import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentDto
} from "../api/documents";
import { getAccessToken } from "../api/auth";
import type {
  ConnectionIndicator,
  DocumentBootstrap,
  DocumentDetails,
  DocumentListItem,
  PresenceUser,
  SessionState
} from "../lib/types";
import { API_BASE_URL, toWebSocketUrl } from "../config";
import { getInitials } from "../lib/utils";

type BootstrapResponse = {
  data: {
    document: {
      id: number;
      title: string;
      role: "owner" | "editor" | "viewer";
      isAiEnabled: boolean;
    };
    collab: {
      roomId: string;
      websocketUrl: string;
      token: string | null;
    };
  };
};

async function requestJson<T>(path: string): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function mapDocument(document: DocumentDto): DocumentDetails {
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

function toPresenceUser(user: SessionState["user"] | null): PresenceUser {
  const displayName = user?.displayName ?? "Guest";

  return {
    userId: user?.id ?? "guest",
    displayName,
    color: "#295eff",
    initials: getInitials(displayName),
    active: true,
    isSelf: true
  };
}

export const documentsClient = {
  async list(): Promise<DocumentListItem[]> {
    const items = await listDocuments();
    return items.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      role: item.role,
      owner: {
        id: String(item.owner.id),
        displayName: item.owner.username
      }
    }));
  },
  async create(title: string) {
    const created = await createDocument({ title });
    return mapDocument(created);
  },
  async get(documentId: number) {
    const document = await getDocument(documentId);
    return mapDocument(document);
  },
  async save(documentId: number, input: { title: string; content: string }) {
    const document = await updateDocument(documentId, input);
    return mapDocument(document);
  },
  async remove(documentId: number) {
    await deleteDocument(documentId);
  },
  async bootstrap(documentId: number, session: SessionState | null): Promise<DocumentBootstrap> {
    const payload = await requestJson<BootstrapResponse>(`/api/v1/documents/${documentId}/bootstrap`);
    const document = payload.data.document;
    const websocketUrl = payload.data.collab.websocketUrl.startsWith("ws")
      ? payload.data.collab.websocketUrl
      : `${toWebSocketUrl(API_BASE_URL)}${payload.data.collab.websocketUrl}`;

    return {
      document: {
        id: document.id,
        title: document.title,
        role: document.role,
        isAiEnabled: document.isAiEnabled
      },
      collab: {
        provider: "websocket",
        roomId: payload.data.collab.roomId,
        websocketUrl,
        token: payload.data.collab.token
      },
      presence: {
        self: toPresenceUser(session?.user ?? null)
      }
    };
  },
  getConnectionIndicator(state: ConnectionIndicator["state"]): ConnectionIndicator {
    const labels: Record<ConnectionIndicator["state"], string> = {
      connecting: "Connecting",
      connected: "Local sync ready",
      reconnecting: "Reconnecting",
      offline: "Offline draft",
      error: "Connection issue"
    };

    return {
      state,
      label: labels[state]
    };
  }
};
