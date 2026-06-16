import os
import redis
import json
from dotenv import load_dotenv

load_dotenv()

# Redis 설정 정보 로드
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "vium_redis_pass")

# Redis 클라이언트 생성
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5
)

def get_redis():
    """Redis 클라이언트를 반환하는 헬퍼 함수"""
    try:
        redis_client.ping()
        return redis_client
    except (redis.ConnectionError, redis.TimeoutError) as e:
        print(f"⚠️ Redis connection failed: {e}")
        return None

def update_station_slots(station_id: str, available_slots: int):
    """특정 충전소의 잔여석 정보를 Redis에 기록합니다."""
    try:
        key = f"station:{station_id}:slots"
        redis_client.set(key, available_slots)
    except Exception as e:
        print(f"⚠️ Failed to update Redis slots: {e}")

def get_station_slots(station_id: str, default_val: int):
    """Redis에서 특정 충전소의 최신 잔여석 정보를 가져옵니다."""
    try:
        key = f"station:{station_id}:slots"
        val = redis_client.get(key)
        return int(val) if val is not None else default_val
    except Exception as e:
        print(f"⚠️ Failed to get slots from Redis: {e}")
        return default_val

def update_station_battery(station_id: str, battery_level: float, active_user_id: int = None):
    """특정 충전소에서 현재 충전 중인 차량의 배터리 잔량과 활성 사용자 ID를 기록합니다."""
    try:
        key = f"station:{station_id}:battery"
        data = {
            "battery_level": battery_level,
            "active_user_id": active_user_id
        }
        # 10분 동안 업데이트가 없으면 데이터 삭제 (TTL 설정)
        redis_client.setex(key, 600, json.dumps(data))
    except Exception as e:
        print(f"⚠️ Failed to update Redis battery: {e}")

def get_station_battery(station_id: str):
    """Redis에서 특정 충전소의 실시간 배터리 잔량과 활성 사용자 ID를 가져옵니다."""
    try:
        key = f"station:{station_id}:battery"
        val = redis_client.get(key)
        if val:
            # 하위 호환성을 위해 JSON 파싱 시도
            try:
                data = json.loads(val)
                return data.get("battery_level"), data.get("active_user_id")
            except json.JSONDecodeError:
                # 과거의 단순 float 데이터인 경우
                return float(val), None
        return None, None
    except Exception as e:
        print(f"⚠️ Failed to get battery from Redis: {e}")
        return None, None
