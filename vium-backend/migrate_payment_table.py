import sys
import os
sys.path.append(os.getcwd())

from app.db.session import engine, Base
from app.models import models

def migrate():
    print("🚀 [START] Database Schema Sync: charging_sessions")
    try:
        # ChargingSession 모델이 정의된 Base의 모든 테이블 생성을 시도합니다.
        # 기존 테이블은 건너뛰고 없는 테이블만 생성합니다.
        Base.metadata.create_all(bind=engine)
        print("✅ [SUCCESS] 테이블 생성이 완료되었습니다.")
    except Exception as e:
        print(f"❌ [ERROR] 마이그레이션 실패: {e}")

if __name__ == "__main__":
    migrate()
