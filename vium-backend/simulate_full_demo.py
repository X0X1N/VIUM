import requests
import time
import json

# [최종 정밀 보정] 주소값 오타 및 인코딩 점검 완료
BASE_URL = "http://127.0.0.1:8000/api/v1"
TARGET_ID = "3682"

def check_sync():
    try:
        # localhost 대신 127.0.0.1 사용하여 해석 속도 향상
        url = f"{BASE_URL}/stations"
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            for s in data:
                for c in s['chargers']:
                    if c['charger_id'] == TARGET_ID:
                        return c['status'], s.get('current_battery')
        else:
            print(f"⚠️ API Status Code: {resp.status_code}")
    except Exception as e:
        print(f"❌ Connection Error: {e}")
    return None, None

print("\n🚀 [START] Full-Stack Live Integration Test")
print("-" * 50)

# 1. 초기 점검
status, bat = check_sync()
print(f"[PRE-CHECK] ID:{TARGET_ID} | Status:{status} | Bat:{bat}")

# 2. 라즈베리파이 입차 신호 (Vision)
print("\n📡 [STEP 1] Vision Signal: Vehicle Arrived")
payload = {"parking_space_id": TARGET_ID, "vehicle_present": True, "confidence_score": 0.85}
requests.post(f"{BASE_URL}/hardware/cameras", json=payload)
time.sleep(1)

# 3. 아두이노 연결 신호 (Sensor)
print("📡 [STEP 2] Sensor Signal: Connector Plugged (Battery 78%)")
payload = {"charger_id": TARGET_ID, "status": "CONNECTED", "battery": 78.0, "voltage": 4.1}
requests.post(f"{BASE_URL}/hardware/connectors", json=payload)
time.sleep(2)

# 4. 최종 결과 확인
final_status, final_bat = check_sync()
print("\n" + "="*40)
print(f"📊 [FINAL RESULT]")
print(f"📍 Station ID : {TARGET_ID}")
print(f"🔄 Web Status : {final_status} (Expected: Charging)")
print(f"🔋 Web Battery: {final_bat}% (Expected: 78.0%)")
print("="*40)

if final_status == "Charging" and final_bat == 78.0:
    print("\n✅ [ALL GREEN] 하드웨어-웹 실시간 연동이 완벽하게 검증되었습니다!")
else:
    print("\n❌ [FAIL] 데이터 정합성 불일치 발생. 서버 로그를 확인하십시오.")
