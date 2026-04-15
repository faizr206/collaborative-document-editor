const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const AUTH_STORAGE_KEY = "collaborative-document-editor.auth";

type ApiErrorEnvelope = {
  detail?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type AuthSession = {
  username: string;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as ApiErrorEnvelope;
      if (payload.detail) {
        message = payload.detail;
      }
      if (payload.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // Keep the fallback message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getStoredSession(): AuthSession | null {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getStoredSession()?.accessToken ?? null;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const response = await requestJson<LoginResponse>("/user_auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });

  const session = {
    username: input.username,
    accessToken: response.access_token,
    tokenType: response.token_type,
    expiresIn: response.expires_in
  };

  setStoredSession(session);
  return session;
}

export async function register(input: RegisterInput): Promise<void> {
  await requestJson("/user_auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}