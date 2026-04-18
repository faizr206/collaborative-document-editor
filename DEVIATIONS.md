# Deviations From `guidelines/first_assignment.md`

This file lists implementation mismatches between the current codebase and the requirements/design described in `guidelines/first_assignment.md`.

## 1. API namespace and endpoint contract deviations

- The assignment specifies a REST namespace under `/api/v1`, but the implementation uses mixed prefixes such as `/api/documents`, `/api/permissions`, `/api/ai`, and `/user_auth` instead. See `backend/app/routes/documents.py:19`, `backend/app/routes/permissions.py:23`, `backend/app/routes/ai.py:20`, and `backend/app/routes/user.py:20`.
- The assignment defines auth endpoints as `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, and `POST /api/v1/auth/logout`. The implementation exposes `/user_auth/register` and `/user_auth/login`, and there is no logout endpoint. See `backend/app/routes/user.py:20-68`.
- The assignment defines `PATCH /api/v1/documents/{documentId}` for metadata only, explicitly stating that document content is not updated via REST. The implementation uses `PUT /api/documents/{document_id}` and updates both `title` and `content` directly through REST. See `backend/app/routes/documents.py:135-161`.
- The assignment defines `GET /api/v1/documents/{documentId}/bootstrap` as a backend endpoint that returns room/bootstrap data. There is no backend bootstrap route. Instead, the frontend synthesizes bootstrap data locally in `documentsClient.bootstrap()`. See `frontend/src/services/documentsClient.ts:78-97`.
- The assignment defines AI requests as `POST /api/v1/documents/{documentId}/ai/requests` and `GET /api/v1/documents/{documentId}/ai/requests/{requestId}`. The implementation instead exposes `/api/ai/suggest`, `/api/ai/stream`, `/api/ai/history/{document_id}`, `/api/ai/interactions/{interaction_id}/review`, and `/api/ai/cancel/{request_id}`. See `backend/app/routes/ai.py:175-409`.
- The assignment defines sharing endpoints under `/api/v1/documents/{documentId}/members`. The implementation places them under `/api/permissions/documents/{document_id}/members`. See `backend/app/routes/permissions.py:106-215`.
- The assignment defines versioning endpoints `GET /api/v1/documents/{documentId}/versions`, `POST /api/v1/documents/{documentId}/versions`, and `POST /api/v1/documents/{documentId}/versions/{versionId}/restore`. No equivalent backend routes exist.

## 2. Response-format deviations

- The assignment defines a standard success envelope of `{ "data": {}, "meta": {} }` and a standard error envelope with `code`, `message`, and `details`. The current implementation is inconsistent:
- Document routes return `{ "data": { ... } }` without a `meta` object. See `backend/app/routes/documents.py:38-51`.
- Auth registration returns `{ "message": "user registered successfully" }` and login returns a bare token object, not the specified wrapped format. See `backend/app/routes/user.py:39` and `backend/app/routes/user.py:65-68`.
- Permission endpoints return raw models instead of a `{ data: ... }` wrapper. See `backend/app/routes/permissions.py:77`, `backend/app/routes/permissions.py:101-103`, and `backend/app/routes/permissions.py:144-149`.
- Error responses produced in `main.py` omit the `details` field required by the assignment. See `backend/app/main.py:37-41`.

## 3. Authentication and authorization deviations

- The assignment says all protected endpoints are under `/api/v1` and the realtime connection uses a tokenized WebSocket URL. The implemented WebSocket endpoint accepts any client at `/ws` and trusts the `user` object sent by the client; there is no token validation. See `backend/app/websocket.py:92-140`.
- The assignment includes four document roles: `owner`, `editor`, `commenter`, and `viewer`. The implementation supports only `owner`, `editor`, and `viewer`. See `frontend/src/lib/types.ts:1` and `backend/app/schemas.py:52-53`, `81-88`.
- The assignment says AI-generated suggestions should be visible to all roles with read access. The implementation restricts AI history to `editor` and above, so viewers cannot access AI suggestion history. See `backend/app/routes/ai.py:351-367`.
- The assignment mentions optional link-based sharing. The implementation only supports direct user sharing by username/email and has no share-link creation, storage, or revocation flow. See `backend/app/routes/permissions.py:111-149` and `frontend/src/features/settings/DocumentSettingsPage.tsx:72-106`.

## 4. Real-time collaboration deviations

- The assignment specifies WebSocket bootstrap plus token-based connection to a collaboration endpoint like `wss://.../collab?token=...`. The implementation uses `/ws` with a client-supplied `join` message and no backend-issued short-lived token. See `backend/app/websocket.py:92-140` and `frontend/src/services/documentsClient.ts:87-92`.
- The assignment says realtime document updates are handled via WebSocket and the REST API should not update document content. The current system still persists editor content through REST autosave in parallel with WebSocket collaboration. See `frontend/src/features/editor/DocumentWorkspacePage.tsx:191-201`, `314-324` and `backend/app/routes/documents.py:135-161`.
- The assignment expects reconnection/state recovery around a dedicated realtime service. The implementation reconnects the browser socket client-side, but room state is kept only in process memory on the backend. If the backend restarts, realtime state is lost. See `backend/app/websocket.py:27-28`, `71-83`.

## 5. AI workflow deviations

- The assignment defines AI work as asynchronous jobs with statuses `queued`, `processing`, `completed`, and `failed`, plus a polling/event retrieval model. The implementation creates the interaction record and immediately generates the result in the request/stream handler; there is no queue or worker-based async job system. See `backend/app/routes/ai.py:175-218` and `221-338`.
- The assignment’s documented AI API is document-scoped. The current AI API is global under `/api/ai/*`, which diverges from the contract.
- The assignment describes AI as a dedicated service/container. In the current codebase, AI logic is embedded directly inside the backend application under `backend/app/ai/` and mounted from `backend/app/routes/ai.py`. There is no separate `ai-service/` module or deployable service.
- The assignment says AI suggestions are shown as suggestions and may be previewed inline or in a side panel. That part is implemented, but the assignment also mentions organization-level restrictions and quota handling. There is no quota or rate-limit enforcement in the AI routes.

## 6. Versioning deviations

- The assignment requires backend version history, snapshot creation, and restore endpoints. The current frontend version panel is backed only by browser local storage, not the backend. See `frontend/src/services/versionsClient.ts:5-31`.
- Although a `DocumentVersion` SQLModel exists, it is not exposed through backend routes and is not used by the editor flow. See `backend/app/models.py:39-45`.
- The assignment requires restoring a previous version by creating a new version rather than overwriting history. No restore implementation exists in the current codebase.

## 7. Data model deviations

- The assignment’s document model includes an `ai_opt_out` privacy flag. The implemented `Document` model has only `id`, `title`, `content`, `owner_id`, `created_at`, and `updated_at`. See `backend/app/models.py:21-28`.
- The assignment says `DocumentVersion` should store a snapshot with a version number and timestamp. The implemented `DocumentVersion` model has `content`, `created_at`, and `edited_by`, but no explicit `version_number` field. See `backend/app/models.py:39-45`.
- The assignment models AI history using both `AIInteraction` and `AIResult`. The implementation has only `AIInteraction`; there is no separate `AIResult` entity. See `backend/app/models.py:48-76`.
- The assignment models link sharing through `ShareLink`. The implementation defines a frontend `ShareLink` type but has no backend model or route for it. See `frontend/src/lib/types.ts:80-86`.
- The assignment’s document metadata example includes fields like `ownerId` and `isAiEnabled`. The implemented document response returns an `owner` object instead, and `isAiEnabled` is inferred on the frontend from the role rather than stored or returned by the backend. See `backend/app/routes/documents.py:38-51` and `frontend/src/services/documentsClient.ts:20-33`.

## 8. Repository and architecture deviations

- The assignment’s planned monorepo structure includes `frontend/`, `backend/`, `realtime/`, `ai-service/`, `shared/`, and `docs/`. The current repository contains `frontend/` and `backend/`, but not `realtime/`, `ai-service/`, or `shared/` as top-level implementation modules.
- The assignment explicitly justifies shared models/types in a `shared/` directory. The current implementation duplicates API/type concepts separately between frontend and backend instead of using a shared package.
- The assignment describes a dedicated realtime collaboration service. The current realtime implementation lives inside the main backend app as `backend/app/websocket.py`, not as a separate service.

## 9. Miscellaneous functional deviations

- The assignment includes a `commenter` role that can add comments and view AI suggestions. There is no comment system in the current implementation.
- The assignment mentions optional link-based access and revocation. There is no UI or backend support for creating or revoking share links.
- The assignment’s versioning section requires users to view version history and revert to previous versions. The UI currently only lists locally stored snapshots and does not offer restore.
- The editor UI exposes an `Export PDF` action, but it is only a frontend placeholder returning `downloadUrl: "#"`, not a real export workflow. See `frontend/src/services/exportsClient.ts:4-14`.
