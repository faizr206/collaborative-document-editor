from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass
from typing import Any, AsyncIterator, Protocol


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


def get_provider() -> LLMProvider:
    provider_name = os.getenv("AI_PROVIDER", "mock").lower()

    if provider_name == "mock":
        return MockLLMProvider()

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
