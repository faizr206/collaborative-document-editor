# Deviations From `guidelines/first_assignment.md`

This file records the current gap between the planned architecture in `guidelines/first_assignment.md` and the actual implementation in this repository.

## Fixed deviations

- The backend now uses `/api/v1` consistently for auth, documents, sharing, bootstrap, versioning, AI, and admin routes.
  Reason: the route migration was mostly mechanical once the frontend and tests were already using versioned endpoints in several places.

- JWT auth now includes refresh-token based re-authentication instead of access-token-only sessions.
  Reason: the assignment requires token issuance, validation, and refresh, so the auth flow was extended instead of keeping the earlier simplified token lifecycle.

- Password handling now uses stronger password hashing rather than plain SHA-256-only storage for new passwords.
  Reason: this was necessary to bring authentication behavior closer to the assignment’s security expectations while preserving compatibility with older local data.

- `GET /api/v1/documents/{documentId}/bootstrap` now exists and returns a collab token for realtime access.
  Reason: the frontend already had the bootstrap data shape, so exposing it from the backend was a contained contract fix.

- WebSocket bootstrap and connection auth now use short-lived document-scoped tokens, and the websocket server enforces document access.
  Reason: the backend already had JWT auth and document role checks, so extending bootstrap to mint collab tokens and enforcing them in `/ws` was a contained change.

- Backend-backed versioning now exists through:
  - `GET /api/v1/documents/{documentId}/versions`
  - `POST /api/v1/documents/{documentId}/versions`
  - `POST /api/v1/documents/{documentId}/versions/{versionId}/restore`
  Reason: the project already had a `DocumentVersion` model, so exposing it through routes was medium effort but contained.

- The frontend version panel now reads from backend APIs instead of browser local storage.
  Reason: this aligned the implementation with the assignment without requiring a redesign of the editor.

- Error responses now include `details: null`.
  Reason: this was a small response-shape adjustment with minimal risk.

## Remaining deviations

## 1. Response format is still only partially aligned

- The planned API contract uses a more uniform envelope shape.
- The current implementation still mixes response formats across endpoints.
- Examples:
  - auth register returns `{ "message": ... }`
  - auth login returns a token payload directly
  - some sharing endpoints return raw models instead of a `{ data: ... }` envelope

Reason:
This is still a contract deviation, but normalizing every success response would require coordinated frontend updates across multiple clients and tests. For a small-scale assignment demo, the current payloads are functional and stable enough, so this was deferred.

## 2. Document content updates still go through REST

- The original design expected document content writes to be more strongly centered around the collaboration channel.
- The current implementation still updates both `title` and `content` through `PATCH /api/v1/documents/{documentId}`.

Reason:
The current editor autosave flow depends on REST persistence for document content. Removing that would require a larger collaboration refactor and stronger realtime persistence semantics. For a single-backend local prototype, REST-based persistence is simpler and more reliable.

## 3. AI processing is still immediate/streamed, not queue-based

- The planned architecture described AI requests as asynchronous jobs with lifecycle states such as `queued`, `processing`, `completed`, and `failed`.
- The current implementation records the interaction and processes it immediately in the request/stream path.

Reason:
A queue-based design would require a worker process, job state management, retry handling, and a polling or callback mechanism. That is disproportionate for the current local coursework scope, where direct streaming is easier to test and reason about.

## 4. Realtime state is still in-memory only

- The planned architecture assumed a more scalable realtime service with state that is safe across multiple processes or instances.
- The current backend stores collaboration room state only in process memory.

Reason:
This project is currently run as a single local backend process for testing and demo purposes. In-memory room state is acceptable for that scope, even though it would not be sufficient for production or horizontal scaling.

## 5. `commenter` role is still missing

- The original design includes `owner`, `editor`, `commenter`, and `viewer`.
- The current implementation supports `owner`, `editor`, and `viewer`, but not `commenter`.

Reason:
Adding `commenter` is not just an enum change. It affects permission checks, editor behavior, UI affordances, AI access rules, and likely comment-specific features. Since the current app does not implement a dedicated comment system, adding this role now would be incomplete.

## 6. AI visibility still excludes viewers

- The planned design allows AI-generated suggestions and history to be visible to users with read access.
- The current implementation still restricts AI history access to editors and owners.

Reason:
The current AI history and review flow was designed around editing privileges. Expanding read-only visibility would require revisiting backend authorization and some frontend assumptions. This is useful, but not essential for validating the main collaboration flow in the current prototype.

## 7. Data model still differs from the original design

- `Document` still does not include an `ai_opt_out` field.
- There is still no separate `AIResult` model.
- The document response still returns an `owner` object rather than the planned `ownerId`-style shape.

Reason:
These are design-level and extensibility-oriented differences rather than blockers for the current demo. The implemented data model is intentionally simpler to keep the project easier to test and maintain within assignment scope.

## 8. Repository structure still differs from the planned architecture

- The original design included more separated top-level modules such as:
  - `realtime/`
  - `ai-service/`
  - `shared/`
  - `docs/`
- The current implementation keeps realtime and AI logic inside the backend application instead.

Reason:
This is an architectural simplification for a small team project and local testing setup. Splitting services would increase operational and coordination overhead without adding much value for the current scale of the implementation.

## 9. Export is still a frontend placeholder

- The UI includes export actions, but `Export PDF` still returns a placeholder download URL.

Reason:
Export is not central to the collaboration, sharing, or AI-writing requirements demonstrated in the current prototype. Leaving it as a placeholder keeps the UI flow visible without introducing a full document rendering/export pipeline.
