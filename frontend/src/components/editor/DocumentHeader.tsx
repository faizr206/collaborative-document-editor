type DocumentHeaderProps = {
  documentId: number | null;
  title: string;
  onTitleChange: (value: string) => void;
  role: "owner" | "editor" | "viewer";
  readOnly: boolean;
};

export function DocumentHeader({ documentId, title, onTitleChange, role, readOnly }: DocumentHeaderProps) {
  return (
    <header className="document-header">
      <div className="document-meta">
        <span className="document-kicker">Document {documentId !== null ? `#${documentId}` : "draft"}</span>
        <p className="document-subtitle">Role: {role}. Collaboration bindings and AI sidecars are isolated behind adapters.</p>
      </div>

      <input
        className="document-title-input"
        type="text"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Untitled document"
        aria-label="Document title"
        readOnly={readOnly}
      />
    </header>
  );
}
