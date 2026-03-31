# Developer Guidelines

## 1. Purpose of This Document

This document converts the product-level requirements in `guidelines/guidelines.txt` into an implementation-ready guide for developers.

The original guide defines the expected behavior of the application, but it does not fully define:

- the exact backend and frontend boundary,
- the API contracts,
- the real-time collaboration protocol,
- the AI integration layer,
- the database model,
- the project structure,
- deployment assumptions.

Where the original guide is silent, this document defines a recommended default that is practical, scalable enough for the project scope, and easy for multiple developers to work on in parallel.

## 2. Product Summary

The application is a collaborative document editor with:

- account registration and authentication,
- document creation and sharing,
- role-based access control,
- real-time collaborative editing,
- version history,
- AI-assisted writing on selected text,
- auditability for AI usage and document changes.

The system must keep document editing functional even if the AI provider is down.

## 3. Recommended Technical Baseline

This section defines the default stack unless the team intentionally decides otherwise.

### 3.1 Monorepo

Use a monorepo so frontend, backend, shared types, and infrastructure contracts stay in sync.

Recommended tool:

- `pnpm` workspaces

Optional:

- `turbo` for caching and task orchestration

### 3.2 Frontend

Recommended:

- `Next.js` with App Router
- `TypeScript`
- `Tailwind CSS`
- `Tiptap` editor
- `Y.js` client for collaborative editing
- `@tanstack/react-query` for server state
- `Zustand` only for small client UI state if needed

Reasoning:

- Next.js gives routing, authentication-friendly SSR, and simple deployment.
- Tiptap is a strong editor foundation and integrates well with Y.js.
- React Query keeps REST data fetching predictable.

### 3.3 Backend

Recommended:

- `NestJS` with `Fastify`
- `TypeScript`
- `Prisma` ORM
- `PostgreSQL`
- `Redis`
- `BullMQ` for async jobs

Reasoning:

- NestJS gives clear module boundaries for auth, documents, AI, collaboration, and sharing.
- PostgreSQL is enough for transactional metadata.
- Redis is useful for session caching, rate limiting, collaboration pub/sub, and queues.

### 3.4 Real-Time Collaboration

Recommended:

- `Y.js` as the collaboration model
- `Hocuspocus` server or a custom Y-websocket-compatible service

Reasoning:

- The original guide allows OT or CRDT. Use CRDT with Y.js because it is simpler to operationalize for a modern collaborative editor and handles offline/reconnection well.

### 3.5 AI Integration

Recommended:

- backend-only AI provider integration,
- provider abstraction layer,
- async job execution for AI requests,
- streaming responses only if the team has time; otherwise use request-response with polling or WebSocket events.

Recommended default provider interface:

- primary provider: OpenAI-compatible chat/completions API
- optional future providers: Anthropic, Gemini, local inference

The frontend must never call the model provider directly.

## 4. High-Level Architecture

Use the following logical services. They may start in one backend app and split later if needed.

### 4.1 Services

- `web`: Next.js frontend
- `api`: main HTTP API for auth, documents, sharing, versions, AI metadata
- `collab`: WebSocket/Y.js collaboration server
- `worker`: background jobs for AI generation, export, cleanup
- `db`: PostgreSQL
- `redis`: cache, queue broker, presence/pub-sub support
- `object-storage`: optional for exports and backups

### 4.2 Responsibility Split

Frontend owns:

- UI routing,
- editor rendering,
- local editor state,
- selection capture for AI requests,
- optimistic display of collaboration presence,
- rendering AI suggestions,
- handling accept/reject/apply flows.

Backend owns:

- authentication and sessions,
- authorization,
- document metadata persistence,
- authoritative permission checks,
- collaboration session authorization,
- version history metadata,
- AI request lifecycle,
- audit logs,
- rate limiting and abuse protection.

Collaboration service owns:

- real-time document synchronization,
- awareness/presence state,
- reconnect and catch-up behavior,
- persistence hooks for CRDT state or snapshots.

## 5. Recommended Repository Structure

```text
collaborative-document-editor/
  apps/
    web/
      app/
      components/
      features/
      lib/
      styles/
    api/
      src/
        main.ts
        app.module.ts
        modules/
          auth/
          users/
          documents/
          shares/
          versions/
          ai/
          exports/
          health/
        common/
    collab/
      src/
        server.ts
        extensions/
        auth/
        persistence/
    worker/
      src/
        main.ts
        jobs/
          ai/
          export/
          cleanup/
  packages/
    shared/
      src/
        types/
        constants/
        schemas/
    editor/
      src/
        tiptap/
        yjs/
        ai/
    config/
      eslint/
      typescript/
  prisma/
    schema.prisma
    migrations/
  guidelines/
    guidelines.txt
    developer-guidelines.md
  docker/
  .env.example
  package.json
  pnpm-workspace.yaml
```

## 6. Core Domain Model

These are the main entities that both frontend and backend should align on.

### 6.1 User

- `id: string`
- `email: string`
- `passwordHash: string`
- `displayName: string`
- `avatarUrl: string | null`
- `createdAt: Date`
- `updatedAt: Date`
- `deletedAt: Date | null`

### 6.2 Document

- `id: string`
- `title: string`
- `ownerId: string`
- `currentContentFormat: "yjs" | "json"`
- `currentContent: jsonb | bytea`
- `latestVersionId: string | null`
- `isAiEnabled: boolean`
- `createdAt: Date`
- `updatedAt: Date`
- `archivedAt: Date | null`

### 6.3 DocumentMember

- `id: string`
- `documentId: string`
- `userId: string`
- `role: "owner" | "editor" | "viewer"`
- `createdAt: Date`
- `updatedAt: Date`

Do not add `commenter` unless the team explicitly decides to support comments in scope. The original guide mentions `commenter` once in a user story, but the formal role model is `owner`, `editor`, `viewer`. Keep scope consistent.

### 6.4 ShareLink

- `id: string`
- `documentId: string`
- `tokenHash: string`
- `role: "viewer" | "editor"`
- `isActive: boolean`
- `expiresAt: Date | null`
- `createdBy: string`
- `createdAt: Date`

### 6.5 DocumentVersion

- `id: string`
- `documentId: string`
- `createdBy: string | null`
- `title: string`
- `snapshotFormat: "yjs" | "json"`
- `snapshotData: jsonb | bytea`
- `versionNumber: number`
- `createdAt: Date`

### 6.6 AiRequest

- `id: string`
- `documentId: string`
- `requestedBy: string`
- `type: "summarize" | "rewrite" | "translate" | "expand" | "shorten" | "fix_grammar"`
- `status: "queued" | "processing" | "completed" | "failed" | "cancelled"`
- `selectionAnchor: jsonb`
- `sourceTextHash: string`
- `sourceText: text`
- `contextText: text | null`
- `instruction: text | null`
- `provider: string | null`
- `model: string | null`
- `resultText: text | null`
- `errorCode: string | null`
- `errorMessage: string | null`
- `createdAt: Date`
- `updatedAt: Date`

### 6.7 AiInteraction

- `id: string`
- `aiRequestId: string`
- `documentId: string`
- `userId: string`
- `outcome: "accepted" | "rejected" | "partially_applied" | "expired"`
- `appliedTextHash: string | null`
- `createdAt: Date`

### 6.8 AuditLog

- `id: string`
- `actorUserId: string | null`
- `documentId: string | null`
- `action: string`
- `metadata: jsonb`
- `createdAt: Date`

## 7. Authorization Rules

These rules must be enforced by the backend. The frontend should reflect them in UI, but UI is not security.

### 7.1 Roles

- `owner`: full access, including share settings, role changes, link generation, version restore, AI configuration
- `editor`: can read, edit, invoke AI, export if allowed
- `viewer`: can read, cannot edit, cannot invoke AI

### 7.2 Permission Matrix

| Action | Owner | Editor | Viewer |
|---|---|---:|---:|
| Read document | yes | yes | yes |
| Edit document | yes | yes | no |
| Use AI | yes | yes | no |
| View versions | yes | yes | yes |
| Revert version | yes | no | no |
| Share with users | yes | no | no |
| Generate share link | yes | no | no |
| Revoke access | yes | no | no |
| Export document | yes | yes | yes |

If the team wants stricter export rules, change it to `owner` and `editor` only. The original guide allows export for users with appropriate permissions but does not force a stricter rule.

## 8. API Design Principles

### 8.1 General Rules

- All REST endpoints are prefixed with `/api/v1`.
- JSON request and response bodies use `camelCase`.
- Authentication uses secure HTTP-only cookies for the session or access token.
- All write endpoints enforce authorization on the server.
- Validation must happen at the API boundary.
- Shared request and response schemas should be defined in `packages/shared`.

### 8.2 Standard Response Shape

Success:

```json
{
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this document.",
    "details": null
  }
}
```

### 8.3 Common Error Codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `RATE_LIMITED`
- `AI_PROVIDER_UNAVAILABLE`
- `AI_SOURCE_TEXT_MISMATCH`
- `INTERNAL_ERROR`

## 9. REST API Contracts

These contracts are the starting point. The team can extend them, but should avoid breaking them once frontend and backend work has started.

### 9.1 Auth

#### `POST /api/v1/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "displayName": "Alice"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "displayName": "Alice",
      "avatarUrl": null
    }
  }
}
```

#### `POST /api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "data": {
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "displayName": "Alice",
      "avatarUrl": null
    }
  }
}
```

#### `POST /api/v1/auth/logout`

Response:

```json
{
  "data": {
    "success": true
  }
}
```

#### `GET /api/v1/auth/me`

Response:

```json
{
  "data": {
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "displayName": "Alice",
      "avatarUrl": null
    }
  }
}
```

### 9.2 Users

#### `PATCH /api/v1/users/me`

Request:

```json
{
  "displayName": "Alice Tan",
  "avatarUrl": "https://cdn.example.com/avatar.png"
}
```

### 9.3 Documents

#### `GET /api/v1/documents`

Query params:

- `cursor?: string`
- `limit?: number`
- `q?: string`
- `role?: "owner" | "editor" | "viewer"`

Response:

```json
{
  "data": {
    "items": [
      {
        "id": "doc_123",
        "title": "Project Proposal",
        "role": "owner",
        "updatedAt": "2026-03-31T08:00:00.000Z",
        "owner": {
          "id": "usr_123",
          "displayName": "Alice"
        }
      }
    ]
  },
  "meta": {
    "nextCursor": null
  }
}
```

#### `POST /api/v1/documents`

Request:

```json
{
  "title": "Untitled Document"
}
```

Response:

```json
{
  "data": {
    "document": {
      "id": "doc_123",
      "title": "Untitled Document",
      "role": "owner",
      "createdAt": "2026-03-31T08:00:00.000Z"
    }
  }
}
```

#### `GET /api/v1/documents/:documentId`

Response:

```json
{
  "data": {
    "document": {
      "id": "doc_123",
      "title": "Project Proposal",
      "role": "editor",
      "ownerId": "usr_123",
      "isAiEnabled": true,
      "updatedAt": "2026-03-31T08:00:00.000Z"
    }
  }
}
```

#### `PATCH /api/v1/documents/:documentId`

Used for metadata only. Do not use this endpoint for live editor content updates.

Request:

```json
{
  "title": "Final Proposal",
  "isAiEnabled": true
}
```

#### `DELETE /api/v1/documents/:documentId`

Soft-delete or archive by default.

### 9.4 Document Bootstrap

#### `GET /api/v1/documents/:documentId/bootstrap`

Purpose:

- provides the frontend with everything needed before opening the collaborative session.

Response:

```json
{
  "data": {
    "document": {
      "id": "doc_123",
      "title": "Project Proposal",
      "role": "editor",
      "isAiEnabled": true
    },
    "collab": {
      "provider": "yjs-websocket",
      "roomId": "doc_123",
      "websocketUrl": "wss://api.example.com/collab",
      "token": "signed-collab-token"
    },
    "presence": {
      "self": {
        "userId": "usr_456",
        "displayName": "Bob",
        "color": "#2563eb"
      }
    }
  }
}
```

This endpoint is important because collaboration auth should be short-lived and document-specific.

### 9.5 Sharing

#### `GET /api/v1/documents/:documentId/members`

Response:

```json
{
  "data": {
    "items": [
      {
        "userId": "usr_123",
        "displayName": "Alice",
        "role": "owner"
      },
      {
        "userId": "usr_456",
        "displayName": "Bob",
        "role": "editor"
      }
    ]
  }
}
```

#### `POST /api/v1/documents/:documentId/members`

Request:

```json
{
  "email": "bob@example.com",
  "role": "editor"
}
```

#### `PATCH /api/v1/documents/:documentId/members/:userId`

Request:

```json
{
  "role": "viewer"
}
```

#### `DELETE /api/v1/documents/:documentId/members/:userId`

#### `GET /api/v1/documents/:documentId/share-links`

#### `POST /api/v1/documents/:documentId/share-links`

Request:

```json
{
  "role": "viewer",
  "expiresAt": null
}
```

Response:

```json
{
  "data": {
    "shareLink": {
      "id": "shl_123",
      "role": "viewer",
      "url": "https://app.example.com/invite/abc123",
      "isActive": true,
      "expiresAt": null
    }
  }
}
```

#### `POST /api/v1/share-links/:token/accept`

Requires authentication. The server resolves the link, grants membership, and returns the document id.

### 9.6 Versions

#### `GET /api/v1/documents/:documentId/versions`

Response:

```json
{
  "data": {
    "items": [
      {
        "id": "ver_001",
        "versionNumber": 12,
        "createdAt": "2026-03-31T08:00:00.000Z",
        "createdBy": {
          "id": "usr_123",
          "displayName": "Alice"
        },
        "title": "Auto snapshot"
      }
    ]
  }
}
```

#### `POST /api/v1/documents/:documentId/versions`

Creates a manual snapshot.

#### `POST /api/v1/documents/:documentId/versions/:versionId/restore`

Only owner can restore.

Response:

```json
{
  "data": {
    "restoredVersionId": "ver_001",
    "newVersionId": "ver_013"
  }
}
```

Restoring a version must create a new version entry. Never overwrite history.

### 9.7 AI

#### Supported AI actions

- `summarize`
- `rewrite`
- `translate`
- `expand`
- `shorten`
- `fix_grammar`

#### `POST /api/v1/documents/:documentId/ai/requests`

Request:

```json
{
  "type": "rewrite",
  "selection": {
    "from": 120,
    "to": 280
  },
  "sourceText": "Original selected text",
  "contextText": "Optional nearby paragraph context",
  "instruction": "Make it more formal",
  "locale": "en"
}
```

Response:

```json
{
  "data": {
    "request": {
      "id": "air_123",
      "status": "queued",
      "type": "rewrite",
      "createdAt": "2026-03-31T08:00:00.000Z"
    }
  }
}
```

Notes:

- backend must verify the caller has `owner` or `editor` role,
- backend must store a hash of `sourceText`,
- backend must not trust only the selection offsets because live collaborative text can change.

#### `GET /api/v1/documents/:documentId/ai/requests/:requestId`

Response when complete:

```json
{
  "data": {
    "request": {
      "id": "air_123",
      "status": "completed",
      "type": "rewrite",
      "sourceText": "Original selected text",
      "resultText": "Rewritten text from the AI",
      "createdAt": "2026-03-31T08:00:00.000Z",
      "updatedAt": "2026-03-31T08:00:04.000Z"
    }
  }
}
```

#### `POST /api/v1/documents/:documentId/ai/requests/:requestId/apply`

Purpose:

- records user intent to accept or partially apply the suggestion,
- backend verifies source text mismatch before final apply metadata is recorded.

Request:

```json
{
  "appliedText": "Edited AI suggestion that user approved",
  "currentSourceText": "Current text in editor before apply"
}
```

Response:

```json
{
  "data": {
    "outcome": "accepted",
    "mismatchDetected": false
  }
}
```

Important:

- the actual text insertion still happens in the collaborative editor via Y.js operations from the client,
- this endpoint exists to preserve traceability and to guard against silent stale applies.

#### `POST /api/v1/documents/:documentId/ai/requests/:requestId/reject`

Response:

```json
{
  "data": {
    "outcome": "rejected"
  }
}
```

#### AI mismatch behavior

If `currentSourceText` does not match the original `sourceText`, return:

```json
{
  "error": {
    "code": "AI_SOURCE_TEXT_MISMATCH",
    "message": "The selected text changed while the AI request was processing.",
    "details": {
      "requestId": "air_123"
    }
  }
}
```

Frontend then offers:

- re-run AI on updated text,
- apply anyway,
- discard.

If the user explicitly chooses apply anyway, the request can be retried with:

```json
{
  "appliedText": "Edited AI suggestion that user approved",
  "currentSourceText": "Current text in editor before apply",
  "force": true
}
```

### 9.8 Export

#### `POST /api/v1/documents/:documentId/exports`

Request:

```json
{
  "format": "pdf"
}
```

Response:

```json
{
  "data": {
    "exportJobId": "exp_123",
    "status": "queued"
  }
}
```

#### `GET /api/v1/documents/:documentId/exports/:exportJobId`

Response:

```json
{
  "data": {
    "status": "completed",
    "downloadUrl": "https://cdn.example.com/exports/doc_123.pdf"
  }
}
```

## 10. Collaboration Contract

REST handles metadata. WebSocket handles document editing and presence.

### 10.1 Connection Flow

1. Frontend calls `GET /api/v1/documents/:documentId/bootstrap`.
2. Frontend receives a short-lived collaboration token.
3. Frontend connects to the collaboration service with:
   - `roomId = documentId`
   - `token = signed collab token`
4. Collaboration server validates:
   - user identity,
   - document id,
   - allowed role,
   - token expiry.

### 10.2 Client Awareness State

Each connected client should publish:

```json
{
  "userId": "usr_456",
  "displayName": "Bob",
  "color": "#2563eb",
  "cursor": {
    "anchor": 128,
    "head": 140
  }
}
```

### 10.3 Presence Rules

- viewers may connect in read-only mode,
- editors and owners connect in editable mode,
- presence is ephemeral and not stored permanently,
- member list is derived from awareness events plus backend identity.

### 10.4 Persistence Rules

Recommended:

- persist Y.js document state periodically,
- create a snapshot on timed intervals and on important events,
- create explicit version entries separately from low-level persistence.

Do not store every keystroke as a version.

### 10.5 Reconnection Rules

- client buffers unsent changes locally,
- Y.js merge resolves after reconnect,
- frontend displays `reconnecting` status,
- if token expired during disconnect, client refreshes bootstrap data.

## 11. AI Integration Design

The AI feature must be safe, auditable, and decoupled from the editor’s core functionality.

### 11.1 AI Request Lifecycle

1. User selects text.
2. Frontend sends request metadata to backend.
3. Backend validates permission and document AI policy.
4. Backend stores `AiRequest` in `queued` status.
5. Worker picks up the job.
6. Worker builds provider-specific prompt.
7. Worker submits request to provider.
8. Worker stores result and marks request `completed` or `failed`.
9. Frontend polls or listens for status updates.
10. User accepts, edits, or rejects result.
11. Backend stores final interaction outcome.

### 11.2 AI Provider Abstraction

Define an interface like:

```ts
interface AiProvider {
  generateSuggestion(input: {
    type: "summarize" | "rewrite" | "translate" | "expand" | "shorten" | "fix_grammar";
    sourceText: string;
    contextText?: string | null;
    instruction?: string | null;
    locale?: string | null;
  }): Promise<{
    provider: string;
    model: string;
    outputText: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>;
}
```

This makes provider replacement possible without changing frontend contracts.

### 11.3 Prompt Construction Rules

- Send only the selected text plus limited surrounding context.
- Never send the full document unless a future feature explicitly requires it.
- Include a structured system instruction so output format is stable.
- For translation, require the target language explicitly.
- For rewrite actions, tell the model to preserve meaning unless the user asks otherwise.

### 11.4 AI Safety and Privacy Rules

- AI can be disabled per document.
- Viewer role cannot invoke AI.
- Log enough metadata for traceability, but do not retain unnecessary full-document content.
- Retain prompts and responses only as long as necessary for debugging and product requirements.
- If the provider fails, document editing remains available.

### 11.5 Suggested AI Prompt Output Format

Prefer deterministic JSON from the provider when possible:

```json
{
  "resultText": "string"
}
```

If the provider does not reliably support structured output in the chosen tier, fallback to plain text and normalize in the backend.

## 12. Frontend Implementation Guidelines

### 12.1 Feature Areas

Recommended frontend feature folders:

```text
apps/web/features/
  auth/
  dashboard/
  editor/
  documents/
  sharing/
  versions/
  ai/
  profile/
```

### 12.2 Editor Responsibilities

The editor feature should own:

- Tiptap setup,
- Y.js provider setup,
- awareness/cursor rendering,
- selection extraction,
- AI preview UI,
- reconnect indicators,
- read-only mode handling.

### 12.3 Frontend Route Structure

Recommended:

```text
/login
/register
/documents
/documents/[documentId]
/documents/[documentId]/settings
/profile
```

### 12.4 Frontend State Strategy

Use:

- React Query for REST resources,
- editor-local state for selection and suggestion previews,
- minimal global state for session and ephemeral UI.

Do not put the live document content into global app state. Let Tiptap + Y.js own it.

### 12.5 Frontend Apply-Suggestion Flow

1. User selects text.
2. User triggers AI action.
3. UI shows loading state.
4. Suggestion appears in side panel or inline diff view.
5. User edits suggestion if desired.
6. Before apply, frontend sends apply metadata to backend.
7. If no mismatch, frontend replaces the selected text in editor.
8. If mismatch, prompt the user before force applying.

### 12.6 Frontend Error Handling

The frontend must handle:

- expired session,
- missing document permission,
- collab reconnect failure,
- AI request failure,
- AI source mismatch,
- share-link expired or disabled.

## 13. Backend Implementation Guidelines

### 13.1 API Modules

Recommended backend modules:

- `auth`
- `users`
- `documents`
- `members`
- `share-links`
- `versions`
- `ai`
- `exports`
- `health`
- `audit`

### 13.2 Service Boundaries

- `DocumentsService`: metadata, permissions lookup helpers
- `MembersService`: invitations, role changes, access revocation
- `VersionsService`: snapshots, restore flow
- `AiService`: request creation, provider selection, lifecycle
- `CollabAuthService`: short-lived tokens for WebSocket join
- `AuditService`: append-only action logging

### 13.3 Validation

Use schema validation at the controller boundary. Recommended:

- `zod` in shared package, or
- Nest DTO validation with `class-validator`

Pick one primary approach and stay consistent.

### 13.4 Transactions

Use DB transactions for:

- document creation with owner membership,
- share acceptance,
- role changes,
- version restore,
- AI apply/reject finalization.

### 13.5 Rate Limiting

Minimum limits:

- auth endpoints,
- AI request creation,
- share-link creation,
- export requests.

AI endpoints need stricter per-user and per-document rate limits to control cost.

## 14. Database and Persistence Guidance

### 14.1 PostgreSQL

Store in PostgreSQL:

- users,
- documents metadata,
- memberships,
- share links,
- versions,
- AI requests and outcomes,
- audit logs.

### 14.2 Collaboration State

Recommended options:

Option A, simplest:

- persist Y.js snapshots in PostgreSQL or object storage,
- use Redis only for pub/sub and awareness coordination.

Option B, more scalable:

- persist snapshots in object storage,
- keep metadata references in PostgreSQL.

For this project, Option A is sufficient unless document size becomes large.

### 14.3 Version History Strategy

Use a hybrid approach:

- low-level collaborative persistence for crash recovery,
- explicit version snapshots for user-visible history.

Recommended snapshot triggers:

- manual snapshot,
- periodic autosnapshot every N minutes,
- snapshot on restore,
- snapshot before destructive operations if needed.

## 15. Environment Variables

Define at least:

```env
NODE_ENV=development
WEB_URL=http://localhost:3000
API_URL=http://localhost:4000
COLLAB_URL=ws://localhost:4001

DATABASE_URL=postgresql://...
REDIS_URL=redis://...

SESSION_SECRET=...
JWT_SECRET=...

AI_PROVIDER=openai
AI_API_KEY=...
AI_MODEL=gpt-4.1-mini

STORAGE_BUCKET=...
STORAGE_REGION=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
```

If JWT is only used for collaboration short-lived tokens and the main app uses cookies, that is acceptable and recommended.

## 16. Local Development Workflow

Recommended startup services:

1. PostgreSQL
2. Redis
3. API server
4. Collaboration server
5. Worker
6. Frontend

Recommended dev commands:

```bash
pnpm install
pnpm dev
```

Recommended root scripts:

- `dev`
- `build`
- `lint`
- `typecheck`
- `test`
- `test:e2e`
- `db:migrate`
- `db:seed`

## 17. Testing Strategy

### 17.1 Frontend

- component tests for forms, document list, AI suggestion UI
- integration tests for editor page behaviors that do not require multi-user transport
- end-to-end tests for critical flows

### 17.2 Backend

- unit tests for permission checks, AI request lifecycle, share-link handling
- integration tests for REST endpoints
- collaboration integration tests for join, edit, reconnect, and read-only enforcement

### 17.3 Critical End-to-End Flows

Test these first:

- register, login, logout
- create document
- share document to another user
- two editors collaborate in one document
- viewer opens read-only document
- editor uses AI and accepts suggestion
- AI mismatch caused by concurrent edit
- owner restores previous version
- revoked user loses access immediately

## 18. Logging, Monitoring, and Audit

### 18.1 Structured Logging

Include:

- `requestId`
- `userId`
- `documentId`
- `service`
- `action`
- `durationMs`
- `status`

### 18.2 Metrics

Track:

- API latency,
- WebSocket connection count,
- edit propagation latency,
- reconnect success rate,
- AI request success rate,
- AI latency,
- AI token usage,
- export duration.

### 18.3 Audit Events

Audit at least:

- login,
- document creation,
- document deletion/archive,
- share changes,
- role changes,
- version restore,
- AI request create,
- AI request accept/reject,
- share-link create/disable.

## 19. Security Requirements for Implementation

- Hash passwords with `argon2` or `bcrypt` with strong settings.
- Use HTTP-only secure cookies in production.
- Enforce CSRF protection if using cookie-based auth.
- Validate all membership and role checks on the server.
- Never trust frontend-supplied document roles.
- Keep AI provider keys only on the server.
- Sanitize exported filenames.
- Store hashed share-link tokens, not raw tokens.
- Expire collaboration tokens quickly, for example 5 minutes.

## 20. Delivery Order

This is the recommended implementation order so frontend and backend can work in parallel.

### Phase 1

- repo setup,
- auth,
- document CRUD metadata,
- document list page,
- permissions model,
- bootstrap endpoint.

### Phase 2

- collaborative editor shell,
- Y.js connection,
- presence and cursor display,
- read-only mode.

### Phase 3

- sharing and role management,
- version snapshots and restore,
- audit logs.

### Phase 4

- AI request lifecycle,
- suggestion UI,
- apply/reject flow,
- mismatch handling,
- rate limiting.

### Phase 5

- export,
- performance hardening,
- observability,
- cleanup and retention jobs.

## 21. Team Working Agreement

To prevent frontend and backend from blocking each other:

- define shared request and response schemas in `packages/shared`,
- never ship undocumented endpoint changes,
- treat `developer-guidelines.md` as the current contract until replaced by OpenAPI or generated types,
- backend can mock incomplete AI provider behavior early,
- frontend can build against mock responses if endpoints are not ready,
- collaboration token/bootstrap contract should be implemented early because it unblocks the editor.

## 22. Final Default Decisions

If the team needs a single concrete baseline and does not want to debate options further, use this:

- monorepo with `pnpm`
- frontend: Next.js + TypeScript + Tailwind + Tiptap + Y.js
- backend: NestJS + Fastify + Prisma
- database: PostgreSQL
- cache and queue: Redis + BullMQ
- real-time sync: Y.js + Hocuspocus-compatible WebSocket server
- auth: secure cookie session plus short-lived collaboration token
- AI: backend provider abstraction, async jobs, selected-text-only scope
- version history: periodic and manual snapshots, restore creates a new version

This baseline is the recommended interpretation of the original requirements and is optimized for developer parallelism, maintainability, and acceptable scalability for the project.
