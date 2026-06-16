import sys
import os
from sqlalchemy import text
sys.path.append(os.getcwd())

from app.db.session import engine, Base
from app.models import models

def fix():
    print("🚀 [START] DB 스키마 강제 보정 시작")
    try:
        with engine.connect() as conn:
            # 외래 키 제약 조건 잠시 해제 (MariaDB/MySQL)
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            
            # 잘못된 구조의 기존 테이블 삭제
            print("🗑️ 구버전 'charging_sessions' 테이블 삭제 중...")
            conn.execute(text("DROP TABLE IF EXISTS charging_sessions;"))
            
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            conn.commit()
        
        # 신규 모델 구조로 테이블 다시 생성
        print("🏗️ 신규 모델 기반 테이블 재구축 중...")
        Base.metadata.create_all(bind=engine)
        print("✅ [SUCCESS] 결제 테이블이 최신 구조로 완벽하게 갱신되었습니다.")
        
    except Exception as e:
        print(f"❌ [ERROR] 보정 실패: {e}")

if __name__ == "__main__":
    fix()
