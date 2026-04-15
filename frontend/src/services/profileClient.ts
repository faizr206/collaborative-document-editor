import type { SessionState } from "../lib/types";
import { readStorage, writeStorage } from "../lib/storage";

const STORAGE_KEY = "frontend-only-profile";

type ProfileRecord = {
  displayName: string;
  avatarUrl: string;
};

export const profileClient = {
  async get(session: SessionState | null) {
    const fallback: ProfileRecord = {
      displayName: session?.user.displayName ?? "",
      avatarUrl: session?.user.avatarUrl ?? ""
    };

    return readStorage<ProfileRecord>(STORAGE_KEY, fallback);
  },
  async save(input: ProfileRecord) {
    writeStorage(STORAGE_KEY, input);
    return input;
  }
};
