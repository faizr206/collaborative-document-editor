# Frontend Architecture Notes

This frontend is intentionally structured so backend and collaboration work can land later without rewriting the UI.

## Current boundaries

- `src/app/`
  - app shell
  - lightweight router
  - session provider
- `src/features/`
  - route-level pages and feature composition
- `src/services/`
  - all backend-dependent and integration-dependent logic
  - replace these modules first when real APIs are ready
- `src/lib/`
  - shared frontend types, storage helpers, formatting helpers
- `src/components/editor/`
  - Tiptap editor primitives reused by the document workspace

## Swap-in points for teammates

- `services/documentsClient.ts`
  - replace current PoC document API mapping with the final document/bootstrap contracts
- `services/collabAdapter.ts`
  - replace `mockCollabAdapter` with Y.js/WebSocket integration
- `services/sharingClient.ts`
  - replace local-storage sharing data with document member and share-link endpoints
- `services/versionsClient.ts`
  - replace local snapshots with real version history endpoints
- `services/aiClient.ts`
  - replace mocked AI suggestion generation with backend request/apply/reject flows
- `services/exportsClient.ts`
  - replace placeholder export jobs with export request polling
- `services/profileClient.ts`
  - connect to `/users/me` when available

## Intentional frontend-only choices

- Missing backend features use adapters or local storage instead of leaking temporary logic into page components.
- The editor page already exposes:
  - read-only handling
  - selection capture
  - collaboration presence area
  - AI preview/apply panel
  - version history panel
- Routing is dependency-light on purpose. If the team later wants `react-router`, the migration should be isolated to `src/app/`.
