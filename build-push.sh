#!/bin/bash
set -e

# Configuration - Docker Hub username
DOCKER_USER="${DOCKER_USER:-gurkenkoenig}"
REPO_NAME="nye-countdown"
TAG="${1:-latest}"

echo "🐳 Building and pushing NYE Countdown images..."
echo "   Docker Hub: ${DOCKER_USER}/${REPO_NAME}"
echo "   Tag: ${TAG}"
echo ""

# Login check
if ! docker info | grep -q "Username"; then
    echo "⚠️  Not logged in to Docker Hub. Run: docker login"
    exit 1
fi

# Build and push backend
echo "📦 Building backend..."
docker build -t "${DOCKER_USER}/${REPO_NAME}-backend:${TAG}" ./backend
echo "🚀 Pushing backend..."
docker push "${DOCKER_USER}/${REPO_NAME}-backend:${TAG}"

# Build and push frontend
echo "📦 Building frontend..."
docker build -t "${DOCKER_USER}/${REPO_NAME}-frontend:${TAG}" ./frontend
echo "🚀 Pushing frontend..."
docker push "${DOCKER_USER}/${REPO_NAME}-frontend:${TAG}"

echo ""
echo "✅ Done! Images pushed:"
echo "   ${DOCKER_USER}/${REPO_NAME}-backend:${TAG}"
echo "   ${DOCKER_USER}/${REPO_NAME}-frontend:${TAG}"
echo ""
echo "To deploy, update docker-compose.yml to use these images instead of build:"
echo "   image: ${DOCKER_USER}/${REPO_NAME}-backend:${TAG}"
echo "   image: ${DOCKER_USER}/${REPO_NAME}-frontend:${TAG}"

