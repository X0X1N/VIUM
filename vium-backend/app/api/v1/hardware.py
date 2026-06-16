from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timedelta
import uuid

from ...db.session import get_db
from ...models import models
from ...models.models import get_kst_now
from ...schemas import schemas
from ...utils.redis_sync import update_redis_slots
from ...db.redis_client import update_station_battery
from ...utils.push_handler import trigger_push_notification
from .. import deps

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/claim", response_model=schemas.ActionResponse)
def claim_charger(
    charger_id: str, 
    db: Session = Depends(get_db), 
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional)
):
    """
    [선점 로직] 사용자가 앱에서 특정 충전기를 클릭하면 실행됩니다.
    하드웨어(아두이노)는 누가 충전기를 꽂았는지 알 수 없기 때문에, 
    사용자가 '나 이거 쓸 거야'라고 앱에서 미리 찜(Claim)해두는 단계가 꼭 필요하더라구요.
    """
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # 누가 쓸 건지 ID를 기록해둡니다. (비회원은 일단 9999라는 임시 ID로 관리해요)
    charger.active_user_id = current_user.user_id if current_user else 9999
    
    # 새로운 충전이 시작될 거니까 기존에 물려있던 세션 정보는 깔끔하게 비워줍니다.
    charger.active_session_id = None

    db.commit()
    print(f"🤫 [Secret Claim] Charger {charger_id} locked for User {charger.active_user_id}")
    return {"success": True, "message": "Charger claimed successfully."}

@router.post("/connectors", response_model=schemas.ActionResponse)
def receive_connector_signal(signal: schemas.ConnectorSignal, db: Session = Depends(get_db)):
    """
    아두이노(ESP32)에서 보내는 충전기 연결 및 배터리 상태 신호를 처리하는 핵심 로직입니다.
    센서 데이터가 들어오면 실시간으로 상태를 바꾸고, 조건에 맞으면 푸시 알림도 보내줘요.
    """
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.charger_id).first()
    if not charger:
        print(f"❌ [IoT Error] Charger ID {signal.charger_id} not found.")
        raise HTTPException(status_code=404, detail="Charger not found")

    station = charger.station
    
    # [지능형 주인 찾기] 하드웨어가 직접 유저 정보를 보내지 못하는 한계를 극복하기 위해,
    # 아까 앱에서 '찜(Claim)'해둔 유저 정보를 바탕으로 실제 주인을 매핑합니다.
    effective_user_id = signal.user_id or charger.active_user_id
    effective_is_guest = False
    if effective_user_id == 9999: 
        effective_is_guest = True
        effective_user_id = None

    # 시연할 때 터미널에서 데이터가 잘 들어오는지 한눈에 보이게 이모지를 섞어서 로그를 찍어봤어요.
    print("\n" + "🔌" * 25)
    print(f"📡 [IoT] CONNECTOR SIGNAL: {signal.status} | 🔋 {signal.battery}% | ⚡ {signal.voltage:.2f}V")
    print(f"📍 STATION : {station.station_name if station else 'N/A'}")
    if effective_user_id:
        print(f"👤 MAPPED USER : {effective_user_id}")
    elif effective_is_guest:
        print(f"👤 MAPPED USER : GUEST (9999)")
    print("🔌" * 25 + "\n")

    # [방어적 코딩] 만약 관리자가 직접 '점검 중(Faulty)'으로 바꿨다면, 
    # 센서가 제멋대로 상태를 업데이트하지 못하도록 락(Lock)을 걸어두는 게 중요하더라구요.
    if charger.status == "Faulty":
        print(f"🛡️ [Status Lock] {charger.charger_id} is in 'Faulty' state. Skipping IoT status update.")
        if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
             update_station_battery(charger.station_id, signal.battery, effective_user_id)
        return {"success": True, "message": "Charger is under maintenance. Status update ignored."}

    # 1. Redis에 실시간 배터리 정보를 업데이트하고, 상황에 맞는 푸시 알림을 쏩니다.
    if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
        update_station_battery(charger.station_id, signal.battery, effective_user_id)

        # 지금 이 충전기를 실제로 쓰고 있는 '진짜 세션'을 찾아서 알림을 보내줍니다.
        query = db.query(models.ChargingSession).filter(
            models.ChargingSession.charger_id == charger.charger_id,
            models.ChargingSession.status == "PENDING"
        )
        if effective_user_id:
            query = query.filter(models.ChargingSession.user_id == effective_user_id)
        elif effective_is_guest:
            query = query.filter(models.ChargingSession.is_guest == True)

        active_session = query.order_by(models.ChargingSession.created_at.desc()).first()

        if active_session:
            user_nickname = active_session.user.nickname if active_session.user else "비회원 고객"
            target_soc = active_session.target_soc or 80
            
            # [충전 시작] 알림: 처음 신호가 왔을 때 한 번만 보냅니다.
            if not active_session.is_start_notified:
                title = "⚡ 충전 시작"
                body = f"{user_nickname}님, {station.station_name}에서 충전이 시작되었습니다. 안전하게 충전해 드릴게요!"
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"start-{active_session.order_id}", n_type="INFO")
                active_session.is_start_notified = True
                db.commit()

            # [80% 도달] 알림: 에코 충전 권장 및 매너 출차를 유도하기 위한 단계예요.
            if target_soc > 80 and signal.battery >= 79.5 and not active_session.is_80_notified:
                title = "🔋 배터리 80% 도달"
                body = f"{user_nickname}님, 배터리가 80%에 도달했습니다. 다음 분을 위해 출차를 준비해 주세요!"
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"80-percent-{active_session.order_id}", n_type="WARNING")
                active_session.is_80_notified = True
                db.commit()

            # [목표 완료] 알림: 유저가 설정한 목표치에 도달하면 결제를 유도합니다.
            if signal.battery >= (target_soc - 0.5) and not active_session.is_completed_notified:
                title = f"✅ 목표 충전({target_soc}%) 도달"
                body = f"{user_nickname}님, 설정하신 {target_soc}% 충전이 완료되었습니다. 결제 후 안전하게 출차해 주세요."
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"done-{active_session.order_id}", n_type="SUCCESS")
                active_session.is_completed_notified = True
                db.commit()

    # 2. 센서 값에 따라 충전기의 상태(Available, Charging, Occupied)를 자동으로 전환합니다.
    old_status = charger.status
    new_status = old_status

    if signal.status == "CHARGING":
        new_status = "Charging"
        
        # 선점한 유저 정보를 다시 한번 확인해서 충전기에 확실히 락을 걸어줍니다.
        target_user_id = effective_user_id or (9999 if effective_is_guest else None)
        
        if target_user_id:
            charger.active_user_id = target_user_id
            print(f"🎯 [Direct Mapping Success] Locked for User {target_user_id}")
            
            # 아직 세션이 안 만들어졌더라도(결제 전), 클릭한 주인이 누구인지는 확실히 기억해둬야 
            # 웹 UI에서 팝업이 제때 뜰 수 있더라구요.
            ten_minutes_ago = get_kst_now() - timedelta(minutes=10)
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.user_id == (target_user_id if target_user_id != 9999 else None),
                models.ChargingSession.is_guest == (True if target_user_id == 9999 else False),
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING",
                models.ChargingSession.created_at >= ten_minutes_ago
            ).order_by(models.ChargingSession.created_at.desc()).first()
            
            if active_session:
                charger.active_session_id = active_session.order_id
            else:
                print(f"🔍 [Mapping Notice] User {target_user_id} is claiming this charger. Popup will trigger.")

        # 혹시 선점 정보가 없더라도, 최근 10분 내에 이 충전기를 쓰려고 했던 세션이 있다면 주인을 찾아주는 센스!
        if not target_user_id:
            ten_minutes_ago = get_kst_now() - timedelta(minutes=10)
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING",
                models.ChargingSession.created_at >= ten_minutes_ago
            ).order_by(models.ChargingSession.created_at.desc()).first()
            
            if active_session:
                charger.active_user_id = active_session.user_id or 9999
                charger.active_session_id = active_session.order_id
                print(f"🔗 [Auto Mapping Fallback] Charger {charger.charger_id} -> User:{charger.active_user_id}")
            
    elif signal.status == "CONNECTED":
        # 물리적으로 연결은 됐지만 아직 충전 시작 전인 상태입니다.
        if old_status == "Charging":
            new_status = "Occupied"
                
    elif signal.status == "DISCONNECTED":
        # 커넥터를 뽑으면 '점유 중(주차 중)' 상태로 바꾸고 사용자에게 알림을 줍니다.
        new_status = "Occupied"
        if old_status == "Charging":
            query = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status.in_(["PENDING", "PAID"])
            )
            if effective_user_id: query = query.filter(models.ChargingSession.user_id == effective_user_id)
            elif effective_is_guest: query = query.filter(models.ChargingSession.is_guest == True)
            
            active_session = query.order_by(models.ChargingSession.created_at.desc()).first()
            if active_session:
                user_nickname = active_session.user.nickname if active_session.user else "고객"
                title = "🔌 커넥터 분리 확인"
                body = f"{user_nickname}님, 커넥터가 안전하게 분리되었습니다. 이제 출차해 주세요."
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"disconnect-{active_session.order_id}", n_type="INFO")

    # 상태가 실제로 바뀌었을 때만 DB에 반영하고 Redis 슬롯 정보를 갱신합니다.
    if old_status != new_status:
        charger.status = new_status
        db.commit()
        update_redis_slots(charger.station_id, db)
        print(f"✅ [Status Change] {charger.charger_id}: {old_status} -> {new_status}")

    return {"success": True, "message": "Signal processed successfully."}

@router.post("/cameras", response_model=schemas.ActionResponse)
def receive_camera_signal(signal: schemas.CameraSignal, db: Session = Depends(get_db)):
    """
    라즈베리파이(OpenCV 비전 인식)에서 보내는 주차 점유 신호를 처리합니다.
    차량이 실제로 주차 공간에 들어왔는지, 나갔는지를 판단하는 중요한 데이터예요.
    """
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.parking_space_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Parking space not found")

    print("\n" + "📸" * 25)
    print(f"📡 [IoT] VISION MONITORING SIGNAL")
    print(f"📍 ID      : {signal.parking_space_id}")
    print(f"🚘 PRESENT : {signal.vehicle_present}")
    print(f"🔍 CONF    : {signal.confidence_score}")
    print("📸" * 25 + "\n")

    # 카메라 신호 역시 점검 중인 곳은 무시하도록 안전장치를 걸어두었습니다.
    if charger.status == "Faulty":
        print(f"🛡️ [Vision Lock] {charger.charger_id} is in 'Faulty' state. Ignoring vision signal.")
        return {"success": True, "message": "Charger is under maintenance. Vision signal ignored."}

    old_status = charger.status
    new_status = old_status

    # 비전 인식의 신뢰도(Confidence Score)가 0.7 이상일 때만 상태 변화를 인정하도록 해서 
    # 오탐지를 최소화하려고 노력했습니다.
    if signal.vehicle_present and signal.confidence_score >= 0.7:
        if old_status == "Available":
            new_status = "Occupied"
    elif not signal.vehicle_present and signal.confidence_score >= 0.7:
        new_status = "Available"

    if old_status != new_status:
        charger.status = new_status
        if new_status == "Available":
            # [유령 충전 방지] 차가 완전히 떠나면, 해당 충전기에 묶여있던 모든 주인 정보를 초기화합니다.
            # 이 로직이 없으면 다음 사용자가 왔을 때 데이터가 꼬일 수 있어서 아주 핵심적인 부분이에요!
            last_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PAID"
            ).order_by(models.ChargingSession.paid_at.desc()).first()
            if last_session:
                user_nickname = last_session.user.nickname if last_session.user else "고객"
                title = "🚗 출차 확인 완료"
                body = f"{user_nickname}님, 안전하게 출차되었습니다. 오늘도 즐거운 드라이빙 되세요!"
                trigger_push_notification(db, title, body, user_id=last_session.user_id, session_id=last_session.order_id if last_session.is_guest else None, tag=f"exit-{last_session.order_id}", n_type="SUCCESS")
            
            charger.active_user_id = None
            charger.active_session_id = None

        db.commit()
        update_redis_slots(charger.station_id, db)
        print(f"🚀 [Auto-Transition] {charger.charger_id}: {old_status} -> {new_status}")
        
    return {"success": True, "message": "Camera signal processed."}
