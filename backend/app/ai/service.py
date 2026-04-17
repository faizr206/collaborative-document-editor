from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator

from app.ai.prompts import (
    MAX_CONTEXT_CHARS,
    MAX_SOURCE_CHARS,
    PROMPT_VERSION,
    get_prompt_template,
)
from app.ai.provider import LLMGenerationRequest, get_provider


@dataclass(frozen=True)
class PreparedPrompt:
    action_type: str
    source_text: str
    context_excerpt: str
    instruction: str
    options: dict[str, Any]
    prompt: str
    request_id: str


class AIService:
    def __init__(self) -> None:
        self.provider = get_provider()
        self._cancel_events: dict[str, asyncio.Event] = {}

    def supported_actions(self) -> list[str]:
        return [
            "rewrite",
            "summarize",
            "translate",
            "expand",
            "fix_grammar",
            "custom_prompt",
            "shorten",
        ]

    def prepare_prompt(
        self,
        *,
        action_type: str,
        source_text: str,
        document_content: str = "",
        context: str = "",
        instruction: str = "",
        options: dict[str, Any] | None = None,
        request_id: str | None = None,
    ) -> PreparedPrompt:
        if not source_text.strip():
            raise ValueError("source_text cannot be empty")

        if action_type not in self.supported_actions():
            raise ValueError(f"Unsupported action type: {action_type}")

        normalized_options = options or {}
        context_excerpt = self._build_context_excerpt(
            document_content=document_content,
            source_text=source_text,
            context=context,
        )
        trimmed_source = source_text.strip()[:MAX_SOURCE_CHARS]
        template = get_prompt_template(action_type)
        prompt = template.render(
            source_text=trimmed_source,
            context_excerpt=context_excerpt,
            instruction=instruction.strip(),
            options=normalized_options,
        )

        return PreparedPrompt(
            action_type=action_type,
            source_text=trimmed_source,
            context_excerpt=context_excerpt,
            instruction=instruction.strip(),
            options=normalized_options,
            prompt=prompt,
            request_id=request_id or str(uuid.uuid4()),
        )

    async def generate_suggestion(
        self,
        prepared: PreparedPrompt,
    ) -> str:
        return await self.provider.generate(self._to_provider_request(prepared))

    async def stream_suggestion(
        self,
        prepared: PreparedPrompt,
    ) -> AsyncIterator[str]:
        cancel_event = self._cancel_events.setdefault(
            prepared.request_id, asyncio.Event()
        )
        try:
            async for chunk in self.provider.stream(
                self._to_provider_request(prepared)
            ):
                if cancel_event.is_set():
                    raise asyncio.CancelledError()
                yield chunk
        finally:
            self._cancel_events.pop(prepared.request_id, None)

    def cancel(self, request_id: str) -> bool:
        cancel_event = self._cancel_events.get(request_id)
        if not cancel_event:
            return False
        cancel_event.set()
        return True

    @property
    def provider_name(self) -> str:
        return self.provider.provider_name

    @property
    def model_name(self) -> str:
        return self.provider.model_name

    @property
    def prompt_version(self) -> str:
        return PROMPT_VERSION

    def serialize_options(self, options: dict[str, Any] | None) -> str:
        return json.dumps(options or {}, sort_keys=True)

    def _to_provider_request(self, prepared: PreparedPrompt) -> LLMGenerationRequest:
        return LLMGenerationRequest(
            action_type=prepared.action_type,
            prompt=prepared.prompt,
            source_text=prepared.source_text,
            context_excerpt=prepared.context_excerpt,
            instruction=prepared.instruction,
            options=prepared.options,
        )

    def _build_context_excerpt(
        self,
        *,
        document_content: str,
        source_text: str,
        context: str,
    ) -> str:
        explicit_context = (context or "").strip()
        if explicit_context:
            return explicit_context[:MAX_CONTEXT_CHARS]

        haystack = document_content or ""
        needle = source_text.strip()
        if not haystack.strip():
            return ""

        if not needle:
            return self._trim_balanced(haystack, 0, MAX_CONTEXT_CHARS)

        match_index = haystack.find(needle)
        if match_index == -1:
            return self._trim_balanced(haystack, 0, MAX_CONTEXT_CHARS)

        return self._trim_balanced(haystack, match_index, MAX_CONTEXT_CHARS)

    def _trim_balanced(self, text: str, center_index: int, limit: int) -> str:
        if len(text) <= limit:
            return text

        half = limit // 2
        start = max(center_index - half, 0)
        end = min(start + limit, len(text))
        start = max(end - limit, 0)

        excerpt = text[start:end]
        if start > 0:
            excerpt = "..." + excerpt[3:]
        if end < len(text):
            excerpt = excerpt[:-3] + "..."
        return excerpt
