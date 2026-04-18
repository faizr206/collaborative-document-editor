"""
routers/user_auth.py — User management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.auth import (
    TOKEN_EXPIRY_SECONDS,
    CurrentUser,
    TokenResponse,
    UserLogin,
    UserRegister,
    create_access_token,
    hash_password,
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

    if stored_user.password_hash != hash_password(user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password, Please try again",
        )

    access_token = create_access_token(user.username)

    return TokenResponse(
        access_token=access_token,
        expires_in=TOKEN_EXPIRY_SECONDS,
    )


@router.post("/api/v1/auth/logout")
async def logout():
    return {"data": {"loggedOut": True}}


@router.get("/user_auth/quick_secure_test")
@router.get("/api/v1/auth/me")
def quick_secure_route(current_user: CurrentUser):
    return {"message": "This is a secure route test", "user": current_user}
