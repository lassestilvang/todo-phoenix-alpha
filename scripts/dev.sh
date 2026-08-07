#!/usr/bin/env bash
# =============================================================================
# Development environment setup & launch for todo-phoenix-alpha
# =============================================================================
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()  { echo -e "${GREEN}✔${NC} $*"; }
warn(){ echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✖${NC} $*"; }

# ── 1️⃣  Ensure Node / Bun are available ──────────────────────────────────
if command -v bun &>/dev/null; then
  ok "Bun available ($(bun --version))"
else
  warn "Bun not found — falling back to node"
fi

# ── 2️⃣  Install dependencies ─────────────────────────────────────────────
log "📦 Installing dependencies..."
bun install --frozen-lockfile || npm ci
ok "Dependencies installed"

# ── 3️⃣  Environment file ──────────────────────────────────────────────────
if [[ ! -f ".env.development" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env.development
    warn "⚠ Created .env.development from .env.example — please edit it!"
  else
    err "❌ No .env.example found; cannot create .env.development"
    exit 1
  fi
fi
ok "Environment file .env.development exists"

# ── 4️⃣  Database initialisation ───────────────────────────────────────────
if [[ ! -f "data/todo.db" ]]; then
  log "🗃️  Database not found — creating fresh SQLite database..."
  mkdir -p data
  # The app creates the DB on first run via better-sqlite3; we just ensure dir exists
  ok "Database directory ready"
else
  ok "Database already exists"
fi

# ── 5️⃣  Run initial migrations / seed ────────────────────────────────────
log "🛠️  Running database migrations..."
# If you have a migration system, run it here:
# npx prisma migrate deploy
# For pure better-sqlite3, the schema creates tables automatically on first run.
ok "Migrations checked (schema auto-creates on first app start)"

# ── 6️⃣  Launch the development server ─────────────────────────────────────
log "🚀 Starting development server…"
export NODE_ENV=development
if command -v bun &>/dev/null; then
  bun run dev
else
  npm run dev
fi