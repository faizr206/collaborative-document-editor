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
    create: vi.fn()
  },
  mockAiClient: {
    createSuggestion: vi.fn()
  },
  mockExportsClient: {
    start: vi.fn()
  },
  mockConnect: vi.fn(),
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
  mockCollabAdapter: {
    connect: (...args: unknown[]) => mockConnect(...args)
  }
}));

vi.mock("../../components/editor/TiptapEditor", () => ({
  TiptapEditor: ({
    content,
    editable,
    onSelectionChange,
    onEditorChange
  }: {
    content: string;
    editable?: boolean;
    onSelectionChange?: (value: { from: number; to: number; text: string }) => void;
    onEditorChange: (editor: unknown) => void;
  }) => (
    <div>
      <div data-testid="mock-editor" data-editable={editable ? "true" : "false"}>
        {content}
      </div>
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
          id: "usr_1",
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
        provider: "mock-local",
        roomId: "doc_42",
        websocketUrl: null,
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
    mockAiClient.createSuggestion.mockResolvedValue({
      id: "ai_1",
      type: "rewrite",
      status: "completed",
      sourceText: "Selected text",
      contextText: "Strategy Memo",
      instruction: "Make it sharper",
      resultText: "Sharper text",
      createdAt: "2026-04-15T10:00:00Z",
      updatedAt: "2026-04-15T10:01:00Z"
    });
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
        dispose: vi.fn()
      };
    });
  });

  it("renders document controls and the snapshots panel", async () => {
    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    expect(await screen.findByText("Strategy Memo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create snapshot/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export PDF/i })).toBeInTheDocument();
    expect(screen.getByText("Snapshots")).toBeInTheDocument();
    expect(screen.queryByText("Comments")).not.toBeInTheDocument();
  });

  it("shows and applies an AI suggestion after text is selected", async () => {
    const user = userEvent.setup();

    renderWithProviders(<DocumentWorkspacePage documentId={42} />);

    await screen.findByText("Strategy Memo");
    await user.click(screen.getByRole("button", { name: "Select example" }));
    await user.type(screen.getByPlaceholderText("Ask AI for help..."), "Make it sharper");
    await user.click(screen.getByRole("button", { name: "Send AI request" }));

    await screen.findByDisplayValue("Sharper text");
    expect(mockAiClient.createSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rewrite",
        sourceText: "Selected text",
        instruction: "Make it sharper"
      })
    );

    await user.click(screen.getByRole("button", { name: /Apply suggestion/i }));

    await waitFor(() => {
      expect(insertContentAt).toHaveBeenCalledWith({ from: 1, to: 5 }, "Sharper text");
    });
  });
});
