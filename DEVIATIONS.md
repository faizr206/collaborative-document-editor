# Deviations From `guidelines/first_assignment.md`

This file records the current gap between the assignment design in `guidelines/first_assignment.md` and the actual implementation after the recent low/medium-effort fixes.

## Fixed deviations

- `/api/v1` routes are now available for auth, documents, sharing, bootstrap, and versioning.
  Reason: this was mostly a routing and client-update task, so it was low effort and safe to add without changing the architecture.

- The backend now uses `/api/v1` consistently for auth, documents, sharing, AI, and admin routes.
  Reason: the route migration was mostly mechanical once the frontend and tests were already using versioned endpoints in several places.

- `POST /api/v1/auth/logout` now exists.
  Reason: the app already uses client-side token storage, so adding a lightweight logout endpoint was straightforward.

- `GET /api/v1/documents/{documentId}/bootstrap` now exists.
  Reason: the frontend already had the bootstrap data shape, so exposing it from the backend was a small contract fix.

- WebSocket bootstrap and connection auth now use short-lived document-scoped tokens.
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

- The assignment defines a standard success shape of `{ "data": {}, "meta": {} }`.
- The current implementation still omits `meta` on success responses.
- Some endpoints still return non-uniform success shapes:
  - auth register returns `{ "message": ... }`
  - auth login returns a token payload directly
  - sharing endpoints return raw models instead of `{ data: ... }`

Reason:
This is still a contract deviation, but changing all success envelopes would require coordinated frontend updates across multiple clients and tests. For a small-scale assignment demo, the current success payloads are functional and stable enough, so this was deferred to avoid unnecessary churn.

## 2. Document update behavior still diverges from the assignment

- The assignment says document content should not be updated through REST and that `PATCH /api/v1/documents/{documentId}` is for metadata/settings.
- The current implementation still updates both `title` and `content` through REST.

Reason:
The current editor autosave flow depends on REST persistence for document content. Removing that would require a larger collaboration refactor and a stronger realtime persistence model. For a small local prototype, REST-based content persistence is simpler and more reliable than forcing all writes through the WebSocket path.

## 3. AI API is still not document-scoped as specified

- The assignment describes:
  - `POST /api/v1/documents/{documentId}/ai/requests`
  - `GET /api/v1/documents/{documentId}/ai/requests/{requestId}`
- The implementation now uses `/api/v1/ai/*`, but it is still a global AI route surface rather than document-scoped request resources.

Reason:
The AI feature set is already working and tested through the current routes. Reworking it into a document-scoped request lifecycle would touch the frontend AI client, backend route structure, and possibly the streaming flow. For a small-scale project, the existing global routes are sufficient.

## 4. AI processing is still immediate/streamed, not queue-based

- The assignment proposes asynchronous AI jobs with states like `queued`, `processing`, `completed`, and `failed`.
- The current implementation creates the interaction and immediately processes it in the request/stream path.

Reason:
A real async job architecture would need a worker queue, background processor, state polling, and retry handling. That is disproportionate for a local assignment prototype where only a few users and requests are expected. The current direct processing model is easier to test and reason about.

## 5. Realtime state is still in-memory only

- The assignment assumes a more scalable realtime service with distributed/session-safe state handling.
- The current backend stores room state only in process memory.

Reason:
This project is currently run as a single local backend process for testing and coursework demonstration. In-memory room state is acceptable for that scope, even though it would not be sufficient for production or horizontal scaling.

## 6. `commenter` role is still missing

- The assignment defines `owner`, `editor`, `commenter`, and `viewer`.
- The implementation still supports only `owner`, `editor`, and `viewer`.

Reason:
Adding `commenter` is not just a new enum value. It affects permission checks, editor behavior, UI affordances, AI access rules, and likely comment-specific features. Since the current app does not implement a comment system, adding this role now would be incomplete and misleading.

## 7. Link-based sharing is still missing

- The assignment mentions optional link-based sharing through a `ShareLink` model and related access flow.
- The implementation only supports direct user sharing by email/username.

Reason:
Link sharing needs token generation, persistence, revocation rules, and a guest-access flow. For a small course project focused on authenticated collaboration, direct sharing already demonstrates the access-control concept adequately.

## 8. AI visibility still excludes viewers

- The assignment says AI-generated suggestions should be visible to all roles with read access.
- The current implementation still restricts AI history access to editors/owners.

Reason:
The current AI history and review flow was designed around editing privileges. Expanding read-only visibility would require revisiting backend authorization and some frontend assumptions. This is useful, but not essential for validating the main collaboration flow in a small prototype.

## 9. Data model still differs from the assignment

- `Document` still does not include an `ai_opt_out` field.
- There is still no separate `AIResult` model.
- There is still no backend `ShareLink` model.
- The document response still returns `owner` rather than the assignment’s `ownerId` shape.

Reason:
These are design-level or extensibility-oriented fields rather than blockers for the current demo. The implemented data model is intentionally simpler to keep the project easier to test and maintain within assignment scope.

## 10. Repository structure still differs from the planned architecture

- The assignment’s design includes top-level modules such as:
  - `realtime/`
  - `ai-service/`
  - `shared/`
  - `docs/`
- The current implementation keeps realtime and AI logic inside the backend application instead.

Reason:
This is an architectural simplification for a small team project and local testing setup. Splitting services would increase operational and coordination overhead without adding much value for the current scale of the implementation.

## 11. Export is still a frontend placeholder

- The UI includes export actions, but `Export PDF` still returns a placeholder download URL.

Reason:
Export is not central to the collaboration, sharing, or AI-writing requirements demonstrated in the current prototype. Leaving it as a placeholder keeps the UI flow visible without introducing a full document rendering/export pipeline.
