import { useState } from "react";
import { DocumentEditor } from "./components/DocumentEditor";
import type { DocumentDto } from "./api/documents";

type StatusTone = "idle" | "success" | "error" | "info";

function App() {
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState({ title: "", content: "" });
  const [statusMessage, setStatusMessage] = useState("Create a document or load one from the backend.");
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");

  const handleDocumentLoaded = (document: DocumentDto) => {
    setDocumentId(document.id);
    setTitle(document.title);
    setContent(document.content);
    setSavedSnapshot({
      title: document.title,
      content: document.content
    });
  };

  const handleStatusChange = (message: string, tone: StatusTone) => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const isDirty = title !== savedSnapshot.title || content !== savedSnapshot.content;

  return (
    <main className="app-shell">
      <div className="app-card">
        <header className="app-header">
          <h1>Collaborative Document Editor PoC</h1>
          <p>
            This frontend validates the basic document contract by creating, loading, and saving documents through the
            backend API.
          </p>
        </header>

        <DocumentEditor
          documentId={documentId}
          title={title}
          content={content}
          statusMessage={statusMessage}
          statusTone={statusTone}
          isDirty={isDirty}
          onTitleChange={setTitle}
          onContentChange={setContent}
          onDocumentLoaded={handleDocumentLoaded}
          onStatusChange={handleStatusChange}
        />
      </div>
    </main>
  );
}

export default App;

