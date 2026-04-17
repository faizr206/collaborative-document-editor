import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "../../app/navigation";
import { documentsClient } from "../../services/documentsClient";
import { sharingClient } from "../../services/sharingClient";

type DocumentSettingsPageProps = {
  documentId: number;
};

export function DocumentSettingsPage({ documentId }: DocumentSettingsPageProps) {
  const queryClient = useQueryClient();
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [actionError, setActionError] = useState<string | null>(null);

  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    queryFn: () => documentsClient.get(documentId)
  });

  const membersQuery = useQuery({
    queryKey: ["documents", documentId, "members"],
    queryFn: () => sharingClient.listMembers(documentId)
  });

  const inviteMutation = useMutation({
    mutationFn: () => sharingClient.inviteMember(documentId, { identifier: identifier.trim(), role }),
    onSuccess: async () => {
      setIdentifier("");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "members"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to share this document.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => documentsClient.remove(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      navigate("/documents");
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to delete this document.");
    }
  });

  const canManage = documentQuery.data?.role === "owner";
  const isBusy = inviteMutation.isPending || deleteMutation.isPending;

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Sharing & access</h1>
          <p>Owners can share by email or username, assign roles, and remove access server-side.</p>
        </div>
        <button className="secondary-action" type="button" onClick={() => navigate(`/documents/${documentId}`)}>
          Back to document
        </button>
      </div>

      <div className="settings-grid">
        <section className="surface page-stack">
          <div className="sidebar-card-header">
            <div>
              <h2>Invite collaborator</h2>
              <p>Use an account email or username and assign `editor` or `viewer` access.</p>
            </div>
            <span className={`role-badge role-${documentQuery.data?.role ?? "viewer"}`}>
              {documentQuery.data?.role ?? "viewer"}
            </span>
          </div>

          <label className="field">
            <span>Email or username</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="teammate@example.com or teammate"
              disabled={!canManage || isBusy}
            />
          </label>

          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} disabled={!canManage || isBusy}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>

          <div className="inline-actions">
            <button
              className="primary-action"
              type="button"
              disabled={!canManage || !identifier.trim() || isBusy}
              onClick={() => inviteMutation.mutate()}
            >
              {inviteMutation.isPending ? "Sharing..." : "Share document"}
            </button>
          </div>

          {!canManage ? <div className="editor-banner editor-banner-warning">Only owners can change sharing or delete this document.</div> : null}
          {actionError ? <div className="editor-banner editor-banner-warning">{actionError}</div> : null}
        </section>

        <section className="surface page-stack">
          <div className="sidebar-card-header">
            <div>
              <h2>Members</h2>
              <p>Permissions are enforced in the backend. Editors can modify content and use AI. Viewers are read-only.</p>
            </div>
          </div>

          {membersQuery.data?.length ? (
            <div className="table-list">
              {membersQuery.data.map((member) => (
                <div key={member.userId} className="table-row">
                  <div>
                    <strong>{member.displayName}</strong>
                    <p>{member.email}</p>
                  </div>
                  <div className="inline-actions">
                    {member.role === "owner" ? (
                      <span className="role-badge role-owner">owner</span>
                    ) : (
                      <>
                        <select
                          value={member.role}
                          disabled={!canManage || isBusy}
                          onChange={async (event) => {
                            try {
                              setActionError(null);
                              await sharingClient.updateMemberRole(
                                documentId,
                                member.userId,
                                event.target.value as "editor" | "viewer"
                              );
                              await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "members"] });
                              await queryClient.invalidateQueries({ queryKey: ["documents"] });
                              await queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
                            } catch (error) {
                              setActionError(error instanceof Error ? error.message : "Unable to update role.");
                            }
                          }}
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          className="secondary-action"
                          type="button"
                          disabled={!canManage || isBusy}
                          onClick={async () => {
                            try {
                              setActionError(null);
                              await sharingClient.removeMember(documentId, member.userId);
                              await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "members"] });
                              await queryClient.invalidateQueries({ queryKey: ["documents"] });
                              await queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
                            } catch (error) {
                              setActionError(error instanceof Error ? error.message : "Unable to remove member.");
                            }
                          }}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No shared members yet.</div>
          )}
        </section>

        <section className="surface page-stack">
          <div className="sidebar-card-header">
            <div>
              <h2>Danger zone</h2>
              <p>Deleting a document is owner-only and enforced by the backend.</p>
            </div>
          </div>

          <button
            className="secondary-action"
            type="button"
            disabled={!canManage || isBusy}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete document"}
          </button>
        </section>
      </div>
    </section>
  );
}
