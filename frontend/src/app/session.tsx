import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authClient } from "../services/authClient";
import type { SessionState } from "../lib/types";

type SessionContextValue = {
  session: SessionState | null;
  isBootstrapping: boolean;
  login: (input: { username: string; password: string }) => Promise<void>;
  register: (input: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void authClient.getSession().then((nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setIsBootstrapping(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isBootstrapping,
      authError,
      clearAuthError() {
        setAuthError(null);
      },
      async login(input) {
        try {
          const nextSession = await authClient.login(input);
          setSession(nextSession);
          setAuthError(null);
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : "Login failed.");
          throw error;
        }
      },
      async register(input) {
        try {
          await authClient.register(input);
          const nextSession = await authClient.login({
            username: input.username,
            password: input.password
          });
          setSession(nextSession);
          setAuthError(null);
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : "Registration failed.");
          throw error;
        }
      },
      async logout() {
        await authClient.logout();
        setSession(null);
        setAuthError(null);
      }
    }),
    [authError, isBootstrapping, session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
}
