from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..models import models
from ..core import security

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db), 
    token: str = Depends(oauth2_scheme)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, security.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.user_id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_user_optional(
    db: Session = Depends(get_db), 
    token: Optional[str] = Depends(oauth2_scheme_optional)
) -> Optional[models.User]:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, security.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
        
    user = db.query(models.User).filter(models.User.user_id == int(user_id)).first()
    return user

def get_current_admin_user(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    """관리자 권한 확인 의존성"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    return current_user

