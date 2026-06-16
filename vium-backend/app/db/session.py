import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# .env 파일 로드
load_dotenv()

# 데이터베이스 연결 URL (기본값은 SQLite로 두어 최소한의 안전장치 마련)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./vium.db")

# MariaDB/MySQL 연결 시 'pool_pre_ping'을 설정하여 연결 끊김 방지 (안정성 강화)
if SQLALCHEMY_DATABASE_URL.startswith("mysql"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        pool_pre_ping=True,
        pool_recycle=3600
    )
else:
    # SQLite 호환성 유지 (필요 시)
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB 세션 의존성 주입용 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
