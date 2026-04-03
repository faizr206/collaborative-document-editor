import { useState } from "react";

type AuthPanelProps = {
  isAuthenticated: boolean;
  username: string | null;
  isBusy: boolean;
  errorMessage: string | null;
  onLogin: (input: { username: string; password: string }) => Promise<void>;
  onRegister: (input: { username: string; email: string; password: string }) => Promise<void>;
  onLogout: () => void;
};

export function AuthPanel({
  isAuthenticated,
  username,
  isBusy,
  errorMessage,
  onLogin,
  onRegister,
  onLogout
}: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [usernameValue, setUsernameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "login") {
      await onLogin({
        username: usernameValue.trim(),
        password: passwordValue
      });
      setPasswordValue("");
      return;
    }

    await onRegister({
      username: usernameValue.trim(),
      email: emailValue.trim(),
      password: passwordValue
    });
    setPasswordValue("");
  }

  if (isAuthenticated) {
    return (
      <div className="auth-panel auth-panel-logged-in">
        <div className="auth-session-copy">
          <span className="auth-kicker">Signed in</span>
          <span className="auth-identity">{username}</span>
        </div>
        <button className="secondary-action" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
        <button
          className={`auth-mode-button${mode === "login" ? " is-active" : ""}`}
          type="button"
          onClick={() => setMode("login")}
        >
          Login
        </button>
        <button
          className={`auth-mode-button${mode === "register" ? " is-active" : ""}`}
          type="button"
          onClick={() => setMode("register")}
        >
          Register
        </button>
      </div>

      <div className="auth-fields">
        <label className="auth-field">
          <span className="sr-only">Username</span>
          <input
            className="auth-input"
            type="text"
            value={usernameValue}
            onChange={(event) => setUsernameValue(event.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
          />
        </label>

        {mode === "register" ? (
          <label className="auth-field">
            <span className="sr-only">Email</span>
            <input
              className="auth-input"
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
          </label>
        ) : null}

        <label className="auth-field">
          <span className="sr-only">Password</span>
          <input
            className="auth-input"
            type="password"
            value={passwordValue}
            onChange={(event) => setPasswordValue(event.target.value)}
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
      </div>

      <button className="primary-action auth-submit" type="submit" disabled={isBusy}>
        {isBusy ? "Working..." : mode === "login" ? "Login" : "Create account"}
      </button>

      {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
    </form>
  );
}
