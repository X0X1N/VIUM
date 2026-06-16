from sqlalchemy.orm import Session
from decimal import Decimal
from ..models import models
from .kepco_api import kepco_client
from ..db.session import SessionLocal
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

def sync_kepco_data(addr: str = "양주시"):
    """
    한전 빅데이터 API로부터 데이터를 가져와 우리 MariaDB에 동기화합니다.
    [중요] '남양주시'가 포함되지 않은 순수 '양주시' 데이터만 선별하여 수집합니다.
    """
    print(f"[Sync] '{addr}' 지역 실제 데이터 동기화 시도...")
    
    external_data = kepco_client.fetch_stations_by_addr(addr)
    if not external_data:
        print("[Sync] 수신된 데이터가 없어 동기화를 중단합니다.")
        return

    db: Session = SessionLocal()
    try:
        count_new_stations = 0
        count_new_chargers = 0
        count_filtered_out = 0
        
        for item in external_data:
            full_addr = item.get("addr", "")
            
            # [섬세한 필터링] '양주시'는 포함하되 '남양주시'는 제외
            if "양주시" not in full_addr or "남양주시" in full_addr:
                count_filtered_out += 1
                continue

            # 1. Station(충전소) 매핑
            station_id = str(item.get("csId"))
            station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
            
            base_price = 340
            
            if not station:
                station = models.Station(
                    station_id=station_id,
                    station_name=item.get("csNm"),
                    address=full_addr,
                    latitude=Decimal(str(item.get("lat"))) if item.get("lat") else Decimal("0"),
                    longitude=Decimal(str(item.get("longi"))) if item.get("longi") else Decimal("0"),
                    price=base_price,
                    isTimeSale=random.choice([True, False]),
                    priceHistory=generate_price_history(base_price),
                    lastSuccessTime="방금 전",
                    distance="-"
                )
                db.add(station)
                db.flush()
                count_new_stations += 1
            else:
                if not station.priceHistory:
                    station.priceHistory = generate_price_history(base_price)
                if not station.lastSuccessTime:
                    station.lastSuccessTime = "업데이트됨"

            # 2. Charger(충전기) 매핑
            charger_id = str(item.get("cpId"))
            charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
            
            raw_stat = str(item.get("cpStat"))
            status_map = {"1": "Available", "2": "Charging"}
            current_status = status_map.get(raw_stat, "Faulty")

            if not charger:
                charger = models.Charger(
                    charger_id=charger_id,
                    station_id=station_id,
                    charger_type="급속" if str(item.get("chargeTp")) == "2" else "완속",
                    connector_type=str(item.get("cpTp")), 
                    status=current_status
                )
                db.add(charger)
                count_new_chargers += 1
            else:
                charger.status = current_status

        db.commit()
        print(f"[Sync] 완료! (신규: {count_new_stations}, 제외(남양주 등): {count_filtered_out})")
        
    except Exception as e:
        db.rollback()
        print(f"[Sync] 데이터 처리 중 오류 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    sync_kepco_data("양주시")
