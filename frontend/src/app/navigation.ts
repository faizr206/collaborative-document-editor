import { useSyncExternalStore } from "react";

export type RouteMatch =
  | { name: "login" }
  | { name: "register" }
  | { name: "documents" }
  | { name: "document"; documentId: number }
  | { name: "settings"; documentId: number }
  | { name: "profile" };

function normalize(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function getCurrentPath() {
  return normalize(window.location.pathname);
}

function parseRoute(pathname: string): RouteMatch {
  const path = normalize(pathname);

  if (path === "/login") {
    return { name: "login" };
  }

  if (path === "/register") {
    return { name: "register" };
  }

  if (path === "/documents") {
    return { name: "documents" };
  }

  if (path === "/profile") {
    return { name: "profile" };
  }

  const settingsMatch = /^\/documents\/(\d+)\/settings$/.exec(path);
  if (settingsMatch) {
    return { name: "settings", documentId: Number(settingsMatch[1]) };
  }

  const documentMatch = /^\/documents\/(\d+)$/.exec(path);
  if (documentMatch) {
    return { name: "document", documentId: Number(documentMatch[1]) };
  }

  return { name: "documents" };
}

export function navigate(path: string, options?: { replace?: boolean }) {
  const next = normalize(path);
  const current = getCurrentPath();
  if (current === next) {
    return;
  }

  if (options?.replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute() {
  const pathname = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("popstate", onStoreChange);
      return () => window.removeEventListener("popstate", onStoreChange);
    },
    getCurrentPath,
    () => "/documents"
  );

  return parseRoute(pathname);
}
