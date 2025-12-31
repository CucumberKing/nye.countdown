from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # NTP servers to query (comma-separated in env)
    ntp_servers: list[str] = [
        "pool.ntp.org",
        "time.google.com",
        "time.cloudflare.com",
    ]

    # How often to re-sync with NTP servers (seconds)
    ntp_sync_interval: int = 60

    # WebSocket time broadcast interval (milliseconds)
    ws_broadcast_interval_ms: int = 500

    # Environment
    environment: str = "development"

    class Config:
        env_prefix = "NYE_"


settings = Settings()

