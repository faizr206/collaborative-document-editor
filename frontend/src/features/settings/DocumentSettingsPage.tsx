import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sharingClient } from "../../services/sharingClient";
import { documentsClient } from "../../services/documentsClient";
import { navigate } from "../../app/navigation";

type DocumentSettingsPageProps = {
  documentId: number;
};

export function DocumentSettingsPage({ documentId }: DocumentSettingsPageProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    queryFn: () => documentsClient.get(documentId)
  });

  const membersQuery = useQuery({
    queryKey: ["documents", documentId, "members"],
    queryFn: () => sharingClient.listMembers(documentId)
  });

  const linksQuery = useQuery({
    queryKey: ["documents", documentId, "shareLinks"],
    queryFn: () => sharingClient.listShareLinks(documentId)
  });

  const inviteMutation = useMutation({
    mutationFn: () => sharingClient.inviteMember(documentId, { email: email.trim(), role }),
    onSuccess: async () => {
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "members"] });
    }
  });

  const createLinkMutation = useMutation({
    mutationFn: () => sharingClient.createShareLink(documentId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "shareLinks"] });
    }
  });

  const canManage = documentQuery.data?.role === "owner";

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Sharing & access</h1>
          <p>Frontend-only member and share-link management with owner-gated controls.</p>
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
              <p>UI is wired behind a dedicated sharing client so backend endpoints can replace local storage later.</p>
            </div>
            <span className={`role-badge role-${documentQuery.data?.role ?? "owner"}`}>{documentQuery.data?.role ?? "owner"}</span>
          </div>

          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@example.com" disabled={!canManage} />
          </label>

          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} disabled={!canManage}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>

          <div className="inline-actions">
            <button className="primary-action" type="button" disabled={!canManage || !email.trim()} onClick={() => inviteMutation.mutate()}>
              {inviteMutation.isPending ? "Sending..." : "Invite member"}
            </button>
            <button className="secondary-action" type="button" disabled={!canManage} onClick={() => createLinkMutation.mutate()}>
              {createLinkMutation.isPending ? "Creating..." : "Create share link"}
            </button>
          </div>

          {!canManage ? <div className="editor-banner editor-banner-warning">Only owners can manage sharing settings.</div> : null}
        </section>

        <section className="surface page-stack">
          <div className="sidebar-card-header">
            <div>
              <h2>Members</h2>
              <p>Role updates and removals stay inside the sharing client boundary.</p>
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
                    <select
                      value={member.role}
                      disabled={!canManage}
                      onChange={async (event) => {
                        await sharingClient.updateMemberRole(
                          documentId,
                          member.userId,
                          event.target.value as "editor" | "viewer"
                        );
                        await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "members"] });
                      }}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={!canManage}
                      onClick={async () => {
                        await sharingClient.removeMember(documentId, member.userId);
                        await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "members"] });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No invited members yet.</div>
          )}
        </section>

        <section className="surface page-stack">
          <div className="sidebar-card-header">
            <div>
              <h2>Share links</h2>
              <p>Create links now; swap in real backend issuance later.</p>
            </div>
          </div>

          {linksQuery.data?.length ? (
            <div className="table-list">
              {linksQuery.data.map((link) => (
                <div key={link.id} className="table-row">
                  <div>
                    <strong>{link.role} link</strong>
                    <p>{link.url}</p>
                  </div>
                  <div className="inline-actions">
                    <span className={`role-badge role-${link.role}`}>{link.isActive ? "active" : "disabled"}</span>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={!canManage || !link.isActive}
                      onClick={async () => {
                        await sharingClient.disableShareLink(documentId, link.id);
                        await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "shareLinks"] });
                      }}
                    >
                      Disable
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No share links yet.</div>
          )}
        </section>
      </div>
    </section>
  );
}
