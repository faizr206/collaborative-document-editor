import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentWorkspacePage } from "./DocumentWorkspacePage";
import { renderWithProviders } from "../../test/utils";

const {
  mockUseSession,
  mockDocumentsClient,
  mockVersionsClient,
  mockAiClient,
  mockExportsClient,
  mockConnect,
  mockPublishPresence,
  mockPublishDocument,
  insertContentAt,
  editorMock
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockDocumentsClient: {
    get: vi.fn(),
    bootstrap: vi.fn(),
    save: vi.fn(),
    getConnectionIndicator: vi.fn()
  },
  mockVersionsClient: {
    list: vi.fn(),
    create: vi.fn(),
    restore: vi.fn()
  },
  mockAiClient: {
    streamSuggestion: vi.fn(),
    listHistory: vi.fn(),
    reviewSuggestion: vi.fn(),
    previewPartialAcceptance: vi.fn()
  },
  mockExportsClient: {
    start: vi.fn()
  },
  mockConnect: vi.fn(),
  mockPublishPresence: vi.fn(),
  mockPublishDocument: vi.fn(),
  insertContentAt: vi.fn(),
  editorMock: {
  chain: () => ({
    focus: () => ({
      insertContentAt: (...args: unknown[]) => {
        insertContentAt(...args);
        return {
          run: vi.fn()
        };
      }
    })
  })
  }
}));

vi.mock("../../app/navigation", () => ({
  navigate: vi.fn()
}));

vi.mock("../../app/session", () => ({
  useSession: () => mockUseSession()
}));

vi.mock("../../services/documentsClient", () => ({
  documentsClient: mockDocumentsClient
}));

vi.mock("../../services/versionsClient", () => ({
  versionsClient: mockVersionsClient
}));

vi.mock("../../services/aiClient", () => ({
  aiClient: mockAiClient
}));

vi.mock("../../services/exportsClient", () => ({
  exportsClient: mockExportsClient
}));

vi.mock("../../services/collabAdapter", () => ({
  collabAdapter: {
    connect: (...args: unknown[]) => mockConnect(...args)
  }
}));

vi.mock("../../components/editor/TiptapEditor", () => ({
  TiptapEditor: ({
    content,
    editable,
    onSelectionChange,
    onEditorChange,
    remotePresences
  }: {
    content: string;
    editable?: boolean;
    onSelectionChange?: (value: { from: number; to: number; text: string }) => void;
    onEditorChange: (editor: unknown) => void;
    remotePresences?: Array<{ userId: string; displayName: string }>;
  }) => (
    <div>
      <div data-testid="mock-editor" data-editable={editable ? "true" : "false"}>
        {content}
      </div>
      <div data-testid="remote-presence-count">{remotePresences?.length ?? 0}</div>
      <button
        type="button"
        onClick={() => {
          onEditorChange(editorMock);
          onSelectionChange?.({ from: 1, to: 5, text: "Selected text" });
        }}
      >
        Select example
      </button>
    </div>
  )
}));

const documentDetails = {
  id: 42,
  title: "Strategy Memo",
  content: "<p>Hello world</p>",
  createdAt: "2026-04-15T10:00:00Z",
  updatedAt: "2026-04-15T10:15:00Z",
  role: "owner" as const,
  owner: {
    id: "usr_local",
    displayName: "You"
  },
  isAiEnabled: true
};

describe("DocumentWorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseSession.mockReturnValue({
      session: {
        user: {
          id: "1",
          username: "alice",
          displayName: "Alice",
          avatarUrl: null
        },
        accessToken: "token",
        tokenType: "bearer",
        expiresIn: 3600
      }
    });

    mockDocumentsClient.get.mockResolvedValue(documentDetails);
    mockDocumentsClient.bootstrap.mockResolvedValue({
      document: {
        id: 42,
        title: "Strategy Memo",
        role: "owner",
        isAiEnabled: true
      },
      collab: {
        provider: "websocket",
        roomId: "doc_42",
        websocketUrl: "ws://127.0.0.1:8000/ws",
        token: null
      },
      presence: {
        self: {
          userId: "usr_1",
          displayName: "Alice",
          color: "#295eff",
          initials: "A",
          active: true,
          isSelf: true
        }
      }
    });
    mockDocumentsClient.save.mockResolvedValue(documentDetails);
    mockDocumentsClient.getConnectionIndicator.mockReturnValue({
      state: "connected",
      label: "Local sync ready"
    });
    mockVersionsClient.list.mockResolvedValue([
      {
        id: "v1",
        versionNumber: 1,
        title: "Initial draft",
        createdAt: "2026-04-15T09:00:00Z",
        createdBy: { id: "usr_1", displayName: "Alice" }
      }
    ]);
    mockVersionsClient.create.mockResolvedValue(undefined);
    mockVersionsClient.restore.mockResolvedValue({
      ...documentDetails,
      content: "<p>Initial draft</p>",
      updatedAt: "2026-04-15T10:20:00Z"
    });
    mockAiClient.listHistory.mockResolvedValue([]);
    mockAiClient.reviewSuggestion.mockResolvedValue(undefined);
    mockAiClient.previewPartialAcceptance.mockImplementation(
      ({ acceptedParts }: { acceptedParts: number[] }) => Promise.resolve({
        parts: ["Sharper text."],
        acceptedParts,
        resultText: acceptedParts.length ? "Sharper text." : ""
      })
    );
    mockAiClient.streamSuggestion.mockImplementation(
      (
        _input: unknown,
        callbacks: {
          onStart?: (payload: { requestId: string; interactionId: number; status: string }) => void;
          onChunk?: (payload: { requestId: string; interactionId: number; delta: string; text: string }) => void;
          onComplete?: (payload: { requestId: string; interactionId: number; status: string; text: string }) => void;
        }
      ) => {
        callbacks.onStart?.({ requestId: "req_1", interactionId: 11, status: "pending" });
        callbacks.onChunk?.({ requestId: "req_1", interactionId: 11, delta: "Sharper", text: "Sharper" });
        callbacks.onComplete?.({ requestId: "req_1", interactionId: 11, status: "completed", text: "Sharper text" });

        return {
          cancel: vi.fn().mockResolvedValue(undefined),
          done: Promise.resolve()
        };
      }
    );
    mockExportsClient.start.mockResolvedValue({
      id: "export_1",
      status: "completed",
      format: "pdf",
      downloadUrl: null
    });
    mockConnect.mockImplementation(({ onChange }: { onChange: (value: unknown) => void }) => {
      onChange({
        collaborators: [
          {
            userId: "usr_1",
            displayName: "Alice",
            color: "#295eff",
            initials: "A",
            active: true,
            isSelf: true
          }
        ],
        connectionState: "connected"
      });

      return {
        publishDocument: mockPublishDocument,
        publishPresence: mockPublishPresence,
        dispose: vi.fn()
      };
    });
  });

  it("renders document controls and the snapshots panel", async () => {
    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    expect(await screen.findByDisplayValue("Strategy Memo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create snapshot/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export PDF/i })).toBeInTheDocument();
    expect(screen.getByText("Snapshots")).toBeInTheDocument();
    expect(screen.queryByText("Comments")).not.toBeInTheDocument();
  });

  it("shows and applies an AI suggestion after text is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    await screen.findByDisplayValue("Strategy Memo");
    await user.click(screen.getByRole("button", { name: "Select example" }));
    await user.type(screen.getByPlaceholderText("Ask AI for help..."), "Make it sharper");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByDisplayValue("Sharper text");
    expect(mockAiClient.streamSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rewrite",
        sourceText: "Selected text",
        instruction: "Make it sharper",
        documentId: 42
      }),
      expect.any(Object)
    );

    await user.click(screen.getByRole("button", { name: /Apply suggestion/i }));

    await waitFor(() => {
      expect(insertContentAt).toHaveBeenCalledWith({ from: 1, to: 5 }, "Sharper text");
    });
  });

  it("supports partial acceptance of AI suggestion parts", async () => {
    const user = userEvent.setup();

    mockAiClient.previewPartialAcceptance.mockResolvedValue({
      parts: ["Sharper text.", "Add evidence."],
      acceptedParts: [1],
      resultText: "Add evidence."
    });
    mockAiClient.streamSuggestion.mockImplementation(
      (
        _input: unknown,
        callbacks: {
          onStart?: (payload: { requestId: string; interactionId: number; status: string }) => void;
          onChunk?: (payload: { requestId: string; interactionId: number; delta: string; text: string }) => void;
          onComplete?: (payload: { requestId: string; interactionId: number; status: string; text: string }) => void;
        }
      ) => {
        callbacks.onStart?.({ requestId: "req_2", interactionId: 12, status: "pending" });
        callbacks.onComplete?.({
          requestId: "req_2",
          interactionId: 12,
          status: "completed",
          text: "Sharper text. Add evidence."
        });

        return {
          cancel: vi.fn().mockResolvedValue(undefined),
          done: Promise.resolve()
        };
      }
    );

    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    await screen.findByDisplayValue("Strategy Memo");
    await user.click(screen.getByRole("button", { name: "Select example" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Part 1");
    await user.click(screen.getByRole("button", { name: /accepted part 1/i }));

    await waitFor(() => {
      expect(mockAiClient.previewPartialAcceptance).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /Apply suggestion/i }));

    await waitFor(() => {
      expect(insertContentAt).toHaveBeenCalledWith({ from: 1, to: 5 }, "Add evidence.");
      expect(mockAiClient.reviewSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: "partially_accepted",
          acceptedParts: [1]
        })
      );
    });
  });

  it("allows changing the document title from the workspace", async () => {
    const user = userEvent.setup();

    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    const titleInput = (await screen.findByRole("textbox", { name: "Document title" })) as HTMLInputElement;
    await user.click(titleInput);
    titleInput.setSelectionRange(0, titleInput.value.length);
    await user.keyboard("{Backspace}");
    await user.type(titleInput, "Updated strategy memo");
    await user.tab();

    await waitFor(() => {
      expect(mockDocumentsClient.save).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          title: "Updated strategy memo"
        })
      );
    });
  });

  it("restores a snapshot from the snapshots panel", async () => {
    const user = userEvent.setup();

    mockVersionsClient.list.mockResolvedValue([
      {
        id: "v1",
        versionNumber: 2,
        title: "Current draft",
        createdAt: "2026-04-15T10:10:00Z",
        createdBy: { id: "usr_1", displayName: "Alice" }
      },
      {
        id: "v0",
        versionNumber: 1,
        title: "Initial draft",
        createdAt: "2026-04-15T09:00:00Z",
        createdBy: { id: "usr_1", displayName: "Alice" }
      }
    ]);

    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    await screen.findByDisplayValue("Strategy Memo");
    const restoreButtons = await screen.findAllByRole("button", { name: "Restore" });
    await user.click(restoreButtons[1]);

    await waitFor(() => {
      expect(mockVersionsClient.restore).toHaveBeenCalledWith(42, "v0");
      expect(screen.getByText('Restored snapshot "Initial draft".')).toBeInTheDocument();
      expect(mockPublishDocument).toHaveBeenCalledWith({
        title: "Strategy Memo",
        content: "<p>Initial draft</p>"
      });
    });
  });

  it("clears snapshot entries when switching to a different document", async () => {
    let resolveVersionsForSecondDoc: ((value: Array<{
      id: string;
      versionNumber: number;
      title: string;
      createdAt: string;
      createdBy: { id: string; displayName: string } | null;
    }>) => void) | null = null;

    mockDocumentsClient.get.mockImplementation((documentId: number) =>
      Promise.resolve({
        ...documentDetails,
        id: documentId,
        title: documentId === 43 ? "Fresh document" : "Strategy Memo"
      })
    );

    mockDocumentsClient.bootstrap.mockImplementation((documentId: number) =>
      Promise.resolve({
        document: {
          id: documentId,
          title: documentId === 43 ? "Fresh document" : "Strategy Memo",
          role: "owner",
          isAiEnabled: true
        },
        collab: {
          provider: "websocket",
          roomId: `doc_${documentId}`,
          websocketUrl: "ws://127.0.0.1:8000/ws",
          token: null
        },
        presence: {
          self: {
            userId: "usr_1",
            displayName: "Alice",
            color: "#295eff",
            initials: "A",
            active: true,
            isSelf: true
          }
        }
      })
    );

    mockVersionsClient.list.mockImplementation((documentId: number) => {
      if (documentId === 43) {
        return new Promise((resolve) => {
          resolveVersionsForSecondDoc = resolve;
        });
      }

      return Promise.resolve([
        {
          id: "v1",
          versionNumber: 1,
          title: "Initial draft",
          createdAt: "2026-04-15T09:00:00Z",
          createdBy: { id: "usr_1", displayName: "Alice" }
        }
      ]);
    });

    const { rerender } = renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    await screen.findByDisplayValue("Strategy Memo");
    expect(await screen.findByText("Initial draft")).toBeInTheDocument();

    rerender(<DocumentWorkspacePage documentId={43} />);

    await screen.findByDisplayValue("Fresh document");
    expect(screen.queryByText("Initial draft")).not.toBeInTheDocument();
    expect(screen.getByText("Loading snapshots...")).toBeInTheDocument();

    resolveVersionsForSecondDoc?.([]);

    await waitFor(() => {
      expect(screen.getByText("No snapshots yet. Create one to seed the version timeline.")).toBeInTheDocument();
    });
  });

  it("renders remote collaborator activity from presence updates", async () => {
    mockConnect.mockImplementation(({ onChange }: { onChange: (value: unknown) => void }) => {
      onChange({
        collaborators: [
          {
            userId: "usr_1",
            displayName: "Alice",
            color: "#295eff",
            initials: "A",
            active: true,
            isSelf: true
          },
          {
            userId: "usr_2",
            displayName: "Bob",
            color: "#ef6c4d",
            initials: "B",
            active: true,
            isSelf: false,
            activity: "typing",
            activityLabel: "Typing..."
          }
        ],
        connectionState: "connected"
      });

      return {
        publishDocument: mockPublishDocument,
        publishPresence: mockPublishPresence,
        dispose: vi.fn()
      };
    });

    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Typing...")).toBeInTheDocument();
    expect(screen.getByTestId("remote-presence-count")).toHaveTextContent("1");
  });
});
