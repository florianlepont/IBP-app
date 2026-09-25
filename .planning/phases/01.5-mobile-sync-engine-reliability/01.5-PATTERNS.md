# Phase 01.5: Mobile sync engine reliability - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 27 new or modified files (mobile: 22, api: 3, config/mocks: 2 groups)
**Analogs found:** 25 / 27. No analog: the module-level single flight, and the `PRAGMA user_version` runner.

All line numbers were read from the working tree on 2026-09-25. The research's line numbers for `sync.ts` are correct. Its hook line numbers are not (see "Conflicts" below).

---

## Conflicts between RESEARCH.md and the actual code (read first)

| # | Research says | Code / CONTEXT says | Consequence for the planner |
|---|---------------|--------------------|-----------------------------|
| C1 | Pattern 3 and the test map say "8 consecutive network/5xx failures flip the row to `sync_blocked`" | **D-05 (locked):** network errors, timeouts, 5xx and 429 **never consume the cap**. Only counted failures do. | Do not write the research's "8 × 5xx → blocked" test. Write "20 × network/5xx/429/timeout → still `failed`, `retry_count` unchanged, backoff applied" and "8 × counted (`unknown`) failure → `sync_blocked`". Also note that the server maps per-op 5xx/429/unknown DB errors to `retryable_error` (`api/src/surveys/sync-error.utils.ts:43`), so a per-op `retryable_error` result must also not count. The plan must say which failures count: `unknown` ones, e.g. an unclassified `UPLOAD_HTTP 4xx`, or a `synced` result with no usable target. |
| C2 | Pitfall 3 / Open Q2 recommend treating over-retried rows as already capped | **D-06 (locked):** the migration resets `retry_count` to 0 | Migration: `UPDATE sync_queue SET retry_count = 0, next_retry_at = NULL`. |
| C3 | Test commands `npx jest sync.test.ts`, `db.test.ts`, `surveys.test.ts` | None of these files exist. Storage tests live in **`mobile/src/storage.test.ts`** (842 lines, imports the `./storage` barrel) and `mobile/src/storage/local-owner.sqlite.test.ts`. | Either extend `src/storage.test.ts` or create co-located `src/storage/sync.sqlite.test.ts` / `db.sqlite.test.ts` using the `local-owner.sqlite.test.ts` recipe. The `./src/storage/` coverage threshold counts both. |
| C4 | `handleDeleteAttachment` at `useSurveySyncSurveyOperations.ts:390` | It is at **`:427`**. The sync call is at `:451` via `runOwnerGuardedSync` (`:71-78`). | The bypass is `runOwnerGuardedSync`. It calls `syncPending` without checking `useSurveySyncNetwork`'s `syncInProgressRef` (`useSurveySyncNetwork.ts:69,93`). |
| C5 | `updateSurveyVisibility` (`sync.ts:1106`) bypasses the lock | This is true inside `sync.ts`. But the only production caller (`useSurveySyncSurveyOperations.ts:258`) passes `""` as the token, so that branch never runs from the UI. The actual drain happens through `runOwnerGuardedSync()` at `:272`. | Route `sync.ts:1106` through the single flight anyway (D-03), but the fix that matters at runtime is in `runOwnerGuardedSync`. |
| C6 | Only 2 raw `fetch` calls in `sync.ts` (`:783`, `:954`) | There are **6**: `:97` (confirm PUT), `:147` (API upload), `:160`+`:166` (direct upload), `:783` (batch), `:954` (changes), `:1000` (`submitSurvey`) | D-07 says "every sync request". Batch/changes/submit/confirm → `apiRequest`. Uploads → `FileSystem.uploadAsync`, which has **no timeout option**. The plan needs an explicit decision there, e.g. a `Promise.race` guard, or accepting the OS timeout. |
| C7 | `uploadFileDirect` replacement uses `uploadType: BINARY_CONTENT` | There are two upload targets. The **API route** (local storage mode) is `multipart/form-data`, field `file` (`api/src/surveys/surveys.controller.ts:104-121`, `FileInterceptor("file")`). The **presigned** target is a raw PUT. | `uploadFileViaApi` → `uploadAsync(url, uri, { httpMethod: "PUT", uploadType: MULTIPART, fieldName: "file", mimeType, headers: { Authorization } })`. `uploadFileDirect` → `BINARY_CONTENT` + `Content-Type`. Both enums exist in `expo-file-system/build/legacy/FileSystem.types.d.ts:18-27,113`. |
| C8 | Resize example `context.resize({ width: 2048 })` = "long edge" | `resize({ width?, height? })` scales on the given axis. With `width: 2048`, a portrait photo keeps a long edge above 2048, and a small image gets upscaled. | Compute the target from the asset's `width`/`height` (ImagePicker gives both; `useSurveySyncSurveyOperations.ts:99-100`). Resize only if `max(w,h) > 2048`, and only on the longer axis. The SDK 57 API was verified in `node_modules/expo-image-manipulator/build/ImageManipulatorContext.d.ts:14,49` and `ImageRef.d.ts:19`: `ImageManipulator.manipulate(uri).resize({...}).renderAsync()` then `.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })`. `manipulateAsync` still exists but is deprecated (`ImageManipulator.d.ts:16-18`). |
| C9 | Pattern 4 puts "indexes + WAL" inside `withTransactionAsync` | SQLite **refuses `PRAGMA journal_mode=WAL` inside a transaction**, and `:memory:` (the test double) always reports `memory` | Run `PRAGMA journal_mode = WAL` outside the migration transaction, once in `initLocalDb`. Don't assert it in node tests. |
| C10 | "Local mode: download URL can be the same API route the local file is already served from" | **There is no route serving attachment files.** The only file-serving analog is `GET /me/profile-picture` (`api/src/users/users.controller.ts:71-80`, `StreamableFile`). | In local mode, D-01 needs a second, authenticated streaming route, or a tokenised URL. See the API section. |
| C11 | Research lists the SDK as `~57.0.24` and CLAUDE.md says Expo 54 / RN 0.81.5 | `mobile/package.json`: `expo ~57.0.24`, `react-native 0.86.3`. CLAUDE.md is outdated. | Use SDK 57. |
| C12 | "Packages not installed" | `expo-crypto 57.0.3`, `expo-image 57.0.5`, `expo-image-manipulator 57.0.20` **are present in root `node_modules/`** (left over from the researcher's `slopcheck install`) but absent from `package.json` / `package-lock.json`. `expo-file-system 57.0.7` is a legitimate transitive dependency of `expo`. | The install task must still run `npx expo install ...` in `mobile/` so the lockfile records them. Don't treat a green local `tsc` as proof that the install happened. |
| C13 | CLAUDE.md says mocks live in `mobile/src/__mocks__/` and the key/value table is `app_metadata` | Mocks live in **`mobile/test/*.mock.ts`** (wired by `moduleNameMapper`). The table is **`local_meta`** (`db.ts:91-95`). | New mocks go in `mobile/test/`. Cached profile goes in `local_meta`. |
| C14 | Pattern 4's runner wraps each migration in `db.withTransactionAsync` | The test double's `withTransactionAsync` (`test/node-sqlite-db.ts:27-36`) issues a literal `BEGIN`, so **nested transactions throw**. expo-sqlite's `withTransactionAsync` is **not exclusive**: other async queries on the connection can run inside it. | Don't call a transaction-wrapped helper from inside another transaction. If the plan uses `withExclusiveTransactionAsync`, the double needs that method added (it has no `txn` parameter today). |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `mobile/src/storage/db.ts` | config / migration | batch (schema) | itself `:39-131` + `local-owner.ts` meta upsert | partial (no versioned runner exists) |
| `mobile/src/storage/sync.ts` | service | request-response + batch | itself; `api/client.ts` for the HTTP calls | exact (refactor in place) |
| `mobile/src/storage/surveys.ts` | service | CRUD | itself `:25-146`, `:289-390` | exact |
| `mobile/src/storage/utils.ts` | utility | transform | itself `:195-261` (error code / terminal classification) | exact |
| `mobile/src/storage/types.ts` | model | — | itself `:17-32`, `:106-117` | exact |
| `mobile/src/storage/attachments.ts` **(new)** | service | file-I/O | `mobile/src/storage/local-owner.ts` (small storage module with `getDb`) + `sync.ts:134-173` (upload helpers) | role-match |
| `mobile/src/storage/local-owner.ts` or new `profile-cache.ts` | service | CRUD (key/value) | `mobile/src/storage/local-owner.ts:4-60` | exact |
| `mobile/src/storage.ts` (barrel) | config | — | itself (4 `export *` lines) | exact |
| `mobile/src/hooks/survey-sync/useSurveySyncNetwork.ts` | hook | event-driven | itself `:83-155`, `:157-232`, `:238-260` | exact |
| `mobile/src/hooks/survey-sync/useSurveySyncSurveyOperations.ts` | hook | request-response + file-I/O | itself `:71-109`, `:393-425`, `:427-495` | exact |
| `mobile/src/hooks/survey-sync/sync-activity.ts` | utility | event-driven | itself `:22-57` (closest thing to a single flight) | role-match |
| `mobile/src/hooks/useSurveySync.ts` | hook (orchestrator) | event-driven | itself `:148-162` (logout purge) | exact |
| `mobile/src/hooks/useEditingDraft.ts` | hook | event-driven (timer) | itself `:38-92` | exact |
| `mobile/src/hooks/useAuth0Session.ts` | hook | request-response | itself `:206-281` (restore effect) | exact |
| `mobile/src/api/client.ts` | utility | request-response | itself `:65-115` | exact |
| `mobile/src/api/ibp-api.ts` | service | request-response | itself `:122-146` (`loadSurveyDetail`) | exact |
| `mobile/src/screens/SurveyDetailScreen.tsx` | component | render | itself `:176-178`, `:762-766`, `:814-816`, `:1221-1231` | exact |
| `mobile/src/screens/SurveyListScreen.tsx` | component | render | itself `:994-1000`, `:1063-1066` | exact |
| `mobile/src/screens/survey-screen-helpers.ts` (optional pure preview-source helper) | utility | transform | itself + `survey-screen-helpers.test.ts` | exact |
| `mobile/test/expo-crypto.mock.ts`, `expo-file-system-legacy.mock.ts`, `expo-image-manipulator.mock.ts`, `expo-image.mock.ts` **(new)** | test mock | — | `mobile/test/expo-haptics.mock.ts`, `expo-sqlite.mock.ts` | exact |
| `mobile/test/node-sqlite-db.ts` (maybe extend) | test double | — | itself | exact |
| `mobile/jest.unit.config.js` | config | — | itself `:19-25` (moduleNameMapper), `:32-40` (ratchet) | exact |
| `mobile/src/storage.test.ts` / new `src/storage/*.sqlite.test.ts` | test | real SQL | `src/storage.test.ts:1-134`, `src/storage/local-owner.sqlite.test.ts` | exact |
| `mobile/src/hooks/useAuth0Session.test.ts` | test (renderHook) | — | itself `:1-130` | exact |
| `mobile/src/hooks/useEditingDraft.test.ts` | test (React spy) | — | itself `:1-80` | exact |
| `mobile/src/hooks/survey-sync/useSurveySyncSurveyOperations.test.ts` | test (useCallback spy) | — | itself `:1-95`, `:476-497` | exact |
| `mobile/app.json` | config | — | itself `plugins` array `:11-34` | exact |
| `api/src/surveys/surveys-attachments.service.ts` | service | request-response | itself `:101-119` (`buildUploadUrl` presigner), `:378-417` (`listAttachments` ownership) | exact |
| `api/src/surveys/surveys.controller.ts` | controller | request-response | itself `:99-102`; streaming: `api/src/users/users.controller.ts:71-80` | exact |
| `api/test/attachments-download.e2e-spec.ts` **(new)** | test (E2E) | — | `api/test/attachments-reports-transactions.e2e-spec.ts:1-75,165-200`; mode-branching: `surveys-idempotency.e2e-spec.ts:1020-1075` | exact |
| `docs/technical/api-contract-v1.md` | docs | — | its `GET /surveys/{id}/attachments` section (`:498-518`) | exact |

---

## Pattern Assignments

### `mobile/src/storage/db.ts` (migration, batch)

**Analog:** itself. There is no versioned runner today; the whole file is 131 lines with no `PRAGMA`.

**Current schema bootstrap to keep verbatim as the fresh-install baseline** (`:39-96`): `CREATE TABLE IF NOT EXISTS local_surveys / sync_queue / local_attachments / local_meta` plus `idx_local_attachments_survey`.

**Anti-pattern to replace** (`:123-131`):
```typescript
async function addColumnIfMissing(db, table, columnDef): Promise<void> {
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`).catch(() => {
    // Column likely already exists; keep migration idempotent.
  })
}
```
Replace it with an explicit `PRAGMA table_info(<table>)` check. The test double supports it: `storage.test.ts:163-169` already reads `PRAGMA table_info(local_surveys)` through `getAllAsync`. Version-0 installs may have any subset of the `:100-120` columns, so migration 1 must re-apply every one of them idempotently, then:
- add `sync_queue.op_type` and backfill it with the existing guards (`utils.ts:102-150`: `isSurveyQueuePayload`, `isSurveyDeleteQueuePayload`, `isSurveyVisibilityQueuePayload`, `isAttachmentQueuePayload`, `isAttachmentDeleteQueuePayload`)
- run `UPDATE sync_queue SET retry_count = 0, next_retry_at = NULL` (D-06)
- add the attachment "unavailable" column(s) for D-10
- run `CREATE INDEX IF NOT EXISTS` on `sync_queue(status, next_retry_at, id)` and `sync_queue(survey_id)`.

**Keep the cached-db pattern** (`:3-11`). `getDb()` memoises one promise per module registry, which the test mock relies on (`test/expo-sqlite.mock.ts` comment `:3-8`).

**Constants live here** (`:13`): `export const MAX_RETRY_COUNT = 8`. Add `SYNC_BATCH_SIZE = 100` and `SCHEMA_VERSION` next to it.

---

### `mobile/src/storage/sync.ts` (service, request-response + batch)

**Analog:** itself (1133 lines). Keep the structure and change these seams:

**Imports** (`:1-39`): `expo-sqlite` type, `getDb, MAX_RETRY_COUNT` from `./db`, types from `./types`, guards/helpers from `./utils`. Add `import { apiRequest, ApiError } from "../api/client"` and `import * as FileSystem from "expo-file-system/legacy"`. The upload code may instead move to `./attachments`.

**Failure options, the bug to fix** (`:41-44`, `:421`, `:469`, `:511`):
```typescript
type FailureOptions = { terminalOverride?: boolean; errorCode?: string }
...
const terminal = options?.terminalOverride ?? (terminalByMessage || reachedRetryCap)
```
Call sites that pass `terminalOverride: false`: `:806-816` (network catch) and `:886-901` (`result.status === "fatal_error"` evaluates to `false` for retryable results). Call sites that pass `true`, which must map to `classification: "fatal"` (Pitfall 5): `:773-776` (`invalid_local_payload`) and `:841-844` (`invalid_attachment_response`). Per D-05, `retryable` must not increment `retry_count` toward the cap. It still sets `status='failed'` and `next_retry_at = computeNextRetryAt(...)` (`utils.ts:258-261`).

**Queue snapshot to page in 100s** (`:649-656`): the `SELECT ... WHERE status IN ('pending','failed') AND (next_retry_at IS NULL OR next_retry_at <= ?) ORDER BY id ASC` has no `LIMIT`. Loop in pages of `LIMIT 100`, or slice. `client_ref = String(row.id)` (`:698`, `:716`, etc.) is unique per row, so the `operationRows` map keeps working per chunk.

**Mark-synced, the D-04 fix** (`:46-64`): `markSurveyQueueRowSynced` deletes the row, then unconditionally sets `sync_state='synced'`. Wrap both statements in one transaction and guard the UPDATE with `AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE survey_id = ?)`. Same treatment for `markSurveyDeleteRowSynced` (`:66-70`, 3 statements), `uploadAttachmentAndMarkSynced` DB tail (`:109-131`), `applyRemoteChanges` delete branch (`:234-239`), and `queueSurveyVisibilityChange` (`:552-639`).

**Pull guard, the D-07 fix** (`:242`, `:270`): today it is `const pendingQueue = await hasPendingQueueForSurvey(db, survey.id)` then `if (!pendingQueue) { UPDATE ... sync_blocked = 0 ... }`. Extend the existing `SELECT id, sync_state FROM local_surveys` at `:244-247` to also read `sync_blocked`, and skip when `pendingQueue || existing.sync_blocked`. `hasPendingQueueForSurvey` (`utils.ts:307-319`) is the helper to keep.

**Remote attachment insert with `local_uri = ""`** (`:323-339`): D-11 replaces this. Keep the `remote-${attachment.id}` id convention (`:308`, `:320`, `:329`) so existing rows still match. Add a remote/"not cached" state column instead of the empty string.

**HTTP calls to route through `apiRequest`** (see C6): `:783-797` (batch). Replace with:
```typescript
const payload = await apiRequest<SyncBatchResponse>({
  baseUrl: apiUrl, path: "/sync", method: "POST", token: accessToken, json: { operations: chunkOps },
})
```
Also `:954-965` (changes: `path: \`/sync/changes?${params}\``; reuse the query building of `buildSyncChangesUrl`, `utils.ts:279-286`), `:1000-1053` (`submitSurvey`: branch on `error instanceof ApiError && error.status === 422` instead of `response.status`), and `:97-106` (confirm PUT, `expectJson: false`).

**Network error classification note:** `apiRequest` rethrows a raw `TypeError` on network failure and `ApiError(408)` on timeout (`client.ts:91-99`). Classification must treat "not an ApiError", 408, 429 and >=500 as `retryable`.

**Meta helpers to reuse** (`:388-408`): `getMetaValue` / `setMetaValue` on `local_meta`.

**Single flight: no analog** (see "No Analog Found"). Wrap `syncPending` and `pullRemoteChanges` with a module-level `let inFlight: Promise<...> | null`. Keep the exported names so the hook call sites and test mocks (`jest.mock("../storage", { syncPending, pullRemoteChanges })`) keep working. `syncPending` calls `pullRemoteChanges` internally (`:923`), so the inner call must bypass the guard or share it, or it deadlocks.

---

### `mobile/src/storage/surveys.ts` (service, CRUD)

**Analog:** itself.

**IDs to switch to `randomUUID()`** (`:28`, `:97`):
```typescript
const id = `survey-${Date.now()}`
const localAttachmentId = `attachment-${Date.now()}-${Math.floor(Math.random() * 1000)}`
```
→ `import { randomUUID } from "expo-crypto"`. Server `surveys.id` is `TEXT` (`api/migrations/001_init.sql:15`), so old IDs stay valid. **Existing assertion to update:** `src/storage.test.ts:518` `expect(result.id).toMatch(/^attachment-/)`.

**Multi-statement writes to wrap in one transaction:** `createLocalDraft` (`:42-66`: INSERT survey + INSERT queue), `queueLocalAttachment` (`:109-128`), `queueDeleteAttachment` (`:148-215`), `queueDeleteSurvey` (`:218-252`), `updateLocalDraft` (`:345-373`: `deleteQueuedSurveyUpserts` + INSERT + UPDATE), `clearLocalIbpData` (`:432-442`), `retrySurveyNow` (`:457-500`), `discardSurveyLocalChanges` (`:502-534`). The pattern already used by the test double:
```typescript
await db.withTransactionAsync(async () => {
  await deleteQueuedSurveyUpserts(db, input.survey_id)
  await db.runAsync(`INSERT INTO sync_queue ...`, [...])
  await db.runAsync(`UPDATE local_surveys ...`, [...])
})
```

**Purge hook for photo files and the cached profile:** `clearLocalIbpData` (`:432-442`) is the one function called by every explicit purge: `useSurveySync.ts:93` (`purgeWhileSyncSuspended`) and `:153` (logout). Delete the `documentDirectory/attachments/` files and the cached-profile `local_meta` key here. It already deletes the owner keys (`:438-441`).

---

### `mobile/src/storage/attachments.ts` (NEW, service, file-I/O)

**Analogs:** `mobile/src/storage/local-owner.ts` (module shape: small storage module, `import { getDb } from "./db"`, exported constants + async functions, `:1-60`) and the upload helpers being moved out of `sync.ts:134-173`.

Capture input comes from `useSurveySyncSurveyOperations.ts:80-109` (`queueAttachmentAsset`). The fake-size line to delete is `:87-88`:
```typescript
const sizeBytes =
  typeof asset.fileSize === "number" && asset.fileSize > 0 ? asset.fileSize : 500_000
```
Get the real size from `FileSystem.getInfoAsync(destUri, { size: true })`, in `expo-file-system/build/legacy/FileSystem.d.ts:25`. Other verified legacy APIs: `documentDirectory` `:7`, `copyAsync` `:76`, `makeDirectoryAsync` `:82`, `downloadAsync` `:120` (D-11 cache), `uploadAsync` `:149`.

**Missing-file handling (D-10):** today `LOCAL_FILE_HTTP 404` is terminal (`utils.ts:254`) and the queue row is deleted (`sync.ts:476-477`). Replace this with a `getInfoAsync(...).exists === false` check before upload that marks the attachment unavailable. It must be fatal-classified but keep the `local_attachments` row, with a user-visible `last_sync_error_code` added next to `deriveAttachmentErrorCode` (`utils.ts:210-230`).

---

### `mobile/src/storage/local-owner.ts` (or new `profile-cache.ts`) (service, key/value CRUD)

**Analog:** `local-owner.ts:4-60`:
```typescript
export const LOCAL_OWNER_SUB_KEY = "session_owner_sub"
...
await db.runAsync(
  `INSERT INTO local_meta (key, value, updated_at)
   VALUES (?, ?, ?)
   ON CONFLICT(key) DO UPDATE SET
     value = excluded.value,
     updated_at = excluded.updated_at`,
  [LOCAL_OWNER_SUB_KEY, owner.sub, now],
)
```
Store the cached `/me` profile as JSON (`AuthUser`, `mobile/src/app/types.ts:1-9`) under a new key, e.g. `cached_profile`. Store it keyed or tagged with the Auth0 `sub`, so an account switch cannot surface another user's profile (Security: Spoofing row). Unit-test analog: `local-owner.test.ts:1-40` (mocked `getDb`) and `local-owner.sqlite.test.ts` (real SQL).

---

### `mobile/src/hooks/survey-sync/useSurveySyncNetwork.ts` (hook, event-driven)

**Analog:** itself.

**Per-hook locks the module-level flight replaces or complements** (`:69-70`, `:93-100`, `:185-189`):
```typescript
const syncInProgressRef = useRef(false)
const pullInProgressRef = useRef(false)
...
if (syncInProgressRef.current) { if (mode === "manual") setStatus("Sync already in progress..."); return }
```
**Wiring that must be preserved around every sync call** (`:107-110`, `:191-194`, `:246-249`):
```typescript
const result = await withAuthRetry(async (token, tokenSub) => {
  await assertSyncOwner(ensureSyncOwner, tokenSub)
  return syncActivity.run(() => syncPending(apiUrl, token))
})
```
The owner assertion (`sync-owner-guard.ts:97-105`) and `syncActivity.run` (WR-08 purge tracking, `sync-activity.ts:26-37`) must stay outside or around the single flight. A caller that joins an in-flight promise has already passed its own owner check, and `syncActivity.waitForIdle` must still see the shared promise.

**Error-branch ladder to copy** for any new sync entry point (`:116-138`): `isSyncSuspendedError` → `isSyncOwnerMismatchError` → `isAuthTemporarilyUnavailableError` → `isAuthRequiredError` (then `clearSession`) → generic.

---

### `mobile/src/hooks/survey-sync/useSurveySyncSurveyOperations.ts` (hook, request-response + file-I/O)

**Analog:** itself.

**`runOwnerGuardedSync`, the D-03 bypass** (`:71-78`):
```typescript
const runOwnerGuardedSync = useCallback(
  () =>
    withAuthRetry(async (token, tokenSub) => {
      await assertSyncOwner(ensureSyncOwner, tokenSub)
      return syncActivity.run(() => syncPending(apiUrl, token))
    }),
  [apiUrl, ensureSyncOwner, syncActivity, withAuthRetry],
)
```
Used by `handleToggleVisibility` (`:272`) and `handleDeleteAttachment` (`:451`). Once `syncPending` itself is single-flight in `sync.ts`, this path is covered without a hook change. Keep the call shape.

**Capture flow** (`:393-425` camera, `:359-391` library, both → `queueAttachmentAsset` `:80-109`). Insert resize → persist → real size between the picker result and `queueLocalAttachment`. The picker already passes `quality: 0.8` (`:374-378`, `:408-412`).

**`submitSurvey` is not wrapped in `syncActivity.run`** (`:174-181`). If it moves to `apiRequest`, consider wrapping it too so the purge waits for it. Minor; not required by D-xx.

---

### `mobile/src/hooks/useEditingDraft.ts` (hook, timer)

**Analog:** itself, `:38-92`. The skip-instead-of-reschedule bug is at `:57-60`:
```typescript
autosaveTimerRef.current = setTimeout(() => {
  if (autosaveInFlightRef.current) {
    return            // <- change is dropped; must reschedule / mark dirty
  }
  autosaveInFlightRef.current = true
```
The fix keeps `autosaveSignatureRef` (`:31`, `:48`, `:71`) as the "already saved" marker. On in-flight, set a pending flag and re-run after the `finally` at `:74-76`.

---

### `mobile/src/hooks/useAuth0Session.ts` (hook, request-response)

**Analog:** itself. The offline-restore branch that shows the login overlay is at `:233-246`:
```typescript
const user = await getMyProfile(apiUrlRef.current, credentials.accessToken).catch(() => null)
if (!active) return
if (!user) {
  reportStatus("session", "success", "Session restored (offline). Profile will load when API is reachable")
  setSessionRestoring(false)
  return            // <- currentUser stays null → isAuthenticated false
}
setProfileFromUser(user)
```
and `:441` `isAuthenticated: Boolean(currentUser)`. The fix: on `!user`, load the cached profile (for the same `sessionOwner.sub`) and call `setProfileFromUser(cached)`. On every successful `getMyProfile` (`:188`, `:233`, `:298`, `:348`, `:393`), write the cache.

**Rules to keep:** `clearSession` (`:100-107`) runs only on `session-ended` / `AUTH_REQUIRED` (`:259-266`, `:193-196`). It resets UI state only; the local-data purge is separate (D-02 from 01.2, comment `useSurveySync.ts:65-66`). Decide whether the cached profile is cleared in `clearSession` (invalid_grant: yes, per D-13 "still ends the session") or only in `clearLocalIbpData` (explicit logout purge). Never clear it on `AUTH_TEMPORARILY_UNAVAILABLE` (the `:267-272` branch).

---

### `mobile/src/api/client.ts` (utility, request-response)

**Analog:** itself (`:65-115`). Already has the `AbortController` timeout (`:81-99`), `ApiError(status, message, body)` (`:1-10`) and `expectJson: false` (`:110-112`). Likely additions: none required. Optionally export a `isRetryableApiFailure(error)` helper next to `ApiError`, or put it in `storage/utils.ts`.

---

### `mobile/src/api/ibp-api.ts` (service, request-response)

**Analog:** `loadSurveyDetail` (`:122-133`):
```typescript
export async function loadSurveyDetail(apiUrl: string, accessToken: string, surveyId: string) {
  return apiRequest<SurveyDetailResponse>({
    baseUrl: apiUrl, path: `/surveys/${surveyId}`, method: "GET", token: accessToken,
  })
}
```
Add e.g. `getAttachmentDownloadUrl(apiUrl, token, surveyId, attachmentId)` returning `{ url, expires_at }`. **Test analog:** `ibp-api.test.ts:1-60`. It mocks `./client` with `mockApiRequest` and asserts `mockApiRequest.mock.calls` deep-equal the option objects.

---

### Screens: `SurveyDetailScreen.tsx`, `SurveyListScreen.tsx` (component, render)

**Analog:** themselves. RN `Image` is imported from `"react-native"` (`SurveyDetailScreen.tsx:2-12`). Photo render sites:
- filter: `SurveyDetailScreen.tsx:176-178` `photoAttachments = attachments.filter(a => Boolean(a.local_uri?.trim()))`. Remote rows with `local_uri=""` are silently hidden today (D-11).
- carousel: `:762-766` `<Image source={{ uri: slide.attachment.local_uri ?? undefined }} style=... resizeMode="cover" />`
- hero: `:814-816`; debug card: `:1221-1231` (has a "No local preview" placeholder, reuse it for the D-10 unavailable state)
- list thumbnail: `SurveyListScreen.tsx:994-1000` (`firstAttachmentWithPreview`), `:1063-1066`

Leave the logo/illustration `Image`s (`SurveyListScreen.tsx:577`, `:1110`, `require(...)` assets) on RN `Image`. `expo-image` uses `contentFit="cover"`, not `resizeMode`. Put any "which source/state to show" logic in `survey-screen-helpers.ts` so it is unit-testable (analog test: `survey-screen-helpers.test.ts`). Screens have ~9% coverage and are not rendered in Jest.

---

### Jest mocks + `mobile/jest.unit.config.js` (test config)

**Analog for a global mock file:** `mobile/test/expo-haptics.mock.ts` (plain `jest.fn()` exports + enums):
```typescript
export const impactAsync = jest.fn()
export enum ImpactFeedbackStyle { Light = "light", ... }
```
and `mobile/test/expo-sqlite.mock.ts` (functional fake with an explanatory header comment).

**Wiring** (`jest.unit.config.js:19-25`):
```js
moduleNameMapper: {
  '^@expo/vector-icons$': '<rootDir>/test/vector-icons.mock.ts',
  '^expo-sqlite$': '<rootDir>/test/expo-sqlite.mock.ts',
  '^expo-haptics$': '<rootDir>/test/expo-haptics.mock.ts',
  ...
}
```
**Use global `moduleNameMapper`, not per-file `jest.mock`, for `expo-crypto` and `expo-file-system/legacy`.** `surveys.ts` and `sync.ts` are imported through the `./storage` barrel by `src/storage.test.ts` and `local-owner.sqlite.test.ts`, and the real modules need native bindings. Add entries `'^expo-crypto$'`, `'^expo-file-system/legacy$'`, `'^expo-image-manipulator$'`, `'^expo-image$'`. The `expo-crypto` mock should return real unique UUIDs, e.g. `randomUUID: jest.fn(() => require("node:crypto").randomUUID())`. Watch out: `no-require-imports` lint applies to `src/**` only, but prefer `import { randomUUID } from "node:crypto"`. Real unique IDs keep multi-insert tests from colliding on the PRIMARY KEY.

**Per-file inline mock analog** (when a test needs to control behaviour): `useSurveySyncSurveyOperations.test.ts:28-33`:
```typescript
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  ...
}))
```
Access it via `import * as ImagePicker from "expo-image-picker"` then `(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue(...)` (`:476-493`).

**Ratchet** (`:32-40`): `./src/storage/` 56/35/68/58 and `./src/hooks/` 82/65/80/83. Values may only go up.

**Existing hook tests whose `jest.mock("../storage" | "../../storage", () => ({...}))` factory must list any new export the hook imports:** `useSurveySyncNetwork.test.ts`, `useSurveySyncSurveyOperations.test.ts:40-51`, `sync-owner-gate.test.ts:29-35`, `useSurveySync.logout-purge.test.ts`. Tests mocking `../storage/surveys`: `useEditingDraft.test.ts:14-18`, `useSurveyList.test.ts`, `useSurveyDraftPatcher.test.ts`, `useLocalDataOwner.test.ts`, `useSurveySync.test.ts`.

---

### Real-SQL storage tests (`src/storage.test.ts` or new `src/storage/*.sqlite.test.ts`)

**Analog A (global mock, barrel import):** `src/storage.test.ts:1-134`. Header comment `:1-10`; `insertSurveyRow` / `insertQueueRow` / `selectQueueRowsForSurvey` helpers `:37-114`; setup:
```typescript
beforeAll(async () => { await initLocalDb() })
beforeEach(async () => {
  const db = await getDb()
  await db.execAsync(`DELETE FROM local_surveys; DELETE FROM sync_queue; DELETE FROM local_attachments; DELETE FROM local_meta;`)
})
```
**Analog B (own handle, for migration tests that need a pre-seeded v0 schema):** `src/storage/local-owner.sqlite.test.ts:8-37`:
```typescript
import { createNodeSqliteDb } from "../../test/node-sqlite-db"
const mockDb = createNodeSqliteDb()
jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }))
```
For the v0→vN migration test, seed `mockDb` with the **old** `CREATE TABLE` text (`db.ts:42-96`, without the new columns) plus rows **before** calling `initLocalDb()`, then assert that the rows survived and `PRAGMA user_version`.

**fetch mocking (these must change when `sync.ts` moves to `apiRequest`):** `storage.test.ts:702-842` mocks `global.fetch` with `{ ok, json }` only. `apiRequest` reads `response.text()` and `response.status` (`client.ts:31-40,101-107`). Copy the mock shape from `client.test.ts:3-7,24-28`:
```typescript
global.fetch = jest.fn().mockResolvedValue({
  ok: true, status: 200, text: async () => JSON.stringify({ results: [] }),
}) as typeof global.fetch
```
**Single-flight test:** call `syncPending(...)` twice without awaiting, `await Promise.all`, then assert the `/sync` URL appears in exactly one `fetch` call.

**Mock-based storage test (no SQL):** `src/storage/local-owner.test.ts:1-40`. Use it only where SQL is irrelevant.

---

### `mobile/src/hooks/useAuth0Session.test.ts` (renderHook)

**Analog:** itself `:1-130`. It already mocks `react-native-auth0` (`:30-62`), `expo-network` (`:64-66`) and `../api/ibp-api` `getMyProfile` (`:68-70`). Recipe: `jest.mock("react-native", () => ({}))` before `import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"`, with `afterEach(async () => { await cleanup() })`. The existing restore tests (`:117-130`) show the offline case shape: `mockHasValidCredentials.mockResolvedValue(true)`, then `await waitFor(() => expect(result.current.sessionRestoring).toBe(false))`. Add a mock for the new profile-cache storage function (`jest.mock("../storage/local-owner" | "../storage/profile-cache", ...)`) the same way `sync-owner-gate.test.ts:18-22` mocks `../storage/local-owner`.

General renderHook rules: `mobile/src/hooks/render-hook-smoke.test.ts:1-26`.

### `mobile/src/hooks/useEditingDraft.test.ts` (React spy, not renderHook)

**Analog:** itself `:1-80`. It spies on `React.useRef` / `React.useEffect` and mocks `../storage/surveys`. The reschedule test needs `jest.useFakeTimers()` plus a deferred `mockUpdateLocalDraft` promise. The research says "renderHook, fake timers", but this file uses spies. Either extend it in its own style or add a separate renderHook file; don't mix the two styles in one file.

---

## API: presigned download endpoint (D-01)

### `api/src/surveys/surveys-attachments.service.ts` (service, request-response)

**Presigner analog** (`:101-119`):
```typescript
private async buildUploadUrl(storageKey: string, mimeType: string, fallbackUrl: string): Promise<string> {
  if (this.objectStorageMode !== "minio" || !this.s3Client) {
    return fallbackUrl
  }
  await this.ensureS3Bucket()
  const command = new PutObjectCommand({ Bucket: this.s3Bucket, Key: storageKey, ContentType: mimeType })
  return getSignedUrl(this.s3Client, command, { expiresIn: 15 * 60 })
}
```
The new method uses `GetObjectCommand`, which is not imported yet (imports at `:2-10`), with a short `expiresIn` such as 5 min.

**Ownership + read analog** (`:378-417` `listAttachments`, and `:248-259` the single-row lookup in `uploadAttachment`):
```typescript
await this.getSurveyForUserOrThrow(this.db, surveyId, user.id)
const existing = await this.db.query<AttachmentRow>(
  `SELECT ... FROM attachments WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
  [attachmentId, surveyId],
)
if (!existing.rows[0]) throw new NotFoundException("Attachment not found")
```
Also reject `uploaded_at IS NULL` (nothing to download). Use `NotFoundException`, or `ConflictException` for "not uploaded yet". This is a read-only endpoint, so no `db.transaction` is needed. `DatabaseService.transaction` (`api/src/database/database.service.ts:40-57`) is the pattern only if an event row is written.

**Local mode** (C10): `uploadsRootDir` + `join(this.uploadsRootDir, storage_key)` (`:25`, `:31`, `:297`). Streaming analog: `users.service.ts:191-205` (`readFile(storagePath).catch(() => null)`).

### `api/src/surveys/surveys.controller.ts` (controller)

**Route analog** (`:99-102`, class-level `@UseGuards(AuthGuard)` at `:31`):
```typescript
@Get(":id/attachments")
async listAttachments(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
  return this.attachmentsService.listAttachments(user, id)
}
```
Add `@Get(":id/attachments/:attachmentId/download-url")` (param style at `:112-116`). For the local-mode byte stream, copy `api/src/users/users.controller.ts:71-80`:
```typescript
@Get("me/profile-picture")
async getProfilePicture(@CurrentUser() user, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
  const picture = await this.usersService.getProfilePicture(user)
  response.setHeader("Content-Type", picture.mimeType)
  response.setHeader("Cache-Control", "private, max-age=60")
  return new StreamableFile(picture.buffer)
}
```
An authenticated GET works from mobile via `FileSystem.downloadAsync(url, dest, { headers: { Authorization } })` for the D-11 cache. Throttle: `@Throttle(UPLOAD_THROTTLE)` exists (`:90`, `common/rate-limit.config.ts`) if the route should be rate-limited separately.

### `api/test/attachments-download.e2e-spec.ts` (new E2E)

**Analog:** `api/test/attachments-reports-transactions.e2e-spec.ts`:
- bootstrap `:1-38` (`Test.createTestingModule({ imports: [AppModule] })`, `configureApp(app)`, `db = moduleFixture.get(DatabaseService)`, `app.close()` in `afterAll`)
- `loginAsNewUser()` via `POST /v1/debug/test-token` `:40-47`
- `createDraftSurvey()` `:49-69`
- create + local upload with `.attach("file", Buffer.from([0xff,0xd8,0xff,0xd9]), { filename, contentType })` `:165-193`

**Mode-agnostic branch analog:** `api/test/surveys-idempotency.e2e-spec.ts:1037-1069` (`if (String(created.body.upload_url).startsWith("http")) { presigned PUT via fetch } else { API PUT .attach(...) }`).

**Cases:** owner gets 200 + URL/bytes. Another user (second `loginAsNewUser`) gets 404 (the ownership threat in RESEARCH §Security). A deleted or never-uploaded attachment gets 404/409. The E2E env is `api/.env.test.example` (`NODE_ENV=test`, `ibp_test`, local storage mode by default).

---

## Shared Patterns

### Owner guard + purge tracking around every sync call
**Source:** `mobile/src/hooks/survey-sync/useSurveySyncNetwork.ts:107-110`, `sync-owner-guard.ts:97-105`, `sync-activity.ts:26-37`
**Apply to:** every hook path that calls `syncPending` / `pullRemoteChanges` / `submitSurvey`. See the excerpt above.

### `local_meta` upsert
**Source:** `mobile/src/storage/local-owner.ts:38-45`, `sync.ts:398-408`
**Apply to:** schema version bookkeeping (if not using `user_version`), cached profile, download cache index.

### Real-SQL test double
**Source:** `mobile/test/node-sqlite-db.ts:8-40` (exposes `execAsync`, `runAsync`, `getFirstAsync`, `getAllAsync`, `withTransactionAsync`, `closeAsync`)
**Apply to:** all storage tests. Add methods to it only if production code starts calling them (e.g. `withExclusiveTransactionAsync`, `getAllSync`).

### Error classification helpers
**Source:** `mobile/src/storage/utils.ts:195-256` (`deriveSurveyErrorCode`, `deriveAttachmentErrorCode`, `isTerminalSurveyError`, `isTerminalAttachmentError`), backoff `:258-261`
**Apply to:** the new `fatal | retryable | unknown` classifier. Extend these helpers rather than adding a parallel module. Note that `deriveSurveyErrorCode` already maps `HTTP 429` → `rate_limited` and `HTTP 5` → `transient_upstream_error`.

### API ownership check
**Source:** `api/src/surveys/surveys-attachments.service.ts:51-80` (`getSurveyForUserOrThrow`, `WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`)
**Apply to:** the new download endpoint.

### Native config (CNG)
**Source:** `mobile/app.json:11-34` `plugins` array (string or `[name, options]`)
**Apply to:** any config plugin the new packages need. `expo-image`, `expo-crypto`, `expo-image-manipulator` and `expo-file-system` need no plugin options for this phase, so no `ios/`/`android/` edits.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| Module-level single flight in `mobile/src/storage/sync.ts` | utility | event-driven | Only per-hook `useRef` booleans exist (`useSurveySyncNetwork.ts:69-70`). `sync-activity.ts` tracks promises but does not dedupe them. Use RESEARCH Pattern 1, and mind the inner `pullRemoteChanges` call at `sync.ts:923`. |
| `PRAGMA user_version` migration runner in `db.ts` | migration | batch | No versioning exists. Use RESEARCH Pattern 4 with the C9/C14 corrections (WAL outside the transaction, no nested transactions). |

## Metadata

**Analog search scope:** `mobile/src/{storage,hooks,hooks/survey-sync,api,screens}`, `mobile/test/`, `mobile/jest.unit.config.js`, `mobile/app.json`, `api/src/{surveys,users,database,common}`, `api/test/`, `node_modules/expo-{file-system,image-manipulator,crypto}` type declarations
**Files scanned:** ~45
**Pattern extraction date:** 2026-09-25
