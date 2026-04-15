import type { PresenceUser } from "../../lib/types";

type CollaboratorListProps = {
  collaborators: PresenceUser[];
};

export function CollaboratorList({ collaborators }: CollaboratorListProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Collaborators">
      {collaborators.map((collaborator) => (
        <div
          key={collaborator.userId}
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium ${
            collaborator.isSelf ? "border-foreground/10 bg-foreground text-background" : "border-border bg-card text-foreground"
          }`}
          title={collaborator.displayName}
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: collaborator.color }}
          >
            {collaborator.initials}
          </span>
          <span className="max-w-[96px] truncate">{collaborator.displayName}</span>
        </div>
      ))}
    </div>
  );
}
