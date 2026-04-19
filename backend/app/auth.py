import base64
import hashlib
import hmac
import secrets
import jwt

# from jose import jwt
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated

from sqlmodel import Session, select
from app.db import get_session
from app.models import User
from app.config import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRY_SECONDS,
    TOKEN_EXPIRY_SECONDS,
    WEBSOCKET_TOKEN_EXPIRY_SECONDS,
)

SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = JWT_ALGORITHM
PBKDF2_ITERATIONS = 200_000
PASSWORD_SCHEME = "pbkdf2_sha256"


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
        min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$", examples=["john_doe"]
    )
    email: str = Field(
        ..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$", examples=["user@example.com"]
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


def _create_token(
    username: str,
    *,
    expires_in: int,
    token_type: str,
    extra_claims: dict | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=expires_in)

    payload = {"sub": username, "exp": expire, "iat": now, "type": token_type}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(username: str) -> str:
    return _create_token(
        username,
        expires_in=TOKEN_EXPIRY_SECONDS,
        token_type="access",
    )


def create_refresh_token(username: str) -> str:
    return _create_token(
        username,
        expires_in=REFRESH_TOKEN_EXPIRY_SECONDS,
        token_type="refresh",
    )


def create_websocket_token(username: str, room_id: str) -> str:
    return _create_token(
        username,
        expires_in=WEBSOCKET_TOKEN_EXPIRY_SECONDS,
        token_type="websocket",
        extra_claims={"room": room_id},
    )


def build_token_response(username: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(username),
        refresh_token=create_refresh_token(username),
        expires_in=TOKEN_EXPIRY_SECONDS,
    )


security = HTTPBearer()


def decode_token(
    token: str, *, expected_types: set[str] | None = None
) -> tuple[str, dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        token_type = payload.get("type", "access")

        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        if expected_types and token_type not in expected_types:
            raise HTTPException(status_code=401, detail="Invalid token type")

        return username, payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print("JWT decode error:", repr(e))
        raise HTTPException(status_code=401, detail="Invalid token")


def get_user_from_token(
    token: str,
    session: Session = Depends(get_session),
) -> tuple[User, dict]:
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
