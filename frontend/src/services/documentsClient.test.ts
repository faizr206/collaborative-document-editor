import { documentsClient } from "./documentsClient";

const { mockAuthorizedFetch } = vi.hoisted(() => ({
  mockAuthorizedFetch: vi.fn()
}));

vi.mock("../api/auth", async () => {
  const actual = await vi.importActual<typeof import("../api/auth")>("../api/auth");

  return {
    ...actual,
    authorizedFetch: (...args: unknown[]) => mockAuthorizedFetch(...args)
  };
});

describe("documentsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the websocket URL token-free so the collab adapter can append it once", async () => {
    mockAuthorizedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          document: {
            id: 42,
            title: "Strategy Memo",
            role: "owner",
            isAiEnabled: true
          },
          collab: {
            roomId: "doc_42",
            websocketUrl: "/ws",
            token: "collab-token"
          }
        }
      })
    });

    const bootstrap = await documentsClient.bootstrap(42, {
      user: {
        id: "1",
        username: "alice",
        displayName: "Alice",
        avatarUrl: null
      },
      accessToken: "access-token",
      tokenType: "bearer",
      expiresIn: 3600
    });

    expect(bootstrap.collab.websocketUrl).toBe("ws://127.0.0.1:8000/ws");
    expect(bootstrap.collab.token).toBe("collab-token");
  });
});
