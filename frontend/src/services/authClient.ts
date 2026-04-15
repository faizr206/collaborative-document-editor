import type { SessionState } from "../lib/types";
import { readStorage, writeStorage } from "../lib/storage";

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

type LoginResponse = {
  access_token?: string;
  token?: string;
  token_type?: string;
  username?: string;
  email?: string;
  user?: {
    username?: string;
    email?: string;
  };
};

function saveSession(session: SessionState | null) {
  writeStorage(STORAGE_KEY, session);
}

function buildSession(data: LoginResponse, fallbackUsername?: string): SessionState {
  const username = data.user?.username ?? data.username ?? fallbackUsername ?? "user";
  const email = data.user?.email ?? data.email ?? "";

  return {
    token: data.access_token ?? data.token ?? "",
    user: {
      username,
      email
    }
  } as SessionState;
}

export const authClient = {
  async getSession(): Promise<SessionState | null> {
    return readStorage<SessionState | null>(STORAGE_KEY, null);
  },

  async login(input: LoginInput): Promise<SessionState> {
    const response = await fetch(`${BASE_URL}/user_auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      let message = "Invalid username or password.";
      try {
        const errorData = await response.json();
        message =
          errorData?.detail ??
          errorData?.error?.message ??
          message;
      } catch {
        // ignore json parse errors
      }
      throw new Error(message);
    }

    const data = (await response.json()) as LoginResponse;
    const session = buildSession(data, input.username);
    saveSession(session);
    return session;
  },

  async register(input: RegisterInput): Promise<void> {
    const response = await fetch(`${BASE_URL}/user_auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      let message = "Registration failed.";
      try {
        const errorData = await response.json();
        message =
          errorData?.detail ??
          errorData?.error?.message ??
          message;
      } catch {
        // ignore json parse errors
      }
      throw new Error(message);
    }
  },

  async logout(): Promise<void> {
    saveSession(null);
  }
};