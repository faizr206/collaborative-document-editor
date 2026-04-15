import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "../../app/navigation";
import { documentsClient } from "../../services/documentsClient";
import { formatDateTime } from "../../lib/utils";

export function DocumentsDashboardPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "editor" | "viewer">("all");

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsClient.list()
  });

  const createMutation = useMutation({
    mutationFn: () => documentsClient.create("Untitled document"),
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      navigate(`/documents/${document.id}`);
    }
  });

  const filtered = useMemo(() => {
    const items = documentsQuery.data ?? [];
    return items.filter((item) => {
      const matchesQuery = query
        ? item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.owner.displayName.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesRole = roleFilter === "all" ? true : item.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [documentsQuery.data, query, roleFilter]);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Documents</h1>
          <p>List, filter, and launch document workspaces from a frontend-ready dashboard.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => createMutation.mutate()}>
          {createMutation.isPending ? "Creating..." : "New document"}
        </button>
      </div>

      <div className="surface controls-grid">
        <label className="field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or owner"
          />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
            <option value="all">All roles</option>
            <option value="owner">Owner</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
      </div>

      <div className="surface card-list">
        {documentsQuery.isLoading ? <div className="empty-state">Loading documents...</div> : null}
        {documentsQuery.isError ? (
          <div className="empty-state">The document list is unavailable. The dashboard shell is ready for retry handling.</div>
        ) : null}
        {!documentsQuery.isLoading && !documentsQuery.isError && filtered.length === 0 ? (
          <div className="empty-state">No documents match the current filters.</div>
        ) : null}

        {filtered.map((item) => (
          <article key={item.id} className="list-card">
            <div>
              <div className="list-card-topline">
                <h2>{item.title || "Untitled document"}</h2>
                <span className={`role-badge role-${item.role}`}>{item.role}</span>
              </div>
              <p>Owned by {item.owner.displayName}</p>
              <p>Updated {formatDateTime(item.updatedAt)}</p>
            </div>
            <div className="list-card-actions">
              <button className="secondary-action" type="button" onClick={() => navigate(`/documents/${item.id}`)}>
                Open
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => navigate(`/documents/${item.id}/settings`)}
              >
                Settings
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
