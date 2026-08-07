#!/usr/bin/env bash
# =============================================================================
# Production launch script for todo-phoenix-alpha
# =============================================================================
# This script assumes the app has already been built (via deploy.sh or CI).
# It starts the production server with proper process management.
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

# ── Configuration ─────────────────────────────────────────────────────────
APP_NAME="todo-phoenix-alpha"
PORT="${PORT:-3000}"
PM2_ENABLED="${PM2_ENABLED:-true}"

# ── 1️⃣  Pre-flight ───────────────────────────────────────────────────────
if [[ ! -f ".env.production" ]]; then
  err "❌ .env.production not found! Copy .env.example and fill in secrets."
  exit 1
fi
ok "Production env file found"

if [[ ! -d ".next" ]]; then
  err "❌ Build output (.next) not found. Run 'npm run build' first."
  exit 1
fi
ok "Build artifacts present"

# ── 2️⃣  Database ──────────────────────────────────────────────────────────
mkdir -p data
if [[ ! -f "data/todo.db" ]]; then
  warn "⚠ Database file not found — it will be created on first request"
fi
ok "Database directory ready"

# ── 3️⃣  Start server ──────────────────────────────────────────────────────
export NODE_ENV=production
export PORT

if [[ "$PM2_ENABLED" == "true" ]] && command -v pm2 &>/dev/null; then
  log "🚀 Starting with PM2…"
  pm2 start npm --name "$APP_NAME" -- run start
  pm2 save
  pm2 startup
  ok "App running under PM2 (name: $APP_NAME)"
  log "Logs: pm2 logs $APP_NAME"
  log "Stop:  pm2 stop $APP_NAME"
else
  log "🚀 Starting with Node.js directly…"
  if command -v bun &>/dev/null; then
    bun run start
  else
    npm run start
  fi
fi