# Backend API Dockerfile
# https://docs.astral.sh/uv/guides/integration/docker/

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build
# ═══════════════════════════════════════════════════════════════════════════════
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder

WORKDIR /app

# Enable bytecode compilation for faster startup
ENV UV_COMPILE_BYTECODE=1

# Use copy link mode for faster installs
ENV UV_LINK_MODE=copy

# Copy dependency files first (better caching)
COPY pyproject.toml uv.lock ./

# Install dependencies (without project itself for caching)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY app/ app/

# Install the project itself
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2: Production
# ═══════════════════════════════════════════════════════════════════════════════
FROM python:3.14-slim-bookworm AS production

LABEL org.opencontainers.image.source="https://github.com/CucumberKing/nye.countdown"

WORKDIR /app

# Create non-root user
RUN groupadd --gid 1001 backend && \
    useradd --uid 1001 --gid backend --shell /bin/bash --create-home backend

# Copy virtual environment from builder
COPY --from=builder --chown=backend:backend /app/.venv /app/.venv

# Copy source code
COPY --from=builder --chown=backend:backend /app/app ./app

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Switch to non-root user
USER backend

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the FastAPI application with uvicorn
# --ws-ping-interval/timeout: WebSocket keepalive for countdown clients
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--ws-ping-interval", "30", "--ws-ping-timeout", "30"]
