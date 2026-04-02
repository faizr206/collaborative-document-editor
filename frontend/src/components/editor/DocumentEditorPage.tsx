import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentDto
} from "../../api/documents";
import { CollaboratorList } from "./CollaboratorList";
import { DocumentHeader } from "./DocumentHeader";
import { EditorToolbar } from "./EditorToolbar";
import { SaveStatus } from "./SaveStatus";
import { TiptapEditor } from "./TiptapEditor";
import type { Collaborator, EditorBanner, SaveState, StatusTone } from "./types";

const mockCollaborators: Collaborator[] = [{ id: "local-user", name: "You", initials: "YU" }];

const AUTOSAVE_DELAY_MS = 1200;

export function DocumentEditorPage() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState({ title: "", content: "" });
  const [banner, setBanner] = useState<EditorBanner>({
    message: "Create a document or pick one from the library to start writing.",
    tone: "info"
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const documentListQuery = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments
  });

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (document) => {
      hydrateFromDocument(document);
      setBanner({
        message: `Document #${document.id} created. The editor is ready for autosave.`,
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => {
      handleBanner(error instanceof Error ? error.message : "Failed to create document.", "error");
      setSaveState("error");
    }
  });

  const loadMutation = useMutation({
    mutationFn: getDocument,
    onSuccess: (document) => {
      hydrateFromDocument(document);
      setBanner({
        message: `Loaded document #${document.id} from the backend.`,
        tone: "info"
      });
    },
    onError: (error) => {
      handleBanner(error instanceof Error ? error.message : "Failed to load document.", "error");
      setSaveState("error");
    }
  });

  const saveMutation = useMutation({
    mutationFn: (nextDocument: { id: number; title: string; content: string }) =>
      updateDocument(nextDocument.id, {
        title: nextDocument.title,
        content: nextDocument.content
      }),
    onSuccess: (document) => {
      hydrateFromDocument(document);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["documents", document.id] });
    }
  });

  const isDirty = title !== savedSnapshot.title || content !== savedSnapshot.content;
  const isBusy = createMutation.isPending || loadMutation.isPending;

  useEffect(() => {
    if (documentId === null) {
      setSaveState("idle");
      return;
    }

    if (saveMutation.isPending) {
      setSaveState("saving");
      return;
    }

    if (isDirty) {
      setSaveState("dirty");
      return;
    }

    setSaveState("saved");
  }, [documentId, isDirty, saveMutation.isPending]);

  useEffect(() => {
    const hasValidTitle = title.trim().length > 0;
    if (!documentId || !isDirty || !hasValidTitle || saveMutation.isPending || loadMutation.isPending) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistDocument("autosave");
    }, AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [content, documentId, isDirty, loadMutation.isPending, saveMutation.isPending, title]);

  function hydrateFromDocument(document: DocumentDto) {
    setDocumentId(document.id);
    setTitle(document.title);
    setContent(document.content);
    setSavedSnapshot({
      title: document.title,
      content: document.content
    });
    setLastSavedAt(document.updatedAt);
    setSaveState("saved");
  }

  function handleBanner(message: string, tone: StatusTone) {
    setBanner({ message, tone });
  }

  async function persistDocument(reason: "manual" | "autosave") {
    if (documentId === null) {
      handleBanner("Create or load a document before saving.", "error");
      setSaveState("error");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      handleBanner("Document title is required before saving.", "error");
      setSaveState("error");
      return;
    }

    setSaveState("saving");

    try {
      const document = await saveMutation.mutateAsync({
        id: documentId,
        title: trimmedTitle,
        content
      });

      setBanner(
        reason === "manual"
          ? {
              message: `All changes saved for document #${document.id}.`,
              tone: "success"
            }
          : null
      );
    } catch (error) {
      handleBanner(error instanceof Error ? error.message : "Failed to save document.", "error");
      setSaveState("error");
    }
  }

  return (
    <main className="docs-app-shell">
      <header className="docs-topbar">
        <div className="topbar-brand">
          <div className="brand-mark">CD</div>
          <div>
            <p className="brand-label">Collaborative Document Editor</p>
            <p className="brand-caption">Rich text PoC with collaboration-ready seams</p>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="primary-action"
            type="button"
            onClick={() => createMutation.mutate({ title: "Untitled document" })}
            disabled={isBusy}
          >
            {createMutation.isPending ? "Creating..." : "New document"}
          </button>
          <SaveStatus saveState={saveState} lastSavedAt={lastSavedAt} connectionLabel="Sync ready" />
          <CollaboratorList collaborators={mockCollaborators} />
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="library-panel">
          <div className="sidebar-section">
            <h2 className="sidebar-heading">Document library</h2>
            <p className="sidebar-copy">Load any saved draft from SQLite and keep working in the same editor shell.</p>
          </div>

          <div className="sidebar-section">
            {documentListQuery.isError ? (
              <div className="sidebar-empty">Document list is unavailable right now.</div>
            ) : documentListQuery.data?.length ? (
              <div className="document-list">
                {documentListQuery.data.map((item) => (
                  <button
                    key={item.id}
                    className={`document-list-item${item.id === documentId ? " is-active" : ""}`}
                    type="button"
                    onClick={() => loadMutation.mutate(item.id)}
                    disabled={isBusy}
                  >
                    <span className="document-list-title">{item.title || "Untitled document"}</span>
                    <span className="document-list-meta">Updated {formatSidebarTime(item.updatedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="sidebar-empty">
                {documentListQuery.isLoading ? "Loading documents..." : "No saved documents yet."}
              </div>
            )}
          </div>
        </aside>

        <section className="editor-column">
          <DocumentHeader documentId={documentId} title={title} onTitleChange={setTitle} />

          {banner ? <div className={`editor-banner editor-banner-${banner.tone}`}>{banner.message}</div> : null}

          <div className="toolbar-shell">
            <EditorToolbar editor={editor} />
          </div>

          <div className="editor-surface">
            <TiptapEditor content={content} onContentChange={setContent} onEditorChange={setEditor} />
          </div>

          <footer className="editor-footer">
            <div className="footer-hints">
              <span>Use `/` for block shortcuts</span>
              <span>Keyboard shortcuts follow the editor defaults</span>
            </div>

            <div className="footer-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  if (documentId !== null) {
                    loadMutation.mutate(documentId);
                  } else {
                    handleBanner("Choose a document before reloading.", "error");
                  }
                }}
                disabled={documentId === null || isBusy}
              >
                {loadMutation.isPending ? "Reloading..." : "Reload"}
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={() => {
                  void persistDocument("manual");
                }}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Save now"}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function formatSidebarTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
