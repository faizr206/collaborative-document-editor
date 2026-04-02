"""
models.py — SQL models.
"""
from sqlmodel import SQLModel, Field
from typing import Literal, Optional
from datetime import datetime, timezone

# User, Document
class User(SQLModel, table=True):
     __tablename__ = "users"
     id: Optional[int] = Field(default=None, primary_key=True)
     username: str = Field(index=True, unique=True)
     email: str = Field(index=True, unique=True)
     created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
     password_hash: str

class Document(SQLModel, table=True):
     __tablename__ = "documents"
     id: Optional[int] = Field(default=None, primary_key=True)
     title: str
     content: str = ""
     owner_id: int = Field(foreign_key="users.id")
     created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
     updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentPermission(SQLModel, table=True):
     __tablename__ = "document_permissions"
     id: Optional[int] = Field(default=None, primary_key=True)
     document_id: int = Field(foreign_key="documents.id")
     user_id: int = Field(foreign_key="users.id")
     permission: str

class DocumentVersion(SQLModel, table=True):
     __tablename__ = "document_versions"
     id: Optional[int] = Field(default=None, primary_key=True)
     document_id: int = Field(foreign_key="documents.id")
     content: str
     created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
     edited_by: int = Field(foreign_key="users.id")
