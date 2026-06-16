from app.db.session import SessionLocal, engine
from app.models import models
from sqlalchemy import text

def cleanup():
    db = SessionLocal()
    try:
        # 1. '남양주'가 포함된 충전소 찾기
        nam_stations = db.query(models.Station).filter(models.Station.address.like("%남양주%")).all()
        nam_station_ids = [s.station_id for s in nam_stations]
        
        if not nam_station_ids:
            print("No Namyangju stations found.")
            return

        print(f"Cleaning up {len(nam_station_ids)} stations in Namyangju...")

        # 2. 해당 충전소들에 속한 충전기 ID 추출
        nam_chargers = db.query(models.Charger).filter(models.Charger.station_id.in_(nam_station_ids)).all()
        nam_charger_ids = [c.charger_id for c in nam_chargers]

        # 3. 제약 조건 순서대로 삭제 (Reports -> Reviews -> Chargers -> Stations)
        if nam_charger_ids:
            rep_del = db.query(models.Report).filter(models.Report.charger_id.in_(nam_charger_ids)).delete(synchronize_session=False)
            print(f"- Reports deleted: {rep_del}")

        rev_del = db.query(models.Review).filter(models.Review.station_id.in_(nam_station_ids)).delete(synchronize_session=False)
        print(f"- Reviews deleted: {rev_del}")

        cha_del = db.query(models.Charger).filter(models.Charger.station_id.in_(nam_station_ids)).delete(synchronize_session=False)
        print(f"- Chargers deleted: {cha_del}")

        stn_del = db.query(models.Station).filter(models.Station.station_id.in_(nam_station_ids)).delete(synchronize_session=False)
        print(f"- Stations deleted: {stn_del}")

        db.commit()
        print("Namyangju data cleanup completed successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during Namyangju cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
