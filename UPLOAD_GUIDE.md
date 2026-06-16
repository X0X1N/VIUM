# GitHub 업로드 안내

이 ZIP은 기존 VIUM 프로젝트에 하드웨어 코드를 합친 버전입니다.

## 추가된 폴더

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

## 중요한 보안 주의

GitHub에는 실제 Wi-Fi 비밀번호, 서버 IP, 개인 토큰을 올리지 마세요.

실행할 때만 로컬에서 아래처럼 복사해서 사용합니다.

```bash
cp hardware/arduino/VIUM_BatteryConnector/config.example.h hardware/arduino/VIUM_BatteryConnector/config.h
cp hardware/raspberrypi/vision_server/.env.example hardware/raspberrypi/vision_server/.env
```

`config.h`, `.env`, `.onnx` 모델 파일은 `.gitignore`에 포함되어 GitHub에 올라가지 않도록 했습니다.

## 업로드 명령어

이미 내 GitHub 저장소가 있다면, 저장소 폴더에서 이 ZIP 내용을 덮어쓴 뒤 실행하세요.

```bash
git status
git add .
git commit -m "Add VIUM hardware integration"
git push origin main
```

브랜치 이름이 `master`라면 마지막 명령어는 다음처럼 바꿔주세요.

```bash
git push origin master
```
