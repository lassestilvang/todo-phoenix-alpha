# Deployment Checklist & Guide

This document provides a comprehensive checklist, environment setup instructions, and release guidelines for the **todo-phoenix-alpha** project.

---

## Table of Contents

1. [Prerequisites](#prerequisites)  
2. [Environment Setup](#environment-setup)  
   - [Development](#development-environment)  
   - [Production](#production-environment)  
3. [Local Testing](#local-testing)  
4. [Deployment Checklist](#deployment-checklist)  
5. [Rollback Procedure](#rollback-procedure)  
6. [Release & Tagging](#release--tagging)  
7. [Cron Jobs](#cron-jobs)  
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Install Command |
|------|---------|-----------------|
| **Node.js** | >= 20.x | `brew install node` or <https://nodejs.org> |
| **Bun (optional)** | >= 1.1.0 | `curl -fsSL https://bun.sh/install | bash` |
| **Git** | >= 2.30 | `brew install git` |
| **PM2 (production)** | >= 5.x | `npm i -g pm2` |
| **Redis (optional, for caching)** | >= 7.x | `brew install redis` |

> **Tip:** If you prefer Node.js over Bun, `npm` / `npx` commands in `package.json` will work without changes.

---

## Environment Setup

### Development Environment

```bash
# 1️⃣ Clone & enter repo
git clone <repo-url>
cd todo-phoenix-alpha

# 2️⃣ Install deps (bun or npm)
bun install           # faster, recommended
# OR
npm ci

# 3️⃣ Create env file
cp .env.example .env.development
nano .env.development  # Edit required values

# 4️⃣ Launch dev server
./scripts/dev.sh
# OR
bun run dev
```

### Production Environment

```bash
# 1️⃣ SSH into server and clone repo
git clone --depth=1 <repo-url> /opt/todo-phoenix-alpha
cd /opt/todo-phoenix-alpha

# 2️⃣ Install system deps
brew install node  # or use NodeSource apt repo on Linux
brew install bun || npm install -g bun

# 3️⃣ Install project deps
bun install --frozen-lockfile || npm ci

# 4️⃣ Set production env
cp .env.example .env.production
nano .env.production  # ⚠️ Fill in ALL secrets (ANTHROPIC_API_KEY, DATABASE_URL, etc.)

# 5️⃣ Build
export NODE_ENV=production
bun run build   # or npm run build

# 6️⃣ Start
./scripts/prod.sh   # Starts with pm2 if available, otherwise Node directly
```

---

## Local Testing

```bash
# Unit & integration tests
bun test              # Faster (requires Bun)
# or
npx vitest run

# Coverage report
bun test --coverage
# or
npx vitest run --coverage

# Lint
bun run lint
# or
npm run lint
```

**All 59 tests should pass.**  
Key test groups:
- Backup & export operations
- Reminder lifecycle
- AI suggestions (mocked)
- Dependency management (including circular detection)
- NLP parser (chrono-node, recurring patterns)

---

## Deployment Checklist

Run this checklist **before merging to `main`** and **after every deployment**.

| Step | Description | Command / Action | ✅ |
|------|-------------|------------------|----|
| 1 | Pull latest `main` | `git pull origin main` | |
| 2 | Check CI status | (GitHub Actions / pipeline) | |
| 3 | Install dependencies | `npm ci` or `bun install` | |
| 4 | Run tests locally | `npm test` or `bun test` | |
| 5 | Check linter | `npm run lint` | |
| 6 | Build locally | `npm run build` | |
| 7 | Create migration backup | `cp data/todo.db data/todo.db.$(date +%Y%m%d%H%M%S)` | |
| 8 | Deploy (prod.sh or CI) | `./scripts/deploy.sh production` | |
| 9 | Run test suite on remote | `./scripts/test-remote.sh` (if exists) | |
| 10 | Smoke test endpoints | `curl localhost:3000/api/health` | |
| 11 | Verify cron jobs | `cat /path/to/scheduled_tasks.json` | |
| 12 | Tag release | `git tag vX.Y.Z && git push --tags` | |

**Hot-reload deployment (zero-downtime):**

```bash
# Using PM2
pm2 reload all
pm2 logs todo-phoenix-alpha
```

---

## Rollback Procedure

If a deployment breaks:

```bash
# 1. Identify working commit
git log --oneline -5

# 2. Stop current app
pm2 stop todo-phoenix-alpha   # or kill $(cat /tmp/pids/todo-phoenix-alpha.pid)

# 3. Restore previous version
git checkout <previous-good-commit>

# 4. Restore backup DB if needed
cp data/todo.db.backup data/todo.db

# 5. Rebuild & restart
npm run build && ./scripts/prod.sh
```

---

## Release & Tagging

```bash
# 1. Generate changelog (standard-version)
npx standard-version   # bumps version, writes CHANGELOG.md

# 2. Tag the release
git tag $(git describe --tags --abbrev=0)   # e.g., v1.2.0
git push --tags

# 3. Create GitHub Release (optional)
gh release create v1.2.0 --title "v1.2.0" --notes-file CHANGELOG.md
```

Or manually:

```bash
# Bump version in package.json (e.g., 0.2.0 → 0.3.0)
# Then commit & push
git add package.json CHANGELOG.md
git commit -m "chore(release): v0.3.0"
git tag v0.3.0
git push && git push --tags
```

---

## Cron Jobs

The following recurring jobs are auto-configured:

| Job ID | Schedule | Purpose |
|--------|----------|---------|
| `29a8e083` | `0 0 * * *` (daily 00:00) | General recurring pattern mining |
| `a44f9ae1` | `0 2 * * *` (daily 02:00) | Task scheduling pattern analysis |

To inspect or re-create these jobs:

```bash
cat .claude/scheduled_tasks.json
```

To re-register a job via CLI:

```bash
# Example: reschedule the pattern mining job to 3 AM instead of 2 AM
# (Edit .claude/scheduled_tasks.json manually or write a new cron)
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `ERR_DLOPEN_FAILED` with `better-sqlite3` | Native module compiled against different Node version | `npm rebuild better-sqlite3` or use Bun runtime |
| `revalidatePath` error in tests | Missing mock for `next/cache` | Already mocked in `*tasks-actions.test.ts` |
| AI suggestions returning `undefined` | Mock not applied before import | Ensure `vi.mock('@/lib/ai/enhancement', …)` is declared **before** any imports that use it |
| `pm2 logs` command not found | PM2 not installed globally | `npm i -g pm2` |

---

## Quick Reference

```bash
# Development
./scripts/dev.sh                 # Full dev setup + start

# Production
./scripts/prod.sh                # Start built app

# Deployment
./scripts/deploy.sh production   # Full deploy check + build

# Testing
bun test                         # All tests
bun test --coverage              # With coverage report

# Release
npm run changelog                # (if script defined)
git tag vX.Y.Z && git push --tags
```

---

*Document generated for `todo-phoenix-alpha` v0.1.0 — last updated 2026-08-18.*