import type { AiActionType, AiSuggestion } from "../lib/types";
import { delay } from "../lib/utils";

function transform(type: AiActionType, sourceText: string, instruction: string | null) {
  const trimmed = sourceText.trim();

  switch (type) {
    case "summarize":
      return `Summary: ${trimmed.slice(0, 180)}${trimmed.length > 180 ? "..." : ""}`;
    case "rewrite":
      return instruction
        ? `Rewritten (${instruction}): ${trimmed}`
        : `Rewritten: ${trimmed}`;
    case "translate":
      return `Translated draft: ${trimmed}`;
    case "expand":
      return `${trimmed}\n\nExpanded with additional detail and connective explanation for the next revision.`;
    case "shorten":
      return trimmed.split(/\s+/).slice(0, 18).join(" ");
    case "fix_grammar":
      return trimmed.replace(/\bi\b/g, "I");
    default:
      return trimmed;
  }
}

export const aiClient = {
  async createSuggestion(input: {
    type: AiActionType;
    sourceText: string;
    contextText: string | null;
    instruction: string | null;
  }): Promise<AiSuggestion> {
    const startedAt = new Date().toISOString();
    await delay(900);

    if (!input.sourceText.trim()) {
      return {
        id: "ai_empty",
        type: input.type,
        status: "failed",
        sourceText: input.sourceText,
        contextText: input.contextText,
        instruction: input.instruction,
        resultText: null,
        createdAt: startedAt,
        updatedAt: new Date().toISOString(),
        errorMessage: "Select some text before requesting AI assistance."
      };
    }

    return {
      id: `ai_${Date.now()}`,
      type: input.type,
      status: "completed",
      sourceText: input.sourceText,
      contextText: input.contextText,
      instruction: input.instruction,
      resultText: transform(input.type, input.sourceText, input.instruction),
      createdAt: startedAt,
      updatedAt: new Date().toISOString()
    };
  }
};
