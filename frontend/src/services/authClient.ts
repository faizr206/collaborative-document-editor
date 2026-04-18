import type { SessionState } from "../lib/types";
import { readStorage, writeStorage } from "../lib/storage";
import {
  clearStoredSession,
  getCurrentUser,
  getStoredSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  setStoredSession
} from "../api/auth";

const STORAGE_KEY = "frontend-session";

type LoginInput = {
  username: string;
  password: string;
};

type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

function saveSession(session: SessionState | null) {
  writeStorage(STORAGE_KEY, session);
}

function buildSession(input: {
  userId?: string;
  username: string;
  email?: string | null;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}): SessionState {
  return {
    accessToken: input.accessToken,
    tokenType: input.tokenType,
    expiresIn: input.expiresIn,
    user: {
      id: input.userId ?? input.username,
      username: input.username,
      email: input.email ?? "",
      displayName: input.username,
      avatarUrl: null
    }
  };
}

async function enrichAuthSession() {
  const authSession = getStoredSession();
  if (!authSession) {
    return null;
  }

  try {
    const currentUser = await getCurrentUser();
    const enriched = {
      ...authSession,
      userId: String(currentUser.id),
      username: currentUser.username,
      email: currentUser.email ?? authSession.email ?? null
    };
    setStoredSession(enriched);
    return buildSession(enriched);
  } catch {
    clearStoredSession();
    saveSession(null);
    return null;
  }
}

export const authClient = {
  async getSession(): Promise<SessionState | null> {
    const mappedSession = await enrichAuthSession();
    if (mappedSession) {
      saveSession(mappedSession);
      return mappedSession;
    }

    return readStorage<SessionState | null>(STORAGE_KEY, null);
  },

  async login(input: LoginInput): Promise<SessionState> {
    const authSession = await loginRequest(input);
    const currentUser = await getCurrentUser();
    const enrichedSession = {
      ...authSession,
      userId: String(currentUser.id),
      username: currentUser.username,
      email: currentUser.email ?? null
    };
    setStoredSession(enrichedSession);
    const session = buildSession(enrichedSession);
    saveSession(session);
    return session;
  },

  async register(input: RegisterInput): Promise<void> {
    await registerRequest(input);
  },

  async logout(): Promise<void> {
    await logoutRequest();
    saveSession(null);
    clearStoredSession();
  }
};
