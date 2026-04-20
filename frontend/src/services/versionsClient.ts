import { authorizedFetch } from "../api/auth";
import type { DocumentDetails, DocumentVersion, SessionState } from "../lib/types";

type BackendVersion = {
  id: number;
  versionNumber: number;
  createdAt: string;
  title: string;
  createdBy: {
    id: number;
    displayName: string;
  } | null;
};

type BackendVersionsResponse = {
  data: {
    items: BackendVersion[];
  };
};

type BackendVersionResponse = {
  data: {
    version: BackendVersion;
  };
};

type BackendDocumentResponse = {
  data: {
    document: {
      id: number;
      title: string;
      content: string;
      createdAt: string;
      updatedAt: string;
      role: "owner" | "editor" | "viewer";
      owner: {
        id: number;
        username: string;
      };
    };
  };
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function mapVersion(version: BackendVersion): DocumentVersion {
  return {
    id: String(version.id),
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
    title: version.title,
    createdBy: version.createdBy
      ? {
          id: String(version.createdBy.id),
          displayName: version.createdBy.displayName
        }
      : null
  };
}

function mapDocument(document: BackendDocumentResponse["data"]["document"]): DocumentDetails {
  return {
    id: document.id,
    title: document.title,
    content: document.content,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    role: document.role,
    owner: {
      id: String(document.owner.id),
      displayName: document.owner.username
    },
    isAiEnabled: document.role !== "viewer"
  };
}

export const versionsClient = {
  async list(documentId: number): Promise<DocumentVersion[]> {
    const payload = await requestJson<BackendVersionsResponse>(
      `/api/v1/documents/${documentId}/versions`
    );
    return payload.data.items.map(mapVersion);
  },
  async create(documentId: number, _session: SessionState | null, title: string) {
    const payload = await requestJson<BackendVersionResponse>(
      `/api/v1/documents/${documentId}/versions`,
      {
        method: "POST",
        body: JSON.stringify({ label: title })
      }
    );
    return mapVersion(payload.data.version);
  },
  async restore(documentId: number, versionId: string | number): Promise<DocumentDetails> {
    const payload = await requestJson<BackendDocumentResponse>(
      `/api/v1/documents/${documentId}/versions/${versionId}/restore`,
      {
        method: "POST"
      }
    );
    return mapDocument(payload.data.document);
  }
};
