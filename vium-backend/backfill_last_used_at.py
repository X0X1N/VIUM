from app.db.session import SessionLocal
from app.models import models
from datetime import datetime, timedelta
import random

def backfill():
    db = SessionLocal()
    chargers = db.query(models.Charger).all()
    
    count = 0
    now = datetime.now()
    
    for charger in chargers:
        if random.random() < 0.7:
            minutes_ago = random.randint(1, 5 * 24 * 60)
            charger.last_used_at = now - timedelta(minutes=minutes_ago)
            count += 1
            
    db.commit()
    db.close()
    print(f"✅ Successfully backfilled 'last_used_at' for {count} chargers.")

if __name__ == "__main__":
    backfill()