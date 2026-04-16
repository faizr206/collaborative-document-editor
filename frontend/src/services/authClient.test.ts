import { authClient } from "./authClient";

const {
  mockReadStorage,
  mockWriteStorage,
  mockClearStoredSession,
  mockGetCurrentUser,
  mockGetStoredSession,
  mockLogin,
  mockRegister,
  mockSetStoredSession
} = vi.hoisted(() => ({
  mockReadStorage: vi.fn(),
  mockWriteStorage: vi.fn(),
  mockClearStoredSession: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockGetStoredSession: vi.fn(),
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockSetStoredSession: vi.fn()
}));

vi.mock("../lib/storage", () => ({
  readStorage: (...args: unknown[]) => mockReadStorage(...args),
  writeStorage: (...args: unknown[]) => mockWriteStorage(...args)
}));

vi.mock("../api/auth", () => ({
  clearStoredSession: (...args: unknown[]) => mockClearStoredSession(...args),
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  getStoredSession: (...args: unknown[]) => mockGetStoredSession(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  register: (...args: unknown[]) => mockRegister(...args),
  setStoredSession: (...args: unknown[]) => mockSetStoredSession(...args)
}));

describe("authClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadStorage.mockReturnValue(null);
  });

  it("clears stale stored auth when token validation fails", async () => {
    mockGetStoredSession.mockReturnValue({
      username: "alice",
      email: "alice@example.com",
      accessToken: "stale-token",
      tokenType: "bearer",
      expiresIn: 1800
    });
    mockGetCurrentUser.mockRejectedValue(new Error("Invalid token"));

    const session = await authClient.getSession();

    expect(session).toBeNull();
    expect(mockClearStoredSession).toHaveBeenCalledTimes(1);
    expect(mockWriteStorage).toHaveBeenCalledWith("frontend-session", null);
  });
});
