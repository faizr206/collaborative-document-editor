from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.ai.service import AIService
from app.db import get_session
from app.models import AIInteraction, Document, DocumentPermission

router = APIRouter(prefix="/api/ai", tags=["AI"])

ai_service = AIService()


class AIRequest(BaseModel):
    action_type: str
    source_text: str
    context: str = ""
    instruction: str = ""
    document_id: int
    user_id: int


def user_can_use_ai(session: Session, document_id: int, user_id: int) -> bool:
    document = session.exec(
        select(Document).where(Document.id == document_id)
    ).first()

    if not document:
        return False

    if document.owner_id == user_id:
        return True

    permission = session.exec(
        select(DocumentPermission).where(
            DocumentPermission.document_id == document_id,
            DocumentPermission.user_id == user_id,
        )
    ).first()

    if not permission:
        return False

    return permission.permission in {"write", "editor", "owner"}


@router.post("/suggest")
def create_ai_suggestion(
    payload: AIRequest,
    session: Session = Depends(get_session),
):
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text cannot be empty")

    if not user_can_use_ai(session, payload.document_id, payload.user_id):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to use AI for this document",
        )

    try:
        result = ai_service.generate_suggestion(
            action_type=payload.action_type,
            source_text=payload.source_text,
            context=payload.context,
            instruction=payload.instruction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    interaction = AIInteraction(
        document_id=payload.document_id,
        user_id=payload.user_id,
        action_type=payload.action_type,
        source_text=payload.source_text,
        context=payload.context,
        instruction=payload.instruction,
        result_text=result,
    )
    session.add(interaction)
    session.commit()
    session.refresh(interaction)

    return {
        "data": {
            "id": interaction.id,
            "actionType": payload.action_type,
            "originalText": payload.source_text,
            "suggestion": result,
            "createdAt": interaction.created_at,
        }
    }


@router.post("/stream")
async def stream_ai_suggestion(
    payload: AIRequest,
    session: Session = Depends(get_session),
):
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text cannot be empty")

    if not user_can_use_ai(session, payload.document_id, payload.user_id):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to use AI for this document",
        )

    async def event_generator():
        try:
            collected_text = ""

            async for chunk in ai_service.stream_suggestion(
                action_type=payload.action_type,
                source_text=payload.source_text,
                context=payload.context,
                instruction=payload.instruction,
            ):
                collected_text += chunk
                yield f"data: {chunk}\n\n"

            interaction = AIInteraction(
                document_id=payload.document_id,
                user_id=payload.user_id,
                action_type=payload.action_type,
                source_text=payload.source_text,
                context=payload.context,
                instruction=payload.instruction,
                result_text=collected_text,
            )
            session.add(interaction)
            session.commit()

        except ValueError as exc:
            yield f"data: ERROR: {str(exc)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )