# PoC Guidelines

## 1. Purpose

This document defines a small proof-of-concept implementation for the collaborative document editor project.

The goal of this PoC is not to build the full product. The goal is to prove that:

- a frontend exists and can render a basic document editor UI,
- the frontend can communicate with the backend,
- the backend can persist document data,
- the request and response contracts work end to end,
- the team has a working technical skeleton that can later evolve into a fuller MVP.

This PoC should stay intentionally small and low-complexity.

## 2. PoC Scope

The PoC only needs to demonstrate the minimum required product flow:

1. User opens the frontend.
2. User creates or loads a document.
3. User edits document content in a basic text area.
4. User saves the document through an API call.
5. User reloads the document and sees persisted content.

This is enough to prove:

- frontend rendering,
- backend API connectivity,
- document data contract validity,
- SQLite persistence.

## 3. What Is In Scope

- a working frontend page,
- a basic document editor UI,
- FastAPI backend,
- SQLite database,
- at least one real document API flow,
- request and response validation,
- simple local development setup,
- CORS configuration for frontend-backend communication.

## 4. What Is Out of Scope

Do not build these for the PoC unless time remains:

- real-time collaboration,
- WebSockets,
- authentication,
- role-based sharing,
- AI integration with real providers,
- version history,
- export,
- background queues,
- Redis,
- PostgreSQL,
- complex editor frameworks,
- production deployment concerns.

For the PoC, a plain text editor is enough.

## 5. Recommended Minimal Stack

Use the simplest stack that proves the contracts.

### 5.1 Frontend

Recommended:

- `React`
- `Vite`
- `TypeScript`
- standard `fetch`
- basic CSS or minimal Tailwind if already preferred

### 5.2 Backend

Recommended:

- `Python`
- `FastAPI`
- `Pydantic`
- `SQLAlchemy`
- `SQLite`
- `Uvicorn`

### 5.3 Reasoning

This stack is recommended because:

- FastAPI is fast to build with,
- Pydantic makes request and response contracts explicit,
- SQLite removes infrastructure setup,
- React + Vite is enough for a basic UI,
- the entire system can run locally with minimal setup.

## 6. Target PoC Architecture

Use one frontend app and one backend app.

### 6.1 Components

- `frontend`: renders the editor page and calls the API
- `backend`: exposes document endpoints and persists data in SQLite
- `sqlite.db`: local file database

### 6.2 Data Flow

1. Frontend sends `POST /api/documents` to create a document.
2. Backend returns the document object.
3. Frontend displays the document title and content.
4. User edits content in a text area.
5. Frontend sends `PUT /api/documents/{id}` to save changes.
6. Backend persists the updated content.
7. Frontend can call `GET /api/documents/{id}` to verify saved content.

## 7. Recommended Repository Structure

```text
collaborative-document-editor/
  backend/
    app/
      main.py
      db.py
      models.py
      schemas.py
      crud.py
      routes/
        documents.py
    requirements.txt
  frontend/
    src/
      App.tsx
      main.tsx
      api/
        documents.ts
      components/
        DocumentEditor.tsx
    package.json
    vite.config.ts
  guidelines/
    guidelines.txt
    developer-guidelines.md
    poc-guidelines.md
```

This structure is intentionally simple. Do not over-modularize the PoC.

## 8. PoC Data Model

For the PoC, only one main entity is necessary.

### 8.1 Document

Fields:

- `id: integer`
- `title: string`
- `content: string`
- `created_at: datetime`
- `updated_at: datetime`

SQLite table suggestion:

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 9. API Contract

The PoC should keep the API very small but explicit.

Recommended base path:

- `/api`

### 9.1 Create Document

#### `POST /api/documents`

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
      "id": 1,
      "title": "Untitled Document",
      "content": "",
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T10:00:00Z"
    }
  }
}
```

Purpose:

- proves frontend can create a document through the backend,
- proves backend returns a structured response matching the contract.

### 9.2 Get Document

#### `GET /api/documents/{documentId}`

Response:

```json
{
  "data": {
    "document": {
      "id": 1,
      "title": "Untitled Document",
      "content": "Hello world",
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T10:05:00Z"
    }
  }
}
```

Purpose:

- proves the saved document can be fetched and rendered.

### 9.3 Update Document

#### `PUT /api/documents/{documentId}`

Request:

```json
{
  "title": "Untitled Document",
  "content": "Hello world"
}
```

Response:

```json
{
  "data": {
    "document": {
      "id": 1,
      "title": "Untitled Document",
      "content": "Hello world",
      "createdAt": "2026-03-31T10:00:00Z",
      "updatedAt": "2026-03-31T10:05:00Z"
    }
  }
}
```

Purpose:

- proves editing and persistence work end to end.

### 9.4 List Documents

Optional but useful:

#### `GET /api/documents`

Response:

```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "title": "Untitled Document",
        "updatedAt": "2026-03-31T10:05:00Z"
      }
    ]
  }
}
```

This is optional for the PoC, but helpful if you want a simple sidebar or document list.

## 10. Pydantic Schema Guidance

Use explicit request and response schemas so the contract is validated.

Recommended schema set:

- `CreateDocumentRequest`
- `UpdateDocumentRequest`
- `DocumentResponse`
- `DocumentListItem`
- `DocumentListResponse`

Suggested shapes:

```python
class CreateDocumentRequest(BaseModel):
    title: str


class UpdateDocumentRequest(BaseModel):
    title: str
    content: str


class DocumentDto(BaseModel):
    id: int
    title: str
    content: str
    createdAt: datetime
    updatedAt: datetime


class DocumentResponse(BaseModel):
    data: dict
```

It is better to define nested models instead of using untyped `dict`, but this example shows the minimum idea.

## 11. Frontend Requirements

The frontend only needs one basic page.

### 11.1 Required UI Elements

- a button to create a document,
- a text input for document title,
- a text area for document content,
- a save button,
- a status message area,
- optional load button or document selector.

### 11.2 Minimum Frontend Flow

1. User clicks `Create Document`.
2. Frontend calls `POST /api/documents`.
3. Frontend stores returned document id in component state.
4. User edits title or content.
5. User clicks `Save`.
6. Frontend calls `PUT /api/documents/{id}`.
7. Frontend shows success message using returned response.

### 11.3 Frontend State

Use simple local React state:

- `documentId`
- `title`
- `content`
- `status`
- `loading`

Do not introduce a heavy global state library for this PoC.

## 12. Backend Requirements

The backend should expose only a few endpoints and keep the code simple.

### 12.1 Backend Modules

Recommended files:

- `main.py`: app creation and CORS
- `db.py`: SQLite session setup
- `models.py`: SQLAlchemy models
- `schemas.py`: Pydantic request and response models
- `crud.py`: database helper functions
- `routes/documents.py`: API endpoints

### 12.2 Validation Rules

- `title` cannot be empty,
- `content` can be empty,
- requests must reject invalid JSON,
- non-existent document ids return `404`.

### 12.3 Error Responses

Use a consistent error shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Document not found"
  }
}
```

Minimum error cases:

- invalid request body,
- missing document,
- internal server error.

## 13. Database Guidance

SQLite should be enough for the PoC.

### 13.1 Why SQLite

- no extra setup,
- easy local execution,
- enough to prove persistence,
- enough to validate contracts.

### 13.2 Migration Strategy

For the PoC, either:

- create tables at startup, or
- use a tiny migration script.

Do not introduce complex migration tooling unless the team already uses it comfortably.

## 14. CORS and Local Development

The frontend and backend will likely run on different ports.

Recommended local ports:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`

Enable CORS in FastAPI for the frontend origin.

Example:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 15. Exact Contract Validation Goal

This PoC is specifically supposed to validate the architecture document’s data contracts.

That means:

- if the architecture says the API returns `{ "data": { "document": ... } }`, the PoC must return exactly that shape,
- field names must match exactly,
- frontend code must parse that exact shape,
- backend schemas must enforce the same shape.

Do not return ad hoc response structures from different endpoints.

## 16. Suggested PoC User Journey

This is the recommended demo flow.

1. Open the frontend page.
2. Click `Create Document`.
3. See returned document metadata on screen.
4. Type text into the editor area.
5. Click `Save`.
6. See a success message.
7. Refresh or reload the document.
8. Confirm the content persisted from SQLite.

If this works, the PoC has succeeded.

## 17. Nice-to-Have Additions

Only add these if the core PoC already works:

- a document list sidebar,
- auto-save button state,
- loading spinner,
- very basic timestamp display,
- a mock AI endpoint that returns transformed text without calling a real model.

If adding a mock AI endpoint, keep it simple, for example:

#### `POST /api/ai/rewrite`

Request:

```json
{
  "text": "hello world"
}
```

Response:

```json
{
  "data": {
    "result": "HELLO WORLD"
  }
}
```

This is optional and only useful if the team wants to prove an AI-shaped contract without actual AI integration.

## 18. Implementation Order

Build in this order:

1. create the FastAPI app,
2. create the SQLite document model,
3. implement `POST /api/documents`,
4. implement `GET /api/documents/{id}`,
5. implement `PUT /api/documents/{id}`,
6. create the frontend page,
7. connect the frontend to the create endpoint,
8. connect save and load flows,
9. manually test the full journey.

## 19. Success Criteria

The PoC is complete if all of these are true:

- the frontend loads in a browser,
- the user can create a document from the frontend,
- the frontend successfully receives and displays backend JSON,
- the user can edit content,
- the content can be saved through the backend,
- the saved content persists in SQLite,
- the request and response shapes match the documented contract.

## 20. Final Recommended Baseline

If the team wants one exact PoC baseline, use this:

- frontend: React + Vite + TypeScript
- backend: FastAPI + Pydantic + SQLAlchemy
- database: SQLite
- editor UI: one page with title input and text area
- API endpoints: create document, get document, update document
- contract style: `{ "data": ... }` for success and `{ "error": ... }` for failure

This is the smallest practical implementation that still proves the product concept and validates frontend-backend integration.
