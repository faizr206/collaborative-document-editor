import { useState } from "react";
import { clearStoredSession, getStoredSession, login, register, type AuthSession } from "./api/auth";
import { DocumentEditor } from "./components/DocumentEditor";

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleLogin(input: { username: string; password: string }) {
    setAuthBusy(true);
    setAuthError(null);

    try {
      const nextSession = await login(input);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(input: { username: string; email: string; password: string }) {
    setAuthBusy(true);
    setAuthError(null);

    try {
      await register(input);
      const nextSession = await login({
        username: input.username,
        password: input.password
      });
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    clearStoredSession();
    setSession(null);
    setAuthError(null);
  }

  return (
    <DocumentEditor
      authBusy={authBusy}
      authError={authError}
      authSession={session}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onRegister={handleRegister}
    />
  );
}

export default App;
