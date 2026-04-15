import type { DocumentVersion, SessionState } from "../lib/types";
import { readStorage, writeStorage } from "../lib/storage";
import { createId } from "../lib/utils";

const STORAGE_PREFIX = "frontend-only-versions";

function key(documentId: number) {
  return `${STORAGE_PREFIX}:${documentId}`;
}

export const versionsClient = {
  async list(documentId: number): Promise<DocumentVersion[]> {
    return readStorage<DocumentVersion[]>(key(documentId), []);
  },
  async create(documentId: number, session: SessionState | null, title: string) {
    const versions = readStorage<DocumentVersion[]>(key(documentId), []);
    const nextVersion: DocumentVersion = {
      id: createId("ver"),
      versionNumber: versions.length + 1,
      createdAt: new Date().toISOString(),
      title,
      createdBy: session
        ? {
            id: session.user.id,
            displayName: session.user.displayName
          }
        : null
    };
    writeStorage(key(documentId), [nextVersion, ...versions]);
    return nextVersion;
  }
};
