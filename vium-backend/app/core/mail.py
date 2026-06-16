import os
from fastapi_mail import ConnectionConfig, FastMail
from dotenv import load_dotenv
from pathlib import Path

# 현재 파일(mail.py)의 위치를 기준으로 .env 파일 경로 설정
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# 포트 번호에 따른 보안 방식 자동 설정 (587: TLS/STARTTLS, 465: SSL/TLS)
mail_port = int(os.getenv("MAIL_PORT", 465))
use_ssl = True if mail_port == 465 else False
use_starttls = True if mail_port == 587 else False

# MAIL_FROM이 비어있을 경우 MAIL_USERNAME을 대신 사용 (Pydantic 에러 방지)
mail_from = os.getenv("MAIL_FROM") or os.getenv("MAIL_USERNAME") or "noreply@vium.com"

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=mail_from,
    MAIL_PORT=mail_port,
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.naver.com"),
    MAIL_FROM_NAME="VIUM Smart Charging",
    MAIL_STARTTLS=use_starttls,
    MAIL_SSL_TLS=use_ssl,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

fastmail = FastMail(conf)
