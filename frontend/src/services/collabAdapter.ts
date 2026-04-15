import type {
  CollabConnectionState,
  DocumentBootstrap,
  PresenceUser
} from "../lib/types";

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
    onChange: (snapshot: CollabSnapshot) => void;
    onRemoteDocument: (snapshot: RemoteDocumentSnapshot) => void;
  }) => CollabSubscription;
};

type CollabEvent =
  | {
      type: "presence";
      action: "join" | "leave";
      roomId: string;
      clientId: string;
      user: PresenceUser;
    }
  | {
      type: "document";
      roomId: string;
      clientId: string;
      user: PresenceUser;
      document: {
        title: string;
        content: string;
      };
    };

function createClientId() {
  return `client_${Math.random().toString(36).slice(2, 10)}`;
}

function parseEvent(raw: string): CollabEvent | null {
  try {
    const parsed = JSON.parse(raw) as CollabEvent;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed) || !("roomId" in parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export const collabAdapter: CollabAdapter = {
  connect({ bootstrap, onChange, onRemoteDocument }) {
    const { self } = bootstrap.presence;
    const clientId = createClientId();
    const collaborators = new Map<string, PresenceUser>([[self.userId, self]]);
    let socket: WebSocket | null = null;
    let disposed = false;
    let pendingMessage: string | null = null;

    const emitSnapshot = (connectionState: CollabConnectionState) => {
      onChange({
        connectionState,
        collaborators: Array.from(collaborators.values())
      });
    };

    const sendEvent = (event: CollabEvent) => {
      const payload = JSON.stringify(event);

      if (!socket || socket.readyState === WebSocket.CONNECTING) {
        pendingMessage = payload;
        return;
      }

      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(payload);
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
        sendEvent({
          type: "presence",
          action: "join",
          roomId: bootstrap.collab.roomId,
          clientId,
          user: self
        });

        if (pendingMessage) {
          socket?.send(pendingMessage);
          pendingMessage = null;
        }
      });

      socket.addEventListener("message", (event) => {
        const payload = parseEvent(String(event.data));
        if (!payload || payload.roomId !== bootstrap.collab.roomId || payload.clientId === clientId) {
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

        collaborators.set(payload.user.userId, {
          ...payload.user,
          active: true
        });
        emitSnapshot("connected");
        onRemoteDocument({
          title: payload.document.title,
          content: payload.document.content,
          updatedBy: payload.user
        });
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
        sendEvent({
          type: "document",
          roomId: bootstrap.collab.roomId,
          clientId,
          user: self,
          document
        });
      },
      dispose() {
        disposed = true;

        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "presence",
              action: "leave",
              roomId: bootstrap.collab.roomId,
              clientId,
              user: self
            } satisfies CollabEvent)
          );
        }

        socket?.close();
      }
    };
  }
};
