import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { documentsClient } from "../../services/documentsClient";
import { mockCollabAdapter } from "../../services/collabAdapter";
import { versionsClient } from "../../services/versionsClient";
import { aiClient } from "../../services/aiClient";
import { exportsClient } from "../../services/exportsClient";
import { useSession } from "../../app/session";
import { formatDateTime } from "../../lib/utils";
import { CollaboratorList } from "../../components/editor/CollaboratorList";
import { DocumentHeader } from "../../components/editor/DocumentHeader";
import { EditorToolbar } from "../../components/editor/EditorToolbar";
import { SaveStatus } from "../../components/editor/SaveStatus";
import { TiptapEditor } from "../../components/editor/TiptapEditor";
import type { AiActionType, AiSuggestion, ConnectionIndicator, DocumentVersion, PresenceUser, SaveState } from "../../lib/types";
import { navigate } from "../../app/navigation";

const AUTOSAVE_DELAY_MS = 1200;

type DocumentWorkspacePageProps = {
  documentId: number;
};

export function DocumentWorkspacePage({ documentId }: DocumentWorkspacePageProps) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState({ title: "", content: "" });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<PresenceUser[]>([]);
  const [connection, setConnection] = useState<ConnectionIndicator>({
    state: "connecting",
    label: "Connecting"
  });
  const [selection, setSelection] = useState({ from: 0, to: 0, text: "" });
  const [instruction, setInstruction] = useState("");
  const [pendingAction, setPendingAction] = useState<AiActionType>("rewrite");
  const [aiDraft, setAiDraft] = useState<AiSuggestion | null>(null);
  const [versionPanelOpen, setVersionPanelOpen] = useState(true);
  const latestSelectionRef = useRef(selection.text);

  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    queryFn: () => documentsClient.get(documentId)
  });

  const bootstrapQuery = useQuery({
    queryKey: ["documents", documentId, "bootstrap"],
    queryFn: () => documentsClient.bootstrap(documentId, session),
    enabled: Boolean(session)
  });

  const versionsQuery = useQuery({
    queryKey: ["documents", documentId, "versions"],
    queryFn: () => versionsClient.list(documentId)
  });

  useEffect(() => {
    if (!documentQuery.data) {
      return;
    }

    setTitle(documentQuery.data.title);
    setContent(documentQuery.data.content);
    setSavedSnapshot({
      title: documentQuery.data.title,
      content: documentQuery.data.content
    });
    setLastSavedAt(documentQuery.data.updatedAt);
  }, [documentQuery.data]);

  useEffect(() => {
    latestSelectionRef.current = selection.text;
  }, [selection.text]);

  useEffect(() => {
    if (!bootstrapQuery.data) {
      return;
    }

    const subscription = mockCollabAdapter.connect({
      bootstrap: bootstrapQuery.data,
      onChange(snapshot) {
        setCollaborators(snapshot.collaborators);
        setConnection(documentsClient.getConnectionIndicator(snapshot.connectionState));
      }
    });

    return () => {
      subscription.dispose();
    };
  }, [bootstrapQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      documentsClient.save(documentId, {
        title: payload.title,
        content: payload.content
      }),
    onSuccess: (document) => {
      setSavedSnapshot({
        title: document.title,
        content: document.content
      });
      setLastSavedAt(document.updatedAt);
      setSaveState("saved");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
    },
    onError: () => {
      setSaveState("error");
    }
  });

  const aiMutation = useMutation({
    mutationFn: () =>
      aiClient.createSuggestion({
        type: pendingAction,
        sourceText: selection.text,
        contextText: title,
        instruction: instruction.trim() || null
      }),
    onSuccess: (suggestion) => {
      const mismatchDetected = latestSelectionRef.current !== suggestion.sourceText;
      setAiDraft({ ...suggestion, mismatchDetected });
    }
  });

  const exportMutation = useMutation({
    mutationFn: () => exportsClient.start("pdf")
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const label = `Manual snapshot at ${new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date())}`;
      return versionsClient.create(documentId, session, label);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", documentId, "versions"] });
    }
  });

  const isDirty = title !== savedSnapshot.title || content !== savedSnapshot.content;
  const canEdit = documentQuery.data?.role !== "viewer";
  const canUseAi = canEdit && Boolean(documentQuery.data?.isAiEnabled);

  useEffect(() => {
    if (documentId && saveMutation.isPending) {
      setSaveState("saving");
      return;
    }

    if (isDirty) {
      setSaveState("dirty");
      return;
    }

    setSaveState(documentQuery.data ? "saved" : "idle");
  }, [documentId, documentQuery.data, isDirty, saveMutation.isPending]);

  useEffect(() => {
    if (!documentQuery.data || !isDirty || !canEdit || saveMutation.isPending) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveMutation.mutateAsync({ title: title.trim() || "Untitled document", content });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canEdit, content, documentQuery.data, isDirty, saveMutation, title]);

  function applyAiDraft(force = false) {
    if (!editor || !aiDraft?.resultText) {
      return;
    }

    if (aiDraft.mismatchDetected && !force) {
      setBanner("The selected text changed before apply. Review and force apply if needed.");
      return;
    }

    editor.chain().focus().insertContentAt({ from: selection.from, to: selection.to }, aiDraft.resultText).run();
    setAiDraft(null);
    setBanner("AI draft applied in the editor. This remains frontend-only until backend audit endpoints are wired.");
  }

  const recentVersions = useMemo<DocumentVersion[]>(() => versionsQuery.data ?? [], [versionsQuery.data]);

  return (
    <section className="workspace-page">
      <div className="workspace-header surface">
        <div className="workspace-header-copy">
          <span className="eyebrow">Document workspace</span>
          <h1>{documentQuery.data?.title ?? "Loading document..."}</h1>
          <p>
            Collaboration, versions, AI, and exports are routed through frontend adapters so teammates can swap in
            real services later.
          </p>
        </div>

        <div className="workspace-header-actions">
          <button className="secondary-action" type="button" onClick={() => navigate(`/documents/${documentId}/settings`)}>
            Sharing & settings
          </button>
          <button className="secondary-action" type="button" onClick={() => setVersionPanelOpen((value) => !value)}>
            {versionPanelOpen ? "Hide versions" : "Show versions"}
          </button>
          <button className="primary-action" type="button" onClick={() => exportMutation.mutate()}>
            {exportMutation.isPending ? "Preparing export..." : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="workspace-grid">
        <section className="editor-panel surface">
          <div className="editor-topline">
            <SaveStatus saveState={saveState} lastSavedAt={lastSavedAt} connectionLabel={connection.label} />
            <CollaboratorList collaborators={collaborators} />
          </div>

          <DocumentHeader
            documentId={documentQuery.data?.id ?? null}
            title={title}
            onTitleChange={setTitle}
            role={documentQuery.data?.role ?? "owner"}
            readOnly={!canEdit}
          />

          {banner ? <div className="editor-banner editor-banner-info">{banner}</div> : null}
          {!canEdit ? <div className="editor-banner editor-banner-warning">Viewer mode is active. Editing and AI actions are disabled.</div> : null}
          {exportMutation.data ? (
            <div className="editor-banner editor-banner-success">
              Export ready: {exportMutation.data.format.toUpperCase()} placeholder generated for frontend integration.
            </div>
          ) : null}

          <div className="toolbar-shell">
            <EditorToolbar editor={editor} />
          </div>

          <div className="editor-surface">
            <TiptapEditor
              content={content}
              onContentChange={setContent}
              onEditorChange={setEditor}
              editable={canEdit}
              onSelectionChange={setSelection}
            />
          </div>
        </section>

        <aside className="sidebar-column">
          <section className="surface sidebar-card">
            <div className="sidebar-card-header">
              <div>
                <h2>AI assistant</h2>
                <p>Selection-aware preview flow with mismatch protection.</p>
              </div>
              <span className={`role-badge role-${documentQuery.data?.role ?? "owner"}`}>{documentQuery.data?.role ?? "owner"}</span>
            </div>

            <label className="field">
              <span>Action</span>
              <select value={pendingAction} onChange={(event) => setPendingAction(event.target.value as AiActionType)} disabled={!canUseAi}>
                <option value="rewrite">Rewrite</option>
                <option value="summarize">Summarize</option>
                <option value="translate">Translate</option>
                <option value="expand">Expand</option>
                <option value="shorten">Shorten</option>
                <option value="fix_grammar">Fix grammar</option>
              </select>
            </label>

            <label className="field">
              <span>Instruction</span>
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Optional guidance for tone or style"
                disabled={!canUseAi}
              />
            </label>

            <div className="selection-preview">
              <strong>Selected text</strong>
              <p>{selection.text || "Select a passage in the editor to prepare an AI request."}</p>
            </div>

            <button className="primary-action wide-action" type="button" disabled={!canUseAi || aiMutation.isPending} onClick={() => aiMutation.mutate()}>
              {aiMutation.isPending ? "Generating..." : "Generate suggestion"}
            </button>

            {aiDraft ? (
              <div className="ai-draft-card">
                <div className="ai-draft-header">
                  <strong>{aiDraft.type}</strong>
                  <span>{formatDateTime(aiDraft.updatedAt)}</span>
                </div>
                {aiDraft.errorMessage ? <p className="inline-error">{aiDraft.errorMessage}</p> : null}
                {aiDraft.mismatchDetected ? (
                  <div className="editor-banner editor-banner-warning">
                    The live selection changed after the AI result returned. Force apply only after review.
                  </div>
                ) : null}
                <textarea
                  value={aiDraft.resultText ?? ""}
                  onChange={(event) =>
                    setAiDraft((current) => (current ? { ...current, resultText: event.target.value } : current))
                  }
                  rows={8}
                />
                <div className="inline-actions">
                  <button className="secondary-action" type="button" onClick={() => setAiDraft(null)}>
                    Reject
                  </button>
                  {aiDraft.mismatchDetected ? (
                    <button className="primary-action" type="button" onClick={() => applyAiDraft(true)}>
                      Force apply
                    </button>
                  ) : (
                    <button className="primary-action" type="button" onClick={() => applyAiDraft()}>
                      Apply suggestion
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          {versionPanelOpen ? (
            <section className="surface sidebar-card">
              <div className="sidebar-card-header">
                <div>
                  <h2>Version history</h2>
                  <p>Manual snapshot flow is ready for backend restore wiring.</p>
                </div>
                <button className="secondary-action" type="button" onClick={() => snapshotMutation.mutate()}>
                  {snapshotMutation.isPending ? "Saving..." : "Create snapshot"}
                </button>
              </div>

              {recentVersions.length === 0 ? (
                <div className="empty-state">No snapshots yet. Create one to seed the version timeline.</div>
              ) : (
                <div className="timeline-list">
                  {recentVersions.map((version) => (
                    <article key={version.id} className="timeline-item">
                      <div>
                        <strong>v{version.versionNumber}</strong>
                        <p>{version.title}</p>
                      </div>
                      <div className="timeline-meta">
                        <span>{formatDateTime(version.createdAt)}</span>
                        <span>{version.createdBy?.displayName ?? "System"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
