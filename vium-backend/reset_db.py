from app.db.session import engine, Base
from app.models import models
from app.utils.data_sync import sync_kepco_data
from fix_ui_data import fix_stations

def run_total_reset():
    print("\n🚀 [VIUM] System Restoration Starting...")
    print("-" * 50)

    try:
        # 1. DB 초기화 (가장 안전한 방식)
        print("🧹 [STEP 1] Database tables resetting...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("✅ Database structure is now clean and up-to-date.")

        # 2. 양주시 실제 데이터 동기화
        print("\n📡 [STEP 2] Fetching real-world Yangju data (KEPCO API)...")
        # 이 과정에서 '신도8차 아파트' 등 실제 ID(3682 등) 데이터가 생성됩니다.
        sync_kepco_data("양주시")
        print("✅ Real-world data synced successfully.")

        # 3. UI 보정 작업
        print("\n✨ [STEP 3] Optimizing data for UI rendering...")
        fix_stations()
        print("✅ UI optimization complete.")

        print("-" * 50)
        print("🎉 [SUCCESS] Your server is now perfectly synced with local data!")
        print("📍 You can now see 'Sindo 8th Apt' on the map after refreshing.")

    except Exception as e:
        print(f"\n❌ [ERROR] Restoration failed: {e}")
        print("Please check your .env file for KEPCO_API_KEY or database permissions.")

if __name__ == "__main__":
    run_total_reset()
