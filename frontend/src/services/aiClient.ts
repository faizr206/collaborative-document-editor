import { getAccessToken } from "../api/auth";
import { API_BASE_URL } from "../config";
import type { AiActionType, AiReviewStatus, AiSuggestion, AiSuggestionPart } from "../lib/types";

type ApiErrorEnvelope = {
  detail?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

type StreamStartPayload = {
  requestId: string;
  interactionId: number;
  status: string;
};

type StreamChunkPayload = {
  requestId: string;
  interactionId: number;
  delta: string;
  text: string;
};

type StreamEndPayload = {
  requestId: string;
  interactionId: number;
  status: string;
  text: string;
  message?: string;
};

type BackendAiInteraction = {
  id: number;
  requestId: string;
  actionType: AiActionType;
  sourceText: string;
  context: string;
  instruction: string;
  resultText: string;
  status: string;
  reviewStatus: AiReviewStatus;
  suggestionParts?: string[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  provider?: string | null;
  model?: string | null;
};

type BackendAiHistoryResponse = {
  data: {
    items: BackendAiInteraction[];
  };
};

type StreamInput = {
  type: AiActionType;
  sourceText: string;
  contextText: string | null;
  instruction: string | null;
  documentId: number;
  documentContent: string;
};

type PartialAcceptanceResponse = {
  data: {
    parts: string[];
    acceptedParts: number[];
    resultText: string;
  };
};

type StreamCallbacks = {
  onStart?: (payload: StreamStartPayload) => void;
  onChunk?: (payload: StreamChunkPayload) => void;
  onComplete?: (payload: StreamEndPayload) => void;
  onError?: (payload: StreamEndPayload) => void;
  onCancelled?: (payload: StreamEndPayload) => void;
};

export type AiStreamHandle = {
  cancel: () => Promise<void>;
  done: Promise<void>;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response): Promise<string> {
  let message = `Request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as ApiErrorEnvelope;
    if (payload.detail) {
      message = payload.detail;
    }
    if (payload.error?.message) {
      message = payload.error.message;
    }
  } catch {
    // Keep fallback.
  }

  return message;
}

function mapStatus(value: string): AiSuggestion["status"] {
  switch (value) {
    case "pending":
      return "processing";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "error":
      return "failed";
    default:
      return "processing";
  }
}

function mapInteraction(item: BackendAiInteraction): AiSuggestion {
  const suggestionParts: AiSuggestionPart[] | undefined = item.suggestionParts?.map((part, index) => ({
    index,
    text: part,
    accepted: true
  }));

  return {
    id: String(item.id),
    interactionId: item.id,
    requestId: item.requestId,
    type: item.actionType,
    status: mapStatus(item.status),
    reviewStatus: item.reviewStatus,
    sourceText: item.sourceText,
    contextText: item.context,
    instruction: item.instruction || null,
    resultText: item.resultText || null,
    serverResultText: item.resultText || null,
    suggestionParts,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    errorMessage: item.errorMessage,
    provider: item.provider ?? null,
    model: item.model ?? null
  };
}

async function readSseStream(response: Response, callbacks: StreamCallbacks) {
  if (!response.body) {
    throw new Error("Streaming response body is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) {
        continue;
      }

      const { event, data } = parsed;

      if (event === "start") {
        callbacks.onStart?.(data as StreamStartPayload);
        continue;
      }

      if (event === "chunk") {
        callbacks.onChunk?.(data as StreamChunkPayload);
        continue;
      }

      if (event === "complete") {
        callbacks.onComplete?.(data as StreamEndPayload);
        continue;
      }

      if (event === "error") {
        callbacks.onError?.(data as StreamEndPayload);
        continue;
      }

      if (event === "cancelled") {
        callbacks.onCancelled?.(data as StreamEndPayload);
      }
    }
  }
}

function parseSseFrame(frame: string): { event: string; data: unknown } | null {
  const lines = frame.split("\n");
  let event = "message";
  let dataText = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      dataText += line.slice(5).trim();
    }
  }

  if (!dataText) {
    return null;
  }

  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return null;
  }
}

export const aiClient = {
  streamSuggestion(input: StreamInput, callbacks: StreamCallbacks): AiStreamHandle {
    const controller = new AbortController();
    let requestId: string | null = null;

    const done = (async () => {
      const accessToken = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/ai/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          action_type: input.type,
          source_text: input.sourceText,
          context: input.contextText ?? "",
          instruction: input.instruction ?? "",
          document_id: input.documentId,
          document_content: input.documentContent,
          options: {}
        })
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      await readSseStream(response, {
        ...callbacks,
        onStart(payload) {
          requestId = payload.requestId;
          callbacks.onStart?.(payload);
        }
      });
    })();

    return {
      async cancel() {
        if (requestId) {
          try {
            await requestJson(`/api/ai/cancel/${requestId}`, {
              method: "POST"
            });
          } catch {
            // The stream disconnect path can already cancel server-side.
          }
        }
        controller.abort();
      },
      done
    };
  },

  async listHistory(input: { documentId: number }): Promise<AiSuggestion[]> {
    const payload = await requestJson<BackendAiHistoryResponse>(`/api/ai/history/${input.documentId}`);
    return payload.data.items.map(mapInteraction);
  },

  async reviewSuggestion(input: {
    interactionId: number;
    userId: number;
    reviewStatus: Extract<AiReviewStatus, "accepted" | "rejected" | "edited" | "partially_accepted">;
    editedText?: string | null;
    acceptedParts?: number[];
  }): Promise<AiSuggestion> {
    const payload = await requestJson<{ data: BackendAiInteraction }>(
      `/api/ai/interactions/${input.interactionId}/review`,
      {
        method: "POST",
        body: JSON.stringify({
          review_status: input.reviewStatus,
          edited_text: input.editedText ?? null,
          accepted_parts: input.acceptedParts ?? null
        })
      }
    );

    return mapInteraction(payload.data);
  },

  async previewPartialAcceptance(input: { suggestion: string; acceptedParts: number[] }) {
    const payload = await requestJson<PartialAcceptanceResponse>("/api/ai/partial-accept", {
      method: "POST",
      body: JSON.stringify({
        suggestion: input.suggestion,
        accepted_parts: input.acceptedParts
      })
    });

    return payload.data;
  }
};
