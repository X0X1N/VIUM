import re
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
from datetime import datetime
from decimal import Decimal

# --- Review Schemas ---
class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=5)

class ReviewCreate(ReviewBase):
    pass

class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    content: Optional[str] = Field(None, min_length=5)

class ReviewAdminUpdate(BaseModel):
    status: str 

class Review(ReviewBase):
    id: int
    station_id: str
    station_name: Optional[str] = None
    station_address: Optional[str] = None
    user_name: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Charger Schemas ---
class ChargerBase(BaseModel):
    charger_id: str
    charger_type: str
    connector_type: str
    status: str
    active_user_id: Optional[int] = None
    active_session_id: Optional[str] = None
    last_used_at: Optional[datetime] = None

class ChargerStatusUpdate(BaseModel):
    status: str 

class Charger(ChargerBase):
    class Config:
        from_attributes = True

# --- Station Schemas ---
class StationBase(BaseModel):
    station_id: str
    station_name: str
    address: str
    latitude: Decimal
    longitude: Decimal
    price: int = 340
    isTimeSale: bool = False
    priceHistory: List[int] = Field(default_factory=lambda: [340]*24)
    lastSuccessTime: str = "방금 전"
    distance: str = "-"
    current_battery: Optional[float] = None

class Station(StationBase):
    chargers: List[Charger] = []
    reviews: List[Review] = []

    class Config:
        from_attributes = True

# --- Report Schemas ---
class ReportCreate(BaseModel):
    charger_id: str
    keyword: str
    content: str = Field(..., min_length=10)

class ReportUpdate(BaseModel):
    status: str 

class Report(BaseModel):
    report_id: int
    user_id: int
    charger_id: str
    keyword: str
    content: str
    image_url: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Mileage Log Schemas ---
class MileageLog(BaseModel):
    log_id: int
    amount: int
    description: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Payment & Charging Session Schemas ---
class ChargingSessionBase(BaseModel):
    station_id: str
    charger_id: str
    total_price: int
    used_mileage: int
    final_amount: int
    target_soc: int = 80

class ChargingSessionCreate(BaseModel):
    station_id: str
    charger_id: str
    total_price: int
    used_mileage: int
    final_amount: int
    target_soc: int = 80

class ChargingCompleteRequest(BaseModel):
    points: int

class ChargingSessionConfirm(BaseModel):
    paymentKey: str
    orderId: str
    amount: int

class ChargingSession(ChargingSessionBase):
    session_id: int
    user_id: Optional[int] = None 
    order_id: str
    payment_key: Optional[str] = None
    is_guest: bool = False
    is_start_notified: bool = False
    is_80_notified: bool = False
    is_completed_notified: bool = False
    status: str
    created_at: datetime
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- User Schemas ---
class UserCreate(BaseModel):
    email: str = Field(..., example="user@example.com")
    password: str = Field(..., min_length=8)
    nickname: str = Field(..., min_length=2, max_length=20)
    admin_code: Optional[str] = None 

    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        # 영문, 숫자, 특수문자(@$!%*#?&)를 포함한 8자 이상 (문자 제한 완화)
        password_regex = r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$'
        if not re.match(password_regex, v):
            raise ValueError("비밀번호는 영문, 숫자, 특수문자(@$!%*#?&)를 포함하여 8자 이상이어야 합니다.")
        return v

class NicknameCheck(BaseModel):
    nickname: str

class VerificationRequest(BaseModel):
    email: str

class VerificationVerify(BaseModel):
    email: str
    code: str

class UserProfile(BaseModel):
    user_id: int
    email: str
    nickname: Optional[str]
    is_admin: bool
    mileage_balance: int
    level: str
    trust_score: int
    mileage_logs: List[MileageLog] = []
    reviews: List[Review] = [] 
    reports: List[Report] = [] 
    charging_sessions: List[ChargingSession] = [] 

    class Config:
        from_attributes = True

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

# --- Response Schemas ---
class RewardResponse(BaseModel):
    success: bool
    points_added: int
    total_balance: int
    message: str

class ActionResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# --- Routing (GPS) Schemas ---
class RouteSummary(BaseModel):
    distance: int 
    duration: int 
    origin: dict
    destination: dict

class DirectionResponse(BaseModel):
    success: bool
    path: List[List[float]] 
    summary: RouteSummary

# --- Push Notification Schemas ---
class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    session_id: Optional[str] = None 
    silent: bool = False

# --- Hardware Schemas ---
class ConnectorSignal(BaseModel):
    charger_id: str
    status: str 
    voltage: Optional[float] = 0.0
    battery: Optional[float] = 0.0
    user_id: Optional[int] = None 
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

class CameraSignal(BaseModel):
    parking_space_id: str 
    vehicle_present: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)
