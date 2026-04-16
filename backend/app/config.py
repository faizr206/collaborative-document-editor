from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"

load_dotenv(ENV_FILE, override=False)


def get_str(name: str, default: str) -> str:
    return os.getenv(name, default)


def get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def get_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


def resolve_database_url(raw_url: str) -> str:
    if not raw_url.startswith("sqlite:///"):
        return raw_url

    sqlite_path = raw_url.removeprefix("sqlite:///")
    if sqlite_path == ":memory:" or sqlite_path.startswith("/"):
        return raw_url

    normalized = sqlite_path.removeprefix("./")

    # Preserve the historical backend-local sqlite file even when the server is
    # launched from the repo root.
    if normalized in {"sqlite.db", "backend/sqlite.db"}:
        resolved_path = ROOT_DIR / "backend" / "sqlite.db"
    else:
        resolved_path = ROOT_DIR / normalized

    return f"sqlite:///{resolved_path.resolve()}"


DATABASE_URL = resolve_database_url(get_str("DATABASE_URL", "sqlite:///backend/sqlite.db"))
JWT_SECRET_KEY = get_str("JWT_SECRET_KEY", "change-me-in-env")
JWT_ALGORITHM = get_str("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRY_SECONDS = get_int("TOKEN_EXPIRY_SECONDS", 30 * 60)
BACKEND_CORS_ORIGINS = get_list(
    "BACKEND_CORS_ORIGINS",
    ["http://localhost:5173", "http://127.0.0.1:5173"],
)

AI_PROVIDER = get_str("AI_PROVIDER", "mock")
LM_STUDIO_BASE_URL = get_str("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1")
LM_STUDIO_MODEL = get_str("LM_STUDIO_MODEL", "qwen2.5-3b-instruct")
LM_STUDIO_API_KEY = get_str("LM_STUDIO_API_KEY", "lm-studio")
LM_STUDIO_TIMEOUT_SECONDS = get_int("LM_STUDIO_TIMEOUT_SECONDS", 120)
