from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.db import get_session
from app.models import (
    User,
    Document,
    DocumentPermission,
    DocumentVersion,
    AIInteraction,
)
from app.auth import ensure_admin
from app.schemas import (
    AdminUsersResponse,
    AdminUserItem,
    AdminDocumentsResponse,
    AdminDocumentItem,
    AdminDocumentRoleItem,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/check_all_users", response_model=AdminUsersResponse)
def check_all_users(
    admin_user: User = Depends(ensure_admin),
    session: Session = Depends(get_session),
):
    users = session.exec(select(User)).all()
    return AdminUsersResponse(
        users=[
            AdminUserItem(
                id=user.id,
                username=user.username,
                email=user.email,
                created_at=user.created_at,
                password_hash=user.password_hash,
            )
            for user in users
        ]
    )


@router.get("/check_all_documents", response_model=AdminDocumentsResponse)
def check_all_documents(
    admin_user: User = Depends(ensure_admin),
    session: Session = Depends(get_session),
):
    documents = session.exec(select(Document)).all()
    permission_rows = session.exec(select(DocumentPermission, User).join(User)).all()

    permissions_by_doc = defaultdict(list)
    for permission, user in permission_rows:
        permissions_by_doc[permission.document_id].append((permission, user))

    result = []
    for document in documents:
        owner = session.get(User, document.owner_id)
        owner_username = owner.username if owner else ""

        viewers = []
        writers = []
        for permission, user in permissions_by_doc.get(document.id, []):
            if permission.permission == "read":
                viewers.append(
                    AdminDocumentRoleItem(
                        user_id=user.id,
                        username=user.username,
                        permission=permission.permission,
                    )
                )
            elif permission.permission == "write":
                writers.append(
                    AdminDocumentRoleItem(
                        user_id=user.id,
                        username=user.username,
                        permission=permission.permission,
                    )
                )

        edit_count = len(
            session.exec(
                select(DocumentVersion).where(
                    DocumentVersion.document_id == document.id
                )
            ).all()
        )
        ai_edits = len(
            session.exec(
                select(AIInteraction).where(AIInteraction.document_id == document.id)
            ).all()
        )

        result.append(
            AdminDocumentItem(
                id=document.id,
                title=document.title,
                content=document.content,
                owner_id=document.owner_id,
                owner_username=owner_username,
                viewers=viewers,
                writers=writers,
                updated_at=document.updated_at,
                edit_count=edit_count,
                ai_edits=ai_edits,
            )
        )

    return AdminDocumentsResponse(documents=result)
