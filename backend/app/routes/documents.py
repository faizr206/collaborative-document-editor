from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select
from app.models import Document, User
from app.schemas import DocumentCreate, DocumentRead, DocumentUpdate
from app.db import get_session
from datetime import datetime
from app.auth import CurrentUser

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(
        document: DocumentCreate,
        current_user: CurrentUser,
        session: Session = Depends(get_session)
):
    new_doc = Document(
        title=document.title,
        content=document.content,
        owner_id=current_user.id
    )

    session.add(new_doc)
    session.commit()
    session.refresh(new_doc)

    return new_doc

@router.get("/", response_model=list[DocumentRead])
def list_all_documents(
        session: Session = Depends(get_session)
):
    documents = session.exec(select(Document)).all()
    return documents

@router.get("/{document_id}", response_model=DocumentRead)
def get_document_by_id(
        document_id: int,
        session: Session = Depends(get_session)
):
    document = session.exec(select(Document).where(Document.id == document_id)).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

#Document updates and deletes
@router.put("/{document_id}", response_model=DocumentUpdate)
def update_document_by_id(
        document_id: int,
        document_update: DocumentUpdate,
        current_user: CurrentUser,
        session: Session = Depends(get_session)
     ):
     changed = False
     document = session.exec(select(Document).where(Document.id == document_id)).first()
     if not document:
          raise HTTPException(status_code=404, detail="Document not found")

     if document_update.title is not None:
          document.title = document_update.title
          changed = True
     if document_update.content is not None:
          document.content = document_update.content
          changed = True
     if changed:
          document.updated_at = datetime.now()
          session.add(document)
          session.commit()
          session.refresh(document)

     return document

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_by_id(
        document_id: int,
        current_user: CurrentUser,
        session: Session = Depends(get_session)
     ):
    document = session.exec(select(Document).where(Document.id == document_id)).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    session.delete(document)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

