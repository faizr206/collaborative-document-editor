import asyncio
from app.ai.prompts import PROMPT_TEMPLATES


class AIService:
    def build_prompt(
        self,
        action_type: str,
        source_text: str,
        context: str = "",
        instruction: str = "",
    ) -> str:
        template = PROMPT_TEMPLATES[action_type]
        return template.format(
            source_text=source_text,
            context=context or "None",
            instruction=instruction or "None",
        )

    def generate_suggestion(
        self,
        action_type: str,
        source_text: str,
        context: str = "",
        instruction: str = "",
    ) -> str:
        # Build prompt (used later when you plug real AI)
        self.build_prompt(action_type, source_text, context, instruction)

        if action_type == "rewrite":
            if instruction:
                return f"{source_text}\n\nRewritten version ({instruction})."
            return f"{source_text}\n\nRewritten version."

        if action_type == "summarize":
            words = source_text.split()
            shortened = " ".join(words[:20])
            if len(words) > 20:
                shortened += "..."
            return f"Summary: {shortened}"

        raise ValueError(f"Unsupported action type: {action_type}")

    async def stream_suggestion(
        self,
        action_type: str,
        source_text: str,
        context: str = "",
        instruction: str = "",
    ):
        # Get full suggestion first
        full_text = self.generate_suggestion(
            action_type=action_type,
            source_text=source_text,
            context=context,
            instruction=instruction,
        )

        # Stream it in chunks
        chunk_size = 12

        for i in range(0, len(full_text), chunk_size):
            await asyncio.sleep(0.05)  # simulate streaming delay
            yield full_text[i:i + chunk_size]