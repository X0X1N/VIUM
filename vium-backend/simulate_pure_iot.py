import requests
import sys

# [설정] 서버 주소 (로컬 및 서버 내부 테스트용)
SERVER_ROOT = "http://localhost:8000/api/v1/hardware"

def send_connector(charger_id, status):
    """아두이노(커넥터) 신호를 시뮬레이션합니다."""
    url = f"{SERVER_ROOT}/connectors"
    payload = {
        "charger_id": charger_id,
        "status": status,
        "voltage": 4.10 if status == "CHARGING" else 3.70,
        "battery": 55,
        "user_id": None,   # 유저 정보 미포함 (순수 하드웨어 모드)
        "is_guest": False
    }
    try:
        resp = requests.post(url, json=payload, timeout=5)
        print(f"🔌 [Connector] {status} -> HTTP {resp.status_code}")
    except Exception as e:
        print(f"❌ Connector Signal Error: {e}")

def send_camera(parking_id, present):
    """라즈베리파이(카메라) 차량 점유 신호를 시뮬레이션합니다."""
    url = f"{SERVER_ROOT}/cameras"
    payload = {
        "parking_space_id": parking_id,
        "vehicle_present": present,
        "confidence_score": 1.0
    }
    try:
        resp = requests.post(url, json=payload, timeout=5)
        status_msg = "ENTRANCE (입차)" if present else "EXIT (출차/리셋)"
        print(f"📸 [Camera] {status_msg} -> HTTP {resp.status_code}")
    except Exception as e:
        print(f"❌ Camera Signal Error: {e}")

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 VIUM Full-Stack Pure Hardware Simulator v3.4")
    print("="*50)
    
    target_id = input("🎯 Enter Target ID (e.g., 3682): ").strip()
    if not target_id:
        print("❌ Target ID is required.")
        sys.exit(1)
    
    print(f"\n[Target: {target_id}] 시연 명령을 선택하세요:")
    print("1: 🚘 입차 (지도 마커 주황색 변경)")
    print("2: 🔌 연결 (CONNECTED - 대기)")
    print("3: ⚡ 충전 (CHARGING - 팝업 트리거)")
    print("4: 🚫 해제 (DISCONNECTED - 알림 발생)")
    print("5: ✨ 출차 (지도 마커 파란색 복구 및 데이터 소거)")
    print("-" * 50)
    print("q: 종료 (QUIT)")

    while True:
        cmd = input(f"\n>> [{target_id}] Command: ").strip().lower()
        
        if cmd == '1':
            send_camera(target_id, True)
        elif cmd == '2':
            send_connector(target_id, "CONNECTED")
        elif cmd == '3':
            send_connector(target_id, "CHARGING")
        elif cmd == '4':
            send_connector(target_id, "DISCONNECTED")
        elif cmd == '5':
            send_camera(target_id, False)
        elif cmd == 'q':
            print("👋 Simulator terminated.")
            break
        else:
            print("⚠️ Invalid command. Please select 1-5 or q.")
