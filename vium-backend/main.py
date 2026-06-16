from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os

from app.db.session import engine, Base

# 프로젝트 실행 시 필요한 DB 테이블들을 자동으로 생성해주는 코드입니다.
# Base.metadata에 등록된 모델들을 바탕으로 실제 데이터베이스에 테이블을 만들어줍니다.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VIUM Smart EV Charging Management System",
    description="전기차 충전소 효율성 제고 및 관제를 위한 백엔드 API 서비스",
    version="1.0.0"
)

# [CORS 설정] 프론트엔드(React)와 백엔드 간의 통신 허용 목록입니다.
# 로컬 개발 환경과 실제 배포된 도메인에서 API에 접근할 수 있도록 보안 설정을 해두었습니다.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://YOUR_SERVER_IP",
    "https://vium-project.duckdns.org",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# 고장 제보 시 사용자가 업로드한 사진을 저장하고 브라우저에서 볼 수 있게 설정하는 부분입니다.
# 'static' 폴더가 실제 서버 경로에 없으면 에러가 날 수 있어서, 없으면 자동으로 생성하게끔 짰습니다.
static_path = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_path):
    os.makedirs(static_path)
app.mount("/static", StaticFiles(directory=static_path), name="static")

# 기능별로 깔끔하게 나눠놓은 라우터들을 메인 앱에 등록합니다.
# 이렇게 나눠놓아야 나중에 유지보수하기가 훨씬 편하더라구요.
from app.api.v1 import auth, endpoints, hardware, payments
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(endpoints.router, prefix="/api/v1")
app.include_router(hardware.router, prefix="/api/v1/hardware", tags=["Hardware"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payment"])

@app.get("/")
async def root():
    """서버가 정상적으로 구동 중인지 확인하는 간단한 테스트용 엔드포인트입니다."""
    return {
        "status": "online",
        "message": "VIUM Backend API Server is running.",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
