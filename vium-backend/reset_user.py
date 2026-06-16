import sys
import os
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models import models

def delete_user(email):
    db = SessionLocal()
    try:
        # 1. 유저 조회
        user = db.query(models.User).filter(models.User.email == email).first()
        
        if not user:
            print(f"❌ User with email '{email}' not found.")
            return

        print(f"⚠️ Found user: {user.nickname} (ID: {user.user_id})")
        print(f"🧹 Deleting associated data (Reviews, Reports, Mileage Logs)...")

        # 2. 연관 데이터 삭제 (Cascading manually if not set in DB)
        db.query(models.Review).filter(models.Review.user_id == user.user_id).delete()
        db.query(models.Report).filter(models.Report.user_id == user.user_id).delete()
        db.query(models.MileageLog).filter(models.MileageLog.user_id == user.user_id).delete()
        
        # 3. 유저 본체 삭제
        db.delete(user)
        db.commit()
        
        print(f"✅ Successfully deleted user '{email}' and all related data.")
        print(f"🚀 Now you can re-register with this email.")

    except Exception as e:
        db.rollback()
        print(f"💥 Error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 reset_user.py <user_email>")
        sys.exit(1)
    
    target_email = sys.argv[1]
    delete_user(target_email)
