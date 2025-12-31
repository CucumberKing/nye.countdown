#!/bin/bash
set -e

# Configuration - Docker Hub username
DOCKER_USER="${DOCKER_USER:-gurkenkoenig}"
REPO_NAME="nye-countdown"
TAG="${1:-latest}"
PLATFORM="linux/amd64"

echo "🐳 Building and pushing NYE Countdown images..."
echo "   Docker Hub: ${DOCKER_USER}/${REPO_NAME}"
echo "   Tag: ${TAG}"
echo "   Platform: ${PLATFORM}"
echo ""

# Login check
if ! docker info | grep -q "Username"; then
    echo "⚠️  Not logged in to Docker Hub. Run: docker login"
    exit 1
fi

# Build and push backend (multi-platform)
echo "📦 Building and pushing backend..."
docker buildx build --platform "${PLATFORM}" \
    -t "${DOCKER_USER}/${REPO_NAME}-backend:${TAG}" \
    --push ./backend

# Build and push frontend (multi-platform)
echo "📦 Building and pushing frontend..."
docker buildx build --platform "${PLATFORM}" \
    -t "${DOCKER_USER}/${REPO_NAME}-frontend:${TAG}" \
    --push ./frontend

echo ""
echo "✅ Done! AMD64 images pushed:"
echo "   ${DOCKER_USER}/${REPO_NAME}-backend:${TAG}"
echo "   ${DOCKER_USER}/${REPO_NAME}-frontend:${TAG}"
