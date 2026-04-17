from __future__ import annotations

from typing import Literal

from fastapi import HTTPException
from sqlmodel import Session, select

from app.models import Document, DocumentPermission, User

DocumentRole = Literal["owner", "editor", "viewer"]

ROLE_RANK: dict[DocumentRole, int] = {
    "viewer": 1,
    "editor": 2,
    "owner": 3,
}

DB_PERMISSION_TO_ROLE: dict[str, DocumentRole] = {
    "read": "viewer",
    "viewer": "viewer",
    "write": "editor",
    "editor": "editor",
    "owner": "owner",
}

ROLE_TO_DB_PERMISSION: dict[DocumentRole, str] = {
    "viewer": "read",
    "editor": "write",
    "owner": "owner",
}


def normalize_permission(value: str) -> DocumentRole:
    normalized = DB_PERMISSION_TO_ROLE.get(value.strip().lower())
    if normalized is None:
        raise HTTPException(status_code=400, detail="Invalid permission value")
    return normalized


def role_to_db_permission(role: DocumentRole) -> str:
    return ROLE_TO_DB_PERMISSION[role]


def get_document_or_404(session: Session, document_id: int) -> Document:
    document = session.exec(select(Document).where(Document.id == document_id)).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def get_document_role(
    session: Session, document: Document, user_id: int
) -> DocumentRole | None:
    if document.owner_id == user_id:
        return "owner"

    permission = session.exec(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document.id,
            DocumentPermission.user_id == user_id,
        )
    ).first()
    if not permission:
        return None

    return normalize_permission(permission.permission)


def require_document_role(
    session: Session,
    document_id: int,
    user_id: int,
    minimum_role: DocumentRole = "viewer",
) -> tuple[Document, DocumentRole]:
    document = get_document_or_404(session, document_id)
    role = get_document_role(session, document, user_id)

    if role is None or ROLE_RANK[role] < ROLE_RANK[minimum_role]:
        raise HTTPException(
            status_code=403, detail="You do not have permission to access this document"
        )

    return document, role


def require_document_owner(
    session: Session, document_id: int, user_id: int
) -> tuple[Document, DocumentRole]:
    return require_document_role(session, document_id, user_id, "owner")


def resolve_user_by_identifier(session: Session, identifier: str) -> User:
    normalized = identifier.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Email or username is required")

    user = session.exec(
        select(User).where((User.email == normalized) | (User.username == normalized))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
