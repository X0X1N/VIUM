from app.db.session import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("🔍 Checking if 'is_start_notified' column exists in 'charging_sessions'...")
        result = conn.execute(text("SHOW COLUMNS FROM charging_sessions LIKE 'is_start_notified'"))
        if not result.fetchone():
            print("🚀 Adding 'is_start_notified' column to 'charging_sessions'...")
            conn.execute(text("ALTER TABLE charging_sessions ADD COLUMN is_start_notified BOOLEAN DEFAULT 0 AFTER is_guest"))
            conn.commit()
            print("✅ Migration successful!")
        else:
            print("✨ 'is_start_notified' column already exists.")

if __name__ == "__main__":
    migrate()
