import sys
from app.db.session import SessionLocal
from app.models import models
import uuid

def create_test_session(charger_id, user_id, target_soc):
    db = SessionLocal()
    try:
        order_id = str(uuid.uuid4())
        new_session = models.ChargingSession(
            user_id=user_id,
            station_id="1225", # Coex
            charger_id=charger_id,
            total_price=5000,
            used_mileage=0,
            final_amount=5000,
            target_soc=target_soc,
            order_id=order_id,
            status="PENDING",
            is_guest=False
        )
        db.add(new_session)
        db.commit()
        print(f"Created test session: OrderID={order_id}, TargetSOC={target_soc}")
    finally:
        db.close()

if __name__ == "__main__":
    charger_id = "3682"
    user_id = 2
    target_soc = int(sys.argv[1]) if len(sys.argv) > 1 else 90
    create_test_session(charger_id, user_id, target_soc)
