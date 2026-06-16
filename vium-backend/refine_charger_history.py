from app.db.session import SessionLocal
from app.models import models
from datetime import datetime, timedelta
import random

def run_targeted_backfill():
    db = SessionLocal()
    # 3682, 3683 호기를 제외한 모든 충전기를 가져옵니다.
    chargers = db.query(models.Charger).filter(
        models.Charger.charger_id.notin_(['3682', '3683'])
    ).all()
    
    count = 0
    now = datetime.now()
    
    print(f"🚀 [Refinement] Starting targeted backfill for {len(chargers)} chargers...")
    
    for charger in chargers:
        # 가중치 기반 시뮬레이션 (현실적인 사용 패턴 생성)
        dice = random.random()
        
        if dice < 0.2:
            # 20% 확률: 매우 최근 (30분 ~ 2시간 전)
            minutes_ago = random.randint(30, 120)
        elif dice < 0.7:
            # 50% 확률: 오늘 중 (3시간 ~ 18시간 전)
            minutes_ago = random.randint(180, 18 * 60)
        else:
            # 30% 확률: 며칠 전 (1일 ~ 3일 전)
            minutes_ago = random.randint(24 * 60, 72 * 60)
            
        charger.last_used_at = now - timedelta(minutes=minutes_ago)
        count += 1
            
    db.commit()
    db.close()
    print(f"✅ [Refinement] Successfully refined history for {count} chargers (3682, 3683 preserved).")

if __name__ == "__main__":
    run_targeted_backfill()
