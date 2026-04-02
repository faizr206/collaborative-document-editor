"""
schemas.py — Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

class UserCreate(BaseModel):
     username: str = Field(min_length=3, max_length=30,example="john_doe", pattern="^[a-zA-Z0-9_]+$")
     email: str = Field(example="john.doe@example.com")
     password: str = Field(min_length=6, max_length=100, example="strongpassword123")

class UserRead(BaseModel):
     id: int
     username: str
     email: str
     created_at: datetime

class DocumentCreate(BaseModel):
     title: str = Field(min_length=1, max_length=255, example="My First Document")
     content: Optional[str] = Field(default="", example="This is the content of the document.")

class DocumentRead(BaseModel):
     id: int
     title: str
     content: str
     owner_id: int
     created_at: datetime
     updated_at: datetime

class DocumentUpdate(BaseModel):
     title: Optional[str] = Field(None, min_length=1, max_length=255, example="Updated Document Title")
     content: Optional[str] = Field(None, example="Updated content of the document.")


class DocumentApi(BaseModel):
     id: int
     title: str
     content: str
     createdAt: str
     updatedAt: str


class DocumentEnvelope(BaseModel):
     document: DocumentApi


class DocumentResponse(BaseModel):
     data: DocumentEnvelope


class DocumentListItem(BaseModel):
     id: int
     title: str
     updatedAt: str


class DocumentListEnvelope(BaseModel):
     items: list[DocumentListItem]


class DocumentListResponse(BaseModel):
     data: DocumentListEnvelope

class DocumentPermissionCreate(BaseModel):
     document_id: int
     user_id: int
     permission: Literal["read", "write", "owner"]
