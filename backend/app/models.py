"""
models.py — SQL models.
"""

from sqlmodel import SQLModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta


# User, Document
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    password_hash: str
    is_admin: int = Field(default=0)


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
    label: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    edited_by: int = Field(foreign_key="users.id")


class AIInteraction(SQLModel, table=True):
    __tablename__ = "ai_interactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: str = Field(index=True, unique=True)

    document_id: int = Field(foreign_key="documents.id")
    user_id: int = Field(foreign_key="users.id")

    action_type: str
    source_text: str
    context: str = ""
    context_excerpt: str = ""
    instruction: str = ""
    options_json: str = "{}"
    prompt_text: str = ""
    prompt_version: str = "v1"
    provider_name: str = "mock"
    model_name: str = "unknown"

    result_text: str = ""
    status: str = "pending"
    review_status: str = "pending"
    error_message: Optional[str] = None
    response_chars: int = 0

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None


class DocumentSharingLinks(SQLModel, table = True):
    __tablename__ = "document_share_links"
    id: Optional[int] = Field(default=None, primary_key=True) 

    document_id: int = Field(foreign_key="documents.id")
    owner_id: int = Field(foreign_key="users.id")
    token: str = Field(index=True, unique=True)

    role: str
    login_required: bool
    multi_use: bool
    is_active: bool = True
    use_count: int = 0
    expiry: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))
