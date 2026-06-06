#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[shelf-workers]${NC} $*"; }
warn()  { echo -e "${YELLOW}[shelf-workers]${NC} $*"; }
error() { echo -e "${RED}[shelf-workers]${NC} $*"; exit 1; }

# ── .env ─────────────────────────────────────────────────────────────────────
[ -f .env ] || error ".env not found. Copy .env.example and fill in real values."
export $(grep -v '^#' .env | xargs)

# ── checks ───────────────────────────────────────────────────────────────────
[ -d .venv ] || error ".venv not found. Run start.sh once first to create it."
source .venv/bin/activate

if ! redis-cli -u "${REDIS_URL:-redis://localhost:6379}" ping &>/dev/null; then
  error "Redis not reachable at ${REDIS_URL:-redis://localhost:6379}. Start Redis first."
fi

if [ -z "$GROQ_API_KEY" ] || [ "$GROQ_API_KEY" = "your_groq_api_key" ]; then
  warn "GROQ_API_KEY not set — demand gap analysis will be skipped."
fi

# ── cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  info "Shutting down workers..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# ── celery worker ─────────────────────────────────────────────────────────────
info "Starting Celery worker (concurrency=2)..."
PYTHONPATH="$SCRIPT_DIR" celery -A celery_app worker \
  --loglevel=info \
  --concurrency=2 \
  --logfile=logs/celery-worker.log \
  &
PIDS+=($!)

# ── celery beat (scheduler) ───────────────────────────────────────────────────
info "Starting Celery beat (daily trend fetch)..."
PYTHONPATH="$SCRIPT_DIR" celery -A celery_app beat \
  --loglevel=info \
  --logfile=logs/celery-beat.log \
  &
PIDS+=($!)

info "Workers running. Logs → shelf-api/logs/. Press Ctrl+C to stop."
wait
