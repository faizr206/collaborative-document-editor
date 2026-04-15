import {
  clearStoredSession,
  getStoredSession,
  login,
  register,
  type AuthSession,
  type LoginInput,
  type RegisterInput
} from "../api/auth";
import type { AuthUser, SessionState } from "../lib/types";

function mapUser(session: AuthSession): AuthUser {
  return {
    id: `usr_${session.username}`,
    username: session.username,
    email: null,
    displayName: session.username,
    avatarUrl: null
  };
}

function mapSession(session: AuthSession): SessionState {
  return {
    user: mapUser(session),
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    expiresIn: session.expiresIn
  };
}

export const authClient = {
  async login(input: LoginInput) {
    const session = await login(input);
    return mapSession(session);
  },
  async register(input: RegisterInput) {
    await register(input);
  },
  async getSession() {
    const session = getStoredSession();
    return session ? mapSession(session) : null;
  },
  async logout() {
    clearStoredSession();
  }
};
