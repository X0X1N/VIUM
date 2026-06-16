from app.db.session import SessionLocal
from app.models import models

def check():
    db = SessionLocal()
    try:
        stations = db.query(models.Station).limit(5).all()
        print("--- Stations ---")
        for s in stations:
            print(f"ID: {s.station_id}, Name: {s.station_name}")
            for c in s.chargers:
                print(f"  Charger ID: {c.charger_id}, Status: {c.status}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
