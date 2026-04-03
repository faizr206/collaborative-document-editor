"""
routers/user_auth.py — User management endpoints.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlmodel import Session, select
from app.db import get_session
from app.models import User

from app.auth import (
    CurrentUser,
    hash_password,
    create_access_token,
    UserRegister,
    UserLogin,
    TokenResponse,
    TOKEN_EXPIRY_SECONDS,
)
router = APIRouter(prefix="/user_auth", tags=["user_auth"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister, session: Session = Depends(get_session)):
     username = session.exec(select(User).where(User.username == user.username)).first()
     if username:
          raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username exists")
     new_user = User(username=user.username, 
                     email=user.email, 
                     password_hash=hash_password(user.password))
     session.add(new_user)
     session.commit()
     session.refresh(new_user)

     return {"message": "user registered successfully"}
     
@router.post("/login", response_model=TokenResponse)
async def login(user: UserLogin, session: Session = Depends(get_session)):
    # Check if user exists
    stored_user: User = session.exec(select(User).where(User.username == user.username)).first()

    if stored_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Verify password
    if stored_user.password_hash != hash_password(user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password, Please try again",
        )

    # Create token
    access_token = create_access_token(user.username)

    return TokenResponse(
        access_token=access_token,
        expires_in=TOKEN_EXPIRY_SECONDS,
    )

@router.get("/quick_secure_test")
def quick_secure_route(current_user: CurrentUser):
    return {"message": "This is a secure route test", "user": current_user}