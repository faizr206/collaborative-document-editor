import hashlib
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.config import JWT_ALGORITHM, JWT_SECRET_KEY, TOKEN_EXPIRY_SECONDS
from app.db import get_session
from app.models import User

# JWT configuration (same used everywhere in backend)
SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = JWT_ALGORITHM
COLLAB_TOKEN_EXPIRY_SECONDS = min(TOKEN_EXPIRY_SECONDS, 5 * 60)

# This handles Authorization: Bearer <token> from HTTP requests
security = HTTPBearer()


#  Simple password hashing (not production-grade but fine for assignment)
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


# Request model for user registration
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


# 📥 Request model for login
class UserLogin(BaseModel):
    username: str
    password: str


# 📤 Response model for tokens
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


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


# Create JWT token when user logs in
def create_access_token(username: str) -> str:
    return _encode_token(
        {
            "sub": username,
            "type": "access",
        },
        TOKEN_EXPIRY_SECONDS,
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


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# Verify token for protected routes
async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    token = credentials.credentials

    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        if token_type not in {None, "access"}:
            raise HTTPException(status_code=401, detail="Invalid token")
        username = payload.get("sub")

        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")

        # check if user exists in DB
        found_user = session.exec(
            select(User).where(User.username == username)
        ).first()

        if not found_user:
            raise HTTPException(status_code=401, detail="User not found")

        return found_user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


#  Shortcut dependency used in routes
# This allows writing:
#   current_user: CurrentUser
CurrentUser = Annotated[User, Depends(verify_token)]


#  Admin-only access
async def ensure_admin(current_user: User = Depends(verify_token)) -> User:
    if getattr(current_user, "is_admin", 0) != 1:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
