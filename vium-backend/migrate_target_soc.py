from app.db.session import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("🔍 Checking if 'target_soc' column exists in 'charging_sessions'...")
        result = conn.execute(text("SHOW COLUMNS FROM charging_sessions LIKE 'target_soc'"))
        if not result.fetchone():
            print("🚀 Adding 'target_soc' column to 'charging_sessions'...")
            conn.execute(text("ALTER TABLE charging_sessions ADD COLUMN target_soc INTEGER DEFAULT 80 AFTER final_amount"))
            conn.commit()
            print("✅ Migration successful!")
        else:
            print("✨ 'target_soc' column already exists.")

if __name__ == "__main__":
    migrate()
