from app.db.session import SessionLocal
from app.models import models

def check():
    db = SessionLocal()
    try:
        nam_stations = db.query(models.Station).filter(models.Station.address.like("%남양주%")).all()
        print(f"Stations with '남양주' in address: {len(nam_stations)}")
        for s in nam_stations:
            print(f"ID: {s.station_id}, Name: {s.station_name}, Addr: {s.address}")
            
        # Delete them if confirmed
        if len(nam_stations) > 0:
            # Delete chargers first
            for s in nam_stations:
                db.query(models.Charger).filter(models.Charger.station_id == s.station_id).delete()
            # Delete stations
            db.query(models.Station).filter(models.Station.address.like("%남양주%")).delete(synchronize_session=False)
            db.commit()
            print("Successfully removed Namyangju data.")
    finally:
        db.close()

if __name__ == "__main__":
    check()
