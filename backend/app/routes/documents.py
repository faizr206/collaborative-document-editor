from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session, select

from app.access import get_document_role, require_document_owner, require_document_role
from app.auth import CurrentUser
from app.db import get_session
from app.models import Document, DocumentPermission, User
from app.schemas import (
    DocumentCreate,
    DocumentListItem,
    DocumentListResponse,
    DocumentOwnerApi,
    DocumentResponse,
    DocumentUpdate,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def serialize_timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def serialize_owner(owner: User | None) -> dict:
    if owner is None:
        return DocumentOwnerApi(id=0, username="Unknown", email="").model_dump()
    return DocumentOwnerApi(
        id=owner.id, username=owner.username, email=owner.email
    ).model_dump()


def serialize_document(document: Document, owner: User | None, role: str) -> dict:
    return {
        "data": {
            "document": {
                "id": document.id,
                "title": document.title,
                "content": document.content,
                "createdAt": serialize_timestamp(document.created_at),
                "updatedAt": serialize_timestamp(document.updated_at),
                "role": role,
                "owner": serialize_owner(owner),
            }
        }
    }


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(
    document: DocumentCreate,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    new_doc = Document(
        title=document.title,
        content=document.content or "",
        owner_id=current_user.id,
    )
    session.add(new_doc)
    session.commit()
    session.refresh(new_doc)

    session.add(
        DocumentPermission(
            document_id=new_doc.id,
            user_id=current_user.id,
            permission="owner",
        )
    )
    session.commit()

    return serialize_document(new_doc, current_user, "owner")


@router.get("", response_model=DocumentListResponse)
def list_documents(
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    documents = session.exec(
        select(Document).order_by(Document.updated_at.desc())
    ).all()
    items: list[DocumentListItem] = []

    for document in documents:
        role = get_document_role(session, document, current_user.id)
        if role is None:
            continue

        owner = session.get(User, document.owner_id)
        items.append(
            DocumentListItem(
                id=document.id,
                title=document.title,
                updatedAt=serialize_timestamp(document.updated_at),
                role=role,
                owner=DocumentOwnerApi(
                    id=owner.id if owner else 0,
                    username=owner.username if owner else "Unknown",
                    email=owner.email if owner else "",
                ),
            )
        )

    return {"data": {"items": items}}


@router.get("/my/documents", response_model=DocumentListResponse)
def list_documents_of_current_user(
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    return list_documents(current_user=current_user, session=session)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document_by_id(
    document_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, role = require_document_role(
        session, document_id, current_user.id, "viewer"
    )
    owner = session.get(User, document.owner_id)
    return serialize_document(document, owner, role)


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document_by_id(
    document_id: int,
    document_update: DocumentUpdate,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, role = require_document_role(
        session, document_id, current_user.id, "editor"
    )
    changed = False

    if document_update.title is not None:
        document.title = document_update.title
        changed = True
    if document_update.content is not None:
        document.content = document_update.content
        changed = True

    if changed:
        document.updated_at = datetime.now(timezone.utc)
        session.add(document)
        session.commit()
        session.refresh(document)

    owner = session.get(User, document.owner_id)
    return serialize_document(document, owner, role)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_by_id(
    document_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, _ = require_document_owner(session, document_id, current_user.id)

    permissions = session.exec(
        select(DocumentPermission).where(DocumentPermission.document_id == document_id)
    ).all()
    for permission in permissions:
        session.delete(permission)

    session.delete(document)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
