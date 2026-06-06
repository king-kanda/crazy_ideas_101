#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[shelf-api]${NC} $*"; }
warn()  { echo -e "${YELLOW}[shelf-api]${NC} $*"; }
error() { echo -e "${RED}[shelf-api]${NC} $*"; exit 1; }

# ── .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn ".env not found — copied from .env.example. Fill in real values before production."
  else
    error ".env file missing. Create one from .env.example."
  fi
fi
export $(grep -v '^#' .env | xargs)

# ── python venv ───────────────────────────────────────────────────────────────
if [ ! -d .venv ]; then
  info "Creating virtual environment..."
  python3 -m venv .venv
fi
source .venv/bin/activate

info "Installing dependencies..."
pip install -q -r requirements.txt

# ── redis check ───────────────────────────────────────────────────────────────
if command -v redis-cli &>/dev/null; then
  if ! redis-cli -u "${REDIS_URL:-redis://localhost:6379}" ping &>/dev/null; then
    warn "Redis not reachable at ${REDIS_URL:-redis://localhost:6379}. Celery workers won't start."
    SKIP_WORKERS=1
  fi
else
  warn "redis-cli not found — skipping Redis check. Install Redis to enable background workers."
  SKIP_WORKERS=1
fi

# ── cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# ── celery worker + beat ──────────────────────────────────────────────────────
if [ -z "$SKIP_WORKERS" ]; then
  info "Starting Celery worker..."
  PYTHONPATH="$SCRIPT_DIR" celery -A celery_app worker --loglevel=info --concurrency=2 &
  PIDS+=($!)

  info "Starting Celery beat (scheduler)..."
  PYTHONPATH="$SCRIPT_DIR" celery -A celery_app beat --loglevel=info &
  PIDS+=($!)
fi

# ── fastapi ───────────────────────────────────────────────────────────────────
PORT="${PORT:-8000}"
info "Starting FastAPI on http://0.0.0.0:${PORT}"
uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload &
PIDS+=($!)

info "All processes started. Press Ctrl+C to stop."
wait
