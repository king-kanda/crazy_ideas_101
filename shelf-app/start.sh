#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[shelf-app]${NC} $*"; }
warn()  { echo -e "${YELLOW}[shelf-app]${NC} $*"; }
error() { echo -e "${RED}[shelf-app]${NC} $*"; exit 1; }

# ── .env.local ────────────────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  if [ -f .env.local.example ]; then
    cp .env.local.example .env.local
    warn ".env.local not found — copied from .env.local.example. Set NEXT_PUBLIC_API_URL if your API isn't on :8000."
  else
    warn ".env.local missing. NEXT_PUBLIC_API_URL will default to http://localhost:8000"
  fi
fi

# ── node / package manager ───────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node 18+ from https://nodejs.org"
fi

NODE_VERSION=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node 18+ required (found v${NODE_VERSION})."
fi

# Prefer pnpm > yarn > npm
if command -v pnpm &>/dev/null; then
  PM="pnpm"
elif command -v yarn &>/dev/null; then
  PM="yarn"
else
  PM="npm"
fi
info "Using package manager: $PM"

# ── install deps ──────────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  info "Installing dependencies..."
  $PM install
else
  info "node_modules found — skipping install. Run '$PM install' manually if packages changed."
fi

# ── mode ──────────────────────────────────────────────────────────────────────
MODE="${1:-dev}"

if [ "$MODE" = "prod" ]; then
  info "Building for production..."
  $PM run build
  PORT="${PORT:-3000}"
  info "Starting Next.js production server on http://localhost:${PORT}"
  PORT="$PORT" $PM run start
else
  PORT="${PORT:-3000}"
  info "Starting Next.js dev server on http://localhost:${PORT}"
  PORT="$PORT" $PM run dev
fi
