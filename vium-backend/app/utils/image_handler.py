import os
import uuid
from PIL import Image
from io import BytesIO

# 이미지 저장 기본 경로
UPLOAD_DIR = "static/uploads/reports"

def save_compressed_image(file_content: bytes, filename: str) -> str:
    """
    업로드된 이미지를 압축 및 리사이징하여 저장합니다.
    - 최대 너비: 800px
    - 포맷: JPEG (용량 최적화)
    - 퀄리티: 70% (시연용으로 충분한 화질)
    """
    # 1. 파일 이름 생성 (중복 방지를 위해 UUID 활용)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
        ext = '.jpg' # 기본값
    
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # 2. 이미지 처리
    img = Image.open(BytesIO(file_content))
    
    # RGBA인 경우 RGB로 변환 (JPEG 저장 가능하도록)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # 3. 리사이징 (비율 유지)
    max_size = (800, 800)
    img.thumbnail(max_size, Image.Resampling.LANCZOS)

    # 4. 저장
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    img.save(file_path, "JPEG", quality=70, optimize=True)

    # 5. 접근 가능한 URL 경로 반환
    return f"/static/uploads/reports/{unique_filename}"
