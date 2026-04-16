from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
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
    document_content: str = ""
    options: dict[str, Any] = Field(default_factory=dict)


class AIReviewRequest(BaseModel):
    review_status: str
    edited_text: Optional[str] = None


def serialize_timestamp(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def user_can_use_ai(session: Session, document_id: int, user_id: int) -> bool:
    document = session.exec(select(Document).where(Document.id == document_id)).first()

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


def get_document_or_404(session: Session, document_id: int) -> Document:
    document = session.exec(select(Document).where(Document.id == document_id)).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def create_interaction_record(
    *,
    session: Session,
    payload: AIRequest,
    prepared,
) -> AIInteraction:
    interaction = AIInteraction(
        request_id=prepared.request_id,
        document_id=payload.document_id,
        user_id=payload.user_id,
        action_type=payload.action_type,
        source_text=prepared.source_text,
        context=payload.context,
        context_excerpt=prepared.context_excerpt,
        instruction=prepared.instruction,
        options_json=ai_service.serialize_options(prepared.options),
        prompt_text=prepared.prompt,
        prompt_version=ai_service.prompt_version,
        provider_name=ai_service.provider_name,
        model_name=ai_service.model_name,
        status="pending",
        review_status="pending",
        updated_at=datetime.now(timezone.utc),
    )
    session.add(interaction)
    session.commit()
    session.refresh(interaction)
    return interaction


def serialize_interaction(interaction: AIInteraction) -> dict[str, Any]:
    return {
        "id": interaction.id,
        "requestId": interaction.request_id,
        "documentId": interaction.document_id,
        "userId": interaction.user_id,
        "actionType": interaction.action_type,
        "sourceText": interaction.source_text,
        "context": interaction.context,
        "contextExcerpt": interaction.context_excerpt,
        "instruction": interaction.instruction,
        "options": json.loads(interaction.options_json or "{}"),
        "promptText": interaction.prompt_text,
        "promptVersion": interaction.prompt_version,
        "provider": interaction.provider_name,
        "model": interaction.model_name,
        "resultText": interaction.result_text,
        "status": interaction.status,
        "reviewStatus": interaction.review_status,
        "errorMessage": interaction.error_message,
        "responseChars": interaction.response_chars,
        "createdAt": serialize_timestamp(interaction.created_at),
        "updatedAt": serialize_timestamp(interaction.updated_at),
        "reviewedAt": serialize_timestamp(interaction.reviewed_at),
    }


def update_interaction(
    interaction: AIInteraction,
    *,
    status: str,
    result_text: str,
    error_message: Optional[str] = None,
) -> None:
    interaction.status = status
    interaction.result_text = result_text
    interaction.response_chars = len(result_text)
    interaction.error_message = error_message
    interaction.updated_at = datetime.now(timezone.utc)


def format_sse_event(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


@router.get("/capabilities")
def get_ai_capabilities():
    return {
        "data": {
            "actions": ai_service.supported_actions(),
            "streamingProtocol": "sse",
            "supportsCancellation": True,
        }
    }


@router.post("/suggest")
async def create_ai_suggestion(
    payload: AIRequest,
    session: Session = Depends(get_session),
):
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text cannot be empty")

    document = get_document_or_404(session, payload.document_id)
    if not user_can_use_ai(session, payload.document_id, payload.user_id):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to use AI for this document",
        )

    prepared = ai_service.prepare_prompt(
        action_type=payload.action_type,
        source_text=payload.source_text,
        document_content=payload.document_content or document.content,
        context=payload.context,
        instruction=payload.instruction,
        options=payload.options,
    )
    interaction = create_interaction_record(session=session, payload=payload, prepared=prepared)

    try:
        result = await ai_service.generate_suggestion(prepared)
    except ValueError as exc:
        update_interaction(interaction, status="error", result_text="", error_message=str(exc))
        session.add(interaction)
        session.commit()
        raise HTTPException(status_code=400, detail=str(exc))

    update_interaction(interaction, status="completed", result_text=result)
    session.add(interaction)
    session.commit()
    session.refresh(interaction)

    return {"data": serialize_interaction(interaction)}


@router.post("/stream")
async def stream_ai_suggestion(
    payload: AIRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text cannot be empty")

    document = get_document_or_404(session, payload.document_id)
    if not user_can_use_ai(session, payload.document_id, payload.user_id):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to use AI for this document",
        )

    prepared = ai_service.prepare_prompt(
        action_type=payload.action_type,
        source_text=payload.source_text,
        document_content=payload.document_content or document.content,
        context=payload.context,
        instruction=payload.instruction,
        options=payload.options,
    )
    interaction = create_interaction_record(session=session, payload=payload, prepared=prepared)

    async def event_generator():
        yield format_sse_event(
            "start",
            {
                "requestId": prepared.request_id,
                "interactionId": interaction.id,
                "status": "pending",
            },
        )

        collected_text = ""

        try:
            async for chunk in ai_service.stream_suggestion(prepared):
                if await request.is_disconnected():
                    ai_service.cancel(prepared.request_id)
                    raise asyncio.CancelledError()

                collected_text += chunk
                yield format_sse_event(
                    "chunk",
                    {
                        "requestId": prepared.request_id,
                        "interactionId": interaction.id,
                        "delta": chunk,
                        "text": collected_text,
                    },
                )

            update_interaction(interaction, status="completed", result_text=collected_text)
            session.add(interaction)
            session.commit()
            session.refresh(interaction)

            yield format_sse_event(
                "complete",
                {
                    "requestId": prepared.request_id,
                    "interactionId": interaction.id,
                    "status": interaction.status,
                    "text": interaction.result_text,
                },
            )
        except asyncio.CancelledError:
            update_interaction(
                interaction,
                status="cancelled",
                result_text=collected_text,
                error_message="Generation cancelled",
            )
            session.add(interaction)
            session.commit()
            session.refresh(interaction)

            yield format_sse_event(
                "cancelled",
                {
                    "requestId": prepared.request_id,
                    "interactionId": interaction.id,
                    "status": interaction.status,
                    "text": interaction.result_text,
                    "message": "Generation cancelled",
                },
            )
        except ValueError as exc:
            update_interaction(
                interaction,
                status="error",
                result_text=collected_text,
                error_message=str(exc),
            )
            session.add(interaction)
            session.commit()
            session.refresh(interaction)

            yield format_sse_event(
                "error",
                {
                    "requestId": prepared.request_id,
                    "interactionId": interaction.id,
                    "status": interaction.status,
                    "text": interaction.result_text,
                    "message": str(exc),
                },
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/cancel/{request_id}")
def cancel_ai_generation(request_id: str):
    cancelled = ai_service.cancel(request_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Generation request not found or already finished")
    return {"data": {"requestId": request_id, "cancelled": True}}


@router.get("/history/{document_id}")
def list_ai_history(
    document_id: int,
    user_id: int,
    limit: int = 20,
    session: Session = Depends(get_session),
):
    get_document_or_404(session, document_id)
    if not user_can_use_ai(session, document_id, user_id):
        raise HTTPException(status_code=403, detail="You do not have permission to view AI history")

    interactions = session.exec(
        select(AIInteraction)
        .where(AIInteraction.document_id == document_id)
        .order_by(AIInteraction.created_at.desc())
        .limit(max(1, min(limit, 100)))
    ).all()

    return {"data": {"items": [serialize_interaction(item) for item in interactions]}}


@router.post("/interactions/{interaction_id}/review")
def review_ai_interaction(
    interaction_id: int,
    payload: AIReviewRequest,
    user_id: int,
    session: Session = Depends(get_session),
):
    allowed_review_statuses = {"accepted", "rejected", "edited"}
    if payload.review_status not in allowed_review_statuses:
        raise HTTPException(status_code=400, detail="Invalid review_status")

    interaction = session.get(AIInteraction, interaction_id)
    if not interaction:
        raise HTTPException(status_code=404, detail="AI interaction not found")

    if not user_can_use_ai(session, interaction.document_id, user_id):
        raise HTTPException(status_code=403, detail="You do not have permission to review this interaction")

    interaction.review_status = payload.review_status
    if payload.review_status == "edited" and payload.edited_text is not None:
        interaction.result_text = payload.edited_text
        interaction.response_chars = len(payload.edited_text)
    interaction.reviewed_at = datetime.now(timezone.utc)
    interaction.updated_at = interaction.reviewed_at

    session.add(interaction)
    session.commit()
    session.refresh(interaction)

    return {"data": serialize_interaction(interaction)}
