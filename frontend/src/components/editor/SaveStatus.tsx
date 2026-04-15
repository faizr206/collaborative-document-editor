import type { SaveState } from "./types";
import { cn } from "../../lib/utils";

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
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
          saveState === "saved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          saveState === "saving" && "border-amber-200 bg-amber-50 text-amber-700",
          saveState === "dirty" && "border-orange-200 bg-orange-50 text-orange-700",
          saveState === "error" && "border-rose-200 bg-rose-50 text-rose-700",
          saveState === "idle" && "border-border bg-muted text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        {connectionLabel}
      </span>
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
