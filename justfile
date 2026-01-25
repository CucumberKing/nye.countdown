# NYE Countdown - Development Commands
# Usage: just <recipe>

# Default recipe - show available commands
default:
    @just --list

# ============================================
# Backend
# ============================================

# Install backend dependencies
backend-install:
    cd backend && uv sync

# Run backend dev server
backend:
    cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run backend tests
backend-test:
    cd backend && uv run pytest -v

# Lint backend code
backend-lint:
    cd backend && uv run ruff check app/ tests/

# Format backend code
backend-format:
    cd backend && uv run ruff format app/ tests/

# Build backend Docker image
backend-build:
    docker build -t nye-countdown-backend ./backend

# ============================================
# Frontend
# ============================================

# Install frontend dependencies
frontend-install:
    cd frontend && npm install

# Run frontend dev server
frontend:
    cd frontend && npm start

# Build frontend for production
frontend-build-prod:
    cd frontend && npm run build

# Build frontend Docker image
frontend-build:
    docker build -t nye-countdown-frontend ./frontend

# ============================================
# Docker Compose
# ============================================

# Start all services in development mode
dev:
    docker compose -f docker-compose.dev.yml up --build

# Start all services in production mode
prod:
    docker compose up --build -d

# Stop all services
down:
    docker compose down

# View logs
logs:
    docker compose logs -f

# ============================================
# Docker: Build & Push (GHCR)
# ============================================

# GitHub Container Registry
REGISTRY := "ghcr.io/cucumberking/nye.countdown"

# Build and push all containers
build-docker: build-docker-backend build-docker-frontend
    @echo "All images built and pushed successfully!"

# Build and push backend image
build-docker-backend:
    docker buildx build \
        --platform linux/amd64 \
        --tag {{REGISTRY}}-backend:latest \
        --push \
        ./backend

# Build and push frontend image
build-docker-frontend:
    docker buildx build \
        --platform linux/amd64 \
        --tag {{REGISTRY}}-frontend:latest \
        --push \
        ./frontend

# Setup buildx builder (run once)
docker-setup-buildx:
    docker buildx create --name multiarch --driver docker-container --use || docker buildx use multiarch
    docker buildx inspect --bootstrap

# Login to GHCR (uses gh CLI - no manual token needed!)
docker-login:
    gh auth token | docker login ghcr.io -u $(gh api user --jq .login) --password-stdin


# Deploy to production server
deploy:
    sh ./deploy.sh

# ============================================
# Full Stack Dev (run both in parallel)
# ============================================

# Run backend and frontend together (requires terminal multiplexer or run in separate terminals)
all:
    @echo "Run in separate terminals:"
    @echo "  Terminal 1: just backend"
    @echo "  Terminal 2: just frontend"

# Quick setup for new developers
setup: backend-install frontend-install
    @echo "✅ Dependencies installed! Run 'just backend' and 'just frontend' in separate terminals."

