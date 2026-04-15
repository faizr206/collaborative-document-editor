import type { SessionState } from "../lib/types";
import { readStorage, writeStorage } from "../lib/storage";
import {
  clearStoredSession,
  getStoredSession,
  login as loginRequest,
  register as registerRequest
} from "../api/auth";

const BASE_URL = "http://127.0.0.1:8000";
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
  username: string;
  email?: string;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}): SessionState {
  return {
    accessToken: input.accessToken,
    tokenType: input.tokenType,
    expiresIn: input.expiresIn,
    user: {
      id: input.username,
      username: input.username,
      email: input.email ?? "",
      displayName: input.username,
      avatarUrl: null
    }
  };
}

export const authClient = {
  async getSession(): Promise<SessionState | null> {
    const authSession = getStoredSession();
    if (authSession) {
      const mappedSession = buildSession(authSession);
      saveSession(mappedSession);
      return mappedSession;
    }

    return readStorage<SessionState | null>(STORAGE_KEY, null);
  },

  async login(input: LoginInput): Promise<SessionState> {
    const authSession = await loginRequest(input);
    const session = buildSession(authSession);
    saveSession(session);
    return session;
  },

  async register(input: RegisterInput): Promise<void> {
    await registerRequest(input);
  },

  async logout(): Promise<void> {
    saveSession(null);
    clearStoredSession();
  }
};
