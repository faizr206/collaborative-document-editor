import type { PresenceUser } from "../../lib/types";

type CollaboratorListProps = {
  collaborators: PresenceUser[];
};

export function CollaboratorList({ collaborators }: CollaboratorListProps) {
  return (
    <div className="collaborators" aria-label="Collaborators">
      {collaborators.map((collaborator) => (
        <div
          key={collaborator.userId}
          className={`collaborator-chip${collaborator.isSelf ? " is-self" : ""}`}
          title={collaborator.displayName}
        >
          <span className="collaborator-avatar" style={{ backgroundColor: collaborator.color }}>
            {collaborator.initials}
          </span>
          <span className="collaborator-name">{collaborator.displayName}</span>
        </div>
      ))}
    </div>
  );
}
