from app.db.session import SessionLocal, engine
from app.models import models
from sqlalchemy import text

def cleanup():
    db = SessionLocal()
    try:
        # 1. 가짜 충전소 ID 리스트 (KEPCO_001~004 및 수동 YANGJU_001~003)
        mock_station_ids = ["KEPCO_001", "KEPCO_002", "KEPCO_003", "KEPCO_004", "YANGJU_001", "YANGJU_002", "YANGJU_003"]
        
        # 2. 관련 리뷰 삭제
        reviews_deleted = db.query(models.Review).filter(models.Review.station_id.in_(mock_station_ids)).delete(synchronize_session=False)
        
        # 3. 관련 충전기 삭제 (제보가 달려있을 수 있으므로 제보 먼저 처리하거나 Cascade 확인 필요)
        # 현재 Charger 모델에 reports 관계가 있으므로 Charger 삭제 전 Report 처리
        # 하지만 사용자가 '고장제보가 작동 안함'이라고 했으므로 가짜 데이터의 제보는 지워도 무방함
        
        # 가짜 충전소의 충전기 ID 추출
        mock_chargers = db.query(models.Charger).filter(models.Charger.station_id.in_(mock_station_ids)).all()
        mock_charger_ids = [c.charger_id for c in mock_chargers]
        
        # 가짜 충전기의 제보 삭제
        reports_deleted = db.query(models.Report).filter(models.Report.charger_id.in_(mock_charger_ids)).delete(synchronize_session=False)
        
        # 충전기 삭제
        chargers_deleted = db.query(models.Charger).filter(models.Charger.station_id.in_(mock_station_ids)).delete(synchronize_session=False)
        
        # 4. 충전소 삭제
        stations_deleted = db.query(models.Station).filter(models.Station.station_id.in_(mock_station_ids)).delete(synchronize_session=False)
        
        db.commit()
        print(f"Cleanup Successful:")
        print(f"- Stations deleted: {stations_deleted}")
        print(f"- Chargers deleted: {chargers_deleted}")
        print(f"- Reviews deleted: {reviews_deleted}")
        print(f"- Reports deleted: {reports_deleted}")
        
    except Exception as e:
        db.rollback()
        print(f"Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
