import type { DocumentMember, DocumentRole, ShareLink } from "../lib/types";
import { readStorage, writeStorage } from "../lib/storage";
import { createId } from "../lib/utils";

type SharingRecord = {
  members: DocumentMember[];
  shareLinks: ShareLink[];
};

const STORAGE_PREFIX = "frontend-only-sharing";

function key(documentId: number) {
  return `${STORAGE_PREFIX}:${documentId}`;
}

function readRecord(documentId: number): SharingRecord {
  return readStorage<SharingRecord>(key(documentId), {
    members: [],
    shareLinks: []
  });
}

function writeRecord(documentId: number, value: SharingRecord) {
  writeStorage(key(documentId), value);
}

export const sharingClient = {
  async listMembers(documentId: number) {
    return readRecord(documentId).members;
  },
  async inviteMember(documentId: number, input: { email: string; role: Exclude<DocumentRole, "owner"> }) {
    const record = readRecord(documentId);
    const displayName = input.email.split("@")[0] ?? input.email;
    const nextMember: DocumentMember = {
      userId: createId("usr"),
      displayName,
      email: input.email,
      role: input.role
    };

    record.members = [nextMember, ...record.members];
    writeRecord(documentId, record);
    return nextMember;
  },
  async updateMemberRole(documentId: number, userId: string, role: Exclude<DocumentRole, "owner">) {
    const record = readRecord(documentId);
    record.members = record.members.map((member) =>
      member.userId === userId ? { ...member, role } : member
    );
    writeRecord(documentId, record);
  },
  async removeMember(documentId: number, userId: string) {
    const record = readRecord(documentId);
    record.members = record.members.filter((member) => member.userId !== userId);
    writeRecord(documentId, record);
  },
  async listShareLinks(documentId: number) {
    return readRecord(documentId).shareLinks;
  },
  async createShareLink(documentId: number, role: Exclude<DocumentRole, "owner">) {
    const record = readRecord(documentId);
    const nextLink: ShareLink = {
      id: createId("shl"),
      role,
      url: `${window.location.origin}/invite/${createId("token")}`,
      isActive: true,
      expiresAt: null
    };
    record.shareLinks = [nextLink, ...record.shareLinks];
    writeRecord(documentId, record);
    return nextLink;
  },
  async disableShareLink(documentId: number, shareLinkId: string) {
    const record = readRecord(documentId);
    record.shareLinks = record.shareLinks.map((link) =>
      link.id === shareLinkId ? { ...link, isActive: false } : link
    );
    writeRecord(documentId, record);
  }
};
