# NYE Countdown

A sleek New Year's Eve countdown with NTP-synchronized time accuracy. Because being off by even a second at midnight is unacceptable.

**Live Demo:** [nyecountdown.live](https://nyecountdown.live)

![Screenshot](docs/screenshot.png)

## What's This?

A real-time countdown to midnight that syncs with atomic clocks via NTP servers. The frontend calculates the exact offset between your device and the server, so everyone sees "0" at the same moment — no matter how wrong their system clock is.

## Features

### Core
- NTP-synced server time (pool.ntp.org, time.google.com, time.cloudflare.com)
- WebSocket ping/pong protocol for accurate client offset calculation
- Wake lock to keep your screen on during the countdown
- Fullscreen support
- Simulation mode to test the celebration without waiting until December 31st

### Interactive Reactions
- **Mobile Remote:** Scan QR code on the main display to open a mobile remote control
- **Emoji Reactions:** Send emojis from your phone that appear on the main countdown display
- **Greetings:** Broadcast custom greeting messages to the big screen
- **Real-time sync:** All reactions are broadcast to all connected clients via WebSocket RPC

### GPU-Accelerated Effects (PixiJS)
- **Firework Effect** (🎆, 🎇): Rocket launches with particle trail, explodes into 80+ colorful particles with gravity
- **Disco Ball Effect** (🪩): Spinning disco ball with 12 rotating, color-shifting light beams
- **Emoji Burst** (all other emojis): Emoji rockets up, explodes into multiple copies with physics
- Celebration mode with confetti when the clock hits zero

## Tech Stack

- **Frontend:** Angular 21 with Signals, PixiJS for GPU-accelerated effects
- **Backend:** FastAPI + WebSockets with JSON-RPC style messaging
- **Time Sync:** ntplib (Python)
- **Deployment:** Docker, Caddy (auto-TLS)
- **Task Runner:** [just](https://github.com/casey/just)

## Quick Start

### Prerequisites

- [just](https://github.com/casey/just)
- [uv](https://github.com/astral-sh/uv)
- Node.js 20+
- Docker

### Local Development

```bash
# Install dependencies
just setup

# Terminal 1: Start backend
just backend

# Terminal 2: Start frontend
just frontend
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:4200`.

### Docker Development

```bash
just dev
```

This spins up everything with hot-reload via `docker-compose.dev.yml`.

## Deployment

The project is set up for deployment to any Docker host with Caddy as reverse proxy.

```bash
# Build and push images to Docker Hub
just push

# Deploy to server (requires NYE_SERVER env var)
NYE_SERVER=your.server.ip ./deploy.sh
```

The `deploy.sh` script copies `docker-compose.yml` and `Caddyfile` to the server and runs `docker compose up`.

## Project Structure

```
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # WebSocket & API endpoints
│   │   ├── ntp_sync.py         # NTP synchronization service
│   │   ├── connection_manager.py
│   │   ├── geolocation.py      # IP-based location lookup
│   │   ├── config.py           # Settings from env vars
│   │   ├── models/             # Pydantic models
│   │   │   ├── reaction.py
│   │   │   ├── greeting.py
│   │   │   └── rpc.py
│   │   └── services/           # Business logic
│   │       ├── reaction.py
│   │       ├── greeting.py
│   │       ├── rpc.py
│   │       └── time_sync.py
│   └── tests/
├── frontend/                   # Angular 21 app
│   └── src/app/
│       ├── components/
│       │   ├── countdown/      # Main countdown display
│       │   ├── remote/         # Mobile remote control
│       │   ├── reaction-overlay/
│       │   └── qr-code/        # QR code for remote access
│       ├── effects/            # PixiJS GPU effects
│       │   ├── base-effect.ts
│       │   ├── firework.effect.ts
│       │   ├── disco.effect.ts
│       │   └── emoji-burst.effect.ts
│       └── services/
│           ├── effect-engine.service.ts
│           ├── time-sync.service.ts
│           ├── websocket.service.ts
│           ├── reaction.service.ts
│           └── greeting.service.ts
├── docker-compose.yml          # Production compose
├── docker-compose.dev.yml      # Development compose
├── Caddyfile                   # Reverse proxy config
└── justfile                    # Development commands
```

## How It Works

### Time Synchronization
1. Backend syncs with NTP servers on startup and periodically
2. Client connects via WebSocket and performs ping/pong measurements
3. Round-trip times are used to calculate the offset between client and server
4. Countdown uses the corrected time for accuracy

### Reaction System
1. User opens `/remote` on their phone (via QR code)
2. Tapping an emoji sends a WebSocket RPC call to the backend
3. Backend broadcasts the reaction to all connected clients
4. Main display renders the reaction using GPU-accelerated PixiJS effects

## License

[MIT](LICENSE) — do whatever you want with it.
