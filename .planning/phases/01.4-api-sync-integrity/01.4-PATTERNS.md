# Phase 01.4: API sync integrity - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 18 (13 source files created/modified, 5 test files created/extended)
**Analogs found:** 17 / 18 (only `database.service.spec.ts` has no direct analog: nothing mocks `pg` today)

All paths are relative to `/home/user/cortege/api/`. Line numbers were read on 2026-09-24.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/database/database.service.ts` (add `Queryable` + `transaction<T>(fn)`) | service (infra) | CRUD / transaction | `src/users/users.service.ts:263-328` (deleteAccount BEGIN/COMMIT/ROLLBACK/release), `src/debug/debug.service.ts:15-35` | exact (same pattern, extracted) |
| `src/surveys/dtos/survey-upsert.dto.ts` (add `@ArrayMaxSize(50)` + format check on `parcel_ids`) | DTO | request-response | itself + `src/surveys/dtos/public-map-items-query.dto.ts` (stacked decorators) | exact |
| `src/surveys/dtos/survey-patch.dto.ts` (same `parcel_ids` rule, D-01 says "same DTO rule applies to REST") | DTO | request-response | `src/surveys/dtos/survey-upsert.dto.ts` | exact |
| `src/surveys/dtos/sync-batch.dto.ts` (NEW) | DTO | request-response | `src/surveys/dtos/survey-upsert.dto.ts`, `src/users/dtos/change-email.dto.ts` (required `!` field) | role-match |
| `src/surveys/dtos/sync-operation.dto.ts` (NEW envelope DTO) | DTO | request-response | `src/surveys/dtos/survey-upsert.dto.ts` (`@IsEnum` of string list) | role-match |
| `src/surveys/dtos/*` delete / attachment-delete / visibility payload DTOs (NEW, optional) | DTO | request-response | `src/surveys/dtos/survey-visibility-patch.dto.ts`, `create-attachment.dto.ts` | exact |
| `src/surveys/sync.controller.ts` (`@Body() body: SyncBatchDto`) | controller | request-response | `src/surveys/surveys.controller.ts:50-52` | exact |
| `src/surveys/surveys-sync.service.ts` (per-operation validation, `syncBatch`) | service | batch | itself `:33-194` (existing if/else dispatch + try/catch + `mapSyncError`) | exact |
| `src/surveys/sync-error.utils.ts` (22xxx/23xxx fatal, generic message) | utility | transform | itself + `src/auth/auth.guard.ts:30-32` (`isUniqueViolation` pg code check) | exact |
| `src/surveys/surveys.service.ts` (upsert/patch/submit/delete in transaction, helpers take `db: Queryable`, remove A-M1 catches, submit lock + 23505 -> 409) | service | CRUD | `src/users/users.service.ts:255-339`, `:367-388` (23505 mapping) | exact |
| `src/surveys/surveys-normalize.utils.ts` (value-aware read-only diff for upsert, D-04) | utility | transform | `getSubmittedReadOnlyFields` at `:23-38` | exact |
| `src/surveys/surveys.types.ts` (drop/replace `SyncOperation`, `SyncBatchBody`) | model (types) | - | itself `:44-54` | exact |
| `src/surveys/surveys-attachments.service.ts` (`createAttachment`, `deleteAttachment` in transaction) | service | CRUD | `src/surveys/surveys.service.ts` (after refactor) / `users.service.ts:263-338` | exact |
| `src/reports/reports.service.ts` (`createReport` in transaction) | service | CRUD | `users.service.ts:263-328` | exact |
| `src/users/users.service.ts` (`deleteAccount`: commit before Auth0, log Auth0 failure) | service | CRUD + external call | itself `:255-339`; Logger from `src/surveys/cadastre-provider.service.ts:17,49-51` | exact |
| `test/surveys-sync-validation.e2e-spec.ts` (NEW) | test (E2E) | request-response | `test/surveys-idempotency.e2e-spec.ts:1164-1229, 1398-1461`; app setup from `test/rate-limit.e2e-spec.ts:20-37` | exact |
| `test/surveys-transactions.e2e-spec.ts` (NEW) | test (E2E) | request-response | `test/surveys-idempotency.e2e-spec.ts:8-46, 537-590` | exact |
| `test/sync-error.utils.spec.ts` (NEW) | test (unit) | transform | `test/users.service.spec.ts:126-142` (pg error fabrication) | role-match |
| `test/database.service.spec.ts` (NEW) | test (unit) | transaction | `test/debug.service.spec.ts:1-23` (mock client) — but needs `jest.mock("pg")`, never done before | partial |
| `test/users.service.spec.ts` (extend deleteAccount) | test (unit) | CRUD | itself `:34-55, 344-391` | exact |

Note on unit test location: every existing API unit spec lives in `api/test/*.spec.ts` (not co-located under `src/`), even though `jest.unit.config.js` roots include `src`. RESEARCH.md proposes `src/database/database.service.spec.ts` and `src/surveys/sync-error.utils.spec.ts`; either path is picked up (`testMatch: ['**/*.spec.ts']`), but `test/` matches current convention.

---

## Pattern Assignments

### `src/database/database.service.ts` (service, transaction)

**Analog:** `src/users/users.service.ts:263-328` (and the identical `src/debug/debug.service.ts:15-35`)

Current file is 32 lines; `query()` at `:22-27`, `connect()` at `:29-31`. Imports at `:1-2` already pull `Pool, PoolClient, QueryResult, QueryResultRow` from `"pg"`.

**Transaction pattern to extract** (`users.service.ts:263, 279-328`):
```typescript
const client = await this.db.connect()
...
try {
  await client.query("BEGIN")
  // ... work on client.query(...)
  await client.query("COMMIT")
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined)
  throw error
} finally {
  client.release()
}
```
Generalise to `transaction<T>(fn: (db: Queryable) => Promise<T>): Promise<T>` using `this.pool.connect()`; export `Queryable` as an `export type`/interface with the same `query<T extends QueryResultRow>(text, values?)` signature as `DatabaseService.query` (`:22-27`) so both `DatabaseService` and `PoolClient` satisfy it. Keep `connect()` — `DebugService` (`src/debug/debug.service.ts:15,46`) and its spec (`test/debug.service.spec.ts:9-16`, mocks `db.connect`) depend on it.

---

### `src/surveys/dtos/survey-upsert.dto.ts` and `survey-patch.dto.ts` (DTO)

**Analog:** itself. Style: one decorator per line, `@IsOptional()` first, then type check, then constraints; optional fields `?:`; string unions via `@IsEnum([...])`.

**Current `parcel_ids`** (`survey-upsert.dto.ts:28-31`, identical in `survey-patch.dto.ts:16-19`):
```typescript
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parcel_ids?: string[]
```
**Stacked constraint style** (`public-map-items-query.dto.ts:4-7`):
```typescript
  @IsOptional()
  @IsString()
  @MaxLength(32)
  from?: string
```
Add `@ArrayMaxSize(50)` (D-01, not 20 as in RESEARCH examples) and `@Matches(PATTERN, { each: true })`; import list at `:1` is a single named import from `"class-validator"`.

**Backward-compat fields that must stay** (D-03): `status` (`:16-18`, `@IsEnum(["draft","submitted","synced","error","expired"])`) and `expires_at` (`:61-63`, `@IsString()`). Keep them whitelisted; ignore in service.

**Parcel ID format warning (load-bearing):** the RESEARCH regex `/^\d{5}[A-Z]{1,3}\d{1,4}$/` comes from `parseParcelIdentifier` (`surveys-normalize.utils.ts:129`, also `cadastre-provider.service.ts:301`) and matches synthetic IDs (`cadastre-provider.service.ts:70`: `${communeCode}${section}${number}`, e.g. `12345AB0042`). But in IGN mode parcel IDs can be the raw IGN `idu` (`surveys.service.ts:1124-1125`: `const parcelId = idu.length > 0 ? idu : ...`), a 14-char IDU such as `75056000AB0012` (5 digits + 3-digit prefix + 2-char section + 4 digits), and `cadastre-provider.service.ts:237-243` keeps any `[0-9A-Z]` string. The planner must pick a pattern that accepts both (e.g. `^\d{5}(\d{3})?[0-9A-Z]{1,3}\d{1,4}$`) or installed apps with IGN parcels will get fatal errors. Validation runs before `normalizeParcelId` (trim/upper): mobile already sends upper-cased trimmed IDs (`mobile/src/storage/utils.ts:36`), but a case-insensitive pattern is safer.

---

### `src/surveys/dtos/sync-batch.dto.ts` / `sync-operation.dto.ts` (NEW DTOs)

**Analogs:** `survey-upsert.dto.ts` (optional + enum), `src/users/dtos/change-email.dto.ts` (required field with `!`):
```typescript
import { IsEmail } from "class-validator"

export class ChangeEmailDto {
  @IsEmail()
  email!: string
}
```
Envelope shape to mirror (`src/surveys/surveys.types.ts:44-54`):
```typescript
export type SyncOperation = {
  client_ref?: string
  entity?: "survey" | "attachment"
  action?: "upsert" | "create" | "delete" | "visibility_update"
  survey_id?: string
  payload?: unknown
}
export type SyncBatchBody = { operations?: SyncOperation[] }
```
Per D-02: `SyncBatchDto` validates only `@IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) operations!: ...` at the controller. Do **not** add `@ValidateNested` / `@Type` on `operations` (would 400 the whole batch, Pitfall 1). Because the global pipe runs `forbidNonWhitelisted: true` (`src/app.setup.ts:30-36`), the per-operation items typed as plain objects are not deep-validated unless `@ValidateNested` is present — confirm behaviour with an E2E. No existing DTO in the codebase uses `@ValidateNested`, `@Type`, `@ArrayMaxSize`, `@Matches`, or `plainToInstance` (grep verified) — these are first uses.

Existing payload DTOs to reuse per branch: `SurveyUpsertDto` (upsert), `CreateAttachmentDto` (`create-attachment.dto.ts:1-19`, attachment create), `SurveyVisibilityPatchDto` (`survey-visibility-patch.dto.ts`, visibility_update). Mobile sends `captured_at: null` for attachments (`mobile/src/storage/sync.ts:708`) — `@IsOptional()` accepts null, fine. Delete payloads are `{ id }` (survey, `mobile/src/storage/sync.ts:750-752`) and `{ attachment_id }` (`:723-725`).

---

### `src/surveys/sync.controller.ts` (controller)

**Analog:** `src/surveys/surveys.controller.ts:50-52`:
```typescript
  @Post()
  async upsert(@CurrentUser() user: AuthenticatedUser, @Body() body: SurveyUpsertDto) {
```
Change is at `sync.controller.ts:8` (import `SyncBatchBody` from `./surveys.types`) and `:18` (`@Body() body: SyncBatchBody` -> `SyncBatchDto`). Keep `@HttpCode(200)` and `@Throttle(SYNC_THROTTLE)` (`:16-17`).

---

### `src/surveys/surveys-sync.service.ts` (service, batch)

**Analog:** itself. Keep the loop shell; insert validation inside each branch.

**Per-operation shell to preserve** (`:47-55, 180-190`):
```typescript
    for (const operation of operations) {
      const clientRef =
        typeof operation.client_ref === "string" && operation.client_ref.trim()
          ? operation.client_ref
          : null
      const entity = typeof operation.entity === "string" ? operation.entity : "unknown"
      const action = typeof operation.action === "string" ? operation.action : "unknown"

      try {
        ...
        throw new BadRequestException(`Unsupported sync operation: ${entity}.${action}`)
      } catch (error) {
        const mapped = mapSyncError(error)
        results.push({ client_ref: clientRef, entity, action, status: mapped.status, error: mapped.error })
      }
    }
```
**Unchecked casts to replace** with validated DTO instances: `:60-63` (`operation.payload as SurveyUpsertBody`), `:134-138` (`operation.payload as CreateAttachmentBody`); manual checks at `:74-84`, `:99-112`, `:149-160` can become DTO validation. Batch bounds at `:37-43` move to `SyncBatchDto` (can stay as defense).

Throw `BadRequestException` on validation failure (the error shell maps HttpException 400 to `fatal_error` with `http_status: 400`, already asserted in `test/surveys-idempotency.e2e-spec.ts:1222-1228`). Use a generic message; do not echo class-validator constraint text if it could include values. For `validate()` options use `{ whitelist: true, forbidNonWhitelisted: true }` to match `app.setup.ts:31-35` — but see E2E warning below about `location`.

Result push pattern (`:64-71`) is repeated per branch — keep `data: data as Record<string, unknown>`.

---

### `src/surveys/sync-error.utils.ts` (utility)

**Analog:** itself + pg code check in `src/auth/auth.guard.ts:30-32`:
```typescript
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505"
}
```
Insertion point: top of `mapSyncError` (`:8-13`) before the `HttpException` branch. Current defect: `:15` `const retryable = typeof httpStatus === "number" ? httpStatus >= 500 || httpStatus === 429 : true` and `:70-72` returns raw `error.message` for plain `Error` (leaks constraint names). Return shape to keep (`:3-6`):
```typescript
export type SyncMappedError = {
  status: "retryable_error" | "fatal_error"
  error: { code: string; message: string; http_status?: number; details?: Record<string, unknown> }
}
```
Omit `details` and use a fixed message for 22xxx/23xxx. Leave `defaultRetryableSyncCode` (`:77-90`) intact for network/5xx.

---

### `src/surveys/surveys.service.ts` (service, CRUD) — 1570 lines, target these ranges only

**Transaction analog:** `users.service.ts:263-328` (above) via the new `this.db.transaction(async (db) => ...)`.

Call sites to wrap and helpers to thread `db: Queryable` through (all currently `this.db.query`):

| Method | Lines | Statements to put in one transaction |
|---|---|---|
| `upsertForUser` | `:167-370` | `getSurveyForUser` (`:211`), `getSurveyParcelIds` (`:215`), `ensureParcelIds` (`:228`), `getDefaultVersionNumber` (`:237`), INSERT (`:243-274`) or UPDATE (`:314-354`), `syncSurveyParcels` (`:275`/`:355`), `insertEvent` (`:277`/`:357`) |
| `patchSurvey` | `:372-506` | read (`:377`), parcels (`:416,431,439`), UPDATE (`:446-484`), `insertEvent` x2 (`:490,499`), `syncSurveyParcels` (`:495`) |
| `submitSurvey` | `:607-694` | read (`:617`), `validateParcelSubmit` (`:625`, uses `getDefaultVersionNumber` `:1555` and `parcels` SELECT `:1540-1545`), expired UPDATE+event (`:642-652`), submit UPDATE (`:663-678`), `insertEvent` (`:684`) |
| `deleteSurvey` | `:696-766` | SELECT attachments (`:723`), UPDATE attachments (`:731`), UPDATE surveys (`:743`), `insertEvent` "deleted" (`:756`, confirms RESEARCH assumption A2: the event exists). Move `cleanupAttachmentStorage` loop (`:739-741`) to after commit (D-07), as `deleteAccount` does at `users.service.ts:330-338` |
| `patchSurveyVisibility` | `:508-550` | UPDATE (`:526`) + `insertEvent` (`:544`) — not named in D-06 but same shape; planner's call |

Helpers to change signature to take `db: Queryable` first: `getSurveyForUser` (`:1248-1261`), `getSurveyForUserOrThrow` (`:1240`), `insertEvent` (`:1263-1274`), `getSurveyParcelIds` (`:1295`), `syncSurveyParcels` (`:1314`), `ensureParcelIds` (`:1375`) -> `ensureParcelById` (`:1438-1490`), `getDefaultVersionNumber` (`:1493`), `validateParcelSubmit` (`:1511`). `insertEvent` today:
```typescript
  private async insertEvent(
    surveyId: string,
    actorId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), surveyId, actorId, eventType, JSON.stringify(payload)],
    )
  }
```

**A-M1 catches to delete (D-09)** — `:1305-1311` and `:1327-1333`:
```typescript
    } catch (error) {
      const message = (error as Error).message ?? ""
      if (message.toLowerCase().includes("survey_parcels")) {
        return []
      }
      throw error
    }
```

**Client `status`/`expires_at` to stop reading (D-03):** `:203-204` (`body.expires_at ?? new Date(now + 7d)`), `:256` (`body.status ?? "draft"` in INSERT), `:338` (`body.status ?? existing.status` in UPDATE), `:350` (`expiresAt` in UPDATE — keep `existing.expires_at` on update).

**Optimistic guard:** app-level check at `:292-312` + unguarded `WHERE id = $1 AND user_id = $2` at `:332`. Add `AND sync_version < $17` and react to `rowCount === 0`. The 409 shape to reuse (`:293-301`):
```typescript
      throw new ConflictException({
        code: "sync_version_conflict",
        message: "Older sync_version received",
        details: { survey_id: body.id, server_sync_version: existing.sync_version, client_sync_version: body.sync_version },
      })
```
(`ConflictException` already imported at `:3`.) `mapSyncError` reads `code`/`details` from the object response (`sync-error.utils.ts:45-66`), so new conflicts must use the same `{ code, message, details }` object form.

**Submitted read-only on upsert (D-04):** existing enforcement in `patchSurvey` (`:378-386`):
```typescript
    const forbiddenPostSubmitFields = getSubmittedReadOnlyFields(body)
    if (existing.status === "submitted" && forbiddenPostSubmitFields.length > 0) {
      throw new UnprocessableEntityException({
        code: "submitted_read_only_fields",
        message: "submitted survey is read-only for observation fields",
        forbidden_fields: forbiddenPostSubmitFields,
      })
    }
```
Two differences for upsert: (1) D-04 asks for 409 / `survey_submitted_read_only` (patch uses 422 / `submitted_read_only_fields` — do not change patch's contract unless intended); (2) `getSubmittedReadOnlyFields` (`surveys-normalize.utils.ts:23-38`) only checks key **presence** (`hasOwnProperty`), but installed apps always send all fields, so upsert needs a value comparison against `existing` (identical values allowed). Add a sibling helper in `surveys-normalize.utils.ts` reusing the same `readonlyFields` list; compare `parcel_ids` after `normalizeParcelIds` and JSON objects (`factors`, `scores`) structurally. Note `scores` is recomputed server-side (`:205-209`) so the client value may legitimately differ — decide whether `scores` belongs in the upsert comparison.

**Submit concurrency (D-08):** `getDefaultVersionNumber` (`:1493-1509`) is a plain SELECT MAX. Add sorted `SELECT parcel_id FROM parcels WHERE parcel_id = ANY($1::text[]) ORDER BY parcel_id FOR UPDATE` inside the transaction before `validateParcelSubmit`'s version check (the existing `parcels` lookup at `:1540-1545` is the natural place). No `UNIQUE (parcel_id, version_number)` constraint exists: `migrations/008_parcels_and_versioning.sql:52` is a plain `CREATE INDEX idx_surveys_parcel_year_version`, so without a new migration a residual race would produce a duplicate version, not a 23505 (RESEARCH A1 resolved: constraint absent). Version numbers are per `survey_parcels.parcel_id`, so a DB unique constraint is not straightforward; the lock is the primary guard.

**23505 -> 409 mapping analog** (`users.service.ts:374-387`):
```typescript
    try {
      await this.db.query(`UPDATE users SET email = $1, ...`, [newEmail, user.id])
    } catch (err: unknown) {
      const isUniqueViolation =
        typeof err === "object" && err !== null && (err as { code?: string }).code === "23505"
      if (isUniqueViolation) {
        ...
        throw new BadRequestException("Email already taken")
      }
      throw err
    }
```
For submit, throw `ConflictException({ code: "parcel_version_conflict", ... })` matching `:628-636`.

---

### `src/surveys/surveys-attachments.service.ts` (service, CRUD)

**Analog:** the refactored `surveys.service.ts` helpers. It has its own private copies to thread `db` through: `getSurveyForUserOrThrow` (`:51`), `getSurveyForUser` (`:59-72`), `insertEvent` (`:74-90`).

- `createAttachment` `:152-224`: count SELECT (`:164-167`), INSERT (`:196-209`), `insertEvent` (`:211-216`). `buildUploadUrl` (`:194`) is a presign (no DB) — can run before the transaction.
- `deleteAttachment` `:312-359`: SELECT (`:320-325`), UPDATE (`:339-344`), `cleanupAttachmentStorage` (`:346`, move after commit, D-07), `insertEvent` (`:348-351`).
- `uploadAttachment` `:226-310` also does UPDATE (`:291`) + event (`:299`); not in D-06 list, planner's call.

---

### `src/reports/reports.service.ts` (service, CRUD)

**Analog:** `users.service.ts:263-328`. Wrap `createReport` `:49-60` (report INSERT then event INSERT, both `this.db.query`):
```typescript
    const result = await this.db.query<Pick<ReportRow, "id" | "status">>(
      `INSERT INTO reports (id, survey_id, reporter_user_id, reason, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING id, status`,
      [reportId, surveyId, user.id, reason],
    )

    await this.db.query(
      `INSERT INTO survey_events (id, survey_id, event_type, payload)
       VALUES ($1, $2, 'reported', $3::jsonb)`,
      [randomUUID(), surveyId, JSON.stringify({ report_id: reportId })],
    )
```
Constructor `:21` takes only `DatabaseService`. Existing E2E coverage: `test/validation-reports.e2e-spec.ts`, `test/epic-e-search-reports.e2e-spec.ts`.

---

### `src/users/users.service.ts` `deleteAccount` (service, CRUD + external)

**Analog:** itself `:255-339`. Move `await this.auth0Management.deleteUser(user.auth0_sub)` (`:261`) to after the `finally` block (`:328`), and optionally replace `:263, 279-328` with `this.db.transaction`. Keep storage cleanup after commit (`:330-338`).

**Logger pattern** (no Logger in UsersService yet) — `src/surveys/cadastre-provider.service.ts:1,17,49-51`:
```typescript
import { Injectable, Logger } from "@nestjs/common"
  private readonly logger = new Logger(CadastreProviderService.name)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`IGN cadastre resolver failed: ${message}`)
      }
```
Use `this.logger.error(...)` with `user.id` and `user.auth0_sub` (D-10), swallow the error so the request still returns 204 (`users.controller.ts:88-92`).

---

### `test/surveys-sync-validation.e2e-spec.ts` and `test/surveys-transactions.e2e-spec.ts` (NEW E2E)

**Analog:** `test/surveys-idempotency.e2e-spec.ts`.

**Setup** (`:1-46`):
```typescript
import "dotenv/config"
import { INestApplication } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { DatabaseService } from "../src/database/database.service"

describe("Surveys idempotency (e2e)", () => {
  let app: INestApplication
  let db: DatabaseService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    db = moduleFixture.get(DatabaseService)
    app.setGlobalPrefix("v1")
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })
```
**Important:** this spec does NOT install the global `ValidationPipe`, so its payloads carry a non-DTO `location` field (`:67, 1191, 1205, 1419, 1440`) that production (`forbidNonWhitelisted: true`) would reject. For the new validation spec, build the app with production config instead — `test/rate-limit.e2e-spec.ts:20-37`:
```typescript
    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()
```
(`import { configureApp } from "../src/app.setup"`; `configureApp` already sets the `v1` prefix and the ValidationPipe, `app.setup.ts:23,30-36`). `test/validation-reports.e2e-spec.ts:12-28` installs its own pipe with `forbidNonWhitelisted: false` — do not copy that, it hides the whitelist behaviour. The per-operation `validate()` in `syncBatch` runs regardless of app setup, so existing idempotency tests that send `location` inside `/v1/sync` payloads (`:1191, 1205, 1440`) will start failing if per-op validation uses `forbidNonWhitelisted: true` — update those fixtures or use `whitelist: true` only. Installed apps never send `location` in sync upserts (`mobile/src/storage/types.ts:60-72`, `mobile/src/storage/surveys.ts:30-40`).

**Auth helper** (`:49-55`): `POST /v1/debug/test-token` with `{ email }` -> `login.body.access_token`. Unique IDs via `Date.now()`.

**Sync batch request + per-op assertions** (`:1174-1228`):
```typescript
    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: [ { client_ref: "op-valid-survey", entity: "survey", action: "upsert", payload: {...} }, ... ] })
      .expect(200)
    expect(response.body.results[1]).toMatchObject({
      client_ref: "op-invalid-survey", entity: "survey", action: "upsert", status: "fatal_error",
    })
    expect(response.body.results[1].error.http_status).toBe(400)
```
Conflict-details assertion shape: `:1447-1460`.

**Submittable survey fixture** (for read-only and concurrent-submit tests) — `:537-590`: `validFactors = { A:1, B:1, C:1, D:1, E:1, F:1, G:1, H:1, I:2, J:2 }`, resolve a parcel via `GET /v1/parcels/resolve?lat&lng` (`:550-556`, synthetic provider in test), compute `version_number` with the `getNextVersionNumber(parcelId)` DB helper (`:12-29`), upsert with `parcel_id`, `observation_year: 2025`, `region_version: "ACA"`, `vegetation_stage: "collineen"`, then `POST /v1/surveys/:id/submit` expecting 201.

**DB inspection / fault injection:** `db = moduleFixture.get(DatabaseService)` (`:37`) and `db.query(...)` to assert nothing committed. For "insertEvent fails -> nothing committed", there is no existing spy on `DatabaseService`; existing spies only target `global.fetch` (`test/auth-provisioning.e2e-spec.ts:51`). Once `transaction` passes a `PoolClient`, `jest.spyOn(db, "query")` will not see statements run on the client — inject via `jest.spyOn(db, "transaction")` wrapping the real implementation with a client proxy that throws on `INSERT INTO survey_events`, or use a DB-level trick (e.g. temporary trigger / CHECK constraint on `survey_events` in the `ibp_test` DB, dropped in `afterEach`). Restore spies with `jest.restoreAllMocks()`.

**Concurrency:** use `Promise.all([request(...).post(...), request(...).post(...)])` and assert sorted statuses `[201, 409]`. `/v1/sync` has `@Throttle(SYNC_THROTTLE)` (`src/common/rate-limit.config.ts:56-58`); keep request counts modest or override the throttler as `rate-limit.e2e-spec.ts:22-26` does.

---

### `test/sync-error.utils.spec.ts` (NEW unit)

**Analog for fabricating pg errors** — `test/users.service.spec.ts:129`:
```typescript
    const uniqueViolation = Object.assign(new Error("unique violation"), { code: "23505" })
```
Pure function, no DI: `import { mapSyncError } from "../src/surveys/sync-error.utils"`, assert `status`, `error.code`, `error.message` does not contain the constraint name, `details` undefined. Also cover `new ConflictException({code,...})` -> fatal with code preserved, `HttpException` 503 / 429 -> retryable, plain `Error` without code -> retryable (unchanged). Assertion style: `expect(...).toMatchObject({...})` / `toEqual(expect.objectContaining(...))` (`users.service.spec.ts:68-74`).

---

### `test/database.service.spec.ts` (NEW unit) — partial analog

**Closest:** `test/debug.service.spec.ts:1-23` (mock client with `query`/`release` jest.fn) and its assertion `expect(db.connect).not.toHaveBeenCalled()`. DatabaseService builds `new Pool(...)` in its constructor (`database.service.ts:8-16`), so the spec must `jest.mock("pg", () => ({ Pool: jest.fn().mockImplementation(() => ({ connect, query, end })) }))` — module mocking precedent is only `jest.mock("fs/promises")` (`test/users.service.spec.ts:5`). Cases: commit path (`BEGIN`, fn, `COMMIT`, `release` once), throw path (`ROLLBACK`, rethrow, `release` once), ROLLBACK failure still rethrows original error and releases.

---

### `test/users.service.spec.ts` (extend)

**Analog:** itself. `buildService()` (`:34-55`) already mocks `db.connect -> client` and `auth0Management.deleteUser`. If `deleteAccount` switches to `db.transaction`, add `transaction: jest.fn(async (fn) => fn(client))` to the `db` mock (or keep using `connect` in the implementation to avoid churn). Existing deleteAccount test (`:344-391`) sequences `client.query.mockResolvedValueOnce(...)` per statement and asserts order with `toHaveBeenNthCalledWith`; its title and first assertion (`:374`) must be updated. New assertions: Auth0 called after COMMIT — use `mock.invocationCallOrder`:
```typescript
expect(auth0Management.deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
  client.query.mock.invocationCallOrder[client.query.mock.calls.length - 1],
)
```
Auth0 failure case: `auth0Management.deleteUser.mockRejectedValueOnce(new Error("auth0 down"))`, expect `deleteAccount` to resolve and a `Logger.prototype.error` spy (`jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)`) to be called with user id / sub. DB failure case: `client.query` rejects mid-way -> `ROLLBACK`, `deleteUser` not called.

---

## Shared Patterns

### Transaction boundary
**Source:** `src/users/users.service.ts:263-328` -> new `DatabaseService.transaction`
**Apply to:** surveys (upsert, patch, submit, delete), attachments (create, delete), reports (create), users (deleteAccount)
Every `this.db.query` inside the callback becomes `db.query`; every private helper called inside takes `db: Queryable` first (Pitfall 2). Keep `WHERE ... AND user_id = $2` predicates (ASVS V4).

### Post-commit best-effort side effects
**Source:** `src/users/users.service.ts:330-338`, `surveys.service.ts:1276-1293` (`cleanupAttachmentStorage` with `.catch(() => undefined)`)
**Apply to:** `deleteSurvey`, `deleteAttachment`, `deleteAccount` (storage + Auth0) — collect keys inside the transaction, act after it returns.

### Error payload shape for sync
**Source:** `ConflictException({ code, message, details })` at `surveys.service.ts:293-301`, consumed by `sync-error.utils.ts:45-66`
**Apply to:** every new 409 (`survey_submitted_read_only`, submit race) so `error.code`/`details` reach the mobile client.

### pg SQLSTATE detection
**Source:** `src/auth/auth.guard.ts:30-32`, `src/users/users.service.ts:380-381`
**Apply to:** `sync-error.utils.ts` (22xxx/23xxx) and `submitSurvey` (23505 -> 409). Do not wrap pg errors in HttpExceptions before they reach `mapSyncError` (Pitfall 3).

### DTO decorator style
**Source:** `src/surveys/dtos/survey-upsert.dto.ts`, `public-map-items-query.dto.ts`
**Apply to:** all new/changed DTOs — one decorator per line, `@IsOptional()` first, double quotes, no semicolons, single `class-validator` import line.

### Formatting
Prettier (`CLAUDE.md`): double quotes, no semicolons, trailing commas, 100 cols. Unused vars prefixed `_`. `export type` for type-only exports (`Queryable`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `test/database.service.spec.ts` | test | transaction | No spec mocks the `pg` module; only `fs/promises` is module-mocked. Use the jest.mock factory approach above. |
| (pattern) `plainToInstance` + `validate()` manual validation | utility | transform | Not used anywhere in `api/src`; follow RESEARCH.md Pattern 2. |
| (pattern) `SELECT ... FOR UPDATE` | SQL | locking | No row locks anywhere in `api/src`; follow RESEARCH.md Pattern 4 with sorted IDs. |
| (pattern) fault injection inside a DB transaction in E2E | test | - | No `DatabaseService` spy exists in E2E; see options under the E2E section. |

## Metadata

**Analog search scope:** `api/src/{database,surveys,users,reports,debug,auth,common}`, `api/test/`, `api/migrations/`, `mobile/src/storage/`
**Files scanned:** ~30
**Pattern extraction date:** 2026-09-24
