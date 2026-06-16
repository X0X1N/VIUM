from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import random
import string
from fastapi_mail import MessageSchema, MessageType
from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...core import security
from ...core.mail import fastmail
from ...db.redis_client import redis_client

router = APIRouter()

def generate_verification_code(length=6):
    """이메일 인증을 위한 6자리 랜덤 숫자를 생성합니다."""
    return ''.join(random.choices(string.digits, k=length))

async def send_auth_email(email: str, code: str):
    """
    실제로 유저의 이메일함에 인증 코드를 담은 HTML 메일을 쏴주는 함수예요. 
    비동기 방식으로 작동해서 서버가 멈추지 않게 짰습니다.
    """
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">VIUM 스마트 충전 인증</h2>
        <p>안녕하세요! VIUM 회원가입을 위한 인증 코드입니다.</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px;">
            {code}
        </div>
        <p style="margin-top: 20px;">이 코드는 <b>3분</b> 동안 유효합니다.</p>
        <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #eee; pt-10px; margin-top: 30px;">
            본 메일은 발신 전용입니다. 문의사항은 고객센터를 이용해 주세요.
        </p>
    </div>
    """
    
    message = MessageSchema(
        subject="[VIUM] 회원가입 인증 코드입니다",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )
    
    try:
        await fastmail.send_message(message)
        print(f"✅ [Email Sent] Real email sent to {email}")
    except Exception as e:
        print(f"❌ [Email Failed] Error sending to {email}: {str(e)}")

@router.post("/send-verification", response_model=schemas.ActionResponse)
async def send_verification(
    req: schemas.VerificationRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    이메일 인증 코드를 발송하는 API입니다. 
    메일 발송은 시간이 좀 걸리는 작업이라 BackgroundTasks를 써서 사용자가 바로 응답을 받을 수 있게 배려했어요!
    """
    # 1. 이미 가입된 이메일인지 먼저 확인합니다.
    existing_user = db.query(models.User).filter(models.User.email == req.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 가입되어 있는 이메일입니다.")
    
    code = generate_verification_code()
    
    # [Redis 활용] 인증 코드는 잠깐만 필요한 데이터라 DB에 넣기엔 아깝더라구요. 
    # 그래서 Redis에 딱 3분(180초)만 보관하도록 설정했습니다.
    redis_key = f"signup_code:{req.email}"
    redis_client.setex(redis_key, 180, code)
    
    # 개발할 때 메일함을 매번 확인하기 귀찮아서 터미널에도 로그를 찍어뒀습니다 ㅎㅎ
    print(f"\n📩 [Email Verification] To: {req.email} | Code: {code}\n")
    
    # 실제 메일 발송은 백그라운드에서 조용히 처리!
    background_tasks.add_task(send_auth_email, req.email, code)
    
    return {"success": True, "message": "인증 코드가 실제 이메일로 발송되었습니다. (3분 이내 입력)"}

@router.post("/verify-code", response_model=schemas.ActionResponse)
async def verify_code(req: schemas.VerificationVerify):
    """유저가 입력한 코드가 Redis에 저장된 코드랑 맞는지 확인합니다."""
    redis_key = f"signup_code:{req.email}"
    saved_code = redis_client.get(redis_key)
    
    if not saved_code:
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었거나 존재하지 않습니다.")
    
    if saved_code != req.code:
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")
    
    # 인증에 성공하면 15분 동안 가입이 가능하도록 Redis에 '인증 완료 마크'를 남겨줍니다.
    verified_key = f"verified_email:{req.email}"
    redis_client.setex(verified_key, 900, "true")
    
    # 보안을 위해 사용된 인증 코드는 즉시 삭제해주는 게 좋더라구요.
    redis_client.delete(redis_key)
    
    return {"success": True, "message": "이메일 인증이 완료되었습니다."}

@router.get("/check-nickname", response_model=schemas.ActionResponse)
def check_nickname(nickname: str, db: Session = Depends(get_db)):
    """닉네임이 중복인지 실시간으로 체크합니다. 대소문자도 가리지 않고 깐깐하게 검사해요!"""
    user = db.query(models.User).filter(func.lower(models.User.nickname) == func.lower(nickname)).first()
    if user:
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
    return {"success": True, "message": "사용 가능한 닉네임입니다."}

@router.post("/signup", response_model=schemas.ActionResponse)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    모든 검증을 마치고 실제로 유저를 등록하는 최종 가입 API입니다. 
    프론트엔드에서 보낸 정보가 진짜인지 서버에서 한 번 더 꼼꼼하게 교차 검증을 수행합니다.
    """
    try:
        # [철저한 검증] Redis에 저장된 이메일 인증 기록이 있는지 확인합니다. 
        # 이걸 안 하면 API를 직접 찌르는 가짜 가입을 못 막거든요.
        verified_key = f"verified_email:{user_in.email}"
        if not redis_client.get(verified_key):
            raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다.")
        
        user = db.query(models.User).filter(models.User.email == user_in.email).first()
        if user:
            raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
            
        existing_nickname = db.query(models.User).filter(models.User.nickname == user_in.nickname).first()
        if existing_nickname:
            raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")
        
        # 관리자 초대 코드가 있다면 관리자 권한을 부여합니다. (ViumMaster2026)
        is_admin = False
        if user_in.admin_code:
            admin_invite_code = os.getenv("ADMIN_INVITE_CODE", "ViumMaster2026")
            if user_in.admin_code == admin_invite_code:
                is_admin = True
            else:
                raise HTTPException(status_code=400, detail="잘못된 관리자 초대 코드입니다.")

        # 비밀번호는 당연히 해싱해서 안전하게 저장합니다!
        new_user = models.User(
            email=user_in.email,
            password=security.get_password_hash(user_in.password),
            nickname=user_in.nickname,
            is_admin=is_admin,
            mileage_balance=1000 # 가입 축하 포인트 선물!
        )
        db.add(new_user)
        
        # 포인트 내역에도 가입 축하 로그를 남겨서 기분 좋게 시작해봐요.
        new_log = models.MileageLog(
            user=new_user,
            description="회원가입 축하 포인트",
            amount=1000
        )
        db.add(new_log)
        
        db.commit()
        db.refresh(new_user)
        
        # 가입에 성공했으니 사용했던 인증 마크는 지워줍니다.
        redis_client.delete(verified_key)
        
        return {"success": True, "message": f"{new_user.nickname}님, 환영합니다!"}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        print(f"💥 [Signup Error]: {e}")
        raise HTTPException(status_code=500, detail="서버 DB 오류가 발생했습니다.")

@router.post("/login", response_model=schemas.Token)
def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    """아이디와 비번을 확인해서 JWT 토큰을 발급해줍니다. VIUM 서비스 이용의 시작점이죠!"""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 잘못되었습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 신원 확인이 끝나면 안전한 토큰을 구워줍니다.
    return {
        "access_token": security.create_access_token(user.user_id),
        "token_type": "bearer",
    }
