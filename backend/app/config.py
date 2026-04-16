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


DATABASE_URL = get_str("DATABASE_URL", "sqlite:///./sqlite.db")
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
