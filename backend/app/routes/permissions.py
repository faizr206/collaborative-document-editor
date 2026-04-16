from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select
from app.models import Document, DocumentPermission, User
from app.schemas import (
    DocumentPermissionCreate,
    UserPermissionsResponse,
    UserDocumentPermission,
    DocumentPermissionsResponse,
    DocumentUserPermission,
)
from app.db import get_session
from app.auth import CurrentUser
from datetime import datetime
router = APIRouter(prefix="/api/permissions", tags=["permissions"])

@router.post("/grant", response_model=str, status_code=status.HTTP_201_CREATED)
def grant_permission(
    permissionData: DocumentPermissionCreate,
    session: Session = Depends(get_session)
):
     # Check if document exists
     document = session.exec(select(Document).where(Document.id == permissionData.document_id)).first()
     if not document:
          raise HTTPException(status_code=404, detail="Document not found")

     # Check if user exists
     user = session.exec(select(User).where(User.id == permissionData.user_id)).first()
     if not user:
          raise HTTPException(status_code=404, detail="User not found")

     # Create or update permission
     doc_permission = session.exec(
          select(DocumentPermission).where(
               DocumentPermission.document_id == permissionData.document_id,
               DocumentPermission.user_id == permissionData.user_id
          )).first()
     if doc_permission:
          doc_permission.permission = permissionData.permission
     else:
          doc_permission = DocumentPermission(
               document_id=permissionData.document_id,
               user_id=permissionData.user_id,
               permission=permissionData.permission
          )
          session.add(doc_permission)
     session.commit()
     session.refresh(doc_permission)
     return f"Permission '{permissionData.permission}' granted to user {user.id} for document '{document.title}'"

@router.get("/user_side", response_model=UserPermissionsResponse)
def get_user_permissions(
     current_user: CurrentUser,
     session: Session = Depends(get_session),
):
     permissions = session.exec(
          select(DocumentPermission, Document).where(
               DocumentPermission.user_id == current_user.id
          ).join(Document)
     ).all()
     
     documents = [
          UserDocumentPermission(
               document_id=perm.document_id,
               title=doc.title,
               permission=perm.permission
          )
          for perm, doc in permissions
     ]
     
     return UserPermissionsResponse(documents=documents)

@router.get("/document_side/{document_id}", response_model=DocumentPermissionsResponse)
def get_document_permissions(
     document_id: int,
     session: Session = Depends(get_session)
):
     document = session.exec(select(Document).where(Document.id == document_id)).first()
     if not document:
          raise HTTPException(status_code=404, detail="Document not found")
     
     permissions = session.exec(
          select(DocumentPermission, User).where(
               DocumentPermission.document_id == document_id
          ).join(User)
     ).all()
     
     users = [
          DocumentUserPermission(
               user_id=perm.user_id,
               username=user.username,
               permission=perm.permission
          )
          for perm, user in permissions
     ]
     
     return DocumentPermissionsResponse(
          document_id=document_id,
          title=document.title,
          users=users
     )
