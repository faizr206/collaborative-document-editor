import { authorizedFetch } from "../api/auth";
import type { DocumentMember, ShareLink } from "../lib/types";

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

type BackendShareLinkInfo = {
  id: number;
  login_required: boolean;
  owner_id: number;
  token: string;
  role: "editor" | "viewer";
  multi_use: boolean;
  expiry: string | null;
  is_active: boolean;
};

type BackendShareLinkResponse = {
  info: BackendShareLinkInfo;
  final_url: string;
};

type BackendShareLinkStatusResponse = {
  message: string;
  document_id: number;
  role: "editor" | "viewer";
  login_required: boolean;
  multi_use: boolean;
  token: string;
};

type BackendAcceptShareLinkResponse = {
  message: string;
  document_id: number;
  role: "owner" | "editor" | "viewer";
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
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
  },
  async createShareLink(
    documentId: number,
    input: { role: "editor" | "viewer"; multiUse: boolean }
  ): Promise<ShareLink> {
    const payload = await requestJson<BackendShareLinkResponse>(`/share/${documentId}`, {
      method: "POST",
      body: JSON.stringify({
        role: input.role,
        login_required: true,
        multi_use: input.multiUse
      })
    });

    return {
      id: String(payload.info.id),
      role: payload.info.role,
      url: new URL(`/share/${payload.info.token}`, window.location.origin).toString(),
      isActive: payload.info.is_active,
      expiresAt: payload.info.expiry,
      loginRequired: payload.info.login_required,
      multiUse: payload.info.multi_use
    };
  },
  async getShareLinkStatus(token: string) {
    return requestJson<BackendShareLinkStatusResponse>(`/share/${token}`);
  },
  async acceptShareLink(token: string) {
    return requestJson<BackendAcceptShareLinkResponse>(`/share/${token}/accept`, {
      method: "POST"
    });
  }
};
