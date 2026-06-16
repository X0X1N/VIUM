import os
import cv2
import time
import requests
import threading
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse, HTMLResponse

load_dotenv()

app = FastAPI(title="VIUM Vision Server")

# ==============================================================================
# 설정
# ==============================================================================
SERVER_URL = os.getenv("CAMERA_SERVER_URL", "http://127.0.0.1:8000/api/v1/hardware/cameras")
MODEL_PATH = os.getenv("MODEL_PATH", "vium_car.onnx")
DEBOUNCE_SECONDS = float(os.getenv("DEBOUNCE_SECONDS", "1"))
ARRIVAL_CONFIRM_COUNT = int(os.getenv("ARRIVAL_CONFIRM_COUNT", "3"))


def parse_cam_config(raw: str):
    """예: '0:3682,2:3683' -> {0: '3682', 2: '3683'}"""
    result = {}
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        cam_id, target_id = item.split(":", 1)
        result[int(cam_id.strip())] = target_id.strip()
    return result


def parse_thresholds(raw: str):
    """예: '0:0.83,2:0.76' -> {0: 0.83, 2: 0.76}"""
    result = {}
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        cam_id, threshold = item.split(":", 1)
        result[int(cam_id.strip())] = float(threshold.strip())
    return result


CAM_CONFIG = parse_cam_config(os.getenv("CAM_CONFIG", "0:3682,2:3683"))
CONFIDENCE_THRESHOLDS = parse_thresholds(os.getenv("CONFIDENCE_THRESHOLDS", "0:0.83,2:0.76"))

lock = threading.Lock()

vehicle_status = {
    cam_id: {"text": "Detecting...", "color": (255, 255, 0)}
    for cam_id in CAM_CONFIG.keys()
}
arrival_counter = {cam_id: 0 for cam_id in CAM_CONFIG.keys()}

# ==============================================================================
# 카메라 초기화
# ==============================================================================
caps = {}

for cam_id in CAM_CONFIG.keys():
    temp = cv2.VideoCapture(cam_id)

    if temp.isOpened():
        temp.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
        temp.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
        temp.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        caps[cam_id] = temp
        print(f"✅ Camera index {cam_id} in use")
    else:
        print(f"❌ Camera index {cam_id} not found!")

if not caps:
    raise RuntimeError("No camera found")

# ==============================================================================
# 모델 로딩
# ==============================================================================
print("⏳ Loading models...")
nets = {}

for cam_id in CAM_CONFIG.keys():
    try:
        nets[cam_id] = cv2.dnn.readNetFromONNX(MODEL_PATH)
        print(f"✅ Model loaded for CAM-{cam_id}")
    except Exception as e:
        raise RuntimeError(f"Model load failed for CAM-{cam_id}: {e}") from e


# ==============================================================================
# 카메라 버퍼 비우기
# ==============================================================================
def read_latest_frame(cap):
    for _ in range(3):
        cap.grab()
    ret, frame = cap.read()
    return ret, frame


# ==============================================================================
# 비동기 서버 전송
# ==============================================================================
def _send_task(target_id, payload, headers, status_str):
    try:
        response = requests.post(
            SERVER_URL,
            json=payload,
            headers=headers,
            timeout=5,
        )
        if response.status_code == 200:
            print(f"🚀 [IoT Cloud] {status_str} signal synced. ID: {target_id}")
        else:
            print(f"⚠️ [IoT Cloud] Server responded with code: {response.status_code}")
    except Exception as e:
        print(f"❌ [IoT Cloud] Sync failed: {e}")


def send_to_server_async(target_id, vehicle_present, confidence_score=0.0):
    status_str = "Occupied" if vehicle_present else "Available"
    payload = {
        "parking_space_id": target_id,
        "vehicle_present": bool(vehicle_present),
        "confidence_score": float(confidence_score),
        "user_id": None,
        "is_guest": False,
    }
    headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420",
    }
    worker = threading.Thread(
        target=_send_task,
        args=(target_id, payload, headers, status_str),
        daemon=True,
    )
    worker.start()


# ==============================================================================
# 추론 루프
# ==============================================================================
def inference_loop(cam_id):
    target_id = CAM_CONFIG[cam_id]
    threshold = CONFIDENCE_THRESHOLDS.get(cam_id, 0.8)

    vehicle_present = False
    empty_start_time = None
    frame_count = 0

    while True:
        with lock:
            ret, frame = read_latest_frame(caps[cam_id])

        if not ret:
            print(f"⚠️ [CAM-{cam_id}] Camera frame capture failed.")
            break

        frame_count += 1

        if frame_count % 5 == 0:
            blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (320, 320), swapRB=True)

            nets[cam_id].setInput(blob)
            outputs = nets[cam_id].forward()[0].T

            car_detected = False
            max_conf = 0.0

            for row in outputs:
                conf = float(row[4])
                if conf > max_conf:
                    max_conf = conf
                if conf > threshold:
                    car_detected = True

            print(f"[CAM-{cam_id}] conf: {max_conf:.2f} (threshold: {threshold:.2f})")

            if car_detected:
                arrival_counter[cam_id] += 1
                empty_start_time = None

                if arrival_counter[cam_id] >= ARRIVAL_CONFIRM_COUNT:
                    if not vehicle_present:
                        print(f"\n🚗 [CAM-{cam_id}] Vehicle arrived! (Confidence: {max_conf:.2f})")
                        send_to_server_async(target_id, vehicle_present=True, confidence_score=max_conf)

                    vehicle_present = True
                    vehicle_status[cam_id]["text"] = f"Occupied ({max_conf:.2f})"
                    vehicle_status[cam_id]["color"] = (0, 255, 0)
                else:
                    vehicle_status[cam_id]["text"] = f"Checking... ({arrival_counter[cam_id]}/{ARRIVAL_CONFIRM_COUNT})"
                    vehicle_status[cam_id]["color"] = (255, 255, 0)
            else:
                arrival_counter[cam_id] = 0

                if empty_start_time is None:
                    empty_start_time = time.time()

                elapsed = time.time() - empty_start_time

                if elapsed >= DEBOUNCE_SECONDS:
                    if vehicle_present:
                        print(f"\n✨ [CAM-{cam_id}] Vehicle cleared! (Available)")
                        send_to_server_async(target_id, vehicle_present=False, confidence_score=1.0)

                    vehicle_present = False
                    empty_start_time = None
                    vehicle_status[cam_id]["text"] = "Available"
                    vehicle_status[cam_id]["color"] = (0, 255, 255)
                else:
                    remaining = DEBOUNCE_SECONDS - elapsed
                    vehicle_status[cam_id]["text"] = f"Monitoring... ({remaining:.1f}s)"
                    vehicle_status[cam_id]["color"] = (255, 255, 0)

        time.sleep(0.01)


# ==============================================================================
# CCTV 오버레이
# ==============================================================================
def add_cctv_overlay(frame, cam_id):
    h, w = frame.shape[:2]

    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 22), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(frame, now, (3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

    cv2.circle(frame, (w - 8, 11), 4, (0, 0, 255), -1)
    cam_label = list(CAM_CONFIG.keys()).index(cam_id) + 1
    cv2.putText(frame, f"CAM-0{cam_label} VIUM", (w - 115, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

    status_text = vehicle_status[cam_id]["text"]
    status_color = vehicle_status[cam_id]["color"]
    cv2.rectangle(frame, (0, h - 22), (w, h), (0, 0, 0), -1)
    cv2.putText(frame, status_text, (3, h - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.35, status_color, 1)

    return frame


# ==============================================================================
# 스트리밍
# ==============================================================================
def generate_frames(cam_id):
    while True:
        with lock:
            ret, frame = caps[cam_id].read()

        if not ret:
            break

        frame = add_cctv_overlay(frame, cam_id)
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 50])

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
        )


# ==============================================================================
# FastAPI 엔드포인트
# ==============================================================================
@app.get("/", response_class=HTMLResponse)
def index():
    camera_cards = ""
    for index, (cam_id, target_id) in enumerate(CAM_CONFIG.items(), start=1):
        camera_cards += f"""
        <div class="cam-box">
            <div class="container">
                <img src="/video/{cam_id}" />
            </div>
            <p class="label">CAM-0{index} | 주차공간 {target_id}</p>
        </div>
        """

    return f"""
    <html>
        <head>
            <title>VIUM Admin CCTV</title>
            <style>
                body {{
                    background: #000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    flex-direction: column;
                    color: #fff;
                    font-family: sans-serif;
                    gap: 20px;
                }}
                h2 {{
                    margin-bottom: 20px;
                    letter-spacing: 2px;
                    font-weight: 900;
                    color: #00ffcc;
                }}
                .cameras {{ display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; }}
                .cam-box {{ display: flex; flex-direction: column; align-items: center; }}
                .container {{
                    position: relative;
                    border: 4px solid #333;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }}
                img {{ display: block; width: 480px; }}
                .label {{ margin-top: 10px; font-size: 14px; color: #888; }}
                .status {{ font-size: 12px; color: #555; }}
            </style>
        </head>
        <body>
            <h2>🛰️ VIUM REAL-TIME MONITOR</h2>
            <div class="cameras">{camera_cards}</div>
            <p class="status">LIVE FEED | ASYNC OPTIMIZED</p>
        </body>
    </html>
    """


@app.get("/video/{cam_id}")
def video(cam_id: int):
    if cam_id not in caps:
        return {"error": f"Camera {cam_id} not found"}
    return StreamingResponse(
        generate_frames(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ==============================================================================
# 스레드 실행
# ==============================================================================
@app.on_event("startup")
def startup_event():
    for cam_id in caps.keys():
        t = threading.Thread(target=inference_loop, args=(cam_id,), daemon=True)
        t.start()
        print(
            f"🚀 Inference thread started "
            f"(CAM-{cam_id}, Target: {CAM_CONFIG[cam_id]}, "
            f"Threshold: {CONFIDENCE_THRESHOLDS.get(cam_id, 0.8):.2f})"
        )

    print("\n" + "=" * 50)
    print("🚀 VIUM VISION ENGINE STARTED")
    print(f"📡 BACKEND    : {SERVER_URL}")
    print("⚡ ASYNC MODE : ENABLED")
    print("=" * 50 + "\n")
