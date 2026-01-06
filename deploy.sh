#!/bin/bash
set -e

# Configuration - set these environment variables before running:
#   NYE_SERVER - IP or hostname of your deployment server (required)
#   NYE_USER   - SSH user (default: root)
#   SSH_KEY    - Path to SSH key (default: ~/.ssh/id_rsa)
SERVER="${NYE_SERVER:-}"
USER="${NYE_USER:-root}"
SSH_KEY="${SSH_KEY:-~/.ssh/id_rsa}"
REMOTE_DIR="/opt/nye-countdown"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new"

if [ -z "$SERVER" ]; then
    echo "❌ Error: NYE_SERVER environment variable is not set"
    echo "   Usage: NYE_SERVER=your.server.ip ./deploy.sh"
    exit 1
fi

echo "🚀 NYE Countdown Deploy"
echo "   Server: ${USER}@${SERVER}"
echo ""


# Step 2: Copy compose files to server
echo "📤 Copying config files to server..."
ssh ${SSH_OPTS} "${USER}@${SERVER}" "mkdir -p ${REMOTE_DIR}"
scp ${SSH_OPTS} docker-compose.yml "${USER}@${SERVER}:${REMOTE_DIR}/"
scp ${SSH_OPTS} Caddyfile "${USER}@${SERVER}:${REMOTE_DIR}/"

# Step 3: Deploy on server
echo "🔄 Starting containers on server..."
ssh ${SSH_OPTS} "${USER}@${SERVER}" << ENDSSH
cd ${REMOTE_DIR}
docker compose pull
docker compose up -d --force-recreate
docker image prune -f
echo ""
echo "✅ Containers running:"
docker compose ps
ENDSSH

echo ""
echo "✅ Deploy complete!"
echo "   https://nyecountdown.live"