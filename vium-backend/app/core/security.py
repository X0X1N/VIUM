import os
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# JWT 설정
SECRET_KEY = os.getenv("SECRET_KEY", "vium_super_secret_key_change_this_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 일주일

# bcrypt 4.x+와 passlib 간의 호환성 이슈 해결을 위해 설정을 보강합니다.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(subject: Union[str, Any]) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증: bcrypt의 72바이트 제한을 고려하여 전처리 후 비교합니다."""
    # Truncate to 72 bytes as per bcrypt spec to avoid errors with very long strings
    safe_password = plain_password[:72]
    return pwd_context.verify(safe_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 해싱: bcrypt 라이브러리의 호환성 버그와 길이 제한을 방어합니다."""
    # Truncate to 72 bytes to prevent "password cannot be longer than 72 bytes" error
    safe_password = password[:72]
    return pwd_context.hash(safe_password)
