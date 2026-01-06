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

    # Target NYE timestamp (Unix seconds, defaults to Jan 1, 2027 00:00 UTC)
    target_ts: float = 1798761600.0

    # Optional legal links (external URLs, not in git)
    impressum_url: str | None = None
    privacy_url: str | None = None

    class Config:
        env_prefix = "NYE_"


settings = Settings()

