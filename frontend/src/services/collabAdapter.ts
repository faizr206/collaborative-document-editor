import type {
  CollabConnectionState,
  DocumentBootstrap,
  PresenceUser
} from "../lib/types";

export type CollabSnapshot = {
  connectionState: CollabConnectionState;
  collaborators: PresenceUser[];
};

export type CollabSubscription = {
  dispose: () => void;
};

export type CollabAdapter = {
  connect: (input: {
    bootstrap: DocumentBootstrap;
    onChange: (snapshot: CollabSnapshot) => void;
  }) => CollabSubscription;
};

const palette = ["#295eff", "#0f766e", "#c05621"];

export const mockCollabAdapter: CollabAdapter = {
  connect({ bootstrap, onChange }) {
    const collaborators: PresenceUser[] = [
      bootstrap.presence.self,
      {
        userId: "usr_reviewer",
        displayName: "Nora Review",
        color: palette[1],
        initials: "NR",
        active: true
      },
      {
        userId: "usr_writer",
        displayName: "Ishaan Draft",
        color: palette[2],
        initials: "ID",
        active: true
      }
    ];

    onChange({
      connectionState: "connecting",
      collaborators
    });

    const timers = [
      window.setTimeout(() => {
        onChange({
          connectionState: "connected",
          collaborators
        });
      }, 450),
      window.setTimeout(() => {
        onChange({
          connectionState: "reconnecting",
          collaborators
        });
      }, 9000),
      window.setTimeout(() => {
        onChange({
          connectionState: "connected",
          collaborators
        });
      }, 10300)
    ];

    return {
      dispose() {
        timers.forEach((timer) => window.clearTimeout(timer));
      }
    };
  }
};
