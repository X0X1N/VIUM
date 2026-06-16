from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import uuid
import httpx
import os

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...db.redis_client import get_station_slots, update_station_slots, get_station_battery
from ...utils.image_handler import save_compressed_image
from ...utils.redis_sync import update_redis_slots
from ..deps import get_current_user, get_current_admin_user, get_current_user_optional
from ...utils.push_handler import trigger_push_notification

router = APIRouter()

@router.get("/stations", response_model=List[schemas.Station])
def read_stations(db: Session = Depends(get_db)):
    """등록된 모든 충전소 목록을 가져오는 API입니다. 지도에 마커를 뿌려줄 때 사용해요."""
    stations = db.query(models.Station).all()
    results = []
    for s in stations:
        station_dto = schemas.Station.model_validate(s)
        # 삭제되지 않고 'VISIBLE' 상태인 리뷰들만 골라서 보여줍니다.
        station_dto.reviews = [r for r in station_dto.reviews if r.status == "VISIBLE"]

        # Redis에 저장된 실시간 배터리 정보랑 점유 중인 유저 정보를 가져와서 합쳐줘요.
        # DB 부하를 줄이기 위해 자주 변하는 데이터는 Redis에서 관리하고 있습니다!
        battery_level, active_user_id = get_station_battery(s.station_id)
        station_dto.current_battery = battery_level

        # 현재 충전 중이거나 주차 중인 충전기에 실제 사용자 ID를 연결해주는 로직이에요.
        # 화면에서 누가 사용 중인지 실시간으로 보여주기 위해 꼭 필요하더라구요.
        for charger in station_dto.chargers:
            if charger.status in ["Charging", "Occupied"]:
                # DB에서 가장 따끈따끈한 최신 정보를 찾아서 매핑해줍니다.
                db_charger = next((c for c in s.chargers if c.charger_id == charger.charger_id), None)
                if db_charger:
                    charger.active_user_id = db_charger.active_user_id
                    charger.active_session_id = db_charger.active_session_id

        results.append(station_dto)
    return results

@router.get("/users/me", response_model=schemas.UserProfile)
def read_user_me(current_user: models.User = Depends(get_current_user)):
    """현재 로그인한 내 정보를 가져옵니다. 마이페이지 같은 곳에서 쓰여요."""
    return current_user

@router.delete("/users/me", response_model=schemas.ActionResponse)
def delete_user_me(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """회원 탈퇴를 처리합니다. 유저 정보뿐만 아니라 그동안 쌓인 로그들도 깔끔하게 정리해줘요."""
    try:
        user = db.merge(current_user)
        user_id = user.user_id

        # 외래키 제약 조건 때문에 에러가 날 수 있어서, 연관된 데이터들을 수동으로 먼저 지워줍니다.
        # 마일리지, 리뷰, 제보, 세션 정보 등을 순서대로 싹 지워야 안전하게 탈퇴 처리가 되더라구요.
        db.query(models.MileageLog).filter(models.MileageLog.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Review).filter(models.Review.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Report).filter(models.Report.user_id == user_id).delete(synchronize_session=False)
        db.query(models.ChargingSession).filter(models.ChargingSession.user_id == user_id).delete(synchronize_session=False)
        db.query(models.PushSubscription).filter(models.PushSubscription.user_id == user_id).delete(synchronize_session=False)

        db.delete(user)
        db.commit()
        return {"success": True, "message": "회원 탈퇴가 완료되었습니다."}
    except Exception as e:
        db.rollback()
        # 어디서 에러가 났는지 로그를 남겨두면 나중에 디버깅할 때 진짜 편해요!
        print(f"💥 [Withdrawal Error]: {e}")
        raise HTTPException(status_code=500, detail="탈퇴 처리 중 오류가 발생했습니다.")

@router.post("/stations/{station_id}/reviews", response_model=schemas.RewardResponse)
def create_station_review(
    station_id: str, 
    review_in: schemas.ReviewCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """새로운 리뷰를 작성하고, 작성해준 고마움의 표시로 마일리지를 지급합니다."""
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="충전소를 찾을 수 없습니다.")

    new_review = models.Review(
        station_id=station_id,
        station_name=station.station_name,
        station_address=station.address,
        user_id=current_user.user_id,
        user_name=current_user.nickname,
        rating=review_in.rating,
        content=review_in.content,
        status="VISIBLE"
    )
    db.add(new_review)

    # 리뷰 쓰면 100포인트를 적립해줍니다! 포인트 쌓이는 재미가 있어야 리뷰를 잘 써주실 것 같았어요.
    reward_amount = 100
    current_user.mileage_balance += reward_amount
    db.add(models.MileageLog(
        user_id=current_user.user_id,
        description=f"리뷰 보상: {station.station_name}",
        amount=reward_amount
    ))

    db.commit()
    db.refresh(current_user)

    # 리뷰가 잘 등록됐다고 유저한테 푸시 알림도 쏴줍니다. 실시간 피드백이 중요하니까요!
    trigger_push_notification(db, "✍️ 리뷰 등록 완료", f"{station.station_name} 리뷰가 정상 등록되어 {reward_amount}P가 지급되었습니다.", user_id=current_user.user_id, tag=f"review-{new_review.id}", n_type="SUCCESS")

    return {
        "success": True, 
        "points_added": reward_amount, 
        "total_balance": current_user.mileage_balance, 
        "message": "리뷰가 등록되었습니다."
    }

@router.patch("/reviews/{review_id}", response_model=schemas.ActionResponse)
def update_review(
    review_id: int,
    review_in: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """내가 쓴 리뷰를 수정합니다. 점수나 내용을 고치고 싶을 때 사용해요."""
    review = db.query(models.Review).filter(models.Review.id == review_id, models.Review.user_id == current_user.user_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")

    # 넘어온 데이터가 있을 때만 업데이트해주는 방식으로 짰습니다.
    if review_in.rating is not None:
        review.rating = review_in.rating
    if review_in.content is not None:
        review.content = review_in.content

    db.commit()
    return {"success": True, "message": "리뷰가 수정되었습니다."}

@router.delete("/reviews/{review_id}", response_model=schemas.ActionResponse)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """리뷰를 삭제합니다. 리뷰를 지우면 공정성을 위해 지급했던 마일리지도 다시 회수해요!"""
    review = db.query(models.Review).filter(models.Review.id == review_id, models.Review.user_id == current_user.user_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")

    # 마일리지 회수 로직 (-100P)
    # 어뷰징 방지를 위해 리뷰 삭제 시 포인트를 다시 깎는 정책을 세웠습니다.
    penalty = 100
    current_user.mileage_balance = max(0, current_user.mileage_balance - penalty)
    db.add(models.MileageLog(
        user_id=current_user.user_id,
        description=f"리뷰 삭제 (회수): {review.station_name}",
        amount=-penalty
    ))

    # 소프트 삭제 처리
    review.status = "DELETED"
    db.commit()
    return {"success": True, "message": "리뷰가 삭제되었습니다."}

@router.get("/admin/reviews", response_model=List[schemas.Review])
def read_all_reviews(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin_user)):
    """[관리자 전용] 서비스에 올라온 모든 리뷰를 최신순으로 모아서 보여줍니다. 모니터링용이에요!"""
    return db.query(models.Review).order_by(models.Review.created_at.desc()).all()

@router.patch("/admin/reviews/{review_id}/status", response_model=schemas.ActionResponse)
def update_review_status_admin(
    review_id: int, 
    update_in: schemas.ReviewAdminUpdate, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(get_current_admin_user)
):
    """
    [관리자 전용] 부적절한 리뷰를 숨기거나 다시 복구하는 기능입니다. 
    리뷰가 숨겨지면 유저의 '신뢰도 점수'를 깎아서 클린한 커뮤니티를 유지하려고 노력했습니다.
    """
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")

    if review.status != update_in.status:
        user = db.query(models.User).filter(models.User.user_id == review.user_id).first()
        if user:
            if update_in.status == "HIDDEN" and review.status == "VISIBLE":
                user.trust_score = max(0, user.trust_score - 10) # 나쁜 리뷰는 점수 삭감!
            elif update_in.status == "VISIBLE" and review.status == "HIDDEN":
                user.trust_score = min(100, user.trust_score + 10) # 오해였다면 점수 복구!

    review.status = update_in.status
    db.commit()
    return {"success": True, "message": f"리뷰 상태가 {update_in.status}로 변경되었습니다."}

@router.post("/reports", response_model=schemas.ActionResponse)
async def create_report(
    charger_id: str = Form(...), 
    keyword: str = Form(...), 
    content: str = Form(...), 
    image: Optional[UploadFile] = File(None), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    사용자가 고장 난 충전기를 제보할 때 실행됩니다. 
    현장 사진을 같이 올려주시면 관리자가 판단하기 훨씬 좋겠죠? 
    이미지는 서버 용량을 아끼기 위해 압축해서 저장하는 유틸리티를 만들어 썼습니다.
    """
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="충전기를 찾을 수 없습니다.")

    # 사진 압축 저장 로직
    image_url = save_compressed_image(await image.read(), image.filename) if image else None

    new_report = models.Report(
        user_id=current_user.user_id,
        charger_id=charger_id,
        keyword=keyword,
        content=content,
        image_url=image_url,
        status="PENDING"
    )
    db.add(new_report)
    db.commit()
    return {"success": True, "message": "고장 제보가 접수되었습니다."}

@router.get("/reports", response_model=List[schemas.Report])
def read_all_reports(db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin_user)):
    """[관리자 전용] 접수된 모든 고장 제보들을 확인하는 리스트입니다."""
    return db.query(models.Report).order_by(models.Report.created_at.desc()).all()

@router.patch("/reports/{report_id}", response_model=schemas.ActionResponse)
def update_report_status(
    report_id: int,
    update_in: schemas.ReportUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """
    [관리자 전용] 제보 내용을 확인하고 승인하거나 반려합니다. 
    승인하면 제보자에게 보상 마일리지를 드리고, 충전기 상태를 자동으로 '점검 중'으로 바꿔줘요.
    """
    report = db.query(models.Report).filter(models.Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="제보를 찾을 수 없습니다.")

    if report.status != "PENDING":
        return {"success": False, "message": "이미 처리가 완료된 제보입니다."}

    report.status = update_in.status
    user = db.query(models.User).filter(models.User.user_id == report.user_id).first()

    if user:
        if update_in.status == "APPROVED":
            # 정직한 제보는 500P와 신뢰도 점수를 드립니다!
            reward = 500
            user.mileage_balance += reward
            user.trust_score = min(100, user.trust_score + 5)

            db.add(models.MileageLog(
                user_id=user.user_id,
                description=f"고장 제보 승인 보상: {report.charger_id}",
                amount=reward
            ))
            trigger_push_notification(db, "🛡️ 제보 승인 알림", f"보내주신 제보가 승인되어 {reward}P가 지급되었습니다. (신뢰도 +5점)", user_id=user.user_id)

            # 승인된 충전기는 자동으로 'Faulty(점검 중)' 상태로 전환!
            charger = db.query(models.Charger).filter(models.Charger.charger_id == report.charger_id).first()
            if charger:
                charger.status = "Faulty"
        elif update_in.status == "REJECTED":
            # 허위 제보는 신뢰도 점수를 깎아서 어뷰징을 방어해요.
            user.trust_score = max(0, user.trust_score - 5)
            trigger_push_notification(db, "⚠️ 제보 반려 안내", "보내주신 제보는 확인 결과 이상이 없는 것으로 판명되었습니다. (신뢰도 -5점)", user_id=user.user_id, n_type="INFO")

    db.commit()
    return {"success": True, "message": f"제보가 {update_in.status} 처리되었습니다."}

@router.patch("/chargers/{charger_id}/status", response_model=schemas.ActionResponse)
def update_charger_status_admin(
    charger_id: str,
    update_in: schemas.ChargerStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """관리자 전용: 충전기 상태 수동 변경"""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="충전기를 찾을 수 없습니다.")

    charger.status = update_in.status
    db.commit()
    update_redis_slots(charger.station_id, db)
    return {"success": True, "message": f"충전기 상태가 {update_in.status}로 변경되었습니다."}

@router.post("/stations/{station_id}/complete-charging", response_model=schemas.RewardResponse)
def complete_charging(
    station_id: str,
    req: schemas.ChargingCompleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """충전 및 출차 완료 보상 지급 (서버 사이드 정책 계산)"""
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="충전소를 찾을 수 없습니다.")

    # [마일리지 정책 2026 반영]
    # 1. 해당 유저의 최신 결제 완료 세션 조회
    session = db.query(models.ChargingSession).filter(
        models.ChargingSession.user_id == current_user.user_id,
        models.ChargingSession.station_id == station_id,
        models.ChargingSession.status == "PAID"
    ).order_by(models.ChargingSession.paid_at.desc()).first()

    reward_amount = 0
    reason = "충전 완료 보상"

    if session:
        # 정책 A: 80% 에코 충전 시 기본 500P
        if session.target_soc == 80:
            reward_amount = 500
            reason = "80% 에코 충전 보상"
        else:
            # 80%가 아닌 경우 기본 300P (기존 정책 수용)
            reward_amount = 300

        # 정책 B: 10분(600초) 이내 출차 시 매너 보너스 +100P
        if session.paid_at:
            exit_duration = (datetime.now() - session.paid_at).total_seconds()
            if exit_duration < 600:
                reward_amount += 100
                reason += " + 매너 출차 보너스"
                print(f"✨ [Manner Bonus]: User {current_user.user_id} exited in {exit_duration:.1f}s")
    else:
         # 세션을 찾을 수 없는 경우 (Fall-back)
         reward_amount = req.points if req.points > 0 else 300

    current_user.mileage_balance += reward_amount
    current_user.trust_score = min(100, current_user.trust_score + 2)

    db.add(models.MileageLog(
        user_id=current_user.user_id,
        description=f"{reason}: {station.station_name}",
        amount=reward_amount
    ))

    db.commit()
    db.refresh(current_user)

    # 충전 완료 및 보상 알림 발송
    trigger_push_notification(
        db, "⚡ 보상 적립 완료", 
        f"{reason}으로 {reward_amount}P가 적립되었습니다! (신뢰도 +2점)", 
        user_id=current_user.user_id, 
        tag=f"reward-{station_id}-{datetime.now().strftime('%H%M%S')}", 
        n_type="SUCCESS"
    )

    return {
        "success": True,
        "points_added": reward_amount,
        "total_balance": current_user.mileage_balance,
        "message": f"{reason}이 지급되었습니다."
    }

@router.get("/directions", response_model=schemas.DirectionResponse)
async def get_directions(origin: str, destination: str):
    rest_api_key = os.getenv("KAKAO_REST_API_KEY")
    url = "https://apis-navi.kakaomobility.com/v1/directions"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                url, 
                headers={"Authorization": f"KakaoAK {rest_api_key}"}, 
                params={"origin": origin, "destination": destination, "summary": "false"},
                timeout=10.0
            )
            data = response.json()

            if response.status_code != 200:
                print(f"💥 [Kakao API Error]: {data}")
                raise HTTPException(status_code=response.status_code, detail="카카오 길찾기 API 호출 실패")

            path = []
            if "routes" in data and len(data["routes"]) > 0:
                for section in data["routes"][0]["sections"]:
                    for road in section["roads"]:
                        v = road["vertexes"]
                        for i in range(0, len(v), 2):
                            path.append([v[i], v[i+1]])
                return {"success": True, "path": path, "summary": data["routes"][0]["summary"]}
            else:
                raise HTTPException(status_code=400, detail="경로를 찾을 수 없습니다.")
        except Exception as e:
            print(f"💥 [Directions Error]: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/push/subscribe", response_model=schemas.ActionResponse)
def subscribe_push(
    subscription: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """웹 푸시 구독 정보 저장 (테스트 알림 발송 로직 제거됨)"""
    try:
        existing = db.query(models.PushSubscription).filter(
            models.PushSubscription.endpoint == subscription.endpoint
        ).first()

        if existing:
            existing.p256dh = subscription.p256dh
            existing.auth = subscription.auth
            existing.user_id = current_user.user_id if current_user else None
            existing.session_id = subscription.session_id
        else:
            db.add(models.PushSubscription(
                endpoint=subscription.endpoint,
                p256dh=subscription.p256dh,
                auth=subscription.auth,
                user_id=current_user.user_id if current_user else None,
                session_id=subscription.session_id
            ))
        db.commit()

        return {"success": True, "message": "알림 구독 성공"}
    except Exception as e:
        db.rollback()
        print(f"💥 [Push Sub Error]: {e}")
        raise HTTPException(status_code=500, detail="구독 저장 실패")

@router.delete("/push/unsubscribe", response_model=schemas.ActionResponse)
def unsubscribe_push(endpoint: str, db: Session = Depends(get_db)):
    db.query(models.PushSubscription).filter(models.PushSubscription.endpoint == endpoint).delete()
    db.commit()
    return {"success": True, "message": "해지 완료"}

@router.get("/push/public-key")
def get_push_public_key():
    import base64
    raw_key = os.getenv("VAPID_PUBLIC_KEY", "")
    try:
        base64_content = raw_key.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replace("\n", "").replace("\r", "").strip()
        key_bytes = base64.b64decode(base64_content)
        raw_public_key = key_bytes[-65:] if len(key_bytes) > 65 else key_bytes
        return {"publicKey": base64.urlsafe_b64encode(raw_public_key).decode('utf-8').rstrip('=')}
    except Exception as e:
        return {"publicKey": ""}

