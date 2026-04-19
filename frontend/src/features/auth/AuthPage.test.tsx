import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPage } from "./AuthPage";

const mockNavigate = vi.fn();
const mockUseSession = vi.fn();

vi.mock("../../app/navigation", () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args)
}));

vi.mock("../../app/session", () => ({
  useSession: () => mockUseSession()
}));

vi.mock("../settings/shareLinkStorage", () => ({
  getPendingShareToken: vi.fn(() => null),
  consumePendingShareToken: vi.fn(() => null)
}));

describe("AuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits the login flow and navigates to documents", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    const clearAuthError = vi.fn();

    mockUseSession.mockReturnValue({
      login,
      register: vi.fn(),
      authError: null,
      clearAuthError
    });

    render(<AuthPage mode="login" />);

    await user.type(screen.getByLabelText("Username"), "  alice  ");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(clearAuthError).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ username: "alice", password: "secret123" });
    expect(mockNavigate).toHaveBeenCalledWith("/documents", { replace: true });
  });

  it("submits the register flow with email and password", async () => {
    const user = userEvent.setup();
    const register = vi.fn().mockResolvedValue(undefined);

    mockUseSession.mockReturnValue({
      login: vi.fn(),
      register,
      authError: null,
      clearAuthError: vi.fn()
    });

    render(<AuthPage mode="register" />);

    await user.type(screen.getByLabelText("Username"), "new_user");
    await user.type(screen.getByLabelText("Email"), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(register).toHaveBeenCalledWith({
      username: "new_user",
      email: "person@example.com",
      password: "secret123"
    });
    expect(mockNavigate).toHaveBeenCalledWith("/documents", { replace: true });
  });

  it("returns to the pending share link after login", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    const clearAuthError = vi.fn();

    const shareLinkStorage = await import("../settings/shareLinkStorage");
    vi.mocked(shareLinkStorage.getPendingShareToken).mockReturnValue("share-token");
    vi.mocked(shareLinkStorage.consumePendingShareToken).mockReturnValue("share-token");

    mockUseSession.mockReturnValue({
      login,
      register: vi.fn(),
      authError: null,
      clearAuthError
    });

    render(<AuthPage mode="login" />);

    expect(screen.getByText("Share invitation")).toBeInTheDocument();
    expect(screen.getByText("Login to accept the shared document")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(mockNavigate).toHaveBeenCalledWith("/share/share-token", { replace: true });
  });
});
