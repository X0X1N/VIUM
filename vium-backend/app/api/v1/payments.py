from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import httpx
import base64
from datetime import datetime

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ..deps import get_current_user_optional
from ...utils.push_handler import trigger_push_notification

router = APIRouter()

# [토스페이먼츠 시크릿 키] 
# 실제 결제 승인을 요청할 때 필요한 비밀 키입니다. 보안이 중요해서 원래는 .env에 두는 게 맞지만, 
# 시연의 편의를 위해 테스트 키를 변수로 잡아두었습니다.
TOSS_SECRET_KEY = "test_sk_4yKeq5bgrpymjvLQz9QA8GX0lzW6"

@router.post("/create-session", response_model=schemas.ChargingSession)
async def create_payment_session(
    session_data: schemas.ChargingSessionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    충전 시작 전, 결제를 위한 일회성 '세션'을 미리 만들어둡니다. 
    사용자마다 고유한 order_id(UUID)를 발급해서 결제 정보가 섞이지 않게 하는 게 포인트예요!
    """
    try:
        # 중복될 일이 거의 없는 무작위 ID를 생성합니다.
        order_id = str(uuid.uuid4())
        
        new_session = models.ChargingSession(
            user_id=current_user.user_id if current_user else None,
            station_id=session_data.station_id,
            charger_id=session_data.charger_id,
            total_price=session_data.total_price,
            used_mileage=session_data.used_mileage if current_user else 0,
            final_amount=session_data.final_amount,
            target_soc=session_data.target_soc, # 사용자가 몇 %까지 충전할지 목표치를 기억해둬요.
            order_id=order_id,
            status="PENDING", # 아직 돈 내기 전이니까 PENDING!
            is_guest=True if not current_user else False
        )
        db.add(new_session)
        
        # [격리 보안] 이 충전기는 지금 이 사용자가 선점했다는 걸 확실히 표시해줍니다.
        charger = db.query(models.Charger).filter(models.Charger.charger_id == session_data.charger_id).first()
        if charger:
            charger.active_session_id = order_id
            if current_user:
                charger.active_user_id = current_user.user_id

        db.commit()
        db.refresh(new_session)
        print(f"💰 [Payment Session]: Created Order ID {order_id} (Target: {session_data.target_soc}%)")
        return new_session
    except Exception as e:
        db.rollback()
        print(f"💥 [Session Error]: {e}")
        raise HTTPException(status_code=500, detail="결제 세션 생성 실패")

@router.patch("/sessions/{order_id}", response_model=schemas.ChargingSession)
async def update_payment_session(
    order_id: str,
    session_data: schemas.ChargingSessionCreate,
    db: Session = Depends(get_db)
):
    """
    충전 도중에 목표가 바뀌거나 최종 요금이 확정되면, 
    미리 만들어둔 세션 정보를 최신 데이터로 덮어씌워 갱신해줍니다.
    """
    session = db.query(models.ChargingSession).filter(models.ChargingSession.order_id == order_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    
    session.total_price = session_data.total_price
    session.used_mileage = session_data.used_mileage
    session.final_amount = session_data.final_amount
    session.target_soc = session_data.target_soc
    
    db.commit()
    db.refresh(session)
    print(f"🔄 [Session Updated]: {order_id} -> Amount: {session.final_amount}, Mileage: {session.used_mileage}, Target: {session.target_soc}%")
    return session

@router.post("/confirm", response_model=schemas.ActionResponse)
async def confirm_payment(
    confirm_data: schemas.ChargingSessionConfirm,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """
    사용자가 카드 결제를 마치면 토스 서버에 최종적으로 '승인'을 요청하는 아주 중요한 API예요.
    승인이 나면 마일리지도 깎고, 충전기 사용 기록도 업데이트하고, 푸시 알림까지 쏴줍니다!
    """
    print(f"💳 [Confirm Request]: Order ID {confirm_data.orderId}")
    
    payment_session = db.query(models.ChargingSession).filter(
        models.ChargingSession.order_id == confirm_data.orderId
    ).first()

    if not payment_session:
        print(f"❌ [Confirm Error]: Order ID {confirm_data.orderId} not found in DB.")
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
    if payment_session.status == "PAID":
        return {"success": True, "message": "이미 완료된 결제입니다."}

    # 토스페이먼츠 서버와 통신할 때 필요한 인증 헤더를 준비합니다. (Basic Auth 방식)
    auth_str = f"{TOSS_SECRET_KEY}:"
    encoded_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.tosspayments.com/v1/payments/confirm",
                json={"paymentKey": confirm_data.paymentKey, "orderId": confirm_data.orderId, "amount": confirm_data.amount},
                headers={"Authorization": f"Basic {encoded_auth}", "Content-Type": "application/json", "TossPayments-Version": "2024-06-01"},
                timeout=15.0
            )
            # 이미 처리된 건이라면 에러로 처리하지 않고 그냥 넘어가게끔 예외 처리를 해뒀어요.
            if response.status_code != 200 and response.json().get("code") != "ALREADY_PROCESSED_PAYMENT":
                print(f"❌ [Toss Reject]: {response.text}")
                raise HTTPException(status_code=400, detail="토스 승인 실패")
        except Exception as e:
            print(f"💥 [Toss Network Error]: {e}")
            raise HTTPException(status_code=503, detail="통신 장애")

    # [결제 완료 후 정산 처리] 돈이 정상적으로 나갔으니 이제 시스템 정보를 업데이트합니다.
    try:
        payment_session.status = "PAID"
        payment_session.paid_at = datetime.now()
        payment_session.payment_key = confirm_data.paymentKey
        
        # 이 충전기가 마지막으로 정상 작동한 시간을 기록해서 다른 유저들에게 '안심 지표'로 보여줍니다.
        charger = db.query(models.Charger).filter(models.Charger.charger_id == payment_session.charger_id).first()
        if charger:
            charger.last_used_at = payment_session.paid_at

        # [마일리지 차감] 사용자가 마일리지를 썼다면 잔액에서 깎아주고 로그를 남깁니다.
        if payment_session.user_id and payment_session.used_mileage > 0:
            user = db.query(models.User).filter(models.User.user_id == payment_session.user_id).first()
            if user:
                before_balance = user.mileage_balance
                # 잔액보다 더 많이 깎이지 않도록 max(0, ...) 처리를 해주는 센스!
                user.mileage_balance = max(0, user.mileage_balance - payment_session.used_mileage)
                after_balance = user.mileage_balance
                
                db.add(models.MileageLog(
                    user_id=user.user_id,
                    description=f"충전 요금 결제 할인 사용: {payment_session.station_id}",
                    amount=-(before_balance - after_balance)
                ))
                print(f"📉 [Mileage Deduction]: User:{user.user_id} | {before_balance}P -> {after_balance}P (Used:{payment_session.used_mileage}P)")

        db.commit()
        
        print(f"✅ [Payment Success]: {confirm_data.orderId} is now PAID. Triggering Notification...")
        
        # 결제가 끝났으니 유저 휴대폰으로 축하 알림을 쏴줍니다 ㅎㅎ
        trigger_push_notification(
            db, "💳 결제 및 충전 승인 완료", 
            "안전하게 충전이 완료되었습니다. 이용해 주셔서 감사합니다!",
            user_id=payment_session.user_id,
            session_id=payment_session.order_id if payment_session.is_guest else None,
            tag=f"paid-{payment_session.order_id}",
            n_type="SUCCESS"
        )
        
        return {"success": True, "message": "결제 승인 및 정산 완료"}
    except Exception as e:
        db.rollback()
        print(f"💥 [Settlement Error]: {e}")
        raise HTTPException(status_code=500, detail="정산 처리 오류")

