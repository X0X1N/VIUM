from app.db.session import SessionLocal, engine, Base
from app.models import models
from sqlalchemy import text
from decimal import Decimal
from datetime import datetime, timedelta
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

db = SessionLocal()

def seed():
    # 1. 유저 데이터 복구 및 신뢰도 초기화
    user = db.query(models.User).filter(models.User.user_id == 1).first()
    if not user:
        user = models.User(
            user_id=1, 
            email="test@vium.com", 
            password="hashed_password", 
            nickname="최정환", 
            mileage_balance=15700, 
            level="에코 드라이버",
            trust_score=98
        )
        db.add(user)
        db.flush()
    else:
        user.mileage_balance = 15700
        user.trust_score = 98

    # 2. 충전소 및 충전기 데이터 (2026 현실화 요금 반영)
    station_data = [
        {
            "id": "YANGJU_001", "name": "양주시청 공영주차장", "addr": "경기도 양주시 부흥로 1533",
            "lat": "37.7853", "lng": "127.0457", "price": 240, "dist": "0.1km",
            "chargers": [
                {"id": "CH_YJ01_1", "type": "급속", "conn": "DC Combo", "status": "Available"},
                {"id": "CH_YJ01_2", "type": "완속", "conn": "Slow", "status": "Available"}
            ]
        },
        {
            "id": "YANGJU_002", "name": "옥정신도시 중심상가 주차타워", "addr": "경기도 양주시 옥정로 226",
            "lat": "37.8175", "lng": "127.0945", "price": 340, "dist": "4.2km",
            "chargers": [
                {"id": "CH_YJ02_1", "type": "급속", "conn": "DC Combo", "status": "Available"},
                {"id": "CH_YJ02_2", "type": "급속", "conn": "DC Combo", "status": "Charging"}
            ]
        },
        {
            "id": "KEPCO_002", "name": "코엑스 지하주차장 B2", "addr": "서울특별시 강남구 삼성동 159",
            "lat": "37.5113", "lng": "127.0598", "price": 390, "dist": "1.2km",
            "chargers": [
                {"id": "CH_002_1", "type": "초급속", "conn": "DC Combo", "status": "Charging"},
                {"id": "CH_002_2", "type": "초급속", "conn": "DC Combo", "status": "Charging"}
            ]
        }
    ]

    for s_info in station_data:
        station = db.query(models.Station).filter(models.Station.station_id == s_info["id"]).first()
        if not station:
            station = models.Station(
                station_id=s_info["id"],
                station_name=s_info["name"],
                address=s_info["addr"],
                latitude=Decimal(s_info["lat"]),
                longitude=Decimal(s_info["lng"]),
                price=s_info["price"],
                isTimeSale=random.choice([True, False]),
                priceHistory=generate_price_history(s_info["price"]),
                distance=s_info["dist"]
            )
            db.add(station)
        
        for c_info in s_info["chargers"]:
            charger = db.query(models.Charger).filter(models.Charger.charger_id == c_info["id"]).first()
            if not charger:
                charger = models.Charger(
                    charger_id=c_info["id"],
                    station_id=s_info["id"],
                    charger_type=c_info["type"],
                    connector_type=c_info["conn"],
                    status=c_info["status"]
                )
                db.add(charger)

    # 3. 마일리지 활동 내역 복구 (MileageLog)
    if db.query(models.MileageLog).count() == 0:
        logs = [
            {"amount": 500, "desc": "양주시청 충전소 고장 제보 승인", "days": 1},
            {"amount": 100, "desc": "옥정중심상가 리뷰 작성 보상", "days": 2},
            {"amount": 200, "desc": "에코 드라이빙 챌린지 달성", "days": 3},
            {"amount": 50, "desc": "충전 매너 서약 참여", "days": 5}
        ]
        for l in logs:
            db.add(models.MileageLog(
                user_id=1,
                amount=l["amount"],
                description=l["desc"],
                created_at=datetime.utcnow() - timedelta(days=l["days"])
            ))

    # 4. 리뷰 데이터 복구 (Review)
    if db.query(models.Review).count() == 0:
        reviews = [
            {"sid": "YANGJU_001", "content": "양주시청 주차 공간이 넉넉해서 초보자도 충전하기 편해요! 관리도 잘 되어있네요.", "rating": 5},
            {"sid": "YANGJU_002", "content": "중심상가라 식사하는 동안 충전하기 딱 좋습니다. 다만 주말에는 대기가 좀 있네요.", "rating": 4},
            {"sid": "KEPCO_002", "content": "코엑스 지하주차장이 너무 넓어서 찾기 힘들었지만 시설은 최고입니다.", "rating": 4}
        ]
        for r in reviews:
            db.add(models.Review(
                station_id=r["sid"],
                user_id=1,
                user_name="최정환",
                rating=r["rating"],
                content=r["content"],
                status="VISIBLE",
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 10))
            ))

    db.commit()
    print("Database data recovery & seeding completed safely!")

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed()
