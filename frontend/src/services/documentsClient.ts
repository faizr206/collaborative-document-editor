import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentDto
} from "../api/documents";
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
    const document = await this.get(documentId);
    return {
      document: {
        id: document.id,
        title: document.title,
        role: document.role,
        isAiEnabled: document.isAiEnabled
      },
      collab: {
        provider: "websocket",
        roomId: `doc_${documentId}`,
        websocketUrl: `${toWebSocketUrl(API_BASE_URL)}/ws`,
        token: null
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
