import os
import json
import base64
import uuid
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models import models
from dotenv import load_dotenv

load_dotenv()

def get_clean_private_key():
    """.env의 PEM 형식 비밀키에서 순수 Base64URL 데이터를 추출합니다."""
    raw_key = os.getenv("VAPID_PRIVATE_KEY", "")
    # 1. 실제 줄바꿈 문자로 변환 (이스케이프 해제)
    clean_key = raw_key.replace("\\n", "\n").replace("\"", "")
    # 2. PEM 헤더/푸터 제거
    clean_key = clean_key.replace("-----BEGIN PRIVATE KEY-----", "")\
                         .replace("-----END PRIVATE KEY-----", "")\
                         .replace("\n", "").replace("\r", "").strip()
    return clean_key

# VAPID 설정 가져오기
VAPID_PRIVATE_KEY = get_clean_private_key()
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@vium.com")

def send_test_notification(user_id=None):
    db = SessionLocal()
    try:
        # 1. 대상 구독 정보 가져오기
        query = db.query(models.PushSubscription)
        if user_id:
            query = query.filter(models.PushSubscription.user_id == user_id)
        
        # 가장 최근에 '성공' 가능성이 높은 구독 정보 (최신순)
        sub_record = query.order_by(models.PushSubscription.id.desc()).first()
        
        if not sub_record:
            print("❌ DB에 등록된 구독 정보가 없습니다. 먼저 웹에서 '알림 받기'를 눌러주세요.")
            return

        print(f"🚀 대상 발견: {'회원 ID ' + str(sub_record.user_id) if sub_record.user_id else '비회원(세션: ' + str(sub_record.session_id) + ')'}")
        print(f"📡 Endpoint: {sub_record.endpoint[:40]}...")
        
        # 2. 페이로드(내용) 작성
        test_tag = f"test-{uuid.uuid4().hex[:6]}"
        payload = {
            "title": "⚡ VIUM 테스트 알림",
            "body": "푸시 알림 및 인앱 동기화 테스트입니다.",
            "url": "/",
            "tag": test_tag,
            "type": "SUCCESS",
            "role": "USER"
        }

        # 3. 푸시 발송
        subscription_info = {
            "endpoint": sub_record.endpoint,
            "keys": {
                "p256dh": sub_record.p256dh,
                "auth": sub_record.auth
            }
        }

        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
        )
        print(f"✅ 푸시 알림 발송 성공! (Tag: {test_tag})")
        print("💡 브라우저의 네이티브 알림과 앱 내 알림 목록을 모두 확인하세요.")

    except WebPushException as ex:
        if ex.response and ex.response.status_code in [404, 410]:
            print(f"❌ [Expired]: 만료된 구독입니다. DB에서 삭제를 권장합니다. (Status: {ex.response.status_code})")
        else:
            print(f"💥 발송 실패 (WebPushException): {ex}")
    except Exception as e:
        import traceback
        print(f"💥 상세 에러 로그:\n{traceback.format_exc()}")
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    target_user = int(sys.argv[1]) if len(sys.argv) > 1 else None
    send_test_notification(target_user)
