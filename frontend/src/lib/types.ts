export type DocumentRole = "owner" | "editor" | "viewer";

export type AuthUser = {
  id: string;
  username: string;
  email?: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type SessionState = {
  user: AuthUser;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};

export type DocumentListItem = {
  id: number;
  title: string;
  updatedAt: string;
  role: DocumentRole;
  owner: {
    id: string;
    displayName: string;
  };
};

export type DocumentDetails = DocumentListItem & {
  content: string;
  createdAt: string;
  isAiEnabled: boolean;
};

export type PresenceUser = {
  userId: string;
  displayName: string;
  color: string;
  initials: string;
  active: boolean;
  isSelf?: boolean;
  activity?: "idle" | "typing" | "selecting";
  activityLabel?: string | null;
  cursorPos?: number | null;
  selection?: {
    from: number;
    to: number;
    text: string;
  } | null;
  lastActiveAt?: string | null;
};

export type CollabConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "error";

export type DocumentBootstrap = {
  document: Pick<DocumentDetails, "id" | "title" | "role" | "isAiEnabled">;
  collab: {
    provider: "mock-local" | "websocket";
    roomId: string;
    websocketUrl: string | null;
    token: string | null;
  };
  presence: {
    self: PresenceUser;
  };
};

export type DocumentMember = {
  userId: string;
  displayName: string;
  email: string;
  role: DocumentRole;
};

export type ShareLink = {
  id: string;
  role: Exclude<DocumentRole, "owner">;
  url: string;
  isActive: boolean;
  expiresAt: string | null;
  loginRequired: boolean;
  multiUse: boolean;
};

export type DocumentVersion = {
  id: string;
  versionNumber: number;
  createdAt: string;
  title: string;
  createdBy: {
    id: string;
    displayName: string;
  } | null;
};

export type AiActionType =
  | "summarize"
  | "rewrite"
  | "translate"
  | "expand"
  | "shorten"
  | "fix_grammar"
  | "custom_prompt";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type AiRequestStatus = "idle" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export type AiReviewStatus = "pending" | "accepted" | "rejected" | "edited" | "partially_accepted";

export type AiSuggestionPart = {
  index: number;
  text: string;
  accepted: boolean;
};

export type AiSuggestion = {
  id: string;
  requestId?: string | null;
  interactionId?: number | null;
  type: AiActionType;
  status: AiRequestStatus;
  reviewStatus?: AiReviewStatus;
  sourceText: string;
  contextText: string | null;
  instruction: string | null;
  resultText: string | null;
  serverResultText?: string | null;
  suggestionParts?: AiSuggestionPart[];
  createdAt: string;
  updatedAt: string;
  mismatchDetected?: boolean;
  errorMessage?: string | null;
  provider?: string | null;
  model?: string | null;
};

export type ExportJob = {
  id: string;
  status: "idle" | "queued" | "processing" | "completed";
  format: "pdf" | "docx" | "markdown";
  downloadUrl: string | null;
};

export type ConnectionIndicator = {
  state: CollabConnectionState;
  label: string;
};
