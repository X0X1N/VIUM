import requests
import json
import time

# --- 자동 환경 감지 및 설정 ---
def get_base_url():
    print("\n--- [VIUM IoT Simulator Environment] ---")
    print("1. Local Environment (http://127.0.0.1:8000)")
    print("2. Production Server (https://vium-project.duckdns.org)")
    print("3. Custom IP/Domain")
    
    choice = input("\nSelect Environment >> ").strip()
    
    if choice == '2':
        return "https://vium-project.duckdns.org/api/v1/hardware"
    elif choice == '3':
        custom_url = input("Enter API Base URL (ex: http://1.2.3.4:8000) >> ").strip()
        return f"{custom_url}/api/v1/hardware"
    else:
        return "http://127.0.0.1:8000/api/v1/hardware"

BASE_URL = get_base_url()

def send_camera(target_id, present):
    url = f"{BASE_URL}/cameras"
    payload = {
        "parking_space_id": target_id,
        "vehicle_present": present,
        "confidence_score": 0.85
    }
    try:
        # SSL 인증서 검증 무시 (DuckDNS 등 자가서명 대비)
        resp = requests.post(url, json=payload, verify=False)
        print(f"📸 Vision Signal ({target_id}): {'Arrived' if present else 'Left'} -> {resp.json().get('message')}")
    except Exception as e:
        print(f"❌ Camera Sync Error: {e}")

def send_connector(target_id, status, battery=None, user_id=None, is_guest=False):
    url = f"{BASE_URL}/connectors"
    payload = {
        "charger_id": target_id,
        "status": status,
        "battery": int(battery) if battery is not None else 0,
        "voltage": 3.0 + (1.2 * battery / 100.0) if battery is not None else 0.0,
        "user_id": user_id,
        "is_guest": is_guest
    }

    try:
        resp = requests.post(url, json=payload, verify=False)
        print(f"🔌 Connector Signal ({target_id}): {status} ({battery if battery is not None else 0}%) [User: {user_id}] -> {resp.json().get('message')}")
    except Exception as e:
        print(f"❌ Connector Sync Error: {e}")

if __name__ == "__main__":
    print("\n" + "="*45)
    print("🚀 VIUM Full-Stack Demo Simulator v2.0")
    print("="*45)
    print("💡 하드웨어-서버-웹의 통합 시나리오를 검증합니다.")
    print(f"📡 Target API: {BASE_URL}")
    
    target_charger_id = input("\nEnter Target Charger ID (Default: 3682): ").strip()
    if not target_charger_id:
        target_charger_id = "3682"

    active_user_id = None
    is_guest_mode = False
    
    user_input = input("\nEnter Target User ID (Empty for Guest Mode): ").strip()
    if user_input:
        active_user_id = int(user_input)
        is_guest_mode = False
        print(f"👤 Mode: Member (ID: {active_user_id})")
    else:
        is_guest_mode = True
        print(f"👤 Mode: Guest (Order ID 기반)")

    while True:
        print(f"\n--- [1. Vision AI Signal] ---")
        print("1. Vehicle Arrived (입차: 주황색 점유 상태로 변경)")
        print("2. Vehicle Left    (퇴거: 파란색 사용가능 상태로 복구)")
        print(f"\n--- [2. Charger Sensor Signal] ---")
        print("3. Start Charging  (충전기 연결: 웹 화면에 '충전 시작하기' 팝업 트리거)")
        print("4. Update Battery  (충전 중 배터리 수치 실시간 전송)")
        print("5. Stop Charging   (충전기 분리: 웹 화면 '커넥터 분리 확인' 단계로 전환)")
        print("\nq. Quit")
        
        choice = input("\nAction >> ").strip().lower()
        
        if choice == '1':
            send_camera(target_charger_id, True)
        elif choice == '2':
            send_camera(target_charger_id, False)
        elif choice == '3':
            try:
                bat = float(input("Enter Initial Battery % (Default 30.0): ") or 30.0)
                # [중요]: 실제 아두이노 로직과 동일하게 CHARGING 신호를 보내야 웹 UI가 팝업됩니다.
                send_connector(target_charger_id, "CHARGING", battery=bat, user_id=active_user_id, is_guest=is_guest_mode)
                print(f"\n✨ [Magic Moment] 웹 화면에 충전 시작 화면이 나타났는지 확인하세요!")
            except ValueError:
                print("Invalid value.")
        elif choice == '4':
            try:
                bat = float(input("Update Current Battery % >> "))
                send_connector(target_charger_id, "CHARGING", battery=bat, user_id=active_user_id, is_guest=is_guest_mode)
            except ValueError:
                print("Invalid value.")
        elif choice == '5':
            # 충전기를 뽑으면 다시 CONNECTED(대기) 상태가 되며, 서버는 이를 '출차 대기'로 인식합니다.
            send_connector(target_charger_id, "CONNECTED", battery=0, user_id=active_user_id, is_guest=is_guest_mode)
            print("\n✅ 커넥터가 분리되었습니다. 웹 화면의 변화를 확인하세요.")
        elif choice == 'q':
            break
