import { useState } from "react";
import { navigate } from "../../app/navigation";
import { useSession } from "../../app/session";

type AuthPageProps = {
  mode: "login" | "register";
};

export function AuthPage({ mode }: AuthPageProps) {
  const { login, register, authError, clearAuthError } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    clearAuthError();

    try {
      if (mode === "login") {
        await login({ username: username.trim(), password });
      } else {
        await register({ username: username.trim(), email: email.trim(), password });
      }

      navigate("/documents", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-hero">
        <span className="eyebrow">Frontend only</span>
        <h1>{mode === "login" ? "Return to your workspace" : "Create a workspace-ready account"}</h1>
        <p>
          The frontend is structured for dashboards, document settings, AI panels, and future collaboration
          adapters without backend rewrites.
        </p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-header">
          <h2>{mode === "login" ? "Login" : "Register"}</h2>
          <p>{mode === "login" ? "Use your existing credentials." : "Create an account, then land on the dashboard."}</p>
        </div>

        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>

        {mode === "register" ? (
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
        ) : null}

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {authError ? <p className="inline-error">{authError}</p> : null}

        <button className="primary-action wide-action" type="submit" disabled={busy}>
          {busy ? "Working..." : mode === "login" ? "Login" : "Create account"}
        </button>

        <button
          className="text-action"
          type="button"
          onClick={() => navigate(mode === "login" ? "/register" : "/login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </form>
    </section>
  );
}
