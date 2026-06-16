# VIUM Hardware Integration

VIUM 프로젝트의 하드웨어 연동 코드입니다.

## 구성

```text
hardware/
├── arduino/
│   └── VIUM_BatteryConnector/
│       ├── VIUM_BatteryConnector.ino
│       └── config.example.h
└── raspberrypi/
    └── vision_server/
        ├── main.py
        ├── requirements.txt
        ├── .env.example
        └── README.md
```

## 포함 기능

- ESP32/Arduino 배터리 전압 측정 및 충전 상태 서버 전송
- Raspberry Pi + OpenCV + FastAPI 기반 실시간 차량 감지 스트리밍
- 주차면별 차량 감지 결과를 백엔드 API로 전송

## 주의

`config.h`, `.env`에는 Wi-Fi 비밀번호, 서버 주소 등 개인 정보가 들어가므로 GitHub에 올리지 않습니다.
예시 파일인 `config.example.h`, `.env.example`만 커밋하세요.
