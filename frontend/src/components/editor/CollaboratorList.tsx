import type { Collaborator } from "./types";

type CollaboratorListProps = {
  collaborators: Collaborator[];
};

export function CollaboratorList({ collaborators }: CollaboratorListProps) {
  return (
    <div className="collaborators" aria-label="Collaborators">
      {collaborators.map((collaborator) => (
        <div key={collaborator.id} className="collaborator-chip" title={collaborator.name}>
          <span className="collaborator-avatar">{collaborator.initials}</span>
          <span className="collaborator-name">{collaborator.name}</span>
        </div>
      ))}
    </div>
  );
}
