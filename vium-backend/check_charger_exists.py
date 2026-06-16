from app.db.session import SessionLocal
from app.models import models
import sys

def check(cid):
    db = SessionLocal()
    try:
        charger = db.query(models.Charger).filter(models.Charger.charger_id == cid).first()
        if charger:
            print(f"FOUND: {charger.charger_id} at Station {charger.station_id}")
        else:
            print(f"NOT FOUND: {cid}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check(sys.argv[1])
    else:
        print("Usage: python check_charger_exists.py <charger_id>")
