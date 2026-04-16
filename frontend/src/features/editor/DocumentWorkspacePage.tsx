import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  CheckCircle2,
  Ellipsis,
  FileOutput,
  PencilLine,
  SendHorizonal,
  Sparkles,
  History
} from "lucide-react";
import { documentsClient } from "../../services/documentsClient";
import { collabAdapter } from "../../services/collabAdapter";
import { versionsClient } from "../../services/versionsClient";
import { aiClient } from "../../services/aiClient";
import { exportsClient } from "../../services/exportsClient";
import { useSession } from "../../app/session";
import { formatDateTime } from "../../lib/utils";
import { CollaboratorList } from "../../components/editor/CollaboratorList";
import { SaveStatus } from "../../components/editor/SaveStatus";
import { TiptapEditor } from "../../components/editor/TiptapEditor";
import type { AiActionType, AiSuggestion, ConnectionIndicator, DocumentVersion, PresenceUser, SaveState } from "../../lib/types";
import { navigate } from "../../app/navigation";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

const AUTOSAVE_DELAY_MS = 1200;
const COLLAB_SYNC_DELAY_MS = 300;

type DocumentWorkspacePageProps = {
  documentId: number;
};

const aiActions: Array<{ value: AiActionType; label: string }> = [
  { value: "rewrite", label: "Rewrite" },
  { value: "shorten", label: "Shorten" },
  { value: "summarize", label: "Summarize" },
  { value: "expand", label: "Expand" },
  { value: "fix_grammar", label: "Fix grammar" },
  { value: "translate", label: "Translate" }
];

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
  const [aiHistoryPanelOpen, setAiHistoryPanelOpen] = useState(true);
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [canUndoAiApply, setCanUndoAiApply] = useState(false);
  const [aiAccessDenied, setAiAccessDenied] = useState(false);
  const latestSelectionRef = useRef(selection.text);
  const collabSubscriptionRef = useRef<ReturnType<typeof collabAdapter.connect> | null>(null);
  const pendingRemoteDocumentRef = useRef<{ title: string; content: string } | null>(null);
  const aiStreamHandleRef = useRef<ReturnType<typeof aiClient.streamSuggestion> | null>(null);
  const latestDocumentRef = useRef({ title: "", content: "" });
  const [isDocumentHydrated, setIsDocumentHydrated] = useState(false);

  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    queryFn: () => documentsClient.get(documentId)
  });

  const bootstrapQuery = useQuery({
    queryKey: ["documents", documentId, "bootstrap"],
    queryFn: () => documentsClient.bootstrap(documentId, session),
    enabled: Boolean(session && documentQuery.data)
  });

  const versionsQuery = useQuery({
    queryKey: ["documents", documentId, "versions"],
    queryFn: () => versionsClient.list(documentId)
  });

  const aiUserId = useMemo(() => {
    const parsed = Number(session?.user.id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [session?.user.id]);

  const aiHistoryQuery = useQuery({
    queryKey: ["documents", documentId, "ai-history", aiUserId],
    queryFn: () => aiClient.listHistory({ documentId, userId: aiUserId }),
    enabled: Boolean(documentQuery.data?.isAiEnabled) && !aiAccessDenied,
    retry: false
  });

  useEffect(() => {
    setIsDocumentHydrated(false);
    setTitle("");
    setContent("");
    setSavedSnapshot({ title: "", content: "" });
    setSelection({ from: 0, to: 0, text: "" });
  }, [documentId]);

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
    setIsDocumentHydrated(true);
  }, [documentQuery.data]);

  useEffect(() => {
    latestSelectionRef.current = selection.text;
  }, [selection.text]);

  useEffect(() => {
    latestDocumentRef.current = { title, content };
  }, [content, title]);

  useEffect(() => {
    if (!bootstrapQuery.data || !isDocumentHydrated) {
      return;
    }

    const subscription = collabAdapter.connect({
      bootstrap: bootstrapQuery.data,
      initialDocument: latestDocumentRef.current,
      onChange(snapshot) {
        setCollaborators(snapshot.collaborators);
        setConnection(documentsClient.getConnectionIndicator(snapshot.connectionState));
      },
      onRemoteDocument(snapshot) {
        const nextDocument = {
          title: snapshot.title,
          content: snapshot.content
        };

        pendingRemoteDocumentRef.current = nextDocument;
        setTitle(snapshot.title);
        setContent(snapshot.content);
        setBanner(`Live update received from ${snapshot.updatedBy.displayName}.`);
      }
    });
    collabSubscriptionRef.current = subscription;

    return () => {
      collabSubscriptionRef.current = null;
      subscription.dispose();
    };
  }, [bootstrapQuery.data, isDocumentHydrated]);

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
  const currentDocument = documentQuery.data;
  const canEdit = currentDocument ? currentDocument.role !== "viewer" : false;
  const canUseAi = canEdit && !aiAccessDenied && Boolean(documentQuery.data?.isAiEnabled) && Boolean(selection.text.trim());

  async function flushDocumentSave() {
    const nextTitle = latestDocumentRef.current.title.trim() || "Untitled document";
    const nextContent = latestDocumentRef.current.content;
    const hasUnsavedChanges = nextTitle !== savedSnapshot.title || nextContent !== savedSnapshot.content;

    if (!canEdit || !documentQuery.data || saveMutation.isPending || !hasUnsavedChanges) {
      return;
    }

    await saveMutation.mutateAsync({
      title: nextTitle,
      content: nextContent
    });
  }

  useEffect(() => {
    if (!aiHistoryQuery.error) {
      return;
    }

    const message = aiHistoryQuery.error instanceof Error ? aiHistoryQuery.error.message : "AI history is unavailable.";
    if (message.toLowerCase().includes("permission")) {
      setAiAccessDenied(true);
      setBanner("AI suggestions are not available for this document with the current account.");
    }
  }, [aiHistoryQuery.error]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const nextTitle = latestDocumentRef.current.title.trim() || "Untitled document";
      const nextContent = latestDocumentRef.current.content;
      const hasUnsavedChanges = nextTitle !== savedSnapshot.title || nextContent !== savedSnapshot.content;

      if (!hasUnsavedChanges || !canEdit || saveMutation.isPending) {
        return;
      }

      void saveMutation.mutateAsync({
        title: nextTitle,
        content: nextContent
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [canEdit, saveMutation, savedSnapshot.content, savedSnapshot.title]);

  useEffect(() => {
    const subscription = collabSubscriptionRef.current;
    if (!subscription || !canEdit || !bootstrapQuery.data || !isDocumentHydrated) {
      return;
    }

    const currentDocument = { title, content };
    const pendingRemoteDocument = pendingRemoteDocumentRef.current;

    if (
      pendingRemoteDocument &&
      pendingRemoteDocument.title === currentDocument.title &&
      pendingRemoteDocument.content === currentDocument.content
    ) {
      pendingRemoteDocumentRef.current = null;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      subscription.publishDocument(currentDocument);
    }, COLLAB_SYNC_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bootstrapQuery.data, canEdit, content, isDocumentHydrated, title]);

  useEffect(() => {
    return () => {
      void aiStreamHandleRef.current?.cancel();
    };
  }, []);

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
    const reviewStatus = aiDraft.serverResultText && aiDraft.serverResultText !== aiDraft.resultText ? "edited" : "accepted";
    if (aiDraft.interactionId) {
      void aiClient.reviewSuggestion({
        interactionId: aiDraft.interactionId,
        userId: aiUserId,
        reviewStatus,
        editedText: reviewStatus === "edited" ? aiDraft.resultText : null
      }).then(() => queryClient.invalidateQueries({ queryKey: ["documents", documentId, "ai-history"] }));
    }
    setAiDraft(null);
    setCanUndoAiApply(true);
    setBanner("AI suggestion applied. Undo is available until your next change.");
  }

  const recentVersions = useMemo<DocumentVersion[]>(() => versionsQuery.data ?? [], [versionsQuery.data]);
  const recentAiHistory = useMemo<AiSuggestion[]>(() => aiHistoryQuery.data ?? [], [aiHistoryQuery.data]);
  const wordCount = useMemo(() => getWordCount(content), [content]);
  const documentTitle = title.trim() || documentQuery.data?.title || "Untitled document";

  async function startAiRequest() {
    if (!canUseAi || !documentQuery.data) {
      return;
    }

    await aiStreamHandleRef.current?.cancel();
    setBanner(null);
    setCanUndoAiApply(false);
    setIsAiStreaming(true);

    const now = new Date().toISOString();
    setAiDraft({
      id: `pending_${Date.now()}`,
      type: pendingAction,
      status: "processing",
      reviewStatus: "pending",
      sourceText: selection.text,
      contextText: title,
      instruction: instruction.trim() || null,
      resultText: "",
      serverResultText: "",
      createdAt: now,
      updatedAt: now,
      errorMessage: null
    });

    const handle = aiClient.streamSuggestion(
      {
        type: pendingAction,
        sourceText: selection.text,
        contextText: title,
        instruction: instruction.trim() || null,
        documentId,
        userId: aiUserId,
        documentContent: content
      },
      {
        onStart: ({ requestId, interactionId }) => {
          setAiDraft((current) =>
            current
              ? {
                  ...current,
                  requestId,
                  interactionId
                }
              : current
          );
        },
        onChunk: ({ text }) => {
          setAiDraft((current) =>
            current
              ? {
                  ...current,
                  status: "processing",
                  resultText: text,
                  updatedAt: new Date().toISOString(),
                  mismatchDetected: latestSelectionRef.current !== current.sourceText
                }
              : current
          );
        },
        onComplete: ({ text }) => {
          setIsAiStreaming(false);
          setInstruction("");
          setAiDraft((current) =>
            current
              ? {
                  ...current,
                  status: "completed",
                  resultText: text,
                  serverResultText: text,
                  updatedAt: new Date().toISOString(),
                  mismatchDetected: latestSelectionRef.current !== current.sourceText
                }
              : current
          );
          void queryClient.invalidateQueries({ queryKey: ["documents", documentId, "ai-history"] });
        },
        onError: ({ text, message }) => {
          setIsAiStreaming(false);
          setAiDraft((current) =>
            current
              ? {
                  ...current,
                  status: "failed",
                  resultText: text,
                  serverResultText: text,
                  errorMessage: message ?? "AI request failed.",
                  updatedAt: new Date().toISOString(),
                  mismatchDetected: latestSelectionRef.current !== current.sourceText
                }
              : current
          );
          void queryClient.invalidateQueries({ queryKey: ["documents", documentId, "ai-history"] });
        },
        onCancelled: ({ text, message }) => {
          setIsAiStreaming(false);
          setAiDraft((current) =>
            current
              ? {
                  ...current,
                  status: "cancelled",
                  resultText: text,
                  serverResultText: text,
                  errorMessage: message ?? "Generation cancelled.",
                  updatedAt: new Date().toISOString(),
                  mismatchDetected: latestSelectionRef.current !== current.sourceText
                }
              : current
          );
          setBanner("AI generation cancelled. Partial output is preserved for review.");
          void queryClient.invalidateQueries({ queryKey: ["documents", documentId, "ai-history"] });
        }
      }
    );

    aiStreamHandleRef.current = handle;
    try {
      await handle.done;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : "AI request failed.";
      if (message.toLowerCase().includes("permission")) {
        setAiAccessDenied(true);
        setBanner("AI suggestions are not available for this document with the current account.");
      }
      setIsAiStreaming(false);
      setAiDraft((current) =>
        current
          ? {
              ...current,
              status: "failed",
              errorMessage: message,
              updatedAt: new Date().toISOString()
            }
          : current
      );
    }
  }

  async function rejectAiDraft() {
    if (aiDraft?.interactionId) {
      await aiClient.reviewSuggestion({
        interactionId: aiDraft.interactionId,
        userId: aiUserId,
        reviewStatus: "rejected"
      });
      void queryClient.invalidateQueries({ queryKey: ["documents", documentId, "ai-history"] });
    }
    setAiDraft(null);
  }

  async function cancelAiRequest() {
    setIsAiStreaming(false);
    await aiStreamHandleRef.current?.cancel();
  }

  function undoLastAiApply() {
    if (!editor) {
      return;
    }

    editor.commands.undo();
    setCanUndoAiApply(false);
    setBanner("Reverted the last AI apply.");
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(229,196,145,0.2),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_38%),linear-gradient(180deg,#f4f1eb_0%,#f7f5f1_100%)] px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-[1700px] flex-col overflow-hidden rounded-[32px] border border-[#d4cec6] bg-white/70 shadow-shell backdrop-blur-xl sm:h-[calc(100vh-2.5rem)]">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[#ddd7cf] bg-white/80 px-3 py-3 sm:px-6">
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-2xl border-[#ddd7cf] bg-white/90 shadow-sm"
            type="button"
            onClick={() => void flushDocumentSave().finally(() => navigate("/documents"))}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to documents</span>
          </Button>

          <div className="min-w-0 text-center">
            {canEdit ? (
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void flushDocumentSave()}
                className="mx-auto h-10 max-w-[320px] border-0 bg-transparent px-2 py-0 text-center text-sm font-semibold tracking-[-0.02em] text-foreground shadow-none focus-visible:ring-1 sm:text-[1.05rem]"
                placeholder="Untitled document"
                aria-label="Document title"
              />
            ) : (
              <h1 className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground sm:text-[1.05rem]">
                {documentTitle}
              </h1>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">{wordCount} words</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              className="rounded-2xl border-[#ddd7cf] bg-white/90 px-3 shadow-sm"
              type="button"
              onClick={() => void flushDocumentSave().finally(() => navigate(`/documents/${documentId}/settings`))}
            >
              <PencilLine className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-11 w-11 rounded-2xl border-[#ddd7cf] bg-white/90 shadow-sm lg:hidden"
              type="button"
              onClick={() => setMobilePanelsOpen((current) => !current)}
            >
              <Ellipsis className="h-5 w-5" />
              <span className="sr-only">Toggle side panels</span>
            </Button>
            <Button variant="secondary" size="icon" className="hidden h-11 w-11 rounded-2xl border-[#ddd7cf] bg-white/90 shadow-sm lg:inline-flex" type="button">
              <Ellipsis className="h-5 w-5" />
              <span className="sr-only">More actions</span>
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          <aside
            className={cn(
              "order-2 h-full min-h-0 flex-col gap-4 overflow-y-auto border-t border-[#e5dfd8] bg-[#fbfaf8] p-4 sm:p-5 lg:order-none lg:flex lg:border-r lg:border-t-0",
              mobilePanelsOpen ? "flex" : "hidden"
            )}
          >
            <Card className="rounded-[28px] border-[#e6ddd3] bg-white/95 shadow-none">
              <CardHeader className="space-y-3 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-lg">AI Writing Assistant</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Select text, stream a suggestion from the backend, compare it against the original, then apply or reject it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {aiActions.map((action) => (
                    <Button
                      key={action.value}
                      variant={pendingAction === action.value ? "default" : "secondary"}
                      size="sm"
                      className={cn(
                        "rounded-full px-4",
                        pendingAction === action.value
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : "border-[#ddd7cf] bg-white text-foreground hover:bg-[#f3efe8]"
                      )}
                      type="button"
                      onClick={() => setPendingAction(action.value)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
            </Card>

            {aiDraft ? (
              <Card className="rounded-[26px] border-[#e8e0d7] bg-white/95 shadow-none">
                <CardHeader className="space-y-2 p-5 pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{aiDraft.type.replace("_", " ")}</CardTitle>
                    <span className="text-xs text-muted-foreground">{formatDateTime(aiDraft.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{aiDraft.status}</Badge>
                    {aiDraft.reviewStatus ? <span>Review: {aiDraft.reviewStatus}</span> : null}
                  </div>
                  {aiDraft.errorMessage ? <p className="text-sm text-destructive">{aiDraft.errorMessage}</p> : null}
                  {aiDraft.mismatchDetected ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      The live selection changed after the AI result returned. Force apply only after review.
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  <div className="rounded-2xl border border-[#eee7de] bg-[#fcfbf8] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Original</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{aiDraft.sourceText}</p>
                  </div>
                  <Textarea
                    value={aiDraft.resultText ?? ""}
                    onChange={(event) => setAiDraft((current) => (current ? { ...current, resultText: event.target.value } : current))}
                    className="min-h-[180px] resize-none border-[#e5dfd8] bg-[#fcfbf8]"
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 rounded-2xl border-[#ddd7cf] bg-white" type="button" onClick={() => void rejectAiDraft()}>
                      Reject
                    </Button>
                    <Button
                      className="flex-1 rounded-2xl"
                      type="button"
                      disabled={!aiDraft.resultText}
                      onClick={() => applyAiDraft(aiDraft.mismatchDetected)}
                    >
                      {aiDraft.mismatchDetected ? "Force apply" : "Apply suggestion"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-[28px] border-[#ddd7cf] bg-white shadow-none">
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selection</p>
                  <p className="mt-2 max-h-24 overflow-auto text-sm leading-6 text-muted-foreground">
                    {selection.text || "Select text in the editor to enable contextual AI help."}
                  </p>
                </div>
                {aiAccessDenied ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    The backend rejected AI access for this document. You can still read the document, but AI actions are disabled.
                  </div>
                ) : null}
                <Textarea
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder="Ask AI for help..."
                  className="min-h-[108px] resize-none border-[#e5dfd8] bg-[#fcfbf8]"
                  disabled={!canEdit || aiAccessDenied}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {selection.text ? `${pendingAction} selected text` : "Select text to enable AI actions"}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {isAiStreaming ? (
                      <Button
                        variant="secondary"
                        className="rounded-2xl border-[#ddd7cf] bg-white px-3"
                        type="button"
                        onClick={() => void cancelAiRequest()}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button
                      className="rounded-2xl px-4"
                      type="button"
                      disabled={!canUseAi || isAiStreaming}
                      onClick={() => void startAiRequest()}
                    >
                      <SendHorizonal className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <main className="order-1 h-full min-h-0 overflow-y-auto bg-[linear-gradient(180deg,#faf8f5_0%,#f7f4f0_100%)] px-3 py-4 sm:px-6 sm:py-6 lg:order-none lg:px-8 lg:py-7">
            <div className="mx-auto flex max-w-[900px] flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SaveStatus saveState={saveState} lastSavedAt={lastSavedAt} connectionLabel={connection.label} />
                  <CollaboratorList collaborators={collaborators} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full border-[#ddd7cf] bg-white px-4"
                    type="button"
                    onClick={() => snapshotMutation.mutate()}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {snapshotMutation.isPending ? "Saving..." : "Create snapshot"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full border-[#ddd7cf] bg-white px-4"
                    type="button"
                    onClick={() => exportMutation.mutate()}
                  >
                    <FileOutput className="h-4 w-4" />
                    {exportMutation.isPending ? "Preparing..." : "Export PDF"}
                  </Button>
                </div>
              </div>

              {banner ? (
                <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">{banner}</div>
              ) : null}
              {canUndoAiApply ? (
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" className="rounded-full border-[#ddd7cf] bg-white px-4" type="button" onClick={undoLastAiApply}>
                    Undo AI apply
                  </Button>
                </div>
              ) : null}
              {!canEdit ? (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Viewer mode is active. Editing and AI actions are disabled.
                </div>
              ) : null}
              {exportMutation.data ? (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Export ready: {exportMutation.data.format.toUpperCase()} placeholder generated for frontend integration.
                </div>
              ) : null}

              <Card className="overflow-hidden rounded-[30px] border-[#ece5dc] bg-white shadow-[0_24px_54px_rgba(24,31,44,0.09)]">
                <CardContent className="px-6 pb-10 pt-8 sm:px-12 sm:pb-14 sm:pt-12 lg:px-14">
                  <div className="mb-8 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span>Document #{documentId}</span>
                    </div>
                    <span>{canEdit ? "Live editing enabled" : "Read-only view"}</span>
                  </div>

                  {documentQuery.isLoading || !isDocumentHydrated ? (
                    <div className="rounded-[24px] border border-dashed border-[#ddd7cf] bg-[#fcfbf8] px-5 py-10 text-sm text-muted-foreground">
                      Loading document content...
                    </div>
                  ) : (
                    <TiptapEditor
                      key={`document-${documentId}`}
                      content={content}
                      onContentChange={setContent}
                      onEditorChange={setEditor}
                      editable={canEdit}
                      onSelectionChange={setSelection}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </main>

          <aside
            className={cn(
              "order-3 h-full min-h-0 flex-col gap-5 overflow-y-auto border-t border-[#e5dfd8] bg-[#fbfaf8] p-4 sm:p-5 lg:order-none lg:flex lg:border-l lg:border-t-0",
              mobilePanelsOpen ? "flex" : "hidden"
            )}
          >
            <Card className="rounded-[26px] border-[#e8e0d7] bg-white/90 shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-foreground" />
                    <CardTitle className="text-base">Snapshots</CardTitle>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Version history remains available while comments stay hidden.</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full" type="button" onClick={() => setVersionPanelOpen((value) => !value)}>
                  {versionPanelOpen ? "Hide" : "Show"}
                </Button>
              </CardHeader>
              {versionPanelOpen ? (
                <CardContent className="space-y-3 p-5 pt-0">
                  {recentVersions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ded7cf] bg-[#fcfbf8] px-4 py-5 text-sm text-muted-foreground">
                      No snapshots yet. Create one to seed the version timeline.
                    </div>
                  ) : (
                    recentVersions.slice(0, 4).map((version) => (
                      <div key={version.id} className="rounded-2xl border border-[#eee7de] bg-[#fcfbf8] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm text-foreground">v{version.versionNumber}</strong>
                          <span className="text-xs text-muted-foreground">{formatDateTime(version.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{version.title}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              ) : null}
            </Card>
            <Card className="rounded-[26px] border-[#e8e0d7] bg-white/90 shadow-none">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-foreground" />
                    <CardTitle className="text-base">AI history</CardTitle>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Suggestions are logged per document for review and reuse.</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full" type="button" onClick={() => setAiHistoryPanelOpen((value) => !value)}>
                  {aiHistoryPanelOpen ? "Hide" : "Show"}
                </Button>
              </CardHeader>
              {aiHistoryPanelOpen ? (
                <CardContent className="space-y-3 p-5 pt-0">
                  {aiAccessDenied ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-700">
                      AI history is unavailable because this document does not permit AI access for the current account.
                    </div>
                  ) : aiHistoryQuery.isLoading ? (
                    <div className="rounded-2xl border border-dashed border-[#ded7cf] bg-[#fcfbf8] px-4 py-5 text-sm text-muted-foreground">
                      Loading AI history...
                    </div>
                  ) : aiHistoryQuery.isError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
                      {aiHistoryQuery.error instanceof Error ? aiHistoryQuery.error.message : "Failed to load AI history."}
                    </div>
                  ) : recentAiHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#ded7cf] bg-[#fcfbf8] px-4 py-5 text-sm text-muted-foreground">
                      No AI interactions yet. Run a suggestion to start the audit trail.
                    </div>
                  ) : (
                    recentAiHistory.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        className="w-full rounded-2xl border border-[#eee7de] bg-[#fcfbf8] px-4 py-3 text-left"
                        type="button"
                        onClick={() => setAiDraft(item)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm capitalize text-foreground">{item.type.replace("_", " ")}</strong>
                          <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Status: {item.status}</span>
                          <span>Review: {item.reviewStatus ?? "pending"}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.resultText || item.errorMessage || "No result text."}</p>
                      </button>
                    ))
                  )}
                </CardContent>
              ) : null}
            </Card>
          </aside>
        </div>
      </div>
    </section>
  );
}

function getWordCount(value: string) {
  const plainText = value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  if (!plainText) {
    return 0;
  }

  return plainText.split(" ").length;
}
