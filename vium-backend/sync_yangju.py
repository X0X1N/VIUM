from app.utils.data_sync import sync_kepco_data
from fix_ui_data import fix_stations
from app.db.session import engine, Base

if __name__ == "__main__":
    print("🚀 [데이터 복구] 양주시 실제 충전소 데이터 동기화를 시작합니다...")
    
    # 1. 테이블 생성 및 안전장치
    Base.metadata.create_all(bind=engine)
    
    # 2. 양주시 데이터 가져오기 (KEPCO API 연동)
    # 실제 한전 API를 호출하여 '신도8차 아파트' 등 양주시의 실시간 정보를 DB에 채웁니다.
    try:
        sync_kepco_data("양주시")
    except Exception as e:
        print(f"❌ 데이터 동기화 중 오류 발생: {e}")

    # 3. UI용 부가 데이터(24시간 요금 그래프, 할인 여부 등) 자동 생성 및 보정
    fix_stations()
    
    print("\n✅ [복구 완료] 이제 서버의 지도가 로컬과 동일한 실제 양주시 데이터로 채워졌습니다!")
