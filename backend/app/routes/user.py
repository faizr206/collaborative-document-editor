"""
routers/user_auth.py — User management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.auth import (
    TOKEN_EXPIRY_SECONDS,
    CurrentUser,
    RefreshTokenRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    build_token_response,
    decode_token,
    hash_password,
    verify_password,
)
from app.db import get_session
from app.models import User

router = APIRouter(tags=["user_auth"])


@router.post("/user_auth/register", status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister, session: Session = Depends(get_session)):
    username = session.exec(select(User).where(User.username == user.username)).first()
    if username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username exists"
        )
    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password),
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return {"message": "user registered successfully"}


@router.post("/user_auth/login", response_model=TokenResponse)
@router.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(user: UserLogin, session: Session = Depends(get_session)):
    stored_user: User = session.exec(
        select(User).where(User.username == user.username)
    ).first()

    if stored_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not verify_password(user.password, stored_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password, Please try again",
        )

    return build_token_response(user.username)


@router.post("/api/v1/auth/refresh", response_model=TokenResponse)
async def refresh_access_token(
    payload: RefreshTokenRequest, session: Session = Depends(get_session)
):
    username, _ = decode_token(payload.refresh_token, expected_types={"refresh"})
    stored_user: User | None = session.exec(
        select(User).where(User.username == username)
    ).first()
    if stored_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return build_token_response(stored_user.username)


@router.post("/api/v1/auth/logout")
async def logout():
    return {"data": {"loggedOut": True}}


@router.get("/user_auth/quick_secure_test")
@router.get("/api/v1/auth/me")
def quick_secure_route(current_user: CurrentUser):
    return {"message": "This is a secure route test", "user": current_user}
