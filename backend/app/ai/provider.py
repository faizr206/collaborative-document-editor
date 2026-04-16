from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator, Protocol

import httpx
from app.config import (
    AI_PROVIDER,
    LM_STUDIO_API_KEY,
    LM_STUDIO_BASE_URL,
    LM_STUDIO_MODEL,
    LM_STUDIO_TIMEOUT_SECONDS,
)

DEFAULT_LM_STUDIO_BASE_URL = LM_STUDIO_BASE_URL
DEFAULT_LM_STUDIO_MODEL = LM_STUDIO_MODEL


@dataclass(frozen=True)
class LLMGenerationRequest:
    action_type: str
    prompt: str
    source_text: str
    context_excerpt: str
    instruction: str
    options: dict[str, Any]


class LLMProvider(Protocol):
    provider_name: str
    model_name: str

    async def stream(self, request: LLMGenerationRequest) -> AsyncIterator[str]:
        ...

    async def generate(self, request: LLMGenerationRequest) -> str:
        ...


class MockLLMProvider:
    provider_name = "mock"
    model_name = "deterministic-editor-v1"

    async def generate(self, request: LLMGenerationRequest) -> str:
        return _transform_text(
            action_type=request.action_type,
            source_text=request.source_text,
            instruction=request.instruction,
            options=request.options,
        )

    async def stream(self, request: LLMGenerationRequest) -> AsyncIterator[str]:
        full_text = await self.generate(request)
        chunk_size = 24

        for index in range(0, len(full_text), chunk_size):
            await asyncio.sleep(0.03)
            yield full_text[index:index + chunk_size]


class LMStudioProvider:
    provider_name = "lmstudio"

    def __init__(
        self,
        *,
        base_url: str | None = None,
        model_name: str | None = None,
        api_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or DEFAULT_LM_STUDIO_BASE_URL).rstrip("/")
        self.model_name = model_name or DEFAULT_LM_STUDIO_MODEL
        self.api_key = api_key or LM_STUDIO_API_KEY
        self.timeout = timeout or LM_STUDIO_TIMEOUT_SECONDS

    async def generate(self, request: LLMGenerationRequest) -> str:
        payload = self._build_payload(request, stream=False)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self._headers(),
                )
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPError as exc:
            raise ValueError(f"LM Studio request failed: {exc}") from exc

        choices = body.get("choices") or []
        if not choices:
            raise ValueError("LM Studio returned no choices")

        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            return "".join(
                item.get("text", "")
                for item in content
                if isinstance(item, dict) and item.get("type") == "text"
            ).strip()
        if isinstance(content, str):
            return content.strip()
        raise ValueError("LM Studio returned an unsupported message content shape")

    async def stream(self, request: LLMGenerationRequest) -> AsyncIterator[str]:
        payload = self._build_payload(request, stream=True)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=self._headers(),
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue

                        data = line[6:].strip()
                        if data == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError as exc:
                            raise ValueError("LM Studio returned malformed streaming JSON") from exc

                        choices = chunk.get("choices") or []
                        if not choices:
                            continue

                        delta = choices[0].get("delta") or {}
                        content = delta.get("content")
                        if isinstance(content, str) and content:
                            yield content
        except httpx.HTTPError as exc:
            raise ValueError(f"LM Studio streaming request failed: {exc}") from exc

    def _build_payload(self, request: LLMGenerationRequest, *, stream: bool) -> dict[str, Any]:
        return {
            "model": self.model_name,
            "messages": [
                {
                    "role": "user",
                    "content": request.prompt,
                }
            ],
            "temperature": self._coerce_float(request.options.get("temperature"), 0.2),
            "max_tokens": self._coerce_int(request.options.get("max_tokens"), 512),
            "stream": stream,
        }

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _coerce_float(self, value: Any, default: float) -> float:
        if value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _coerce_int(self, value: Any, default: int) -> int:
        if value is None:
            return default
        try:
            return int(value)
        except (TypeError, ValueError):
            return default


def get_provider() -> LLMProvider:
    provider_name = AI_PROVIDER.lower()

    if provider_name == "mock":
        return MockLLMProvider()
    if provider_name == "lmstudio":
        return LMStudioProvider()

    raise ValueError(f"Unsupported AI provider: {provider_name}")


def _transform_text(
    *,
    action_type: str,
    source_text: str,
    instruction: str,
    options: dict[str, Any],
) -> str:
    stripped = source_text.strip()
    tone = options.get("tone")
    style = options.get("style")
    target_language = options.get("target_language") or instruction or "target language"
    summary_format = options.get("format", "paragraph")
    summary_length = options.get("length", "medium")

    if action_type == "rewrite":
        modifiers = [value for value in [tone, style, instruction] if value]
        suffix = f" ({', '.join(modifiers)})" if modifiers else ""
        return f"Rewritten{suffix}: {stripped}"

    if action_type == "summarize":
        limit_map = {"short": 16, "medium": 30, "long": 45}
        limit = limit_map.get(str(summary_length).lower(), 30)
        words = stripped.split()
        shortened = " ".join(words[:limit])
        if len(words) > limit:
            shortened += "..."
        if summary_format == "bullets":
            return f"- {shortened}"
        return f"Summary: {shortened}"

    if action_type == "translate":
        translated_lines = [
            f"[{target_language}] {line}" if line.strip() else ""
            for line in source_text.splitlines()
        ]
        return "\n".join(translated_lines)

    if action_type == "expand":
        extra = instruction or "with clearer explanation and supporting detail"
        return f"{stripped}\n\nExpanded: {extra}."

    if action_type == "fix_grammar":
        fixed = re.sub(r"\bi\b", "I", source_text)
        fixed = re.sub(r"\s+([,.!?])", r"\1", fixed)
        fixed = re.sub(r"\bim\b", "I'm", fixed, flags=re.IGNORECASE)
        return fixed.strip()

    if action_type == "custom_prompt":
        directive = instruction or "Apply the requested custom transformation"
        return f"{directive}: {stripped}"

    if action_type == "shorten":
        words = stripped.split()
        shortened = " ".join(words[:18])
        if len(words) > 18:
            shortened += "..."
        return shortened

    raise ValueError(f"Unsupported action type: {action_type}")
