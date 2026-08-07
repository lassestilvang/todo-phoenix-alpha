#!/usr/bin/env bash
# =============================================================================
# Deployment script for todo-phoenix-alpha
# =============================================================================
# Usage:
#   ./scripts/deploy.sh [environment] [--skip-tests] [--skip-build]
#
# Environments: development, staging, production (default: production)
# =============================================================================

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────
ENV="${1:-production}"
SKIP_TESTS=false
SKIP_BUILD=false

for arg in "${@:2}"; do
  case "$arg" in
    --skip-tests)  SKIP_TESTS=true ;;
    --skip-build)  SKIP_BUILD=true ;;
    *) echo "❌ Unknown argument: $arg" && exit 1 ;;
  esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
ok()   { echo -e "${GREEN}✔${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✖${NC} $*"; }

# ─── Pre-flight checks ──────────────────────────────────────────────────────
check_env_file() {
  local env_file=".env.${ENV}"
  if [[ ! -f "$env_file" ]]; then
    warn "Environment file $env_file not found. Creating from .env.example..."
    cp .env.example "$env_file"
    warn "Please edit $env_file with your credentials before continuing."
    exit 1
  fi
  ok "Environment file $env_file exists"
}

check_node_version() {
  local required="20"
  local current=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$current" -lt "$required" ]]; then
    err "Node.js >= $required required (found v$current)"
    exit 1
  fi
  ok "Node.js version OK (v$(node -v | sed 's/v//'))"
}

check_bun() {
  if ! command -v bun &>/dev/null; then
    warn "Bun not found — some scripts may fail. Install from https://bun.sh"
  else
    ok "Bun available ($(bun --version))"
  fi
}

# ─── Steps ──────────────────────────────────────────────────────────────────
install_deps() {
  log "Installing dependencies..."
  if command -v bun &>/dev/null; then
    bun install --frozen-lockfile
  else
    npm ci
  fi
  ok "Dependencies installed"
}

run_tests() {
  if [[ "$SKIP_TESTS" == true ]]; then
    warn "Skipping tests (--skip-tests)"
    return
  fi
  log "Running test suite..."
  if command -v bun &>/dev/null; then
    bun test
  else
    npx vitest run
  fi
  ok "All tests passed"
}

run_lint() {
  log "Running linter..."
  if command -v bun &>/dev/null; then
    bun run lint
  else
    npm run lint
  fi
  ok "Lint passed"
}

build_app() {
  if [[ "$SKIP_BUILD" == true ]]; then
    warn "Skipping build (--skip-build)"
    return
  fi
  log "Building application..."
  if command -v bun &>/dev/null; then
    bun run build
  else
    npm run build
  fi
  ok "Build completed"
}

run_migrations() {
  log "Running database migrations..."
  # Add your migration command here if you have a migration system
  # Example: npx prisma migrate deploy
  # For now, we just ensure the database file exists
  if [[ ! -f "data/todo.db" ]]; then
    warn "Database file not found — it will be created on first run"
  fi
  ok "Database ready"
}

start_app() {
  log "Starting application in ${ENV} mode..."
  export NODE_ENV="${ENV}"
  if [[ "$ENV" == "development" ]]; then
    if command -v bun &>/dev/null; then
      bun run dev
    else
      npm run dev
    fi
  else
    if command -v bun &>/dev/null; then
      bun run start
    else
      npm run start
    fi
  fi
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║          todo-phoenix-alpha Deployment Script              ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  log "Target environment: ${ENV}"

  check_env_file
  check_node_version
  check_bun

  install_deps
  run_tests
  run_lint
  build_app
  run_migrations

  if [[ "$ENV" == "development" ]]; then
    start_app
  else
    ok "Deployment to ${ENV} completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  • Start the server: NODE_ENV=${ENV} npm run start"
    echo "  • Or with PM2: pm2 start ecosystem.config.js --env ${ENV}"
    echo "  • View logs: pm2 logs"
  fi
}

main "$@"