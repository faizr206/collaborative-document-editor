#!/usr/bin/env sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [ ! -f "$BACKEND_DIR/.venv/bin/activate" ]; then
  echo "Missing backend virtualenv at backend/.venv"
  echo "Create it first with:"
  echo "  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

cleanup() {
  if [ "${BACKEND_PID:-}" != "" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ "${FRONTEND_PID:-}" != "" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

(
  cd "$BACKEND_DIR"
  . .venv/bin/activate
  uvicorn app.main:app --reload
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 127.0.0.1
) &
FRONTEND_PID=$!

echo "Backend:  http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:5173"
echo "Press Ctrl+C to stop both processes."

wait "$BACKEND_PID" "$FRONTEND_PID"
