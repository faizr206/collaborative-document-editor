import { API_BASE_URL } from "../config";

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
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type AuthSession = {
  userId?: string;
  username: string;
  email?: string | null;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
};

export type CurrentUserResponse = {
  message: string;
  user: {
    id: number;
    username: string;
    email?: string | null;
  };
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

let refreshPromise: Promise<AuthSession | null> | null = null;

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

export function getRefreshToken(): string | null {
  return getStoredSession()?.refreshToken ?? null;
}

async function refreshAccessToken(): Promise<AuthSession | null> {
  const existing = getStoredSession();
  if (!existing?.refreshToken) {
    clearStoredSession();
    return null;
  }

  const response = await requestJson<LoginResponse>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: existing.refreshToken
    })
  });

  const nextSession = {
    ...existing,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    tokenType: response.token_type,
    expiresIn: response.expires_in
  };
  setStoredSession(nextSession);
  return nextSession;
}

export async function ensureFreshSession(): Promise<AuthSession | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch(() => {
        clearStoredSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function authorizedFetch(
  path: string,
  init?: RequestInit,
  options?: { retryOnUnauthorized?: boolean }
): Promise<Response> {
  const retryOnUnauthorized = options?.retryOnUnauthorized ?? true;
  const accessToken = getAccessToken();
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (response.status !== 401 || !retryOnUnauthorized || !getRefreshToken()) {
    return response;
  }

  const refreshed = await ensureFreshSession();
  if (!refreshed?.accessToken) {
    return response;
  }

  response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${refreshed.accessToken}`,
      ...(init?.headers ?? {})
    }
  });
  return response;
}

export async function getCurrentUser(): Promise<CurrentUserResponse["user"]> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error("No access token found.");
  }

  const response = await authorizedFetch("/api/v1/auth/me");
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return ((await response.json()) as CurrentUserResponse).user;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const response = await requestJson<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });

  const session = {
    userId: undefined,
    username: input.username,
    email: null,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    tokenType: response.token_type,
    expiresIn: response.expires_in
  };

  setStoredSession(session);
  return session;
}

export async function register(input: RegisterInput): Promise<void> {
  await requestJson("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function logout(): Promise<void> {
  await requestJson("/api/v1/auth/logout", {
    method: "POST"
  });
}
