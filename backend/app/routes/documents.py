from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlmodel import Session, select

from app.access import get_document_role, require_document_owner, require_document_role
from app.auth import CurrentUser
from app.db import get_session
from app.models import Document, DocumentPermission, DocumentVersion, User, DocumentSharingLinks
from app.schemas import (
    DocumentBootstrapDocumentApi,
    DocumentBootstrapResponse,
    DocumentCreate,
    DocumentListItem,
    DocumentListResponse,
    DocumentOwnerApi,
    DocumentResponse,
    DocumentUpdate,
    DocumentVersionApi,
    DocumentVersionCreate,
    DocumentVersionCreatedByApi,
    DocumentVersionResponse,
    DocumentVersionsResponse,
    ShareLinkCreate,
    ShareLinkRead,
    ShareLinkWithUrlRead
)
import secrets

router = APIRouter(tags=["documents"])

LEGACY_BASE = "/api/documents"
V1_BASE = "/api/v1/documents"


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


def serialize_document_version(
    version: DocumentVersion,
    *,
    version_number: int,
    author: User | None,
) -> DocumentVersionApi:
    return DocumentVersionApi(
        id=version.id,
        versionNumber=version_number,
        createdAt=serialize_timestamp(version.created_at),
        title=version.label or "Snapshot",
        createdBy=DocumentVersionCreatedByApi(
            id=author.id,
            displayName=author.username,
        )
        if author
        else None,
    )


def build_bootstrap_payload(document: Document, role: str) -> DocumentBootstrapResponse:
    return DocumentBootstrapResponse(
        data={
            "document": DocumentBootstrapDocumentApi(
                id=document.id,
                title=document.title,
                role=role,
                isAiEnabled=role != "viewer",
            ),
            "collab": {
                "roomId": f"doc_{document.id}",
                "websocketUrl": "/ws",
                "token": None,
            },
        }
    )


def create_snapshot(
    *,
    session: Session,
    document: Document,
    user_id: int,
    label: str,
) -> DocumentVersion:
    snapshot = DocumentVersion(
        document_id=document.id,
        content=document.content,
        label=label,
        edited_by=user_id,
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return snapshot


def list_document_versions_payload(
    session: Session,
    document_id: int,
) -> DocumentVersionsResponse:
    versions = session.exec(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc(), DocumentVersion.id.desc())
    ).all()

    total = len(versions)
    items = []
    for index, version in enumerate(versions):
        author = session.get(User, version.edited_by)
        items.append(
            serialize_document_version(
                version,
                version_number=total - index,
                author=author,
            )
        )

    return DocumentVersionsResponse(data={"items": items})


@router.post(
    LEGACY_BASE,
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    V1_BASE,
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
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


@router.get(LEGACY_BASE, response_model=DocumentListResponse)
@router.get(V1_BASE, response_model=DocumentListResponse)
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


@router.get(f"{LEGACY_BASE}/my/documents", response_model=DocumentListResponse)
@router.get(f"{V1_BASE}/my/documents", response_model=DocumentListResponse)
def list_documents_of_current_user(
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    return list_documents(current_user=current_user, session=session)


@router.get(f"{LEGACY_BASE}/{{document_id}}", response_model=DocumentResponse)
@router.get(f"{V1_BASE}/{{document_id}}", response_model=DocumentResponse)
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


@router.put(f"{LEGACY_BASE}/{{document_id}}", response_model=DocumentResponse)
@router.put(f"{V1_BASE}/{{document_id}}", response_model=DocumentResponse)
@router.patch(f"{V1_BASE}/{{document_id}}", response_model=DocumentResponse)
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


@router.delete(f"{LEGACY_BASE}/{{document_id}}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete(f"{V1_BASE}/{{document_id}}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get(
    f"{V1_BASE}/{{document_id}}/bootstrap",
    response_model=DocumentBootstrapResponse,
)
def get_document_bootstrap(
    document_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, role = require_document_role(
        session, document_id, current_user.id, "viewer"
    )
    return build_bootstrap_payload(document, role)


@router.get(
    f"{V1_BASE}/{{document_id}}/versions",
    response_model=DocumentVersionsResponse,
)
def list_document_versions(
    document_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    require_document_role(session, document_id, current_user.id, "viewer")
    return list_document_versions_payload(session, document_id)


@router.post(
    f"{V1_BASE}/{{document_id}}/versions",
    response_model=DocumentVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document_version(
    document_id: int,
    payload: DocumentVersionCreate,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, _ = require_document_role(session, document_id, current_user.id, "editor")
    snapshot = create_snapshot(
        session=session,
        document=document,
        user_id=current_user.id,
        label=payload.label,
    )
    versions = list_document_versions_payload(session, document_id).data.items
    created = next(version for version in versions if version.id == snapshot.id)
    return {"data": {"version": created}}


@router.post(
    f"{V1_BASE}/{{document_id}}/versions/{{version_id}}/restore",
    response_model=DocumentResponse,
)
def restore_document_version(
    document_id: int,
    version_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, role = require_document_role(
        session, document_id, current_user.id, "editor"
    )
    version = session.get(DocumentVersion, version_id)
    if version is None or version.document_id != document_id:
        raise HTTPException(status_code=404, detail="Document version not found")

    document.content = version.content
    document.updated_at = datetime.now(timezone.utc)
    session.add(document)
    session.commit()
    session.refresh(document)

    create_snapshot(
        session=session,
        document=document,
        user_id=current_user.id,
        label=f"Restored from snapshot #{version.id}",
    )

    owner = session.get(User, document.owner_id)
    return serialize_document(document, owner, role)


@router.post(
    "/share/{document_id}",
    response_model=ShareLinkWithUrlRead,
    status_code=status.HTTP_201_CREATED
)
def share_this_document_via_link(
    document_id: int,
    share_data: ShareLinkCreate,
    request: Request,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
    
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    owner = session.get(User, document.owner_id)
    if current_user.id != owner.id:
        raise HTTPException(status_code=403, detail="You must have owner role to share this document")
    token = secrets.token_urlsafe(32)

    share_link = DocumentSharingLinks(
        document_id=document_id,
        owner_id=current_user.id,
        token=token,
        role=share_data.role,
        login_required=share_data.login_required,
        multi_use=share_data.multi_use,
    )

    session.add(share_link)
    session.commit()
    session.refresh(share_link)

    link_info = ShareLinkRead(
        id=share_link.id,
        login_required=share_link.login_required,
        owner_id=share_link.owner_id,
        token=share_link.token,
        role=share_link.role,
        multi_use=share_link.multi_use,
        expiry=share_link.expiry,
        is_active=share_link.is_active,
    )
    share_url = f"{request.base_url}share/{token}"
    payload = ShareLinkWithUrlRead(info=link_info, final_url=share_url)
    return payload

@router.get("/share/{token}")
def open_share_link(
    token: str,
    session: Session = Depends(get_session),
):
    link_task = session.exec(
        select(DocumentSharingLinks).where(DocumentSharingLinks.token == token)
    ).first()

    if not link_task:
        raise HTTPException(status_code=404, detail="Share link not found")

    now = datetime.now(timezone.utc)

    if not link_task.is_active:
        raise HTTPException(status_code=403, detail="Share link is no longer active")

    if link_task.expiry and link_task.expiry.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=403, detail="Share link has expired")

    return {
        "message": "Share link is valid",
        "document_id": link_task.document_id,
        "role": link_task.role,
        "login_required": link_task.login_required,
        "multi_use": link_task.multi_use,
        "token": link_task.token,
    }

@router.post("/share/{token}/accept")
def accept_share_link(
    token: str,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    link_task = session.exec(
        select(DocumentSharingLinks).where(DocumentSharingLinks.token == token)
    ).first()

    if not link_task:
        raise HTTPException(status_code=404, detail="Share link not found")

    now = datetime.now(timezone.utc)

    if not link_task.is_active:
        raise HTTPException(status_code=403, detail="Share link is no longer active")

    if link_task.expiry and link_task.expiry.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=403, detail="Share link has expired")

    if current_user.id == link_task.owner_id:
        return {
            "message": "You already own this document",
            "document_id": link_task.document_id,
            "role": "owner",
        }

    existing_permission = session.exec(
        select(DocumentPermission).where(
            DocumentPermission.document_id == link_task.document_id,
            DocumentPermission.user_id == current_user.id,
        )
    ).first()

    if existing_permission:
        existing_permission.permission = link_task.role
        session.add(existing_permission)
    else:
        new_permission = DocumentPermission(
            document_id=link_task.document_id,
            user_id=current_user.id,
            permission=link_task.role,
        )
        session.add(new_permission)

    link_task.use_count += 1

    if not link_task.multi_use:
        link_task.is_active = False

    session.add(link_task)
    session.commit()

    return {
        "message": "Access granted successfully",
        "document_id": link_task.document_id,
        "role": link_task.role,
    }