from app.db.session import engine
from sqlalchemy import inspect

def inspect_db():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables found: {tables}")
    
    for table_name in tables:
        print(f"\n--- Columns in {table_name} ---")
        columns = inspector.get_columns(table_name)
        for column in columns:
            print(f"  {column['name']} ({column['type']})")

if __name__ == "__main__":
    inspect_db()
