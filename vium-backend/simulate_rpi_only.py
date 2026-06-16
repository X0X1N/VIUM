import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1/hardware"
TARGET_ID = "3682"

def simulate_rpi_arrival():
    print(f"\n[라즈베리파이 전용 시뮬레이션] 🚗 차량 입차 감지 신호 전송")
    print(f"👉 웹 지도에서 {TARGET_ID}번 마커가 '파란색(Available)' -> '주황색(Occupied)'으로 바뀌는지 확인하세요.")
    
    cam_data = {"parking_space_id": TARGET_ID, "status": "Occupied", "confidence_score": 0.92}
    try:
        response = requests.post(f"{BASE_URL}/cameras", json=cam_data)
        if response.status_code == 200:
            print("✅ 라즈베리파이 입차 신호 전송 성공!")
            print(f"📡 서버 응답: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        else:
            print(f"❌ 신호 전송 실패 (Status: {response.status_code})")
    except Exception as e:
        print(f"⚠️ 연결 오류: {e}")

if __name__ == "__main__":
    simulate_rpi_arrival()
