import type { SaveState } from "./types";

type SaveStatusProps = {
  saveState: SaveState;
  lastSavedAt: string | null;
  connectionLabel: string;
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

export function SaveStatus({ saveState, lastSavedAt, connectionLabel }: SaveStatusProps) {
  const label = getSaveLabel(saveState, lastSavedAt);

  return (
    <div className="save-status" aria-live="polite">
      <span className={`status-pill status-pill-${saveState}`}>{label}</span>
      <span className={`connection-pill connection-pill-${connectionLabel.toLowerCase().replace(/\s+/g, "-")}`}>{connectionLabel}</span>
    </div>
  );
}

function getSaveLabel(saveState: SaveState, lastSavedAt: string | null) {
  if (saveState === "saving") {
    return "Saving...";
  }

  if (saveState === "dirty") {
    return "Unsaved changes";
  }

  if (saveState === "error") {
    return "Save failed";
  }

  if (saveState === "saved" && lastSavedAt) {
    const formatted = timeFormatter.format(new Date(lastSavedAt));
    return `Saved ${formatted}`;
  }

  if (saveState === "saved") {
    return "Saved";
  }

  return "Ready";
}
