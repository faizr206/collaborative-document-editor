# Collaborative Document Editor

This project has:

- a FastAPI backend in `backend/`
- a React + Vite frontend in `frontend/`

## Prerequisites

Make sure you have these installed:

- Python 3.10+
- Node.js 18+
- npm
- SQLite

## Backend

The backend uses SQLite and stores data in:

```text
backend/sqlite.db
```

Then install the backend dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a shared root env file before starting the apps:

```bash
cp .env.example .env
```

Start the backend server:

```bash
uvicorn app.main:app --reload
```

The backend will run on:

```text
http://localhost:8000
```

Quick health check:

```bash
curl http://localhost:8000/health
```

## Frontend

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will run on:

```text
http://localhost:5173
```

## Frontend API Configuration

The frontend and backend now share the same root `.env` file.

Important variables in `.env.example`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
DATABASE_URL=sqlite:///./sqlite.db
JWT_SECRET_KEY=change-me-in-env
AI_PROVIDER=lmstudio
LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=qwen2.5-3b-instruct
```

The frontend reads `VITE_API_BASE_URL` from the repo root `.env`.
The backend reads the same root `.env` automatically via `python-dotenv`.

## Run Both

Use two terminals:

Terminal 1:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

## Testing

### Backend Tests

Install dependencies first:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run all backend tests:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest
```

Run only the document and AI access-control tests:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest tests/test_documents.py tests/test_ai.py
```

The `PYTHONPATH=.` prefix is required so `pytest` can import the `app` package from `backend/app`.

### Frontend Tests

Install dependencies first:

```bash
cd frontend
npm install
```

Run all frontend tests:

```bash
cd frontend
npm test
```

Run a single frontend test file:

```bash
cd frontend
npm test -- --run src/features/editor/DocumentWorkspacePage.test.tsx
```

Run frontend tests in watch mode:

```bash
cd frontend
npm run test:watch
```

### End-to-End Tests

The frontend also includes Playwright end-to-end tests in `frontend/e2e/`.

Install dependencies first:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install
```

Install the Playwright browser once if needed:

```bash
cd frontend
npx playwright install chromium
```

Run the full e2e suite:

```bash
cd frontend
npm run test:e2e
```

What this does automatically:

- starts the FastAPI backend on `http://127.0.0.1:8010`
- starts the Vite frontend on `http://127.0.0.1:4173`
- uses the mock AI provider for deterministic AI flows
- creates an isolated temporary SQLite database for the test run
- deletes that temporary e2e database after the run finishes

Current e2e coverage includes:

- register and logout
- profile preference save flow
- document sharing and viewer read-only access
- login through AI suggestion acceptance

## Real-Time Collaboration 

### Implementation
The real-time feature was implemented using WebSockets in the backend.

- A WebSocket endpoint (`/ws`) was created
- Multiple users can connect simultaneously
- Messages are broadcast to all connected users
- Active users are tracked

### Presence
- When a user connects, all clients receive a "User joined" message
- When a user disconnects, all clients receive a "User left" message

### Testing

#### Manual Testing
- Open the application in two browser tabs
- Send a message in one tab
- The message appears instantly in the other tab
- Closing a tab shows a "user left" message

#### Automated Testing
Automated backend tests were implemented using FastAPI TestClient.

These tests verify:
- successful WebSocket connection
- message broadcasting between multiple clients
- proper handling of client connections

All tests passed successfully.

### Architecture Deviation

In Assignment 1, real-time collaboration was designed as a separate service.

In this implementation, it was integrated directly into the backend for simplicity and easier local testing.

While separating it into its own service could improve scalability, combining it is sufficient for this assignment.
