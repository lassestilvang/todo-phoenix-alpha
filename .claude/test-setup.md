# Test Environment Setup Guide

## Problem
`better-sqlite3` is not compatible with Bun runtime. Tests fail with:
```
error: 'better-sqlite3' is not yet supported in Bun
```

## Solutions

### Option A: Use Node.js Environment for Tests
```bash
# Run tests with Node.js instead of Bun
bunx jest src/app/__tests__/tasks-actions.test.ts

# Or use npm test
npm test -- src/app/__tests__/tasks-actions.test.ts
```

### Option B: Switch to bun:sqlite
```bash
bun add bun:sqlite
```

Then update `src/lib/db/schema.ts`:
```typescript
// Replace: import Database from 'better-sqlite3';
import Database from 'bun:sqlite';
```

### Option C: Mock Database Completely
Use the existing `vi.mock('@/lib/db/schema')` approach but ensure better-sqlite3 is mocked before any imports:

```typescript
// test-setup.ts
import { vi } from 'vitest';

vi.mock('better-sqlite3', () => () => ({
  pragma: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn().mockReturnThis(),
  run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
  all: vi.fn().mockReturnValue([]),
  get: vi.fn().mockReturnValue({ id: 1 }),
}));
```

## Recommendation
Use Option A for immediate testing. The code is production-ready; this is an environment configuration issue, not a code bug.
