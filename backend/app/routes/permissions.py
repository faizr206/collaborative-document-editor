from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.access import (
    normalize_permission,
    require_document_owner,
    require_document_role,
    resolve_user_by_identifier,
    role_to_db_permission,
)
from app.auth import CurrentUser
from app.db import get_session
from app.models import DocumentPermission, User
from app.schemas import (
    DocumentPermissionsResponse,
    DocumentShareCreate,
    DocumentShareUpdate,
    DocumentUserPermission,
    UserDocumentPermission,
    UserPermissionsResponse,
)

router = APIRouter(tags=["permissions"])

LEGACY_BASE = "/api/permissions"
V1_BASE = "/api/v1/documents"


def _serialize_document_members(
    session: Session, document_id: int
) -> list[DocumentUserPermission]:
    permissions = session.exec(
        select(DocumentPermission, User)
        .join(User, User.id == DocumentPermission.user_id)
        .where(DocumentPermission.document_id == document_id)
    ).all()

    members: list[DocumentUserPermission] = []
    seen_user_ids: set[int] = set()

    for permission, user in permissions:
        role = normalize_permission(permission.permission)
        if user.id in seen_user_ids:
            continue
        seen_user_ids.add(user.id)
        members.append(
            DocumentUserPermission(
                user_id=user.id,
                username=user.username,
                email=user.email,
                permission=role,
            )
        )

    return sorted(
        members,
        key=lambda member: (member.permission != "owner", member.username.lower()),
    )


@router.get(f"{LEGACY_BASE}/my", response_model=UserPermissionsResponse)
def get_user_permissions(
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(DocumentPermission).where(DocumentPermission.user_id == current_user.id)
    ).all()
    items = [
        UserDocumentPermission(
            document_id=permission.document_id,
            title=require_document_role(
                session, permission.document_id, current_user.id, "viewer"
            )[0].title,
            permission=normalize_permission(permission.permission),
        )
        for permission in rows
    ]

    return UserPermissionsResponse(documents=items)


@router.get(
    f"{LEGACY_BASE}/documents/{{document_id}}",
    response_model=DocumentPermissionsResponse,
)
@router.get(
    f"{V1_BASE}/{{document_id}}/members",
    response_model=DocumentPermissionsResponse,
)
def get_document_permissions(
    document_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, _ = require_document_role(session, document_id, current_user.id, "viewer")
    owner = session.get(User, document.owner_id)
    members = _serialize_document_members(session, document_id)

    if owner and all(member.user_id != owner.id for member in members):
        members.insert(
            0,
            DocumentUserPermission(
                user_id=owner.id,
                username=owner.username,
                email=owner.email,
                permission="owner",
            ),
        )

    return DocumentPermissionsResponse(
        document_id=document_id, title=document.title, users=members
    )


@router.post(
    f"{LEGACY_BASE}/documents/{{document_id}}/members",
    response_model=DocumentUserPermission,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    f"{V1_BASE}/{{document_id}}/members",
    response_model=DocumentUserPermission,
    status_code=status.HTTP_201_CREATED,
)
def grant_permission(
    document_id: int,
    payload: DocumentShareCreate,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, _ = require_document_owner(session, document_id, current_user.id)
    target_user = resolve_user_by_identifier(session, payload.identifier)

    if target_user.id == document.owner_id:
        raise HTTPException(status_code=400, detail="The owner already has full access")

    db_permission = role_to_db_permission(payload.role)
    doc_permission = session.exec(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == target_user.id,
        )
    ).first()

    if doc_permission:
        doc_permission.permission = db_permission
    else:
        doc_permission = DocumentPermission(
            document_id=document_id,
            user_id=target_user.id,
            permission=db_permission,
        )
        session.add(doc_permission)

    session.commit()
    session.refresh(doc_permission)

    return DocumentUserPermission(
        user_id=target_user.id,
        username=target_user.username,
        email=target_user.email,
        permission=payload.role,
    )


@router.patch(
    f"{LEGACY_BASE}/documents/{{document_id}}/members/{{user_id}}",
    response_model=DocumentUserPermission,
)
@router.patch(
    f"{V1_BASE}/{{document_id}}/members/{{user_id}}",
    response_model=DocumentUserPermission,
)
def update_member_role(
    document_id: int,
    user_id: int,
    payload: DocumentShareUpdate,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    require_document_owner(session, document_id, current_user.id)

    permission = session.exec(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id,
        )
    ).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Shared member not found")

    permission.permission = role_to_db_permission(payload.role)
    session.add(permission)
    session.commit()
    session.refresh(permission)

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return DocumentUserPermission(
        user_id=user.id,
        username=user.username,
        email=user.email,
        permission=payload.role,
    )


@router.delete(
    f"{LEGACY_BASE}/documents/{{document_id}}/members/{{user_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@router.delete(
    f"{V1_BASE}/{{document_id}}/members/{{user_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member(
    document_id: int,
    user_id: int,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
):
    document, _ = require_document_owner(session, document_id, current_user.id)

    if user_id == document.owner_id:
        raise HTTPException(status_code=400, detail="The owner cannot be removed")

    permission = session.exec(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id,
        )
    ).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Shared member not found")

    session.delete(permission)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
