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
# Docker Hub
# ============================================

# Docker Hub username (override with: just push docker_user=otherusername)
docker_user := env_var_or_default("DOCKER_USER", "gurkenkoenig")
tag := env_var_or_default("TAG", "latest")

# Build and push all images to Docker Hub (multi-platform for AMD64 servers)
push:
    docker buildx build --platform linux/amd64 -t {{docker_user}}/nye-countdown-backend:{{tag}} --push ./backend
    docker buildx build --platform linux/amd64 -t {{docker_user}}/nye-countdown-frontend:{{tag}} --push ./frontend
    @echo "✅ Pushed AMD64 images to {{docker_user}}/nye-countdown-*:{{tag}}"

# Push with specific tag: just push-tag v1.0.0
push-tag version:
    TAG={{version}} just push


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

