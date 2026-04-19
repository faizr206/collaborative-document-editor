import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.config import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRY_SECONDS,
    TOKEN_EXPIRY_SECONDS,
)
from app.db import get_session
from app.models import User

SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = JWT_ALGORITHM
COLLAB_TOKEN_EXPIRY_SECONDS = min(TOKEN_EXPIRY_SECONDS, 5 * 60)
PBKDF2_ITERATIONS = 200_000
PASSWORD_SCHEME = "pbkdf2_sha256"

security = HTTPBearer()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PBKDF2_ITERATIONS
    )
    return (
        f"{PASSWORD_SCHEME}${PBKDF2_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}$"
        f"{base64.b64encode(derived).decode()}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith(f"{PASSWORD_SCHEME}$"):
        try:
            _, iterations_raw, salt_raw, expected_raw = stored_hash.split("$", 3)
            iterations = int(iterations_raw)
            salt = base64.b64decode(salt_raw.encode())
            expected = base64.b64decode(expected_raw.encode())
        except Exception:
            return False

        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return hmac.compare_digest(actual, expected)

    legacy_hash = hashlib.sha256(password.encode()).hexdigest()
    return hmac.compare_digest(legacy_hash, stored_hash)


class UserRegister(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_]+$",
        examples=["john_doe"],
    )
    email: str = Field(
        ...,
        pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$",
        examples=["user@example.com"],
    )
    password: str = Field(min_length=4, max_length=100)


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def _encode_token(payload: dict[str, Any], expires_in_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=expires_in_seconds)
    return jwt.encode(
        {
            **payload,
            "exp": expire,
            "iat": now,
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_access_token(username: str) -> str:
    return _encode_token(
        {
            "sub": username,
            "type": "access",
        },
        TOKEN_EXPIRY_SECONDS,
    )


def create_refresh_token(username: str) -> str:
    return _encode_token(
        {
            "sub": username,
            "type": "refresh",
        },
        REFRESH_TOKEN_EXPIRY_SECONDS,
    )


def create_collab_token(
    *,
    user_id: int,
    username: str,
    document_id: int,
    room_id: str,
) -> str:
    return _encode_token(
        {
            "sub": username,
            "uid": user_id,
            "doc": document_id,
            "roomId": room_id,
            "type": "collab",
        },
        COLLAB_TOKEN_EXPIRY_SECONDS,
    )


def build_token_response(username: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(username),
        refresh_token=create_refresh_token(username),
        expires_in=TOKEN_EXPIRY_SECONDS,
    )


def decode_token(
    token: str, *, expected_types: set[str] | None = None
) -> tuple[str, dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        token_type = payload.get("type")

        if not isinstance(username, str) or not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        if expected_types and token_type not in expected_types:
            raise HTTPException(status_code=401, detail="Invalid token type")

        return username, payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        print("JWT decode error:", repr(exc))
        raise HTTPException(status_code=401, detail="Invalid token")


def get_user_from_token(
    token: str,
    session: Session,
) -> tuple[User, dict[str, Any]]:
    username, payload = decode_token(token, expected_types={"access"})
    found_user = session.exec(select(User).where(User.username == username)).first()
    if not found_user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return found_user, payload


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    found_user, _ = get_user_from_token(credentials.credentials, session)
    return found_user


CurrentUser = Annotated[User, Depends(verify_token)]


async def ensure_admin(current_user: User = Depends(verify_token)) -> User:
    if getattr(current_user, "is_admin", 0) != 1:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
