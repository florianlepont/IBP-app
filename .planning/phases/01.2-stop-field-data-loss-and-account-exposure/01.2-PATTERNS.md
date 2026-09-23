# Phase 01.2: Stop field data loss and account exposure - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 15 (modified) + 1 new migration
**Analogs found:** 15 / 15 (all are modifications of existing files, so the analog is nearly always the file's own current version — patterns below show the surrounding conventions to preserve)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `mobile/src/hooks/useAuth0Session.ts` | hook | event-driven (session lifecycle) | itself (existing file, in-place rewrite of 2 code paths) | exact |
| `mobile/src/hooks/useSurveySync.ts` | hook | event-driven (orchestrator) | itself | exact |
| `mobile/src/storage/sync.ts` | utility/storage | CRUD (SQLite) | itself (`getMetaValue`/`setMetaValue` already defined here, reuse as-is) | exact |
| `mobile/src/storage/surveys.ts` | utility/storage | CRUD (SQLite) | `mobile/src/storage/sync.ts` (sibling storage module, same DB/promise style) | role-match |
| `mobile/src/hooks/useAuth0Session.test.ts` | test | unit (renderHook) | `mobile/src/hooks/useGpsCapture.test.ts` (best existing hook test — mocks external SDK via `jest.mock` factory, exercises every branch) | role-match |
| `mobile/src/hooks/useSurveySync.test.ts` | test | unit (existing, spy-based) | itself (extend; do not need a full `renderHook` rewrite, just add cases) | exact |
| `mobile/src/hooks/useNearbyParcels.ts` | hook | request-response | `mobile/src/app/map-viewport.ts` (`computeRegionBbox` — the correct bbox builder to reuse) | role-match (fix, not new pattern) |
| `mobile/src/hooks/useNearbyParcels.test.ts` | test | unit | `mobile/src/hooks/useGpsCapture.test.ts` (hook test with mocked `expo-location`) | role-match |
| `mobile/src/screens/SettingsScreen.tsx` | component/screen | request-response (renders dev tools) | `mobile/src/screens/AuthGateScreen.tsx` (existing `__DEV__` gating pattern, lines 372 & 499) | role-match |
| `mobile/src/app/dev-tools.ts` (new helper, per D-11) | utility | transform (pure predicate) | `mobile/src/app/map-viewport.ts` (small pure-function module co-located under `mobile/src/app/`) | role-match |
| `mobile/src/app/dev-tools.test.ts` (new) | test | unit | `mobile/src/hooks/operation-status.test.ts` (small pure-function test file, no mocking needed) | role-match |
| `api/src/main.ts` | config/bootstrap | request-response | itself | exact |
| `api/src/app.module.ts` | config (module wiring) | request-response | itself | exact |
| `api/src/auth/auth.guard.ts` | middleware/guard | request-response | itself (`getOrProvisionUser`, add `ClientAwareThrottlerGuard` alongside or in a new file `api/src/auth/throttler.guard.ts`) | exact |
| `api/src/auth/throttler.guard.ts` (new) | middleware/guard | request-response | `api/src/auth/auth.guard.ts` (same directory, same `CanActivate`-adjacent guard convention; also see `api/src/auth/admin.guard.ts`) | role-match |
| `api/src/debug/debug.module.ts` | config (conditional module) | request-response | `api/src/app.module.ts` (conditional import pattern goes in the parent module, not here) | role-match |
| `api/src/reports/reports.service.ts` | service | CRUD | itself | exact |
| `api/migrations/013_scrub_report_events.sql` (new) | migration | batch | `api/migrations/012_account_deletion_anonymization.sql` (simplest recent migration — single `ALTER`/`UPDATE` statement, no down-migration file, numbered sequentially) | exact |
| `api/test/rate-limit.e2e-spec.ts` (new) | test | request-response (E2E) | `api/test/auth-profile.e2e-spec.ts` (existing E2E using `/v1/debug/test-token` to get a bearer token, Supertest against the Nest app) | role-match |
| `api/test/auth.guard.spec.ts` | test | unit | itself (extend — `buildGuard`/`makeContext`/`makeToken` helpers already exist) | exact |
| `api/test/epic-e-search-reports.e2e-spec.ts` or `validation-reports.e2e-spec.ts` | test | request-response (E2E) | itself (extend for reporter-identity redaction assertion) | exact |

## Pattern Assignments

### `mobile/src/hooks/useAuth0Session.ts` (hook, event-driven)

**Analog:** itself — two call sites need the same error-classification helper.

**Current bug — bare catch swallows type** (lines 84-95):
```typescript
const getValidAccessToken = useCallback(async (): Promise<string | null> => {
  try {
    const credentials = await getAuth0().credentialsManager.getCredentials()
    if (credentials?.accessToken) {
      setAccessToken(credentials.accessToken)
      return credentials.accessToken
    }
    return null
  } catch {
    return null
  }
}, [getAuth0])
```

**Second call site with the same bug — session restore effect** (lines 139-194, catch block at 182-187):
```typescript
} catch (error) {
  if (!active) return
  await clearSession().catch(() => undefined)
  reportStatus("session", "error", `Session restore error: ${(error as Error).message}`)
  setSessionRestoring(false)
}
```
Both call sites must apply the SAME classification (per RESEARCH.md Pitfall 1) — do not fix only one.

**Import pattern to add** (top of file, alongside existing imports at lines 1-13):
```typescript
import { useCallback, useEffect, useRef, useState } from "react"
import Auth0, { CredentialsManagerError, CredentialsManagerErrorCodes } from "react-native-auth0"
```

**Classification helper to introduce** (new, place near `isUnauthorizedError` at line 16):
```typescript
const SESSION_ENDING_CODES = new Set<string>([
  CredentialsManagerErrorCodes.NO_CREDENTIALS,
  CredentialsManagerErrorCodes.NO_REFRESH_TOKEN,
  CredentialsManagerErrorCodes.INVALID_CREDENTIALS,
  CredentialsManagerErrorCodes.RENEW_FAILED,
])

function isSessionEndingError(error: unknown): boolean {
  return error instanceof CredentialsManagerError && SESSION_ENDING_CODES.has(error.type)
}
```

**Existing return-shape convention** (lines 328-351) — new/changed hook outputs must follow the same flat object-return style; dead stubs to remove per D-01/RESEARCH (`pendingEmailVerification`, `devVerificationToken`, `handleCancelEmailVerification`, `handleVerifyEmail`, `handleResendVerification`, `refreshToken: ""`) live here.

**Force-refresh on 401** (current, line 108, to change per D-01/RESEARCH "Forcing a token refresh"):
```typescript
// current — does NOT force a refresh:
const refreshed = await getValidAccessToken()
// target — pass forceRefresh=true on the 4th positional arg:
const credentials = await getAuth0().credentialsManager.getCredentials(undefined, undefined, undefined, true)
```

---

### `mobile/src/hooks/useSurveySync.ts` (hook, event-driven orchestrator)

**Analog:** itself.

**Current purge-on-session-clear bug** (lines 50-55, `clearSurveySessionState`):
```typescript
const clearSurveySessionState = useCallback(async (): Promise<void> => {
  setSurveyDetails({})
  setSurveyEvents({})
  detailAutoLoadCooldownUntilRef.current = {}
  await clearLocalIbpData()   // <-- D-02: remove this line; session end must never purge local data
}, [])
```
This is wired in as `onSessionCleared` at line 118 (`useAuth0Session({ ..., onSessionCleared: clearSurveySessionState })`) — after the fix it should ONLY reset React state, never touch storage.

**Existing explicit-purge convention to copy for the new logout-confirmation flow** — model the new `handleLogout` confirm-then-purge dialog on the existing `handleDeleteAccount`/`runDebugReset` "Alert.alert with Cancel + destructive action" pattern already used in this same file (lines 159-174 and 190-228):
```typescript
const handleDeleteAccount = useCallback(async (): Promise<void> => {
  Alert.alert(
    "Delete account",
    "This action is immediate and irreversible. ...",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete my account",
        style: "destructive",
        onPress: () => {
          void performDeleteAccount()
        },
      },
    ],
  )
}, [performDeleteAccount])
```
Reuse `runDebugReset`'s shape (title/message/inProgressMessage/onReset callback) as the template for a new `confirmLogoutWithPendingWork({ pendingSurveys, pendingAttachments, onConfirm })` helper — same `Alert.alert` + destructive-style button structure, same `setStatus` progress reporting via `reportStatus`.

**Storage helpers already available for the pending-work count (D-03)** — `hasPendingSyncWork` already exists in `mobile/src/storage/sync.ts` per RESEARCH.md; import it the same way `clearLocalIbpData` is imported today (line 11):
```typescript
import { clearLocalIbpData } from "../storage/surveys"
```

---

### `mobile/src/storage/sync.ts` / `mobile/src/storage/surveys.ts` (storage, CRUD)

**Analog:** itself — `getMetaValue`/`setMetaValue` already implemented (lines 388-408), reuse verbatim for `local_meta` owner-sub tracking (D-04):
```typescript
async function getMetaValue(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM local_meta WHERE key = ?`,
    [key],
  )
  return row?.value ?? null
}

async function setMetaValue(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO local_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, value, now],
  )
}
```
Use key name `session_owner_sub` (Claude's discretion per CONTEXT.md). These two functions are currently module-private (not exported) — export them (or add a small wrapper) so `useAuth0Session`/`useSurveySync` can call them on login-success to compare the new JWT `sub` against the stored owner.

**`local_meta` table schema** (`mobile/src/storage/db.ts` lines 91-95) — already exists, no migration needed:
```sql
CREATE TABLE IF NOT EXISTS local_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Schema-upgrade convention** (`db.ts` lines 98-121) — if any new column is ever needed, follow the existing `addColumnIfMissing` idempotent pattern; this phase should not need it since `local_meta` is generic key/value.

---

### `mobile/src/hooks/useAuth0Session.test.ts` / `useNearbyParcels.test.ts` (test, unit/renderHook)

**Analog:** `mobile/src/hooks/useGpsCapture.test.ts` (full file read — see below), the strongest existing example of "mock external SDK via `jest.mock` factory + exercise every branch."

**Mock-hoisting pattern** (lines 8-23):
```typescript
// Variables starting with "mock" can be referenced inside jest.mock factories
// despite hoisting — this is a Jest-specific allowance.
const mockGetCredentials = jest.fn()
const mockHasValidCredentials = jest.fn()

jest.mock("react-native-auth0", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    credentialsManager: {
      getCredentials: mockGetCredentials,
      hasValidCredentials: mockHasValidCredentials,
    },
  })),
  CredentialsManagerError: class CredentialsManagerError extends Error {
    type: string
    constructor(type: string) {
      super(type)
      this.type = type
    }
  },
  CredentialsManagerErrorCodes: {
    NO_NETWORK: "NO_NETWORK",
    RENEW_FAILED: "RENEW_FAILED",
    NO_REFRESH_TOKEN: "NO_REFRESH_TOKEN",
    NO_CREDENTIALS: "NO_CREDENTIALS",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  },
}))
```

**Table-style branch coverage convention** (lines 37-165) — one `test(...)` per branch, `beforeEach` resets mocks and rebuilds the hook; apply the same structure for each `CredentialsManagerError.type` value (`NO_NETWORK` → session survives; `RENEW_FAILED` → session ends, `clearLocalIbpData` NOT called).

---

### `mobile/src/hooks/useNearbyParcels.ts` (hook, request-response)

**Analog:** `mobile/src/app/map-viewport.ts` — reuse `computeRegionBbox`, do not hand-roll a second bbox builder.

**Current bug** (line 73):
```typescript
const bbox = `${lng - RADIUS_DEG},${lng + RADIUS_DEG},${lat - RADIUS_DEG},${lat + RADIUS_DEG}`
```

**Correct helper already available** (`map-viewport.ts` lines 28-36):
```typescript
export function computeRegionBbox(region: Region): string {
  const halfLat = region.latitudeDelta / 2
  const halfLng = region.longitudeDelta / 2
  const minLat = Math.max(-90, region.latitude - halfLat)
  const maxLat = Math.min(90, region.latitude + halfLat)
  const minLng = Math.max(-180, region.longitude - halfLng)
  const maxLng = Math.min(180, region.longitude + halfLng)
  return `${minLng.toFixed(6)},${minLat.toFixed(6)},${maxLng.toFixed(6)},${maxLat.toFixed(6)}`
}
```
`useNearbyParcels.ts` does not have a `Region` object (it has a raw lat/lng + fixed radius), so either construct a synthetic `Region` (`{ latitude: lat, longitude: lng, latitudeDelta: RADIUS_DEG * 2, longitudeDelta: RADIUS_DEG * 2 }`) and call `computeRegionBbox`, or extract the minLng/minLat/maxLng/maxLat ordering logic into a small shared helper in `map-viewport.ts` that both call sites use directly on raw numbers. D-12 explicitly says "sharing the helper in `mobile/src/app/map-viewport.ts`" — prefer adding a second exported function there (e.g. `buildBboxFromCenter(lat, lng, radiusDeg)`) rather than constructing a fake `Region`.

---

### `mobile/src/screens/SettingsScreen.tsx` (screen, request-response)

**Analog:** `mobile/src/screens/AuthGateScreen.tsx` — established `__DEV__` gating pattern.

**Existing pattern to copy** (`AuthGateScreen.tsx` lines 372, 499):
```typescript
onLogoPress={__DEV__ ? () => setShowDevModal(true) : undefined}
...
{__DEV__ ? (
  // dev-only JSX
) : null}
```

**Current unconditional dev-tools section** (`SettingsScreen.tsx` lines 218-239):
```tsx
{/* Zone 3 — Outils développeur (repliée par défaut) */}
<AppCollapsibleSection title="Outils développeur" badge="DEV">
  <AppField label="URL de l'API" value={apiUrl} onChangeText={onApiUrlChange} ... />
  <AppButton label="Vider la base IBP" ... onPress={confirmDebugResetIbpData} />
  <AppButton label="Vider la base utilisateur" ... onPress={confirmDebugResetUserData} />
</AppCollapsibleSection>
```
Per D-11, wrap this whole block in a small extracted, unit-testable predicate rather than inlining `__DEV__` directly, so a `.test.ts` (not `.test.tsx`, which is not collected until Phase 1.3 per D-11) can cover the logic:
```typescript
// mobile/src/app/dev-tools.ts
export function shouldShowDevTools(isDev: boolean = __DEV__): boolean {
  return isDev
}
```
```tsx
{shouldShowDevTools() ? (
  <AppCollapsibleSection title="Outils développeur" badge="DEV">
    ...
  </AppCollapsibleSection>
) : null}
```

**Test analog for the new helper** — `mobile/src/hooks/operation-status.test.ts` (small pure-function test, no mocking) is the template: plain `describe`/`test`, direct function calls, no `jest.mock`.

---

### `api/src/main.ts` (bootstrap, request-response)

**Analog:** itself.

**Current** (lines 8-9):
```typescript
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
```

**Target** (per D-05/RESEARCH "Enabling trust proxy"):
```typescript
import { NestExpressApplication } from "@nestjs/platform-express"

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.set("trust proxy", "loopback")
```
Everything below (helmet, CORS, ValidationPipe, `setGlobalPrefix`, `listen`) stays exactly as-is — this is an additive, two-line change at the top of `bootstrap()`.

---

### `api/src/app.module.ts` / `api/src/auth/throttler.guard.ts` (guard, request-response)

**Analog:** itself for `app.module.ts`; `api/src/auth/auth.guard.ts` for the new guard's file placement and class shape.

**Current throttler config** (lines 14-19):
```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60_000,
    limit: process.env.NODE_ENV === "production" ? 10 : 10_000,
  },
]),
```
Target per D-06: raise the production `limit` (Claude's discretion, RESEARCH.md suggests 100-300/min range sized so a full offline day's sync batch fits), and register the custom tracker guard:
```typescript
providers: [{ provide: APP_GUARD, useClass: ClientAwareThrottlerGuard }],
```
(replacing the current `useClass: ThrottlerGuard` at line 28) — import `ClientAwareThrottlerGuard` from the new `api/src/auth/throttler.guard.ts`.

**New guard file — model on `auth.guard.ts`'s `@Injectable() class ... implements CanActivate` shape** (same directory `api/src/auth/`, same import conventions: `Injectable` from `@nestjs/common`, `Request` from `express`):
```typescript
import { createHash } from "crypto"
import { Injectable } from "@nestjs/common"
import { ThrottlerGuard } from "@nestjs/throttler"

@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader = req.headers?.authorization
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      return `token:${createHash("sha256").update(authHeader).digest("hex")}`
    }
    return `ip:${req.ip}`
  }
}
```

**Conditional `DebugModule` import (D-07)** — target in `app.module.ts` imports array (currently unconditional at line 25):
```typescript
imports: [
  ThrottlerModule.forRoot([...]),
  DatabaseModule,
  AuthModule,
  UsersModule,
  SurveysModule,
  ReportsModule,
  ...(process.env.NODE_ENV !== "production" ? [DebugModule] : []),
],
```
`DebugModule` itself (`debug.module.ts`) needs no changes — the conditional lives at the import-site in `app.module.ts`, matching how every other feature module is already listed flatly in the `imports` array.

---

### `api/src/auth/auth.guard.ts` (guard, request-response)

**Analog:** itself.

**Current race-prone provisioning** (lines 117-160, `getOrProvisionUser`) — SELECT-then-conditional-INSERT with a separate byEmail branch. Target per D-08/D-09:
```typescript
// gate email-based linking on email_verified (D-08):
const byEmail = await this.db.query<AuthenticatedUser>(
  `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url
   FROM users WHERE email = $1`,
  [email],
)

if (byEmail.rows.length > 0 && userInfo.email_verified === true) {
  await this.db.query(`UPDATE users SET auth0_sub = $1 WHERE email = $2`, [auth0Sub, email])
  return byEmail.rows[0]
}

// race-free insert (D-09), using auth0_sub UNIQUE constraint from migration 011:
const inserted = await this.db.query<AuthenticatedUser>(
  `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
   VALUES (gen_random_uuid(), $1, $2, $3, '', '', 'contributor')
   ON CONFLICT (auth0_sub) DO UPDATE SET auth0_sub = EXCLUDED.auth0_sub
   RETURNING id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url`,
  [auth0Sub, email, displayName],
)
```
`fetchUserInfo`'s return type (line 162-170) needs `email_verified?: boolean` added to the inline type literal:
```typescript
private async fetchUserInfo(
  token: string,
): Promise<{ email?: string; name?: string; nickname?: string; email_verified?: boolean }> {
```

**Existing `verifyTestToken`/HS256 branch (lines 42-46, 57-70)** — do NOT remove or alter the inner `process.env.NODE_ENV === "test"` gate; it stays as defense-in-depth alongside the new `DebugModule` conditional import.

---

### `api/src/reports/reports.service.ts` (service, CRUD)

**Analog:** itself.

**Current event write exposing reporter identity** (lines 56-60, D-10 target):
```typescript
// current:
await this.db.query(
  `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
   VALUES ($1, $2, $3, 'reported', $4::jsonb)`,
  [randomUUID(), surveyId, user.id, JSON.stringify({ report_id: reportId, reason })],
)

// target — no actor_id, no reason in payload:
await this.db.query(
  `INSERT INTO survey_events (id, survey_id, event_type, payload)
   VALUES ($1, $2, 'reported', $3::jsonb)`,
  [randomUUID(), surveyId, JSON.stringify({ report_id: reportId })],
)
```
Confirm `survey_events.actor_id` is nullable or the column list must drop it entirely (check the `survey_events` migration before deciding whether to pass `NULL` explicitly or omit the column from the INSERT's column list, as shown above — omitting is preferred since it matches the "never write it" requirement literally).

**`reports` table already retains `reporter_user_id`/`reason`** (lines 49-54, unchanged) — this is the correct place for that data per D-10; no change needed to the `INSERT INTO reports` statement.

**New migration analog** — `api/migrations/012_account_deletion_anonymization.sql` (single-statement, no rollback file):
```sql
ALTER TABLE surveys
  ALTER COLUMN user_id DROP NOT NULL;
```
Target `api/migrations/013_scrub_report_events.sql` (same minimal single-statement style):
```sql
UPDATE survey_events
SET payload = payload - 'actor_id' - 'reason'
WHERE event_type = 'reported';
```
(Adjust JSONB removal syntax to whatever `reason`/`actor_id` actually look like in the stored payload — confirm during implementation whether `actor_id` was ever stored in `payload` vs. only the column; RESEARCH.md says "scrubs existing rows," matching this simple `UPDATE`.)

**Optional `@MaxLength` on reason** (discretionary per CONTEXT.md/RESEARCH.md) — check `api/src/reports/reports.types.ts` / any DTO class for the `class-validator` decorator convention already used elsewhere (see `api/src/users/dto/*.ts` for `@MaxLength`/`@IsString` examples) if implementing this optional item.

---

## Shared Patterns

### Session-error classification (mobile)
**Source:** `mobile/src/hooks/useAuth0Session.ts` (both `getValidAccessToken` and the restore-session effect must share one classification function)
**Apply to:** `useAuth0Session.ts` only, but the resulting `isSessionEndingError`/`AUTH_REQUIRED` vs `AUTH_TEMPORARILY_UNAVAILABLE` distinction must be threaded through to `useSurveySync.ts`'s error handling (already has an `AUTH_REQUIRED_ERROR` constant exported at line 15, reuse it — do not invent a second constant).

### Explicit-confirm-then-purge dialog (mobile)
**Source:** `mobile/src/hooks/useSurveySync.ts` lines 159-174 (`handleDeleteAccount`) and 190-228 (`runDebugReset`)
**Apply to:** the new logout-confirmation flow (D-03) and the new different-account conflict flow (D-04) — both should reuse the same `Alert.alert(title, message, [{Cancel}, {destructive action}])` shape already established in this file, per RESEARCH.md's Open Question 2 recommendation to use one UX pattern for both.

### `local_meta` key/value storage (mobile)
**Source:** `mobile/src/storage/sync.ts` lines 388-408 (`getMetaValue`/`setMetaValue`), table defined in `mobile/src/storage/db.ts` lines 91-95
**Apply to:** `session_owner_sub` (D-04) and the already-used `downsync_cursor` key (existing usage at `sync.ts` line 947/976) — same table, same helpers, no schema change.

### `AuthGuard`-adjacent guard file placement (API)
**Source:** `api/src/auth/auth.guard.ts`, `api/src/auth/admin.guard.ts` (sibling guard)
**Apply to:** new `api/src/auth/throttler.guard.ts` — same directory, same `@Injectable()` + NestJS guard-class convention, same import style (`Injectable` from `@nestjs/common`).

### Conditional module import gated on `NODE_ENV` (API)
**Source:** `api/src/app.module.ts` imports array; `api/src/debug/debug.controller.ts` line 17 (`if (process.env.NODE_ENV !== "test") throw new ForbiddenException()`) as the existing "gate on NODE_ENV" idiom already used in this codebase
**Apply to:** conditional `DebugModule` import (D-07) — same env var, same strict `!== "production"` check, no new env var introduced (per RESEARCH.md Pitfall 3, CI already sets `NODE_ENV=test`).

### Sequential single-statement migrations (API)
**Source:** `api/migrations/012_account_deletion_anonymization.sql`
**Apply to:** new `api/migrations/013_scrub_report_events.sql` — same numbering convention (`api/migrations/`, zero-padded 3-digit prefix), no down-migration file exists in this repo's convention, so none is needed here either.

### Hook unit test with `jest.mock` factory + hoisting comment (mobile)
**Source:** `mobile/src/hooks/useGpsCapture.test.ts` (full file, lines 1-165)
**Apply to:** `useAuth0Session.test.ts` (mock `react-native-auth0`'s default export + `CredentialsManagerError`/`CredentialsManagerErrorCodes`) and `useNearbyParcels.test.ts` (mock `expo-location` exactly as `useGpsCapture.test.ts` already does, since `useNearbyParcels.ts` imports the same module).

## No Analog Found

None — every file in this phase is either an existing file being modified in place, or a small new file with a clear structural analog already identified above (new guard next to `auth.guard.ts`, new migration next to `012_...sql`, new test next to `useGpsCapture.test.ts`/`operation-status.test.ts`).

## Metadata

**Analog search scope:** `mobile/src/hooks/`, `mobile/src/storage/`, `mobile/src/screens/`, `mobile/src/app/`, `api/src/auth/`, `api/src/app.module.ts`, `api/src/main.ts`, `api/src/debug/`, `api/src/reports/`, `api/migrations/`, `api/test/`
**Files scanned:** 20 read directly (see Pattern Assignments), plus directory listings of `api/migrations/` and `mobile/src/hooks/*.test.ts`
**Pattern extraction date:** 2026-09-23
