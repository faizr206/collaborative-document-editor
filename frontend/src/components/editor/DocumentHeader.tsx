type DocumentHeaderProps = {
  documentId: number | null;
  title: string;
  onTitleChange: (value: string) => void;
};

export function DocumentHeader({ documentId, title, onTitleChange }: DocumentHeaderProps) {
  return (
    <header className="document-header">
      <div className="document-meta">
        <span className="document-kicker">Document {documentId !== null ? `#${documentId}` : "draft"}</span>
        <p className="document-subtitle">Structured for rich text today and collaboration wiring next.</p>
      </div>

      <input
        className="document-title-input"
        type="text"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Untitled document"
        aria-label="Document title"
      />
    </header>
  );
}
