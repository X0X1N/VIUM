from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, DECIMAL, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta, timezone
from ..db.session import Base

# 한국 표준시(KST) 정의
KST = timezone(timedelta(hours=9))

def get_kst_now():
    return datetime.now(KST)

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    nickname = Column(String(50))
    is_admin = Column(Boolean, default=False)
    mileage_balance = Column(Integer, default=0)
    level = Column(String(50), default="에코 드라이버")
    # 신규: 악성 유저 관리를 위한 신뢰도 점수 (추후 확장용)
    trust_score = Column(Integer, default=100) 
    created_at = Column(DateTime, default=get_kst_now)

    reviews = relationship("Review", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    mileage_logs = relationship("MileageLog", back_populates="user", order_by="desc(MileageLog.created_at)", cascade="all, delete-orphan")
    charging_sessions = relationship("ChargingSession", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")

class Station(Base):
    __tablename__ = "stations"
    station_id = Column(String(50), primary_key=True)
    station_name = Column(String(100), index=True)
    address = Column(String(200))
    latitude = Column(DECIMAL(10, 7))
    longitude = Column(DECIMAL(10, 7))
    price = Column(Integer, default=340)
    isTimeSale = Column(Boolean, default=False)
    priceHistory = Column(JSON) 
    lastSuccessTime = Column(String(50), default="방금 전")
    distance = Column(String(20))

    chargers = relationship("Charger", back_populates="station", lazy="joined")
    # 리뷰 조회 시 조건부 렌더링을 위해 lazy='joined' 유지
    reviews = relationship("Review", back_populates="station", lazy="joined")
    charging_sessions = relationship("ChargingSession", back_populates="station")

class Charger(Base):
    __tablename__ = "chargers"
    charger_id = Column(String(50), primary_key=True)
    station_id = Column(String(50), ForeignKey("stations.station_id"))
    charger_type = Column(String(20)) 
    connector_type = Column(String(50)) 
    status = Column(String(20), default="Available") 
    active_user_id = Column(Integer, nullable=True)
    active_session_id = Column(String(100), nullable=True)
    last_used_at = Column(DateTime, nullable=True)

    station = relationship("Station", back_populates="chargers")
    reports = relationship("Report", back_populates="charger")
    charging_sessions = relationship("ChargingSession", back_populates="charger")

class ChargingSession(Base):
    __tablename__ = "charging_sessions"
    session_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    station_id = Column(String(50), ForeignKey("stations.station_id"))
    charger_id = Column(String(50), ForeignKey("chargers.charger_id"))
    
    total_price = Column(Integer, nullable=False) # 마일리지 적용 전 원본 요금
    used_mileage = Column(Integer, default=0) # 사용한 마일리지
    final_amount = Column(Integer, nullable=False) # 실제 카드 결제 금액
    target_soc = Column(Integer, default=80)
    
    order_id = Column(String(100), unique=True, nullable=False) # 토스 주문 고유 번호
    payment_key = Column(String(255), nullable=True) # 토스 결제 승인 키
    
    is_guest = Column(Boolean, default=False)
    is_start_notified = Column(Boolean, default=False)
    is_80_notified = Column(Boolean, default=False)
    is_completed_notified = Column(Boolean, default=False)
    
    # 상태: PENDING (결제 대기), PAID (결제 완료), FAILED (결제 실패), CANCELED (취소)
    status = Column(String(20), default="PENDING")
    created_at = Column(DateTime, default=get_kst_now)
    paid_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="charging_sessions")
    station = relationship("Station", back_populates="charging_sessions")
    charger = relationship("Charger", back_populates="charging_sessions")

class Report(Base):
    __tablename__ = "reports"
    report_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    charger_id = Column(String(50), ForeignKey("chargers.charger_id"))
    keyword = Column(String(50))
    content = Column(String(1000))
    image_url = Column(String(255))
    # 상태: PENDING (대기), APPROVED (승인), REJECTED (반려)
    status = Column(String(20), default="PENDING")
    created_at = Column(DateTime, default=get_kst_now)

    user = relationship("User", back_populates="reports")
    charger = relationship("Charger", back_populates="reports")

class MileageLog(Base):
    __tablename__ = "mileage_logs"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    amount = Column(Integer)
    description = Column(String(100))
    created_at = Column(DateTime, default=get_kst_now)

    user = relationship("User", back_populates="mileage_logs")

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(50), ForeignKey("stations.station_id"))
    station_name = Column(String(100)) # 신규: 작성 당시 충전소명 기록
    station_address = Column(String(200)) # 신규: 작성 당시 주소 기록
    user_id = Column(Integer, ForeignKey("users.user_id"))
    user_name = Column(String(100))
    rating = Column(Integer)
    content = Column(String(1000))
    # 상태: VISIBLE (정상 노출), HIDDEN (관리자 숨김), DELETED (사용자 삭제)
    status = Column(String(20), default="VISIBLE")
    created_at = Column(DateTime, default=get_kst_now)
    updated_at = Column(DateTime, default=get_kst_now, onupdate=get_kst_now)

    station = relationship("Station", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    session_id = Column(String(100), nullable=True)
    endpoint = Column(String(500), nullable=False, unique=True)
    p256dh = Column(String(100), nullable=False)
    auth = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=get_kst_now)
    user = relationship("User", back_populates="push_subscriptions")
