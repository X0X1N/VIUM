from app.db.session import SessionLocal
from app.models import models

def check_chargers():
    db = SessionLocal()
    try:
        chargers = db.query(models.Charger).all()
        print(f"Chargers Status:")
        for c in chargers:
            print(f"ID: {c.charger_id}, Status: {c.status}, Station: {c.station_id}")
    finally:
        db.close()

if __name__ == "__main__":
    check_chargers()
