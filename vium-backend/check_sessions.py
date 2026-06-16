from app.db.session import SessionLocal
from app.models import models
from sqlalchemy import desc

def check_latest_sessions():
    db = SessionLocal()
    try:
        sessions = db.query(models.ChargingSession).order_by(desc(models.ChargingSession.created_at)).limit(5).all()
        print(f"Latest 5 Charging Sessions:")
        for s in sessions:
            print(f"ID: {s.session_id}, OrderID: {s.order_id}, User: {s.user_id}, Charger: {s.charger_id}, Status: {s.status}, Target SOC: {s.target_soc}, Start Notified: {s.is_start_notified}, 80% Notified: {s.is_80_notified}, Completed Notified: {s.is_completed_notified}")
    finally:
        db.close()

if __name__ == "__main__":
    check_latest_sessions()
