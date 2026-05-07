FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (ffmpeg for video, libgl/libglib for opencv)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

# Install deps first for better layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app

# Pre-download InsightFace buffalo_l model (~300MB) for face cropping
# This avoids slow first-request download at runtime
RUN uv run python -c "from app.services.face_cropper import _get_face_analysis; _get_face_analysis()" || true

EXPOSE 18765

ENV PYTHONPATH=/app

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-18765} --workers ${WEB_CONCURRENCY:-4}"]
