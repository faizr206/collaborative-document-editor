from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.ai.service import AIService

router = APIRouter(prefix="/api/ai", tags=["AI"])

ai_service = AIService()


class AIRequest(BaseModel):
    action_type: str
    source_text: str
    context: str = ""
    instruction: str = ""


@router.post("/suggest")
def create_ai_suggestion(payload: AIRequest):
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text cannot be empty")

    try:
        result = ai_service.generate_suggestion(
            action_type=payload.action_type,
            source_text=payload.source_text,
            context=payload.context,
            instruction=payload.instruction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "data": {
            "actionType": payload.action_type,
            "originalText": payload.source_text,
            "suggestion": result,
        }
    }


@router.post("/stream")
async def stream_ai_suggestion(payload: AIRequest):
    if not payload.source_text.strip():
        raise HTTPException(status_code=400, detail="source_text cannot be empty")

    async def event_generator():
        try:
            async for chunk in ai_service.stream_suggestion(
                action_type=payload.action_type,
                source_text=payload.source_text,
                context=payload.context,
                instruction=payload.instruction,
            ):
                yield f"data: {chunk}\n\n"
        except ValueError as exc:
            yield f"data: ERROR: {str(exc)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )