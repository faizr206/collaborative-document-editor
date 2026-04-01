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

The frontend reads the backend URL from `VITE_API_BASE_URL`.

If you do not set it, the frontend uses this default:

```text
http://localhost:8000/api
```

If your backend is running at a different URL, create `frontend/.env` and set:

```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

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
