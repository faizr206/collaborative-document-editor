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
});
