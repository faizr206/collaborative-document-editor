import { authorizedFetch } from "../api/auth";
import type { DocumentVersion, SessionState } from "../lib/types";

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
  }
};
