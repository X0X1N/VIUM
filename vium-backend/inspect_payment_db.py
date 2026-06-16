import sys
import os
from sqlalchemy import inspect
sys.path.append(os.getcwd())

from app.db.session import engine

def inspect_db():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"📊 현재 존재하는 테이블: {tables}")
    
    if "charging_sessions" in tables:
        columns = [c['name'] for c in inspector.get_columns("charging_sessions")]
        print(f"🔍 'charging_sessions' 테이블 컬럼: {columns}")
    else:
        print("❌ 'charging_sessions' 테이블이 존재하지 않습니다.")

if __name__ == "__main__":
    inspect_db()
