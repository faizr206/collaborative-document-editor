import hashlib
import jwt
# from jose import jwt
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated

from sqlmodel import Session, select
from app.db import get_session, engine
from app.models import User
from app.config import JWT_ALGORITHM, JWT_SECRET_KEY, TOKEN_EXPIRY_SECONDS

SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = JWT_ALGORITHM

def hash_password(password: str) -> str:
     return hashlib.sha256(password.encode()).hexdigest()


class UserRegister(BaseModel):
     username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$", examples=["john_doe"])
     email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$", examples=["user@example.com"])
     password: str = Field(min_length=4, max_length=100)
class UserLogin(BaseModel):
     username:str
     password:str
class TokenResponse(BaseModel):
     access_token: str
     token_type: str = "bearer"
     expires_in:int

def create_access_token(username: str)-> str:
     now = datetime.now(timezone.utc)
     expire = now + timedelta(seconds=TOKEN_EXPIRY_SECONDS)

     payload = {
          "sub": username,
          "exp": expire,
          "iat": now
     }
     return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

security = HTTPBearer()
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security),
                       session: Session = Depends(get_session))->str:
     token = credentials.credentials
     try:
          payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
          username = payload.get("sub")

          found_user = session.exec(select(User).where(User.username == username)).first()
          if not found_user:
               raise HTTPException(status_code=401, detail="Invalid token, due to username")

          return found_user

     except jwt.ExpiredSignatureError:
          raise HTTPException(status_code=401, detail="Token expired")

     except jwt.InvalidTokenError as e:
          print("JWT decode error:", repr(e))
          raise HTTPException(status_code=401, detail="Invalid token")

CurrentUser = Annotated[User, Depends(verify_token)]

async def ensure_admin(current_user: User = Depends(verify_token)) -> User:
     if getattr(current_user, "is_admin", 0) != 1:
          raise HTTPException(status_code=403, detail="Admin privileges required")
     return current_user
