import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000/api/v1/hardware"
TARGET_ID = "3682"  # 테스트용 신도8차 아파트 1번 충전기 ID

def simulate_arduino_connect():
    print(f"\n[아두이노 전용 시뮬레이션] 🔌 커넥터 연결 신호 전송 준비 중...")
    
    # 아두이노 테스트를 위해서는 웹 UI 조건상 'Occupied(입차)' 상태가 선행되어야 함
    # 따라서, 아두이노 팀원이 테스트할 때 라즈베리파이 신호(입차)를 자동으로 먼저 쏴줌
    print(f"👉 1. (사전 조건 충족) 가상의 라즈베리파이 입차 신호를 보냅니다.")
    cam_data = {"parking_space_id": TARGET_ID, "status": "Occupied", "confidence_score": 0.95}
    requests.post(f"{BASE_URL}/cameras", json=cam_data)
    time.sleep(2)
    
    # 사용자 ID 입력
    try:
        user_input = input("\n👤 타겟 유저 ID를 입력하세요 (전체 방송은 엔터): ").strip()
        user_id = int(user_input) if user_input else None
    except ValueError:
        print("올바른 숫자가 아닙니다. 전체 방송 모드로 진행합니다.")
        user_id = None

    print(f"\n👉 2. ⚡ 아두이노 커넥터 연결 신호를 보냅니다. (웹 화면을 확인하세요!)")
    connector_data = {"charger_id": TARGET_ID, "status": "CONNECTED", "voltage": 3.8, "battery": 78.5}
    if user_id:
        connector_data["user_id"] = user_id
        print(f"🎯 Target User ID: {user_id}")

    try:
        response = requests.post(f"{BASE_URL}/connectors", json=connector_data)
        if response.status_code == 200:
            print("✅ 아두이노 신호 전송 성공!")
            print(f"📡 서버 응답: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        else:
            print(f"❌ 신호 전송 실패 (Status: {response.status_code})")
    except Exception as e:
        print(f"⚠️ 연결 오류: {e}")

if __name__ == "__main__":
    simulate_arduino_connect()
