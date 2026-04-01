from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select
from app.models import Document, DocumentPermission, User
from app.schemas import DocumentPermissionCreate
from app.db import get_session
from datetime import datetime
router = APIRouter(prefix="/permissions", tags=["permissions"])

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