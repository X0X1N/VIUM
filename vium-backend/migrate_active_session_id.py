from app.db.session import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            # chargers 테이블에 active_session_id 컬럼 추가
            conn.execute(text("ALTER TABLE chargers ADD COLUMN active_session_id VARCHAR(100) NULL;"))
            conn.commit()
            print("✅ Successfully added 'active_session_id' column to 'chargers' table.")
        except Exception as e:
            print(f"⚠️ Migration error (might already exist): {e}")

if __name__ == "__main__":
    migrate()
