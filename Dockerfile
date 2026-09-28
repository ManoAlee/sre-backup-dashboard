# ==============================================================================
# SRE Backup & Infrastructure Observability Platform — Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build Modern React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Flask Backend
FROM python:3.11-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5000 \
    HOST=0.0.0.0

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    iputils-ping \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY app.py ./
COPY blueprints/ ./blueprints/
COPY core/ ./core/
COPY services/ ./services/
COPY templates/ ./templates/
COPY static/ ./static/

# Copy built frontend assets into static and template distribution targets
COPY --from=frontend-builder /app/static/dist/ ./static/dist/
COPY --from=frontend-builder /app/templates/dist/index.html ./templates/index.html

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "app:app"]
