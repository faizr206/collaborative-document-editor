const PENDING_SHARE_TOKEN_KEY = "pending-share-token";

export function setPendingShareToken(token: string) {
  window.localStorage.setItem(PENDING_SHARE_TOKEN_KEY, token);
}

export function getPendingShareToken() {
  return window.localStorage.getItem(PENDING_SHARE_TOKEN_KEY);
}

export function consumePendingShareToken() {
  const token = getPendingShareToken();
  if (token) {
    window.localStorage.removeItem(PENDING_SHARE_TOKEN_KEY);
  }
  return token;
}
