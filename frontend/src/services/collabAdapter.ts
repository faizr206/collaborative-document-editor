import type {
  CollabConnectionState,
  DocumentBootstrap,
  PresenceUser
} from "../lib/types";
import {
  CollaborativeDocumentState,
  type DocumentOperations,
  type SerializedNode
} from "./collabCrdt";

export type CollabSnapshot = {
  connectionState: CollabConnectionState;
  collaborators: PresenceUser[];
};

export type RemoteDocumentSnapshot = {
  title: string;
  content: string;
  updatedBy: PresenceUser;
};

export type CollabSubscription = {
  publishDocument: (document: { title: string; content: string }) => void;
  dispose: () => void;
};

export type CollabAdapter = {
  connect: (input: {
    bootstrap: DocumentBootstrap;
    initialDocument: { title: string; content: string };
    onChange: (snapshot: CollabSnapshot) => void;
    onRemoteDocument: (snapshot: RemoteDocumentSnapshot) => void;
  }) => CollabSubscription;
};

type SyncEvent = {
  type: "sync";
  roomId: string;
  state: {
    title: SerializedNode[];
    content: SerializedNode[];
  };
  document: {
    title: string;
    content: string;
  };
  collaborators: PresenceUser[];
};

type PresenceEvent = {
  type: "presence";
  action: "join" | "leave";
  roomId: string;
  clientId: string;
  user: PresenceUser;
};

type OperationsEvent = {
  type: "operations";
  roomId: string;
  clientId: string;
  user: PresenceUser;
  operations: DocumentOperations;
  document: {
    title: string;
    content: string;
  };
};

type ErrorEvent = {
  type: "error";
  message: string;
};

type CollabEvent = SyncEvent | PresenceEvent | OperationsEvent | ErrorEvent;

function createClientId() {
  return `client_${Math.random().toString(36).slice(2, 10)}`;
}

function parseEvent(raw: string): CollabEvent | null {
  try {
    const parsed = JSON.parse(raw) as CollabEvent;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function hasOperations(operations: DocumentOperations) {
  return operations.title.length > 0 || operations.content.length > 0;
}

export const collabAdapter: CollabAdapter = {
  connect({ bootstrap, initialDocument, onChange, onRemoteDocument }) {
    const { self } = bootstrap.presence;
    const clientId = createClientId();
    const collaborators = new Map<string, PresenceUser>([[self.userId, self]]);
    const documentState = new CollaborativeDocumentState(initialDocument);
    let socket: WebSocket | null = null;
    let disposed = false;
    let isSynced = false;
    let queuedOperations: DocumentOperations[] = [];

    const emitSnapshot = (connectionState: CollabConnectionState) => {
      onChange({
        connectionState,
        collaborators: Array.from(collaborators.values())
      });
    };

    const flushQueue = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN || !isSynced) {
        return;
      }

      for (const operations of queuedOperations) {
        socket.send(
          JSON.stringify({
            type: "operations",
            roomId: bootstrap.collab.roomId,
            clientId,
            operations
          })
        );
      }

      queuedOperations = [];
    };

    const connectSocket = () => {
      if (!bootstrap.collab.websocketUrl) {
        emitSnapshot("offline");
        return;
      }

      emitSnapshot(socket ? "reconnecting" : "connecting");
      socket = new WebSocket(bootstrap.collab.websocketUrl);

      socket.addEventListener("open", () => {
        if (disposed) {
          return;
        }

        emitSnapshot("connected");
        socket?.send(
          JSON.stringify({
            type: "join",
            roomId: bootstrap.collab.roomId,
            clientId,
            user: self,
            document: documentState.text()
          })
        );
      });

      socket.addEventListener("message", (event) => {
        const payload = parseEvent(String(event.data));
        if (!payload) {
          return;
        }

        if ("roomId" in payload && payload.roomId !== bootstrap.collab.roomId) {
          return;
        }

        if (payload.type === "sync") {
          isSynced = true;
          collaborators.clear();
          for (const collaborator of payload.collaborators) {
            collaborators.set(collaborator.userId, collaborator);
          }
          collaborators.set(self.userId, {
            ...self,
            active: true
          });
          documentState.loadState(payload.state);
          emitSnapshot("connected");
          const syncedDocument = documentState.text();
          if (
            syncedDocument.title !== initialDocument.title ||
            syncedDocument.content !== initialDocument.content
          ) {
            onRemoteDocument({
              ...syncedDocument,
              updatedBy: self
            });
          }
          flushQueue();
          return;
        }

        if (payload.type === "presence") {
          if (payload.action === "leave") {
            collaborators.delete(payload.user.userId);
          } else {
            collaborators.set(payload.user.userId, {
              ...payload.user,
              active: true
            });
          }

          emitSnapshot("connected");
          return;
        }

        if (payload.type === "operations") {
          if (payload.clientId === clientId) {
            return;
          }

          documentState.applyOperations(payload.operations);
          collaborators.set(payload.user.userId, {
            ...payload.user,
            active: true
          });
          emitSnapshot("connected");
          onRemoteDocument({
            ...documentState.text(),
            updatedBy: payload.user
          });
          return;
        }

        emitSnapshot("error");
      });

      socket.addEventListener("error", () => {
        if (!disposed) {
          emitSnapshot("error");
        }
      });

      socket.addEventListener("close", () => {
        if (disposed) {
          return;
        }

        isSynced = false;
        window.setTimeout(() => {
          if (!disposed) {
            connectSocket();
          }
        }, 1500);
      });
    };

    connectSocket();

    return {
      publishDocument(document) {
        const operations = documentState.buildOperations(document, clientId);
        if (!hasOperations(operations)) {
          return;
        }

        if (!socket || socket.readyState !== WebSocket.OPEN || !isSynced) {
          queuedOperations.push(operations);
          return;
        }

        socket.send(
          JSON.stringify({
            type: "operations",
            roomId: bootstrap.collab.roomId,
            clientId,
            operations
          })
        );
      },
      dispose() {
        disposed = true;

        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "leave",
              roomId: bootstrap.collab.roomId,
              clientId
            })
          );
        }

        socket?.close();
      }
    };
  }
};
