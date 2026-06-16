from sqlalchemy.orm import Session
import logging
from ..models import models
from ..db.redis_client import update_station_slots

logger = logging.getLogger(__name__)

def update_redis_slots(station_id: str, db: Session):
    """
    DB에서 해당 충전소의 사용 가능한 충전기(Available) 수를 계산하여 Redis에 업데이트합니다.
    이 작업은 웹 화면의 잔여석 숫자를 실시간으로 변경하는 트리거가 됩니다.
    """
    try:
        available_count = db.query(models.Charger).filter(
            models.Charger.station_id == station_id,
            models.Charger.status == "Available"
        ).count()
        update_station_slots(station_id, available_count)
        logger.info(f"Redis updated for station {station_id}: {available_count} slots available")
    except Exception as e:
        logger.error(f"Failed to update Redis slots for station {station_id}: {e}")
