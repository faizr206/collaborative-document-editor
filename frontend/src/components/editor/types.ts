export type StatusTone = "info" | "success" | "error";

export type EditorBanner = {
  message: string;
  tone: StatusTone;
} | null;

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type Collaborator = {
  id: string;
  name: string;
  initials: string;
};
