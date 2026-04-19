import { authorizedFetch } from "./auth";

export type DocumentDto = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  role: "owner" | "editor" | "viewer";
  owner: {
    id: number;
    username: string;
    email: string;
  };
};

type BackendDocument = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  role: "owner" | "editor" | "viewer";
  owner: {
    id: number;
    username: string;
    email: string;
  };
};

type DocumentListItemDto = Pick<DocumentDto, "id" | "title" | "updatedAt" | "role" | "owner">;

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
    updatedAt: document.updatedAt,
    role: document.role,
    owner: document.owner
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
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

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentDto> {
  const payload = await requestJson<DocumentResponseEnvelope>("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify(input)
  });

  return mapDocument(payload.data.document);
}

export async function getDocument(documentId: number): Promise<DocumentDto> {
  const payload = await requestJson<DocumentResponseEnvelope>(`/api/v1/documents/${documentId}`);
  return mapDocument(payload.data.document);
}

export async function updateDocument(
  documentId: number,
  input: UpdateDocumentInput
): Promise<DocumentDto> {
  const payload = await requestJson<DocumentResponseEnvelope>(`/api/v1/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });

  return mapDocument(payload.data.document);
}

export async function listDocuments(): Promise<DocumentListItemDto[]> {
  const payload = await requestJson<DocumentListResponseEnvelope>("/api/v1/documents");
  return payload.data.items;
}

export async function deleteDocument(documentId: number): Promise<void> {
  await requestJson(`/api/v1/documents/${documentId}`, {
    method: "DELETE"
  });
}
