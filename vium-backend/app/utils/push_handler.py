import os
import json
import logging
import uuid
from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException
from ..models import models

logger = logging.getLogger(__name__)

def get_clean_private_key():
    """VAPID 프라이빗 키 정제"""
    raw_key = os.getenv("VAPID_PRIVATE_KEY", "")
    clean_key = raw_key.replace("\\n", "\n").replace("\"", "")
    clean_key = clean_key.replace("-----BEGIN PRIVATE KEY-----", "")\
                         .replace("-----END PRIVATE KEY-----", "")\
                         .replace("\n", "").replace("\r", "").strip()
    return clean_key

VAPID_PRIVATE_KEY = get_clean_private_key()
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@vium.com")

def trigger_push_notification(db: Session, title: str, body: str, user_id: int = None, session_id: str = None, tag: str = None, role: str = "USER", n_type: str = "INFO"):
    """지정된 사용자 또는 세션에 푸시 알림을 발송합니다."""
    query = db.query(models.PushSubscription)
    if user_id:
        query = query.filter(models.PushSubscription.user_id == user_id)
    elif session_id:
        query = query.filter(models.PushSubscription.session_id == session_id)
    else:
        return

    subs = query.all()
    # tag가 없으면 랜덤 생성하여 중복 방지 로직 지원
    final_tag = tag or f"vium-{uuid.uuid4().hex[:8]}"
    payload = json.dumps({
        "title": title, 
        "body": body, 
        "url": "/",
        "tag": final_tag,
        "role": role,
        "type": n_type,
        "user_id": user_id,      # [추가]: 클라이언트 측 격리 필터링을 위한 메타데이터
        "session_id": session_id # [추가]: 클라이언트 측 격리 필터링을 위한 메타데이터
    })
    
    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_CLAIMS_EMAIL}
            )
            print(f"🔔 [Auto Push]: Sent to {sub.endpoint[:20]}... (Tag: {final_tag})")
        except WebPushException as e:
            if e.response and e.response.status_code in [404, 410]:
                db.delete(sub)
                db.commit()
            print(f"❌ [Push Failed]: {str(e)}")
