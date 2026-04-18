"""
schemas.py — Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str = Field(
        min_length=3, max_length=30, example="john_doe", pattern="^[a-zA-Z0-9_]+$"
    )
    email: str = Field(example="john.doe@example.com")
    password: str = Field(min_length=6, max_length=100, example="strongpassword123")


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255, example="My First Document")
    content: Optional[str] = Field(
        default="", example="This is the content of the document."
    )


class DocumentRead(BaseModel):
    id: int
    title: str
    content: str
    owner_id: int
    created_at: datetime
    updated_at: datetime


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(
        None, min_length=1, max_length=255, example="Updated Document Title"
    )
    content: Optional[str] = Field(None, example="Updated content of the document.")


class DocumentOwnerApi(BaseModel):
    id: int
    username: str
    email: str


class DocumentApi(BaseModel):
    id: int
    title: str
    content: str
    createdAt: str
    updatedAt: str
    role: Literal["owner", "editor", "viewer"]
    owner: DocumentOwnerApi


class DocumentEnvelope(BaseModel):
    document: DocumentApi


class DocumentResponse(BaseModel):
    data: DocumentEnvelope


class DocumentBootstrapCollabApi(BaseModel):
    roomId: str
    websocketUrl: str
    token: str | None = None


class DocumentBootstrapDocumentApi(BaseModel):
    id: int
    title: str
    role: Literal["owner", "editor", "viewer"]
    isAiEnabled: bool


class DocumentBootstrapEnvelope(BaseModel):
    document: DocumentBootstrapDocumentApi
    collab: DocumentBootstrapCollabApi


class DocumentBootstrapResponse(BaseModel):
    data: DocumentBootstrapEnvelope


class DocumentListItem(BaseModel):
    id: int
    title: str
    updatedAt: str
    role: Literal["owner", "editor", "viewer"]
    owner: DocumentOwnerApi


class DocumentListEnvelope(BaseModel):
    items: list[DocumentListItem]


class DocumentListResponse(BaseModel):
    data: DocumentListEnvelope


class DocumentPermissionCreate(BaseModel):
    document_id: int
    user_id: int
    permission: Literal["read", "write", "owner"]


class DocumentShareCreate(BaseModel):
    identifier: str = Field(
        min_length=1, max_length=255, example="teammate@example.com"
    )
    role: Literal["editor", "viewer"]


class DocumentShareUpdate(BaseModel):
    role: Literal["editor", "viewer"]


class UserDocumentPermission(BaseModel):
    document_id: int
    title: str
    permission: str


class UserPermissionsResponse(BaseModel):
    documents: list[UserDocumentPermission]


class DocumentUserPermission(BaseModel):
    user_id: int
    username: str
    email: str
    permission: str


class DocumentPermissionsResponse(BaseModel):
    document_id: int
    title: str
    users: list[DocumentUserPermission]


class DocumentVersionCreatedByApi(BaseModel):
    id: int
    displayName: str


class DocumentVersionApi(BaseModel):
    id: int
    versionNumber: int
    createdAt: str
    title: str
    createdBy: DocumentVersionCreatedByApi | None


class DocumentVersionsEnvelope(BaseModel):
    items: list[DocumentVersionApi]


class DocumentVersionsResponse(BaseModel):
    data: DocumentVersionsEnvelope


class DocumentVersionEnvelope(BaseModel):
    version: DocumentVersionApi


class DocumentVersionResponse(BaseModel):
    data: DocumentVersionEnvelope


class DocumentVersionCreate(BaseModel):
    label: str = Field(
        min_length=1,
        max_length=255,
        example="Manual snapshot at 10:30",
    )


class AdminUserItem(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    password_hash: str


class AdminUsersResponse(BaseModel):
    users: list[AdminUserItem]


class AdminDocumentRoleItem(BaseModel):
    user_id: int
    username: str
    permission: str


class AdminDocumentItem(BaseModel):
    id: int
    title: str
    content: str
    owner_id: int
    owner_username: str
    viewers: list[AdminDocumentRoleItem]
    writers: list[AdminDocumentRoleItem]
    updated_at: datetime
    edit_count: int
    ai_edits: int


class AdminDocumentsResponse(BaseModel):
    documents: list[AdminDocumentItem]
