const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

export type DocumentDto = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type BackendDocument = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentListItemDto = Pick<DocumentDto, "id" | "title" | "updatedAt">;

type DocumentResponseEnvelope = {
  data: {
    document: BackendDocument;
  };
};

type DocumentListResponseEnvelope = {
  data: {
    items: DocumentListItemDto[];
  };
};

type ApiErrorEnvelope = {
  detail?: string;
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

function mapDocument(document: BackendDocument): DocumentDto {
  return {
    id: document.id,
    title: document.title,
    content: document.content,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

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
      if (payload.detail) {
        message = payload.detail;
      }
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
  const payload = await requestJson<DocumentResponseEnvelope>("/documents", {
    method: "POST",
    body: JSON.stringify(input)
  });

  return mapDocument(payload.data.document);
}

export async function getDocument(documentId: number): Promise<DocumentDto> {
  const payload = await requestJson<DocumentResponseEnvelope>(`/documents/${documentId}`);
  return mapDocument(payload.data.document);
}

export async function updateDocument(
  documentId: number,
  input: UpdateDocumentInput
): Promise<DocumentDto> {
  const payload = await requestJson<DocumentResponseEnvelope>(`/documents/${documentId}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });

  return mapDocument(payload.data.document);
}

export async function listDocuments(): Promise<DocumentListItemDto[]> {
  const payload = await requestJson<DocumentListResponseEnvelope>("/documents");
  return payload.data.items;
}
