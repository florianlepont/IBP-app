# Phase 01.3: CI and test safety net - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 13 (new + modified)
**Analogs found:** 13 / 13 (all files being rewritten already exist; the "analog" is the file's own current state plus one or two sibling files for a piece they're missing)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.github/workflows/ci.yml` (rewrite) | config (CI workflow) | event-driven | itself (current state) + audit's target sketch | exact (evolving in place) |
| `.github/workflows/codeql.yml` (new) | config (CI workflow) | event-driven | `.github/workflows/ci.yml` job-step conventions | role-match |
| `.github/dependabot.yml` (add `github-actions` block) | config | batch (scheduled) | itself (`npm` ecosystem block already present) | exact |
| `api/Dockerfile` (rewrite) | config (container build) | file-I/O / build | itself (current state) | exact |
| `.dockerignore` (new, repo root) | config | file-I/O | none in-repo; `.gitignore` is the closest analog for exclude-pattern style | role-match |
| `mobile/jest.unit.config.js` (edit) | config (test) | transform | itself (current state) | exact |
| `mobile/test/expo-sqlite.mock.ts` (rewrite) | test double / mock | CRUD (SQL passthrough) | `mobile/test/node-sqlite-db.ts` (the helper it must delegate to) | exact |
| `mobile/test/node-sqlite-db.ts` (reference only, no change expected) | utility (test) | CRUD | — (already correct, this is the source of truth) | exact |
| `mobile/src/storage.test.ts` (rewrite assertions) | test | CRUD | `mobile/src/storage/local-owner.sqlite.test.ts` (already uses `createNodeSqliteDb`) | exact |
| `api/jest.config.js` (edit: add `globalSetup`) | config (test) | transform | `api/jest.unit.config.js` (sibling config, same shape) | exact |
| `api/jest.unit.config.js` (edit: add `coverageThreshold`) | config (test) | transform | `mobile/jest.unit.config.js`'s coverage block (once added) — same Jest field | role-match |
| `api/test/global-setup.js` (new) | utility (test lifecycle) | event-driven / DB reset | `api/scripts/migrate.js` (DB connection + query pattern) | role-match |
| `api/scripts/migrate.js` (read-only reference, no change expected) | utility (migration runner) | batch | — | exact |
| `mobile/app.json` (edit: remove `newArchEnabled`) | config | — | itself (current state) | exact |
| `mobile/metro.config.js` (edit or document `disableHierarchicalLookup`) | config | — | itself (current state, has inline comment already) | exact |
| `package.json` (root, edit: add `engines`, keep scripts) | config | — | itself (current state) | exact |

## Pattern Assignments

### `.github/workflows/ci.yml` (config, event-driven)

**Analog:** itself (current file, read in full above) — this is a structural rewrite, not a from-scratch file. Preserve every currently-passing job's *behavior*, just restructure around path-filtering and one aggregator.

**Current triggers/jobs** (`.github/workflows/ci.yml` lines 1-166, already read in full):
- `quality` (lint+format), `test-unit-api`, `test-unit-mobile`, `test-e2e-api` (postgres service container with a full literal `env:` block of test secrets), `changes` (currently `if: github.event_name != 'pull_request'` — **must be removed** per RESEARCH.md Pattern 3), `build` (needs all four test jobs + `changes`, `if: needs.changes.outputs.api == 'true' || github.event_name == 'workflow_dispatch'`, `permissions: contents: read / packages: write`, tags only `:latest`).

**E2E env block to carry over verbatim into the new `unit`/`e2e` jobs** (lines 85-105):
```yaml
env:
  NODE_ENV: test
  PORT: 3000
  POSTGRES_HOST: localhost
  POSTGRES_PORT: 5432
  POSTGRES_DB: ibp
  POSTGRES_USER: ibp
  POSTGRES_PASSWORD: ibp
  OBJECT_STORAGE_MODE: local
  OBJECT_STORAGE_BUCKET: ibp-media
  ATTACHMENTS_UPLOAD_DIR: /tmp/ibp-uploads
  ACCESS_TOKEN_SECRET: ci-access-secret
  REFRESH_TOKEN_SECRET: ci-refresh-secret
  ACCESS_TOKEN_EXPIRES_IN: 15m
  REFRESH_TOKEN_EXPIRES_IN: 7d
  AUTH_DEV_EXPOSE_EMAIL_TOKEN: true
  AUTH_LOGIN_OR_CREATE_ENABLED: true
  SMTP_ENABLED: false
  DEBUG_DATA_RESET_ENABLED: true
  CADASTRE_PROVIDER: synthetic
  CADASTRE_PROVIDER_ALLOW_FALLBACK: true
```
Postgres service block to carry over (lines 70-83):
```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: ibp
      POSTGRES_USER: ibp
      POSTGRES_PASSWORD: ibp
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```

**Build job to adapt** (lines 136-166) — keep `permissions:` scoping and `docker/*` action usage, only change: SHA-pin every `uses:`, add `tags:` with commit SHA alongside `latest`, gate strictly on `main` push (not `workflow_dispatch` from any branch — RESEARCH.md flags `workflow_dispatch` bypass as CI-2), add a `concurrency:` group `deploy-image` with `cancel-in-progress: false`, and change `context: ./api` → `context: .` + `file: api/Dockerfile` (Pattern 3 / D-04 requires root build context):
```yaml
- name: Build and push
  uses: docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8 # v6.19.2
  with:
    context: .
    file: api/Dockerfile
    platforms: linux/amd64
    push: true
    tags: |
      ghcr.io/florianlepont/cortege:latest
      ghcr.io/florianlepont/cortege:sha-${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**New/extended `changes` job** — use RESEARCH.md's Pattern 1 verbatim (already vetted against this repo's actual paths), just add `mobile` and `shared` outputs to the existing `api`-only filter:
```yaml
changes:
  name: Detect changed paths
  runs-on: ubuntu-latest
  timeout-minutes: 5
  outputs:
    api: ${{ steps.filter.outputs.api }}
    mobile: ${{ steps.filter.outputs.mobile }}
    shared: ${{ steps.filter.outputs.shared }}
  steps:
    - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
    - uses: dorny/paths-filter@0e4a8c6effa4802afeda77dc8d303f8176d7dfad # v3.0.4
      id: filter
      with:
        filters: |
          api:
            - 'api/**'
          mobile:
            - 'mobile/**'
          shared:
            - 'package.json'
            - 'package-lock.json'
            - '.github/workflows/**'
            - '.eslintrc.json'
            - '.prettierrc.json'
            - 'tsconfig*.json'
```

**`ci-ok` aggregator** — new job, copy RESEARCH.md Pattern 2 verbatim, `needs: [check, unit, e2e, mobile-build, audit]`.

**Error handling / resilience pattern:** none of the current jobs have `timeout-minutes:` or a `permissions:` block except `build` — every new/rewritten job must add both (RESEARCH.md Code Examples show `timeout-minutes: 5`/`10` throughout; top-level `permissions: contents: read` should be added once at the workflow root, with `packages: write` only on `build`).

---

### `.github/workflows/codeql.yml` (config, event-driven) — new file

**Analog:** no direct analog in this repo (first CodeQL workflow); style should match `ci.yml`'s existing step conventions (SHA-pinned `uses:`, `timeout-minutes:`, `permissions:` block).

**Shape to use** (RESEARCH.md Standard Stack + Owner decision 3 — separate file, PR + weekly schedule, `javascript-typescript`, action `github/codeql-action@e429ea58a9912cadc53f8132ad35562b54de1b30 # v3.38.1`):
```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1'  # weekly, Monday 03:00 UTC

permissions:
  contents: read
  security-events: write

jobs:
  analyze:
    name: CodeQL analysis
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: github/codeql-action/init@e429ea58a9912cadc53f8132ad35562b54de1b30 # v3.38.1
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@e429ea58a9912cadc53f8132ad35562b54de1b30 # v3.38.1
```
Re-resolve the `github/codeql-action` SHA at execution time exactly as `ci.yml`'s other actions must be (RESEARCH.md Anti-Patterns: "never copy a training-data-recalled SHA").

---

### `.github/dependabot.yml` (config, batch)

**Analog:** itself — extend the existing single-ecosystem file with a second block, same style (full file already read above).

**Pattern to add** (append a second `updates:` entry, matching the existing npm block's style/comment density):
```yaml
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```
Note the existing `npm` entry sets `open-pull-requests-limit: 0` with an explanatory comment ("dependencies are upgraded deliberately, not on a schedule"). Decide per Claude's Discretion whether `github-actions` should get the same `0` limit (defeats the purpose of SHA-pin maintenance, since D-04/RESEARCH.md's SHA-pinning strategy depends on Dependabot actually opening bump PRs) or a real limit — RESEARCH.md's "Known Threat Patterns" table explicitly calls for "Dependabot `github-actions` ecosystem to keep pins current," implying PRs should actually be allowed to open (do **not** copy `open-pull-requests-limit: 0` onto this new block).

---

### `api/Dockerfile` (config, file-I/O/build)

**Analog:** itself (current state, read in full above, 31 lines) — full rewrite per D-04/RESEARCH.md Pattern 3.

**Current pattern being replaced:**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY tsconfig*.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
RUN npm run build
# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/migrations ./migrations
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.js && node dist/main.js"]
```
Problems this has (per RESEARCH.md/CONTEXT.md D-04): builds from `api/` alone so there's no root lockfile → `npm install` (not `ci`) resolves versions fresh, ignoring root `overrides` (multer, @bottom-tabs/react-navigation pins); runs as root; no `HEALTHCHECK`; tag is always `:latest` regardless of branch (fixed in `ci.yml`, not here).

**Target pattern — copy RESEARCH.md Pattern 3 verbatim** (already fully verified against this exact repo's `package.json`/`package-lock.json`/`api/package.json` this session, image sizes measured: 133 MB vs 529 MB):
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci --workspace api
COPY api ./api
RUN npm --workspace api run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci --workspace api --omit=dev
COPY --from=builder /app/api/dist ./api/dist
COPY api/scripts ./api/scripts
COPY api/migrations ./api/migrations
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/v1/health', r => process.exit(r.statusCode===200?0:1)).on('error', ()=>process.exit(1))"
EXPOSE 3000
CMD ["sh", "-c", "node api/scripts/migrate.js && node api/dist/main.js"]
```
Note paths change to `api/dist`, `api/scripts`, `api/migrations` throughout because the build context becomes the repo root (`.`), not `api/`. `USER node` is the built-in Alpine `node` image account (RESEARCH.md Assumption A1) — simpler than creating a custom user; must run **after** the final `npm ci` so file ownership from that install isn't broken by a later `USER` switch reordering (keep `USER node` as the last instruction before `HEALTHCHECK`/`CMD`, exactly as in the pattern above). **Critical:** never add `--include-workspace-root` (RESEARCH.md Pitfall 2) — add an inline comment above the `RUN npm ci --workspace api` lines saying so, so a future edit doesn't reintroduce the 529 MB regression.

**Corresponding `ci.yml` build job change:** `context: .` + explicit `file: api/Dockerfile` (see ci.yml section above) — this Dockerfile rewrite and the `ci.yml` build-job context change must land in the same commit/plan since they're interdependent (root context only works once the Dockerfile expects it).

---

### `.dockerignore` (new, repo root)

**Analog:** no existing `.dockerignore` in repo; use `mobile/.gitignore` / root `.gitignore` exclude-list conventions as the style reference (not read in full here, but standard monorepo excludes apply). RESEARCH.md Wave 0 Gaps explicitly calls out this gap.

**Pattern to write** (exclude everything Docker's new root build context doesn't need — `mobile/` entirely, since the API image build never touches it once `--workspace api` is used, plus standard noise):
```
node_modules
**/node_modules
mobile
.git
**/dist
**/coverage
**/*.test.ts
**/*.e2e-spec.ts
.planning
docs
```
Keep `api/package.json`, `package.json`, `package-lock.json` un-ignored since the Dockerfile explicitly `COPY`s them by name (an ignore rule on `**/*.json` would be wrong — only exclude build artifacts and unrelated workspaces).

---

### `mobile/jest.unit.config.js` (config, transform)

**Analog:** itself (current state, read in full above — 32 lines, note it currently has **two** `moduleNameMapper` keys, the second silently overriding the first since they're both top-level object literal keys in the same `module.exports`; this is itself a latent bug worth fixing as part of this edit since it means the `@expo/vector-icons` line 8 mapper is dead code, shadowed by the second block at line 22-27).

**Current state:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/test/vector-icons.mock.ts',
  },
  collectCoverageFrom: [ /* ... */ ],
  coverageDirectory: '<rootDir>/coverage/unit',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }]
  },
  moduleNameMapper: {   // <-- this second block wins; the first is currently dead
    '^@expo/vector-icons$': '<rootDir>/test/vector-icons.mock.ts',
    '^expo-sqlite$': '<rootDir>/test/expo-sqlite.mock.ts',
    '^expo-haptics$': '<rootDir>/test/expo-haptics.mock.ts',
    '^react-native-svg$': '<rootDir>/test/react-native-svg.mock.ts',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/test/image.mock.ts',
  },
  globals: {
    __DEV__: true,
  },
};
```
**Required edits per CONTEXT.md D-05/D-07:**
1. `testMatch: ['**/*.test.ts']` → `['**/*.test.ts', '**/*.test.tsx']` (D-07 — currently `.test.tsx` is invisible to Jest; confirmed no `.test.tsx` files exist yet, RESEARCH.md Validation Architecture row).
2. Merge the two duplicate `moduleNameMapper` keys into one object (keep the second block's five mappings since it's the one actually in effect; delete the first, now-redundant, block).
3. Add `coverageThreshold` (RESEARCH.md Code Examples — measure fresh at execution time via `npm run test:coverage:mobile`, seed values ratcheted down from measured, not up):
```javascript
coverageThreshold: {
  global: {
    statements: 51,
    branches: 30,
    functions: 41,
    lines: 52,
  },
},
```
The `expo-sqlite` mock delegation (D-05) does **not** require a config change here — it's satisfied by rewriting `mobile/test/expo-sqlite.mock.ts` itself (see next section); the `moduleNameMapper` entry `'^expo-sqlite$': '<rootDir>/test/expo-sqlite.mock.ts'` already exists and stays as-is.

---

### `mobile/test/expo-sqlite.mock.ts` (test double, CRUD)

**Analog:** `mobile/test/node-sqlite-db.ts` (already read in full above) is the helper this file must delegate to, and `mobile/src/storage/local-owner.sqlite.test.ts` is the one existing test file that already imports `createNodeSqliteDb` directly (confirms the integration pattern works).

**Current state (to be replaced):**
```typescript
const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  closeAsync: jest.fn().mockResolvedValue(undefined),
}
export const openDatabaseAsync = jest.fn().mockResolvedValue(mockDb)
export type SQLiteDatabase = typeof mockDb
```
**Target pattern** — delegate to `createNodeSqliteDb()`, matching real `expo-sqlite`'s per-call-site database identity (RESEARCH.md Pattern 4 — "one instance per test file, matching how `openDatabaseAsync` is called once per module load in the real `storage.ts`"):
```typescript
import { createNodeSqliteDb } from "./node-sqlite-db"

export const openDatabaseAsync = jest.fn(async () => createNodeSqliteDb())

export type SQLiteDatabase = ReturnType<typeof createNodeSqliteDb>
```
Note `createNodeSqliteDb()` (from `node-sqlite-db.ts`, already read above) does not implement `closeAsync` under a different name — it does have `closeAsync`, so the interface matches. `withTransactionAsync` also exists in the helper but not in the old mock — confirm `storage.ts`'s real usage doesn't need per-call fresh DBs across `openDatabaseAsync` invocations (check whether `storage.ts` caches its DB promise module-level, matching how the real `expo-sqlite` singleton works, before assuming one call = one fresh DB is correct).

---

### `mobile/src/storage.test.ts` (test, CRUD) — 807 lines, targeted rewrite of assertions only

**Analog:** `mobile/src/storage/local-owner.sqlite.test.ts` (uses `createNodeSqliteDb` already) for the "assert on table state via `SELECT`" pattern this file must adopt instead of `mockDb.runAsync.mock.calls` inspection.

**Current pattern being replaced** (lines 1-31, already read above) — a `getRunAsyncPayload` helper that greps `mockDb.runAsync.mock.calls` for a SQL string fragment and returns the bound params, i.e. assertions are on *what SQL string was sent*, not *what state resulted*. This is exactly the audit's called-out weakness (RESEARCH.md: "a deliberately broken SQL string in `storage.ts` must fail this test — currently would NOT, since it's spy-based").

**Target pattern:** once the mock (above) delegates to `createNodeSqliteDb()`, `mockDb`/`getRunAsyncPayload` no longer apply (there's no shared spy object — each `openDatabaseAsync()` call returns a fresh real in-memory DB per the new mock). Rewrite assertions to call the storage module's own read functions (`getLocalSurveyDraft`, `listLocalSurveys`, etc. — already imported per lines 34-51 above) after a write, and assert on the returned rows, e.g.:
```typescript
// After: await createLocalDraft(TEST_SURVEY_ID, payload)
const stored = await getLocalSurveyDraft(TEST_SURVEY_ID)
expect(stored?.payload).toEqual(payload)
```
This is a large mechanical rewrite (807 lines) — do it function-by-function, keeping the existing `describe`/`it` structure and `makeSurveyRow`-style fixtures (lines 58+), only swapping the assertion bodies. Do not attempt to also touch `useSurveySync.test.ts` here (out of scope per D-06/deferred).

---

### `api/jest.config.js` (config, transform) — add `globalSetup`

**Analog:** itself (current state, 15 lines, read in full above); `api/scripts/migrate.js` for the DB-connection pattern the new `global-setup.js` must reuse; `api/package.json`'s `test:e2e` script (`"npm run migrate && jest --runInBand --config jest.config.js"`) resolves RESEARCH.md's Open Question/Pitfall 4 — **migrations already run before Jest starts** (via the npm script, not via Jest itself), so `globalSetup` is safe to `TRUNCATE` unconditionally without racing schema creation.

**Current state:**
```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/*.e2e-spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 15000,
  setupFiles: ["<rootDir>/test/setup-env.js"],
  moduleNameMapper: { "^jwks-rsa$": "<rootDir>/test/__mocks__/jwks-rsa.js" },
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/**/*.d.ts"],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "text-summary", "json-summary", "lcov"],
}
```
**Edit:** add one line, `globalSetup: "<rootDir>/test/global-setup.js"` (matching the existing `setupFiles` path convention, all-JS per RESEARCH.md's note that this config's sibling files are already `.js` not `.ts`).

---

### `api/test/global-setup.js` (new, utility/DB-reset)

**Analog:** `api/scripts/migrate.js` (already read in full above) for the `pg` `Client` connection pattern (host/port/user/password/database from `process.env`, matching `POSTGRES_*` env vars already set by `ci.yml`'s E2E job and `test/setup-env.js`).

**Connection pattern to copy** (`api/scripts/migrate.js` lines 1-16):
```javascript
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'ibp',
  password: process.env.POSTGRES_PASSWORD || 'ibp',
  database: process.env.POSTGRES_DB || 'ibp'
});
await client.connect();
```
**Target pattern for `global-setup.js`** — since `npm run test:e2e` already runs `npm run migrate` before invoking Jest (confirmed in `api/package.json` line 12: `"test:e2e": "npm run migrate && jest --runInBand --config jest.config.js"`), the schema is guaranteed to exist by the time `globalSetup` runs; this resolves RESEARCH.md Pitfall 4/Assumption A2 definitively — **no need to call `migrate.js` from within `global-setup.js` itself**, just reset data:
```javascript
const { Client } = require("pg")

module.exports = async function globalSetup() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || "ibp",
    password: process.env.POSTGRES_PASSWORD || "ibp",
    database: process.env.POSTGRES_DB || "ibp",
  })
  await client.connect()
  try {
    // Discover application tables (excluding the migration ledger itself) and
    // truncate them, matching Postgres's own primitive for this exact purpose
    // (RESEARCH.md "Don't Hand-Roll" — avoids the Date.now()-uniqueness crutch
    // currently used across the *.e2e-spec.ts files).
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != 'schema_migrations'
    `)
    if (rows.length > 0) {
      const tableList = rows.map((r) => `"${r.tablename}"`).join(", ")
      await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`)
    }
  } finally {
    await client.end()
  }
}
```
Verify the exact table set by reading `api/migrations/*.sql` at execution time — do not hardcode a table list, since new migrations will add tables this file must also reset (the dynamic `pg_tables` query above avoids that maintenance burden entirely, preferred over hardcoding).

---

### `api/jest.unit.config.js` (config, transform) — add `coverageThreshold`

**Analog:** itself (current state, 17 lines, read in full above) — same `module.exports` shape as `mobile/jest.unit.config.js`, so the same `coverageThreshold` field applies structurally.

**Edit:** append (values per RESEARCH.md Code Examples, measured this session — re-measure via `npm run test:coverage:api` at execution time and round down):
```javascript
coverageThreshold: {
  global: {
    statements: 45,
    branches: 24,
    functions: 32,
    lines: 45,
  },
},
```
Per-directory glob keys (criterion 5 wants per-directory, not just global — e.g. `"./src/surveys/**/*.ts": { ... }`) should be added the same way; re-run `npm run test:coverage:api` and read the per-file table in its output to seed exact current values per directory.

---

### `mobile/app.json` (config)

**Analog:** itself, line 36 (`"newArchEnabled": true`).

**Edit:** remove the `newArchEnabled` key entirely (D-02 — it's not a valid Expo config-schema key per `expo-doctor`'s finding; New Architecture in Expo 54/SDK 57 is on by default and not controlled via this flag). Confirm with `npx expo-doctor` after removal that this specific finding clears, and with `npx expo export --platform android` that the bundle still produces cleanly (RESEARCH.md: this command already succeeds today, confirm it still does post-edit).

---

### `mobile/metro.config.js` (config)

**Analog:** itself (current state, read in full above, already has an inline comment justifying the override at lines 6-7).

**Current pattern:**
```javascript
const config = getDefaultConfig(__dirname);
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules')
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native')
};
```
**Decision required per D-02:** investigate whether `disableHierarchicalLookup: true` is still needed given `extraNodeModules` already pins `react`/`react-native` explicitly (which may make the `disableHierarchicalLookup` override redundant, since `extraNodeModules` alone can resolve the version-pinning concern the comment describes). If `npx expo export --platform android` still succeeds with `disableHierarchicalLookup` removed (or set to `false`, matching Expo's default), remove it to clear the `expo-doctor` finding; if removing it breaks the export or introduces a wrong React copy being bundled (test by checking bundle output / `npm ls react` resolution), keep it and document why `expo-doctor`'s specific check is being knowingly overridden (no per-check suppression flag exists in `expo-doctor` itself, per RESEARCH.md Pitfall 1 — the only lever is fixing the underlying config or accepting the finding, there's no silencing mechanism).

---

### `package.json` (root, config)

**Analog:** itself (current state, read in full above).

**Edit:** add `"engines": { "node": ">=22.5.0" }` per RESEARCH.md Pattern 4 (floors Node version for `node:sqlite`/`DatabaseSync` support; no `engines` field exists anywhere in the repo today). Scripts (`typecheck`, `test:unit`, `test:coverage:api`, `test:coverage:mobile`, etc.) are consumed as-is by the new CI jobs — no script renames needed, `ci.yml`'s new `unit`/`e2e`/`check`/`audit`/`mobile-build` jobs should call the *existing* npm scripts (`npm run typecheck`, `npm --workspace api run test:unit`, etc.) rather than inlining raw `jest`/`tsc` invocations, matching the current `ci.yml`'s existing convention of delegating to `npm run <script> --workspace <name>` / `working-directory:`.

---

## Shared Patterns

### GitHub Actions: SHA-pinned `uses:`, `timeout-minutes:`, per-job `permissions:`
**Source:** RESEARCH.md Standard Stack table (all 8 SHAs verified live this session) + current `ci.yml`'s `build` job (only job with an explicit `permissions:` block today, lines 141-143).
**Apply to:** every job in the rewritten `ci.yml` and the new `codeql.yml` — none of the current non-`build` jobs have `permissions:` or `timeout-minutes:` today; this is a repo-wide gap being closed, not a one-off.
```yaml
permissions:
  contents: read
  packages: write   # only on the `build` job
```

### npm workspace command delegation
**Source:** root `package.json` scripts (`"migrate:api": "npm --workspace api run migrate"`, `"test:unit": "npm --workspace api run test:unit && npm --workspace mobile run test:unit"`).
**Apply to:** all new CI job steps — always call through a root `package.json` script or `npm --workspace <name> run <script>` / `working-directory:`, never invoke `jest`/`tsc`/`eslint` binaries directly in a workflow step, matching every existing job in `ci.yml`.

### Real-SQL test double keyed off `moduleNameMapper`
**Source:** `mobile/jest.unit.config.js`'s existing `'^expo-sqlite$': '<rootDir>/test/expo-sqlite.mock.ts'` mapping + `mobile/test/node-sqlite-db.ts`.
**Apply to:** `mobile/test/expo-sqlite.mock.ts` rewrite — the config-level wiring already exists and needs no change; only the mock module's internals change.

### Postgres connection via `pg.Client` reading `POSTGRES_*` env vars
**Source:** `api/scripts/migrate.js` lines 6-13.
**Apply to:** `api/test/global-setup.js` — reuse the exact same env var names and defaults so it works identically in CI (env already set by `ci.yml`'s E2E job block) and locally (falls back to `localhost`/`ibp`/`ibp`/`ibp`, matching `infra/docker-compose.yml` local dev credentials).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/codeql.yml` | config | event-driven | First CodeQL workflow in the repo; styled after `ci.yml`'s conventions instead (see Pattern Assignments above) |
| `.dockerignore` | config | file-I/O | No `.dockerignore` exists anywhere in repo today (Docker build context was `./api` until this phase, small enough not to need one) |
| `api/test/global-setup.js` | utility | event-driven/DB-reset | No Jest `globalSetup` file exists in either `api/jest.config.js` or `api/jest.unit.config.js` today; closest available building block is `migrate.js`'s connection pattern, reused above |

## Metadata

**Analog search scope:** `.github/`, `api/` (Dockerfile, jest configs, scripts, test/), `mobile/` (jest config, test/, src/storage*, src/hooks/*.test.ts), `infra/vps/`, `infra/docker-compose.vps.yml`, root `package.json`
**Files read directly:** `.github/workflows/ci.yml`, `.github/dependabot.yml`, `api/Dockerfile`, `api/jest.config.js`, `api/jest.unit.config.js`, `api/scripts/migrate.js`, `api/package.json`, `api/test/setup-env.js`, `api/test/auth-profile.e2e-spec.ts`, `mobile/jest.unit.config.js`, `mobile/test/expo-sqlite.mock.ts`, `mobile/test/node-sqlite-db.ts`, `mobile/src/storage.test.ts`, `mobile/src/hooks/useAuth0Session.test.ts`, `mobile/app.json`, `mobile/metro.config.js`, root `package.json`, `infra/vps/update-stack.sh`, `infra/vps/README.md`, `infra/docker-compose.vps.yml` (grep only)
**Pattern extraction date:** 2026-09-24
