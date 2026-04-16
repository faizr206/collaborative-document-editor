import { safeJsonParse } from "./utils";

export function readStorage<T>(key: string, fallback: T): T {
  return safeJsonParse<T>(window.localStorage.getItem(key), fallback);
}

export function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
