from app.db.session import SessionLocal
from app.models import models
import random

def generate_price_history(base_price):
    history = []
    for hour in range(24):
        # 전통적 부하(Peak-load) 모델 반영: 점심/저녁 피크, 심야 저가
        if 23 <= hour or hour <= 7: 
            # 심야/새벽 경부하 (가장 저렴)
            price = base_price - random.randint(60, 80)
        elif (11 <= hour <= 13) or (18 <= hour <= 20):
            # 점심 및 저녁 피크 시간대 (가장 비쌈)
            price = base_price + random.randint(50, 70)
        elif (8 <= hour <= 10) or (14 <= hour <= 17) or (21 <= hour <= 22):
            # 중간 부하 시간대
            price = base_price + random.randint(-10, 10)
        else:
            price = base_price
        history.append(price)
    return history

def fix_stations():
    db = SessionLocal()
    try:
        stations = db.query(models.Station).all()
        updated_count = 0
        for s in stations:
            # 모든 충전소의 가격 및 그래프를 표준 피크 모델(340원 기준)로 강제 업데이트
            s.price = 340
            s.priceHistory = generate_price_history(340)
            
            if not s.lastSuccessTime or s.lastSuccessTime == "정보 없음":
                s.lastSuccessTime = "방금 전"
            if s.isTimeSale is None:
                s.isTimeSale = random.choice([True, False])
            
            updated_count += 1
        
        db.commit()
        print(f"Successfully fixed {updated_count} stations for UI rendering.")
    except Exception as e:
        print(f"Error fixing stations: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_stations()
