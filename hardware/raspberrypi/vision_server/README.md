# VIUM Raspberry Pi Vision Server

Raspberry Pi에서 USB 카메라와 ONNX 차량 감지 모델을 사용해 주차면 점유 여부를 감지하고 서버로 전송합니다.

## 설치

```bash
cd hardware/raspberrypi/vision_server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

`.env`를 열어서 서버 주소, 카메라 번호, 주차공간 ID, threshold를 수정합니다.

```env
CAMERA_SERVER_URL=http://YOUR_SERVER:8000/api/v1/hardware/cameras
CAM_CONFIG=0:3682,2:3683
CONFIDENCE_THRESHOLDS=0:0.83,2:0.76
MODEL_PATH=vium_car.onnx
```

카메라 번호 확인:

```bash
v4l2-ctl --list-devices
```

## 실행

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

브라우저에서 접속:

```text
http://라즈베리파이_IP:8000
```

## 모델 파일

`vium_car.onnx`는 용량이 클 수 있으므로 필요하면 별도로 업로드하세요.
