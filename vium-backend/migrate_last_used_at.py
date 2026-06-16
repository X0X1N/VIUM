from app.db.session import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE chargers ADD COLUMN last_used_at DATETIME NULL;"))
            conn.commit()
            print("✅ Successfully added 'last_used_at' column to 'chargers' table.")
        except Exception as e:
            print(f"⚠️ Migration error (might already exist): {e}")

if __name__ == "__main__":
    migrate()