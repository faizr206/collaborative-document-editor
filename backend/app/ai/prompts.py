from __future__ import annotations

from dataclasses import dataclass
from typing import Any


PROMPT_VERSION = "v2"
MAX_CONTEXT_CHARS = 1200
MAX_SOURCE_CHARS = 4000


@dataclass(frozen=True)
class PromptTemplate:
    label: str
    template: str

    def render(
        self,
        *,
        source_text: str,
        context_excerpt: str,
        instruction: str,
        options: dict[str, Any],
    ) -> str:
        normalized_options = ", ".join(
            f"{key}={value}" for key, value in sorted(options.items()) if value not in (None, "")
        ) or "None"
        return self.template.format(
            source_text=source_text,
            context_excerpt=context_excerpt or "None",
            instruction=instruction or "None",
            options=normalized_options,
        )


PROMPT_TEMPLATES: dict[str, PromptTemplate] = {
    "rewrite": PromptTemplate(
        label="Rewrite / Rephrase",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Rewrite the selected text while preserving its meaning.\n"
            "Apply tone/style instructions when provided.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
    "summarize": PromptTemplate(
        label="Summarize",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Summarize the selected text according to the requested length and format.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
    "translate": PromptTemplate(
        label="Translate",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Translate the selected text and preserve paragraph and list formatting.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
    "expand": PromptTemplate(
        label="Expand / Elaborate",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Expand the selected text with additional helpful detail while staying on topic.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
    "fix_grammar": PromptTemplate(
        label="Fix Grammar & Spelling",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Correct grammar, spelling, and punctuation while preserving intent.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
    "custom_prompt": PromptTemplate(
        label="Custom Prompt",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Follow the user's free-form instruction for the selected text.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
    "shorten": PromptTemplate(
        label="Shorten",
        template=(
            "You are an AI writing assistant inside a collaborative document editor.\n"
            "Shorten the selected text while keeping the key information.\n\n"
            "Instruction: {instruction}\n"
            "Options: {options}\n"
            "Relevant document context:\n{context_excerpt}\n\n"
            "Selected text:\n{source_text}"
        ),
    ),
}


def get_prompt_template(action_type: str) -> PromptTemplate:
    template = PROMPT_TEMPLATES.get(action_type)
    if not template:
        raise ValueError(f"Unsupported action type: {action_type}")
    return template

