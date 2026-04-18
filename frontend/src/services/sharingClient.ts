import { getAccessToken } from "../api/auth";
import { API_BASE_URL } from "../config";
import type { DocumentMember } from "../lib/types";

type ApiErrorEnvelope = {
  detail?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

type BackendMember = {
  user_id: number;
  username: string;
  email: string;
  permission: "owner" | "editor" | "viewer";
};

type BackendMembersResponse = {
  document_id: number;
  title: string;
  users: BackendMember[];
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
      // Keep the fallback error.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function mapMember(member: BackendMember): DocumentMember {
  return {
    userId: String(member.user_id),
    displayName: member.username,
    email: member.email,
    role: member.permission
  };
}

export const sharingClient = {
  async listMembers(documentId: number): Promise<DocumentMember[]> {
    const payload = await requestJson<BackendMembersResponse>(`/api/v1/documents/${documentId}/members`);
    return payload.users.map(mapMember);
  },
  async inviteMember(documentId: number, input: { identifier: string; role: "editor" | "viewer" }) {
    const payload = await requestJson<BackendMember>(`/api/v1/documents/${documentId}/members`, {
      method: "POST",
      body: JSON.stringify(input)
    });
    return mapMember(payload);
  },
  async updateMemberRole(documentId: number, userId: string, role: "editor" | "viewer") {
    const payload = await requestJson<BackendMember>(
      `/api/v1/documents/${documentId}/members/${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role })
      }
    );
    return mapMember(payload);
  },
  async removeMember(documentId: number, userId: string) {
    await requestJson(`/api/v1/documents/${documentId}/members/${userId}`, {
      method: "DELETE"
    });
  }
};
