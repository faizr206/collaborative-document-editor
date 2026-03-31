const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type DocumentDto = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentEnvelope = {
  data: {
    document: DocumentDto;
  };
};

type DocumentListEnvelope = {
  data: {
    items: Array<{
      id: number;
      title: string;
      updatedAt: string;
    }>;
  };
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type CreateDocumentInput = {
  title: string;
};

export type UpdateDocumentInput = {
  title: string;
  content: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as ApiErrorEnvelope;
      if (payload.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // Keep the fallback message when the backend did not return JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentDto> {
  const payload = await requestJson<DocumentEnvelope>("/documents", {
    method: "POST",
    body: JSON.stringify(input)
  });

  return payload.data.document;
}

export async function getDocument(documentId: number): Promise<DocumentDto> {
  const payload = await requestJson<DocumentEnvelope>(`/documents/${documentId}`);
  return payload.data.document;
}

export async function updateDocument(
  documentId: number,
  input: UpdateDocumentInput
): Promise<DocumentDto> {
  const payload = await requestJson<DocumentEnvelope>(`/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });

  return payload.data.document;
}

export async function listDocuments(): Promise<DocumentListEnvelope["data"]["items"]> {
  const payload = await requestJson<DocumentListEnvelope>("/documents");
  return payload.data.items;
}

