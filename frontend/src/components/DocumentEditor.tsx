import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentDto
} from "../api/documents";

type StatusTone = "idle" | "success" | "error" | "info";

type DocumentEditorProps = {
  documentId: number | null;
  title: string;
  content: string;
  statusMessage: string;
  statusTone: StatusTone;
  isDirty: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onDocumentLoaded: (document: DocumentDto) => void;
  onStatusChange: (message: string, tone: StatusTone) => void;
};

export function DocumentEditor({
  documentId,
  title,
  content,
  statusMessage,
  statusTone,
  isDirty,
  onTitleChange,
  onContentChange,
  onDocumentLoaded,
  onStatusChange
}: DocumentEditorProps) {
  const queryClient = useQueryClient();

  const documentListQuery = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments
  });

  const createMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: (document) => {
      onDocumentLoaded(document);
      onStatusChange(`Document #${document.id} created.`, "success");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => {
      onStatusChange(error instanceof Error ? error.message : "Failed to create document.", "error");
    }
  });

  const loadMutation = useMutation({
    mutationFn: getDocument,
    onSuccess: (document) => {
      onDocumentLoaded(document);
      onStatusChange(`Document #${document.id} loaded from backend.`, "info");
    },
    onError: (error) => {
      onStatusChange(error instanceof Error ? error.message : "Failed to load document.", "error");
    }
  });

  const saveMutation = useMutation({
    mutationFn: (nextDocument: { id: number; title: string; content: string }) =>
      updateDocument(nextDocument.id, {
        title: nextDocument.title,
        content: nextDocument.content
      }),
    onSuccess: (document) => {
      onDocumentLoaded(document);
      onStatusChange(`Document #${document.id} saved to backend.`, "success");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["documents", document.id] });
    },
    onError: (error) => {
      onStatusChange(error instanceof Error ? error.message : "Failed to save document.", "error");
    }
  });

  const isBusy =
    createMutation.isPending || loadMutation.isPending || saveMutation.isPending || documentListQuery.isLoading;

  const handleCreate = () => {
    createMutation.mutate({ title: "Untitled Document" });
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (documentId === null) {
      onStatusChange("Create or load a document before saving.", "error");
      return;
    }

    saveMutation.mutate({
      id: documentId,
      title,
      content
    });
  };

  return (
    <div className="editor-layout">
      <aside className="sidebar">
        <div className="stack">
          <div>
            <p className="panel-title">PoC Actions</p>
            <div className="actions">
              <button className="button button-primary" type="button" onClick={handleCreate} disabled={isBusy}>
                {createMutation.isPending ? "Creating..." : "Create Document"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  if (documentId !== null) {
                    loadMutation.mutate(documentId);
                  } else {
                    onStatusChange("No document selected to reload.", "error");
                  }
                }}
                disabled={documentId === null || isBusy}
              >
                {loadMutation.isPending ? "Reloading..." : "Reload Current"}
              </button>
            </div>
          </div>

          <div>
            <p className="panel-title">Saved Documents</p>
            <div className="stack">
              {documentListQuery.isError ? (
                <div className="status status-idle">Document list endpoint not available yet.</div>
              ) : documentListQuery.data?.length ? (
                documentListQuery.data.map((item) => (
                  <button
                    key={item.id}
                    className="button button-ghost"
                    type="button"
                    onClick={() => loadMutation.mutate(item.id)}
                    disabled={isBusy}
                  >
                    #{item.id} {item.title || "Untitled"}
                  </button>
                ))
              ) : (
                <div className="status status-idle">
                  {documentListQuery.isLoading ? "Loading documents..." : "No documents yet."}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="panel-title">Contract Check</p>
            <div className="meta-list">
              <div>
                <strong>Base URL:</strong> {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api"}
              </div>
              <div>
                <strong>Current ID:</strong> {documentId ?? "none"}
              </div>
              <div>
                <strong>Dirty state:</strong> {isDirty ? "unsaved changes" : "synced"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="content">
        <form className="stack" onSubmit={handleSave}>
          <div className={`status status-${statusTone}`}>{statusMessage}</div>

          <div className="field">
            <label htmlFor="document-title">Document Title</label>
            <input
              id="document-title"
              className="input"
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Untitled Document"
            />
          </div>

          <div className="field">
            <label htmlFor="document-content">Document Content</label>
            <textarea
              id="document-content"
              className="textarea"
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Type here to validate the document contract end to end."
            />
          </div>

          <div className="actions">
            <button className="button button-primary" type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Document"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
