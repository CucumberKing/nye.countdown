# Frontend Dockerfile
# Builds Angular app and serves via nginx

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration=production

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2: Serve
# ═══════════════════════════════════════════════════════════════════════════════
FROM nginx:alpine AS production

LABEL org.opencontainers.image.source="https://github.com/CucumberKing/nye.countdown"

# Copy built app
COPY --from=builder /app/dist/nyecountdown.live/browser /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1
