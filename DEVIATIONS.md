# Deviations From `guidelines/first_assignment.md`

This file records the current gap between the planned architecture in `guidelines/first_assignment.md` and the actual implementation in this repository.

For each deviation, this report states what changed, why, and whether the result is an `Improvement`, `Neutral implementation choice`, or `Compromise`, as required by Assignment 2.

## 1. Response format is still only partially aligned

Label: `Compromise`

What changed:
- The planned API contract uses a more uniform success envelope shape.
- The current implementation still mixes response formats across endpoints.
- Examples:
  - auth register returns `{ "message": ... }`
  - auth login returns a token payload directly
  - some sharing endpoints return raw models instead of a `{ data: ... }` envelope

Why:
- This is currently temporary technical debt rather than an intentional long-term contract strategy.
- Normalizing every success response would require coordinated updates across the frontend service layer, route handlers, and tests.
- That work was deferred to avoid destabilizing already-working flows late in implementation.

Consequence:
- Success response shapes are inconsistent, but error handling is still uniform enough for the frontend because the backend now consistently returns structured error payloads with `error.code`, `error.message`, and `details`.
- The frontend service layer already adapts per-endpoint success payloads, so the inconsistency is manageable, but it is still a contract-level deviation.

## 2. Document content updates still go through REST

Label: `Neutral implementation choice`

What changed:
- The original design expected document content writes to be more strongly centered around the collaboration channel.
- The current implementation still updates both `title` and `content` through `PATCH /api/v1/documents/{documentId}`.

Why:
- The current editor autosave flow depends on REST persistence for document content.
- Reworking persistence to rely primarily on the realtime channel would require a larger collaboration refactor and stronger server-side durability semantics.

Consequence:
- Realtime is currently used for collaboration UX: live propagation, presence, awareness, and immediate shared editing feedback.
- REST remains the source of durable persistence for the document state.
- For a single-backend local prototype, this split is simpler and more reliable than making websocket state authoritative.

## 3. AI processing is still immediate/streamed, not queue-based

Label: `Compromise`

What changed:
- The planned architecture described AI requests as asynchronous jobs with lifecycle states such as `queued`, `processing`, `completed`, and `failed`.
- The current implementation records the interaction and processes it immediately in the request or stream path.

Why:
- A queue-based design would require a worker process, job state management, retry handling, and a polling or callback mechanism.
- That is disproportionate for the current local coursework scope, where direct streaming is easier to test and reason about.

Consequence:
- The implementation is simpler and gives good UX for interactive requests, but it is less scalable and less resilient than a proper queued AI job architecture.

## 4. Realtime state is still in-memory only

Label: `Compromise`

What changed:
- The planned architecture assumed a more scalable realtime service with state that is safe across multiple processes or instances.
- The current backend stores collaboration room state only in process memory.

Why:
- This project is currently run as a single local backend process for testing and demo purposes.
- In-memory room state is acceptable for that scope and kept the implementation smaller.

Consequence:
- Room state is lost on backend restart.
- The current realtime layer is not safe for multi-instance deployment.
- This means the design is acceptable for local demo use, but not for production durability or horizontal scaling.

## 5. `commenter` role is still missing

Label: `Compromise`

What changed:
- The original design includes `owner`, `editor`, `commenter`, and `viewer`.
- The current implementation supports `owner`, `editor`, and `viewer`, but not `commenter`.

Why:
- Adding `commenter` is not just an enum change.
- It affects permission checks, editor behavior, UI affordances, and AI access rules.
- More importantly, the current application does not implement a dedicated comment subsystem.

Consequence:
- The omission of `commenter` is directly tied to the lack of a comment subsystem.
- Adding the role without comments, comment permissions, and comment-specific UI would be incomplete and misleading.

## 6. AI visibility still excludes viewers

Label: `Compromise`

What changed:
- The planned design allows AI-generated suggestions and history to be visible to users with read access.
- The current implementation still restricts AI history access to editors and owners.

Why:
- The current AI history and review flow was designed around editing privileges.
- Expanding read-only visibility would require revisiting backend authorization and some frontend assumptions.

Consequence:
- This is useful from a collaboration-audit perspective, but it is not essential for validating the main collaboration and AI editing flow in the current prototype.

## 7. Data model still differs from the original design

Label: `Neutral implementation choice`

What changed:
- `Document` still does not include an `ai_opt_out` field.
- There is still no separate `AIResult` model.
- The document response still returns an `owner` object rather than the planned `ownerId`-style shape.

Why:
- These are design-level and extensibility-oriented differences rather than blockers for the current demo.
- The implemented data model is intentionally simpler to keep the project easier to test and maintain within assignment scope.

Consequence:
- The current model is sufficient for the implemented feature set, but it leaves less room for future expansion than the original design intended.

## 8. Repository structure still differs from the planned architecture

Label: `Neutral implementation choice`

What changed:
- The original design included more separated top-level modules such as:
  - `realtime/`
  - `ai-service/`
  - `shared/`
  - `docs/`
- The current implementation keeps realtime and AI logic inside the backend application instead.

Why:
- This is an architectural simplification for a small team project and local testing setup.
- Splitting services would increase operational and coordination overhead without adding much value for the current scale of the implementation.

Consequence:
- The codebase is less distributed and less aligned with the originally planned service boundaries, but easier to run, debug, and demonstrate locally.

## 9. Export is still a frontend placeholder

Label: `Compromise`

What changed:
- The UI includes export actions, but `Export PDF` still returns a placeholder download URL rather than a real exported file.

Why:
- Export was part of the broader planned document-management scope from Assignment 1 and should be treated as a real missing capability, not just a nice-to-have omission.
- It was deprioritized in favor of collaboration, sharing, authentication, version restore, and streaming AI, which were more central to the live demo and current integration risks.

Consequence:
- This should be considered an unfinished feature.
- The current UI preserves the intended interaction point, but the backend does not yet implement an actual export pipeline for common formats.
