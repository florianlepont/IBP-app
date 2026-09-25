# Phase 01.6: Sync feed ordering and unified object storage - Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 27 (new or modified)
**Analogs found:** 25 / 27 (2 have partial or no analog: the migration backfill test and the CI MinIO step)

> Read "Conflicts with CONTEXT/RESEARCH" first. Conflict C-1 is a correctness bug in D-01/D-02 as written. It was reproduced against local PostgreSQL 16.13.

---

## Conflicts with CONTEXT/RESEARCH (planner must resolve)

### C-1 (BLOCKER): a `seq` cursor with an `xid8 < pg_snapshot_xmin` filter still skips events. Page on `(xid8, seq)`

D-01 says paging uses `seq` with a `seq:<n>` cursor. D-02 adds `xid8 < pg_snapshot_xmin(pg_current_snapshot())`. Together they are **not** skip-proof.

A transaction gets its xid on its first write, but `seq` is assigned when the event INSERT runs. `upsertForUser` writes `surveys` first and inserts the event later, and an IGN call can sit in between. So a transaction with a **lower** xid can hold a **higher** seq.

Reproduced on the local PG 16.13 with the `pg` driver (script: scratchpad `xid.js`):

```
T4: BEGIN; pg_current_xact_id()  -> xid 9843 (early xid)
T3: BEGIN; pg_current_xact_id()  -> xid 9844
T3: INSERT event                  -> seq 6   (stays open)
T4: INSERT event                  -> seq 7 ; COMMIT
poll: seq > base AND xid8 < xmin(=9844)  -> returns t4 (seq 7), cursor = 7
T3: COMMIT
poll: seq > 7 AND xid8 < xmin            -> []      <-- t3 (seq 6) is skipped forever
(xid8, seq) order: ... t4:9843:7  t3:9844:6          <-- t3 sorts after t4
```

**Fix (keeps D-02's snapshot rule):** order and page on the tuple `(xid8, seq)`:
`WHERE (e.xid8, e.seq) > ($cursorXid::xid8, $cursorSeq::bigint) AND e.xid8 < pg_snapshot_xmin(pg_current_snapshot()) ORDER BY e.xid8, e.seq`.

This is correct for two reasons:
- Every event with `xid8 < xmin` belongs to a finished transaction.
- Any event that becomes visible later has `xid8 >= xmin`, which is greater than every xid already returned.

The cursor must therefore carry both values, for example `v2:<xid8>:<seq>`. The mobile app treats the cursor as opaque (see "Mobile cursor" below), so the format is free. `seq` is still useful as the tie-breaker within one transaction and for the legacy translation. The index should be `(xid8, seq)`.

I verified that the row comparison `(xid8, seq) > ($1::xid8, $2::bigint)` works when the values are bound as strings.

### C-2: `:id` UUID validation (D-07) clashes with how survey ids work today

- `surveys.id` is `TEXT` (`api/migrations/001_init.sql:15`). The client chooses it, and `SurveyUpsertDto.id` is only `@IsString()` (`api/src/surveys/dtos/survey-upsert.dto.ts:14-16`).
- Mobile generates UUIDs (`mobile/src/storage/surveys.ts:1,29`, `expo-crypto randomUUID`), so installed apps are fine.
- **About 70 E2E fixtures use non-UUID survey ids** such as `` `e2e-survey-${Date.now()}` ``. Count per file: surveys-idempotency 27, auth-profile 8, surveys-transactions 7, attachments-download 6, attachments-reports-transactions 6, epic-e-search-reports 6, validation-reports 5, sync-installed-app-compat 3, sync-validation 1, database-transaction 1. A bare `ParseUUIDPipe` on `:id` breaks all of them.
- The **sync path bypasses route pipes**: `envelope.survey_id` (`api/src/surveys/dtos/sync-batch.dto.ts:35-38`, only `@IsString @MaxLength(128)`) goes straight into `attachmentsService.createAttachment` (`api/src/surveys/surveys-sync.service.ts:122-131`). That builds `` `surveys/${surveyId}/${attachmentId}${extension}` `` (`api/src/surveys/surveys-attachments.service.ts:198`).
- Because `SurveyUpsertDto.id` accepts any string, a survey whose id is `../../x` can be created and then passes the ownership check.

Controller pipes alone therefore do not contain keys. Recommended layering:
- The storage key builder in StorageService validates its segments itself (UUID or strict charset).
- It also runs the local containment check.
- Add `@IsUUID()` to `SurveyUpsertDto.id`, `SyncOperationEnvelopeDto.survey_id` and `SurveyDeletePayloadDto.id`, plus `ParseUUIDPipe` on `:id`/`:attachmentId`.
- Migrate the E2E fixtures to `randomUUID()`. The alternative is a safe-segment regex such as `^[A-Za-z0-9_-]{1,128}$` that keeps the fixtures unchanged. **This is a planner or owner decision.**
- Before choosing strict UUID, check the VPS for existing non-UUID survey ids: `SELECT count(*) FROM surveys WHERE id !~* '^[0-9a-f-]{36}$'`.
- `:attachmentId` is always server-generated (`randomUUID()`, surveys-attachments.service.ts:195), so `ParseUUIDPipe` is safe there.

### C-3: profile pictures must be proxied by the API, not redirected to a presigned URL

- Installed apps load `${apiUrl}/me/profile-picture?v=…` through `<Image source={{ uri, headers: { Authorization: Bearer … } }}>` (`mobile/src/screens/AccountScreen.tsx:109-116,259-262`).
- A 302 to a presigned MinIO URL would forward the Bearer header. S3/MinIO rejects requests that carry two auth mechanisms, and `docs/technical/api-contract-v1.md` already says "Clients must not send the bearer token to this URL".
- The existing E2E `api/test/auth-profile.e2e-spec.ts:71-76` expects `200` + `image/*` bytes from `GET /v1/me/profile-picture`.

So StorageService needs a **`getObject(key) -> Buffer | null`** method (S3 `GetObjectCommand` + `Body.transformToByteArray()`, or `readFile` in local mode), and `users.controller.ts:269-278` keeps returning a `StreamableFile`. The research's `getDownloadDescriptor` should only replace `buildDownloadUrl` for attachments, not the profile-picture route.

**D-06 "no picture, no error":** today a missing file gives `404` on `GET /me/profile-picture` (users.service.ts:204-208), and the mobile `<Image>` then shows a broken image, not the initials fallback. To actually show "no picture", either:
- `getMe`/`toMeResponse` returns `profile_picture_url: null` when the object is missing (HEAD per `/me`), or
- the 404 path lazily clears the three `profile_picture_*` columns.

The planner should pick one.

### C-4: event inserts happen in three `src` places plus several test files. Use column DEFAULTs

`survey_events` INSERT sites:
- `api/src/surveys/surveys.service.ts:1543-1555` (`insertEvent`, used at :273, :389, :490, :676, :685, :732, :881, :923, :1016)
- `api/src/surveys/surveys-attachments.service.ts:90-102`, a **duplicate private `insertEvent`** (used at :229, :319, :370)
- `api/src/reports/reports.service.ts:57-61`, a **direct INSERT with no helper and no actor_id**
- Tests insert directly: `api/test/auth-profile.e2e-spec.ts:118`, `api/test/epic-e-search-reports.e2e-spec.ts:414`, `api/test/database-transaction.e2e-spec.ts:93,100,109`

All `src` inserts run inside `db.transaction(...)` (verified; no autocommit event insert in `src`). Other writes to the table: `users.service.ts:293-317` (UPDATE/DELETE during account deletion) and `debug.service.ts:19,50` (DELETE).

**Recommendation:** `seq` as `GENERATED BY DEFAULT AS IDENTITY` and `xid8 xid8 NOT NULL DEFAULT pg_current_xact_id()`. No insert site then needs to change, and test inserts keep working. Do not add the columns to the INSERT statements.

### C-5: `ADD COLUMN seq BIGSERIAL` does not backfill in `(created_at, id)` order

The research's Runtime State Inventory assumes insertion order. D-01 requires `(created_at, id)` order. The sequence below was verified in PG16 inside one transaction, the way `migrate.js` runs it. Rows inserted out of order came out as `m:1 z:2 a:3 b:4`, which matches `(created_at, id)`:

```sql
ALTER TABLE survey_events ADD COLUMN IF NOT EXISTS seq BIGINT;
UPDATE survey_events e SET seq = o.rn
  FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM survey_events) o
  WHERE o.id = e.id;
ALTER TABLE survey_events ALTER COLUMN seq SET NOT NULL;
ALTER TABLE survey_events ALTER COLUMN seq ADD GENERATED BY DEFAULT AS IDENTITY;
SELECT setval(pg_get_serial_sequence('survey_events', 'seq'),
              COALESCE((SELECT MAX(seq) FROM survey_events), 0) + 1, false);
ALTER TABLE survey_events ADD COLUMN IF NOT EXISTS xid8 xid8 NOT NULL DEFAULT pg_current_xact_id();
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_events_xid8_seq ON survey_events (xid8, seq);
```

All backfilled rows get the migration's own xid, so they sort among themselves by `seq`, which is correct.

The D-03 synthetic events (`INSERT … SELECT … FROM surveys s WHERE NOT EXISTS (SELECT 1 FROM survey_events e WHERE e.survey_id = s.id)`) must run **after** the setval, so they take new seq values and the migration xid. They also need `user_id IS NOT NULL`, because the feed joins `surveys.user_id`.

### C-6: legacy cursors can point at a survey, not an event

Before this phase, the fallback path emitted `cursor_out = buildChangesCursor(survey.updated_at, survey.id)` (`surveys-sync.service.ts:325-331`). An installed app may therefore hold a legacy cursor whose id is a **survey id**. The research's "exact match on `(created_at, id)` else seq = 0" would resend everything for those clients.

Translate instead with `<=`: `SELECT xid8, seq FROM survey_events e JOIN surveys s … WHERE s.user_id = $1 AND (e.created_at, e.id) <= ($ts::timestamptz, $id) ORDER BY e.xid8 DESC, e.seq DESC LIMIT 1`. If nothing matches, use `(0, 0)`.

When a legacy cursor comes in and there are no new events, return the **translated new-format** cursor as `cursor_out`. Mobile only persists `cursor_out` when it differs from the current cursor (`mobile/src/storage/sync.ts:1141-1152`).

### C-7: existing E2E tests assert the fallback that D-03 removes

- `api/test/surveys-idempotency.e2e-spec.ts:1549-1631` "returns surveys without events via GET /v1/sync/changes fallback"
- `api/test/surveys-idempotency.e2e-spec.ts:1632-1693` "…even when cursor is newer than survey.updated_at". Both INSERT `surveys` rows directly with no event.

Invert or replace them: an event-less row is **not** re-sent on every poll.

### C-8: E2E fixtures declare sizes that differ from the bytes they upload. They break under D-08 and the MinIO pass (D-10)

- `surveys-idempotency.e2e-spec.ts:1024` declares `size_bytes: 2048000` and uploads `Buffer.from("fake-jpeg-binary")` (16 B) at `:1040-1046` (presigned) and `:1061` (local).
- `surveys-idempotency.e2e-spec.ts:1329` declares `size_bytes: 1024` and uploads 16 B (`:1343-1360`).
- `attachments-reports-transactions.e2e-spec.ts:174` declares 1000 and attaches 4 B, then **expects 500** from injected event failure (`:182-192`). If a local-mode size check runs before the event insert, this becomes 422. Either fix the declared size or put the check after the event insert. The declared size should be fixed.
- Other `size_bytes: 1000/1024` fixtures only create and never upload, so they are unaffected.

### C-9: CI service containers cannot run `quay.io/minio/minio`

GitHub Actions `services:` accepts `image`, `env`, `ports` and `options`, but no command or args. The MinIO image needs `server /data`. Use a step instead:

```
docker run -d --name minio -p 9000:9000 -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio123 \
  quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z server /data
```

Then wait for `curl -fsS http://localhost:9000/minio/health/live`. The pinned tag matches `infra/docker-compose.yml:18`.

### C-10: the migration backfill is not exercised by E2E

`api/test/global-setup.js:180-186` drops the schema and re-runs all migrations on an **empty** database. The backfill order and synthetic-event SQL never meet data in E2E.

To test it, the spec can seed `survey_events`/`surveys` rows, then run the migration's backfill and synthetic statements as a transaction against those rows. A better option is a scratch schema with `SET search_path`. Another is to extract the backfill into a SQL function tested by an E2E spec. A pure unit test cannot prove SQL ordering. **No existing analog.**

### C-11: smaller notes

- **Snapshot xmin is cluster-wide.** An open *writing* transaction in any database on the same cluster, including idle-in-transaction sessions, holds back the feed. This is a delay, not a skip. Read-only transactions do not count, because they have no xid. Document this in `sync-conflict-resolution-v1.md` (D-11). E2E runs `--runInBand` (`api/package.json:12`), so specs do not interfere with each other.
- **Types:** `pg` returns `bigint` (`seq`) and `xid8` as **strings** (verified: `typeof … === "string"`, e.g. `seq: '5'`, `xid8: '9842'`). Keep them as strings in the cursor. Never `Number()` an xid8.
- **Same-version compare (D-04):** do not hash `JSON.stringify(existing.factors)`. JSONB reorders object keys, so a naive stored-vs-incoming hash falsely conflicts. Reuse the value-comparison helper `getChangedSubmittedReadOnlyFields` (see pattern below) plus `visibility`, and exclude `scores`, `status` and `expires_at`, as D-13 already does.
- **Unit tests in `api` live in `api/test/*.spec.ts`**, not co-located, even though CLAUDE.md says so. The research's `api/src/storage/storage.service.spec.ts` would run (jest roots include `src`), but the convention is `api/test/storage.service.spec.ts`. Add a `'./src/storage/'` threshold row in `api/jest.unit.config.js:240-249`.
- **Presigned PUT content-length (verified with SDK 3.1004.0).** Passing `ContentLength` to `PutObjectCommand` already makes `getSignedUrl` sign it: `X-Amz-SignedHeaders=content-length;host`. `signableHeaders` is not needed. Without `ContentLength` the header list is just `host`. Whether MinIO RELEASE.2025-09-07 then rejects a mismatched body is still unverified locally (no Docker here), so the D-10 CI pass is the proof. Mobile uploads with `FileSystem.createUploadTask(..., BINARY_CONTENT)` (`mobile/src/storage/attachments.ts:166-172`), and `sizeBytes` comes from the prepared file (`mobile/src/storage/attachments.ts:103`), so a real device sends a matching Content-Length.
- **Profile picture MIME:** `users.service.ts:137-142` accepts any `image/*`, then `extensionFromMime` **throws a plain Error**, which becomes a 500, for e.g. `image/gif`. Route it through `isAllowedMimeType` and return 400.
- **Bucket drift:** `users.service.ts:59` defaults to `"ibp-surveys"`, while `surveys.service.ts:65` and `surveys-attachments.service.ts:38` default to `"ibp-media"`. The VPS sets `OBJECT_STORAGE_BUCKET=cortege-media` (`infra/docker-compose.vps.yml:71`). Unify on `"ibp-media"`, the CI/.env.example value.
- **Existing containment check.** `getAttachmentContent` already implements the resolve + prefix check (`surveys-attachments.service.ts:515-519`). Three other places `join()` without a check: `surveys-attachments.service.ts:144,305`, `surveys.service.ts:1573` and `users.service.ts:396-398`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `api/migrations/014_survey_events_seq_xid8.sql` (new) | migration | batch/DDL | `api/migrations/004_attachment_upload_tracking.sql` (add, backfill, constrain), `008_parcels_and_versioning.sql` (idempotent guards) | exact |
| `api/src/surveys/surveys-sync.service.ts` (getSyncChanges, remove fallback) | service | request-response (feed) | self, lines 192-250 | exact |
| `api/src/surveys/surveys-normalize.utils.ts` (cursor helpers, same-version compare) | utility | transform | self, `parseChangesCursor`/`buildChangesCursor` :399-426, `getChangedSubmittedReadOnlyFields` :95+ | exact |
| `api/src/surveys/surveys.types.ts` (`SurveyEventRow`/`SyncChangeEvent` + seq/xid8?) | model/type | — | self :118 | exact |
| `api/src/surveys/surveys.service.ts` (3 same-version sites; drop S3 client) | service | CRUD | self :318-326, :368-376, :467-475; S3 block :47-83, :1558-1575 | exact |
| `api/src/storage/storage.service.ts` (new) | service | file-I/O | `api/src/surveys/surveys-attachments.service.ts:29-167, 455-479, 502-530` | exact (extraction) |
| `api/src/storage/storage.module.ts` (new) | config/module | — | `api/src/auth/auth.module.ts` (non-global, exports) / `api/src/database/database.module.ts` (@Global) | exact |
| `api/src/surveys/surveys.module.ts` | config/module | — | self; `imports: [AuthModule]` | exact |
| `api/src/users/users.module.ts` | config/module | — | self | exact |
| `api/src/app.module.ts` (only if StorageModule is @Global) | config | — | `DatabaseModule` import at :17 | exact |
| `api/src/surveys/surveys-attachments.service.ts` | service | file-I/O + CRUD | self | exact |
| `api/src/users/users.service.ts` (profile picture via storage) | service | file-I/O + CRUD | `surveys-attachments.service.ts` minio branches | role-match |
| `api/src/users/users.controller.ts` | controller | request-response (binary) | self :253-284; `surveys.controller.ts:116-127` | exact |
| `api/src/surveys/surveys.controller.ts` (UUID params) | controller | request-response | self; no `ParseUUIDPipe` in the repo yet (NestJS built-in) | role-match |
| `api/src/surveys/dtos/survey-upsert.dto.ts`, `sync-batch.dto.ts`, `sync-payloads.dto.ts` (if C-2 goes strict) | model/DTO | validation | `survey-upsert.dto.ts:35-44` (`@Matches` + constant) | exact |
| `api/src/common/file.utils.ts` | utility | transform | self :16-18; `Object.prototype.hasOwnProperty.call` at `surveys-normalize.utils.ts:37,115` | exact |
| `.github/workflows/ci.yml` (MinIO E2E pass) | config/CI | batch | self e2e job :178-262 | role-match (see C-9) |
| `api/test/sync-changes-ordering.e2e-spec.ts` (new) | test (E2E) | concurrency | `api/test/database-transaction.e2e-spec.ts` + `DatabaseService.connect()` | role-match |
| `api/test/surveys-idempotency.e2e-spec.ts` (same-version conflict; fallback tests; size fixtures) | test (E2E) | request-response | self :48-92, :1402-1466, :1467-1548 | exact |
| `api/test/sync-installed-app-compat.e2e-spec.ts` (legacy cursor) | test (E2E) | request-response | self :255-270 | exact |
| `api/test/attachments-download.e2e-spec.ts` / new `attachments-upload-size.e2e-spec.ts` | test (E2E) | file-I/O, mode branch | `attachments-download.e2e-spec.ts:60-91` | exact |
| `api/test/auth-profile.e2e-spec.ts` (profile picture round trip, both modes) | test (E2E) | file-I/O | self :47-87 | exact |
| `api/test/attachments-reports-transactions.e2e-spec.ts` (fix size fixture) | test (E2E) | — | self :168-199 | exact |
| `api/test/storage.service.spec.ts` (new unit) | test (unit) | — | `api/test/surveys-attachments-download.spec.ts:1-76` (S3 + fs mocks, env-mode builder) | exact |
| `api/test/file.utils.spec.ts` (new unit) or fold into storage spec | test (unit) | — | `api/test/surveys-normalize.utils.spec.ts` | role-match |
| `api/test/surveys-normalize.utils.spec.ts` (cursor + compare) | test (unit) | — | self :1-31 (`makeRow`) | exact |
| `api/test/users.service.spec.ts`, `api/test/surveys-attachments-download.spec.ts` (constructor change) | test (unit) | — | self :35-66 / :58-68 | exact |
| `api/jest.unit.config.js` (threshold row for `./src/storage/`) | config | — | self :240-249 | exact |
| `docs/technical/sync-conflict-resolution-v1.md`, `docs/technical/api-contract-v1.md`, `docs/technical/data-contract-v1.md` | docs | — | self (sections listed below) | exact |

---

## Pattern Assignments

### `api/migrations/014_survey_events_seq_xid8.sql` (migration, DDL + backfill)

**Runner** (`api/scripts/migrate.js:28-43`): files are sorted by name. Each file runs as **one `client.query(sql)` inside BEGIN/COMMIT**, so multi-statement SQL is fine, and so are `DO $$` blocks and `SELECT setval(...)`. The migration is recorded in `schema_migrations`. There is no advisory lock (deferred to 01.7). Next free number: **014** (the last is `013_scrub_reported_event_identity.sql`).

**Header comment style** (`013_scrub_reported_event_identity.sql:1-3`):
```sql
-- Migration 013: Stop exposing the reporter to the reported survey's owner (A-M6)
-- Scrub actor_id and reason from existing 'reported' survey_events rows; the reporter
-- identity and reason remain in the access-controlled `reports` table.
```

**Add, backfill, constrain precedent** (`004_attachment_upload_tracking.sql:1-12`):
```sql
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS upload_token TEXT;

UPDATE attachments
SET upload_token = id
WHERE upload_token IS NULL;

ALTER TABLE attachments
  ALTER COLUMN upload_token SET NOT NULL;
```

**Idempotent-guard precedent** (`008_parcels_and_versioning.sql:21-34`): `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint …) THEN ALTER TABLE … END IF; END $$;`. Use `IF NOT EXISTS` on columns and indexes.

**Table being altered** (`001_init.sql:39-48`): `survey_events(id TEXT PK, survey_id TEXT FK, actor_id UUID, event_type TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT NOW())` and `idx_survey_events_survey (survey_id, created_at DESC)`.

**Verified body:** see C-5. Then the D-03 synthetic events, in the column order of the existing inserts (`surveys.service.ts:1551`):
```sql
INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
SELECT gen_random_uuid()::text, s.id, NULL, 'backfilled', jsonb_build_object('reason', 'migration_014')
FROM surveys s
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM survey_events e WHERE e.survey_id = s.id);
```
`gen_random_uuid()` is already used in SQL (`api/src/auth/auth.guard.ts:182`). Choose the event_type name deliberately: mobile does not interpret event types (it applies `surveys`/`attachments`), but `GET /surveys/:id/events` shows them.

---

### `api/src/surveys/surveys-sync.service.ts` (service, feed)

**Analog:** self.

**Imports and constructor** (lines 1-39): keep them. `SurveysService`/`SurveysAttachmentsService` stay injected for `syncBatch`.

**Core feed query to rewrite** (lines 204-250):
```ts
const limit = normalizeChangesLimit(limitRaw)
const parsedCursor = parseChangesCursor(cursor)

const rawEvents = await this.db.query<SyncChangeEvent>(
  `SELECT e.id, e.survey_id, e.actor_id, e.event_type, e.payload, e.created_at::text
   FROM survey_events e
   JOIN surveys s ON s.id = e.survey_id
   WHERE s.user_id = $1
     AND (
       e.created_at > $2::timestamptz
       OR (e.created_at = $2::timestamptz AND e.id > $3)
     )
   ORDER BY e.created_at ASC, e.id ASC
  LIMIT $4`,
  [user.id, parsedCursor.timestamp, parsedCursor.eventId, limit + 1],
)
const hasMoreEvents = rawEvents.rows.length > limit
const events = hasMoreEvents ? rawEvents.rows.slice(0, limit) : rawEvents.rows
if (events.length > 0) {
  // loadSyncChangeSurveys / loadSyncChangeAttachmentsByIds (keep)
  const lastEvent = events[events.length - 1]
  const cursorOut = buildChangesCursor(lastEvent.created_at, lastEvent.id)
  return { cursor_in: parsedCursor.original, cursor_out: cursorOut, has_more: hasMoreEvents, events, surveys, attachments }
}
```
New shape per C-1: `AND (e.xid8, e.seq) > ($2::xid8, $3::bigint) AND e.xid8 < pg_snapshot_xmin(pg_current_snapshot()) ORDER BY e.xid8 ASC, e.seq ASC LIMIT $4`. Select `e.seq::text` and `e.xid8::text` for the cursor. The legacy translation query from C-6 runs before this when the parser returns `kind: "legacy"`.

**Delete** lines 252-340 (fallback) and `loadSyncChangeSurveysWithoutEvents` (440-486). `loadSyncChangeAttachmentsBySurveyIds` (413-438) is then only used by the fallback, so remove it as well or the lint `no-unused` rule will complain. The empty-result return (312-321) moves to the events path: `cursor_out` is the translated or original cursor.

**Unit test analog:** `api/test/surveys-sync.service.spec.ts:15-58` (`buildService` with `db = { query: jest.fn() }`). No `getSyncChanges` unit test exists today (`describe` only at :76 for `syncBatch`). Add one that asserts the SQL contains `pg_snapshot_xmin` and the cursor mapping.

---

### `api/src/surveys/surveys-normalize.utils.ts` (utility, cursor + same-version compare)

**Cursor helpers to replace** (lines 399-426):
```ts
export function parseChangesCursor(cursor?: string): {
  timestamp: string
  eventId: string
  original: string | null
} {
  if (!cursor || cursor.trim().length === 0) {
    return { timestamp: "1970-01-01T00:00:00.000Z", eventId: "", original: null }
  }
  const [timestampRaw, eventIdRaw] = cursor.split("|")
  if (!timestampRaw || Number.isNaN(Date.parse(timestampRaw))) {
    throw new BadRequestException("Invalid sync cursor")
  }
  return { timestamp: timestampRaw, eventId: eventIdRaw ?? "", original: cursor }
}

export function buildChangesCursor(timestamp: string, eventId: string): string {
  return `${timestamp}|${eventId}`
}
```
Keep `BadRequestException("Invalid sync cursor")` for malformed input. Return a discriminated union: `{ kind: "none" } | { kind: "position", xid8: string, seq: string } | { kind: "legacy", timestamp, eventId }`, plus `original`. Validate the new form with a digits-only regex such as `/^v2:(\d{1,20}):(\d{1,19})$/`, and keep the values as strings (C-11). The legacy form is `<pg timestamptz text>|<id>`, for example `2026-03-09 10:20:31.991+00|8ac…`; the `created_at::text` output is what gets round-tripped.

**Same-version compare helper to reuse** (lines 95-160+, `getChangedSubmittedReadOnlyFields(body, existing, existingParcelIds)`):
```ts
for (const field of readonlyFields) {
  if (!Object.prototype.hasOwnProperty.call(body, field)) continue
  const bodyValue = (body as Record<string, unknown>)[field]
  if (bodyValue === undefined || bodyValue === null) continue
  switch (field) {
    case "site_name": if (bodyValue !== existing.site_name) changed.push(field); break
    case "parcel_ids": /* normalizeParcelIds + parcelIdSetEqual */
    ...
```
It already compares by value, handling JSONB key order via `jsonDeepEqual` (:39-67) and parcel sets via `parcelIdSetEqual` (:69-…). Add a `hasSameVersionContentChanged(body, existing, existingParcelIds)` that reuses it and also compares `visibility` (`body.visibility ?? existing.visibility`). If D-04's "hash" wording must be kept literally, hash a **canonical** (sorted-keys) serialization of both sides. Never hash raw `JSON.stringify`.

**Unit test analog:** `api/test/surveys-normalize.utils.spec.ts:1-31` (`makeRow(overrides)` fixture).

---

### `api/src/surveys/surveys.service.ts` (service, CRUD): the three same-version sites

**Site 1: existing row, same version** (lines 318-326):
```ts
if (syncVersion === existing.sync_version) {
  return {
    id: existing.id,
    server_status: "synced" as const,
    updated_at: existing.updated_at,
    warnings: draftValidation.warnings,
    factor_results: draftValidation.factor_results ?? undefined,
  }
}
```
**Site 2: submitted path, UPDATE matched 0 rows, re-read** (lines 368-376) and **Site 3: draft path re-read** (lines 467-475): same return with `reRead`. `existingParcelIds` is available at :316 (`await this.getSurveyParcelIds(db, existing.id)`). Sites 2 and 3 must load parcel ids for `reRead`, or reuse the locked `existing`. Because of the `forUpdate: true` lock taken at :218, sites 2 and 3 are practically unreachable, but they must still get the check.

**Conflict error shape to copy** (lines 306-316):
```ts
throw new ConflictException({
  code: "sync_version_conflict",
  message: "Older sync_version received",
  details: {
    survey_id: surveyId,
    server_sync_version: existing.sync_version,
    client_sync_version: syncVersion,
  },
})
```
For the same-version case, use a distinct message such as `"Same sync_version with different content"` with the same `code` and `details`. `mapSyncError` (`api/src/surveys/sync-error.utils.ts`) already maps a 409 to `fatal_error` in `/sync`.

**Remove from this service:** the S3 fields and constructor block (:47-51, :63-83), the `cleanupAttachmentStorage` private (:1558-1575), and the imports `DeleteObjectCommand, S3Client` (:8), `rm` (:10) and `join` (:11) if unused. Delete path caller (:1027-1030): `for (const storageKey of storageKeys) await this.storage.deleteObject(storageKey)` (best-effort, post-commit, D-07 comment at :1026). Inject `StorageService` in the constructor (:58-62).

---

### `api/src/storage/storage.service.ts` (new, service, file-I/O)

**Analog:** `api/src/surveys/surveys-attachments.service.ts`. Move code out of it rather than rewriting it.

**Imports** (surveys-attachments.service.ts:1-22):
```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import {
  CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand,
  HeadObjectCommand, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { dirname, join, resolve, sep } from "path"
```

**Config and client construction** (surveys-attachments.service.ts:35-56). Use a single copy with the unified default bucket `"ibp-media"`. Constants, not new env vars (Claude's discretion):
```ts
this.objectStorageMode =
  (process.env.OBJECT_STORAGE_MODE ?? "local") === "minio" ? "minio" : "local"
this.s3Bucket = process.env.OBJECT_STORAGE_BUCKET ?? "ibp-media"
this.uploadsRootDir = process.env.ATTACHMENTS_UPLOAD_DIR ?? "/tmp/ibp-uploads"
if (this.objectStorageMode === "minio") {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT ?? "http://localhost:9000"
  ...
  this.s3Client = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } })
}
```

**Lazy bucket creation** (surveys-attachments.service.ts:148-167, `ensureS3Bucket`): move it as is and call it before put, presign, head and get.

**Presigned PUT** (surveys-attachments.service.ts:109-127). Add `ContentLength` (verified to be signed automatically, C-11):
```ts
const command = new PutObjectCommand({ Bucket: this.s3Bucket, Key: storageKey, ContentType: mimeType })
return getSignedUrl(this.s3Client, command, { expiresIn: 15 * 60 })
```

**Best-effort delete** (surveys-attachments.service.ts:129-146; the same code is duplicated at surveys.service.ts:1558-1575 and users.service.ts:400-416): S3 `DeleteObjectCommand(...).catch(() => undefined)`, or `rm(path, { force: true }).catch(() => undefined)`. Route the local branch through `resolveLocalPath`.

**Containment check** (surveys-attachments.service.ts:515-519). Generalize it into `resolveLocalPath(key)`:
```ts
const root = resolve(this.uploadsRootDir)
const filePath = resolve(root, attachment.storage_key)
if (filePath !== root && !filePath.startsWith(root + sep)) {
  throw new NotFoundException("Attachment content not found")
}
```
(On the write path, throw `BadRequestException("invalid storage key")`.)

**Download descriptor** (surveys-attachments.service.ts:455-479). Generalize into `presignGet(key)`. The attachment service keeps building the local `/content` URL, since it knows the survey and attachment ids:
```ts
if (this.objectStorageMode === "minio" && this.s3Client) {
  await this.ensureS3Bucket()
  const command = new GetObjectCommand({ Bucket: this.s3Bucket, Key: storageKey })
  const url = await getSignedUrl(this.s3Client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS })
  return { url, requires_auth: false }
}
return { url: `/surveys/${surveyId}/attachments/${attachmentId}/content`, requires_auth: true }
```

**Confirm with size check** (surveys-attachments.service.ts:280-308, the minio HEAD plus the local write). New `headObject(key)` returns `ContentLength | null`. The caller compares it with `size_bytes`; on mismatch it calls `deleteObject` and throws `UnprocessableEntityException` (already imported in `surveys.service.ts:6`). Local write: `mkdir(dirname(p), { recursive: true }); writeFile(p, buffer)`.

**New `getObject(key)`** for profile pictures (C-3). Minio: `GetObjectCommand` then `await res.Body?.transformToByteArray()` into a `Buffer`, returning `null` on `NoSuchKey`/`NotFound`. Local: `readFile(resolveLocalPath(key)).catch(() => null)` (pattern from users.service.ts:204-208 and surveys-attachments.service.ts:521).

**Key builder:** `buildAttachmentKey(surveyId, attachmentId, mime)` and `buildProfilePictureKey(userId, mime)`. Validate the segments (C-2), then use `extensionFromMime`.

---

### `api/src/storage/storage.module.ts` (new, module)

**Analog A, non-global with exports** (`api/src/auth/auth.module.ts:1-9`):
```ts
import { Module } from "@nestjs/common"
import { AuthGuard } from "./auth.guard"
import { Auth0ManagementService } from "./auth0-management.service"

@Module({
  providers: [AuthGuard, Auth0ManagementService],
  exports: [AuthGuard, Auth0ManagementService],
})
export class AuthModule {}
```
Consumers then add `imports: [AuthModule, StorageModule]` in `surveys.module.ts:13` and `users.module.ts:7`.

**Analog B, global** (`api/src/database/database.module.ts:1-9`, `@Global()` + registered once in `app.module.ts:17`).

Recommendation: analog A, so the dependency is explicit and only two consumers use it. `DebugModule` does not touch files. A NestJS singleton per module import is fine, because `StorageModule` is instantiated once.

**Injection style** (`surveys-sync.service.ts:34-39`): constructor `private readonly` params. The unit tests construct services directly (`new UsersService(db as never, auth0Management as never)` at `api/test/users.service.spec.ts:61`, and `new SurveysAttachmentsService(db as never)` at `api/test/surveys-attachments-download.spec.ts:64`). Append `storage` as the **last** constructor param and update both specs.

---

### `api/src/surveys/surveys-attachments.service.ts` (service)

- Delete :29-57 (config/S3), :104-167 (`buildUploadUrl`, `cleanupAttachmentStorage`, `ensureS3Bucket`), and the S3/fs imports. Delegate to `StorageService`.
- `createAttachment` (:169-243): keep the validation order (mime required, size integer, max 25 MB, `isAllowedMimeType`). The key comes from `storage.buildAttachmentKey`, and `uploadUrl` from `storage.presignPut(key, mime, body.size_bytes)`.
- `uploadAttachment` (:245-333): the minio branch at :280-295 becomes `head`, then compare with `existing.rows[0].size_bytes`, then delete and 422. The local branch at :296-308 goes through `storage.putObject`. Keep the transaction and event at :310-327 unchanged (`object_storage_mode` in the payload comes from `storage.mode`).
- Keep the private `insertEvent` (:90-102). With DEFAULTs (C-4) it needs no change.
- `getAttachmentContent` (:502-530): use `storage.getObject` / `resolveLocalPath`, and keep the minio → 404 rule (:509-511, documented in api-contract).

---

### `api/src/users/users.service.ts` (service, profile pictures)

- Delete :48-51, :57-77 (config/S3), :396-416 (`storagePathForKey`, `cleanupAttachmentStorage`) and the S3/fs/path imports (:2-4).
- `uploadProfilePicture` (:125-189): the MIME check becomes `isAllowedMimeType` (400), the key comes from `storage.buildProfilePictureKey(user.id, mime)`, and the write from `storage.putObject(key, file.buffer, mime)`. Old-key cleanup (:153-157) goes to `storage.deleteObject`. The DB update (:159-178) is unchanged.
- `getProfilePicture` (:191-214): `storage.getObject(key)`, where null means NotFound. See C-3 for D-06.
- `removeProfilePicture` (:216-254) and `deleteAccount` (:335-343): `storage.deleteObject`. The transaction ordering comment A-M9 (:276-278) must stay.

---

### `api/src/users/users.controller.ts` (controller, binary response)

Keep the `StreamableFile` passthrough (:269-278):
```ts
@Get("me/profile-picture")
async getProfilePicture(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
  const picture = await this.usersService.getProfilePicture(user)
  response.setHeader("Content-Type", picture.mimeType)
  response.setHeader("Cache-Control", "private, max-age=60")
  return new StreamableFile(picture.buffer)
}
```
Upload limits: `FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })` (:255-260). This works as is, because the buffer is handed to `storage.putObject`.

---

### `api/src/surveys/surveys.controller.ts` (controller, UUID params)

**Current param style** (e.g. :107-114):
```ts
@Get(":id/attachments/:attachmentId/download-url")
async getAttachmentDownloadUrl(
  @CurrentUser() user: AuthenticatedUser,
  @Param("id") id: string,
  @Param("attachmentId") attachmentId: string,
) {
```
Change it to `@Param("id", new ParseUUIDPipe()) id: string` / `@Param("attachmentId", new ParseUUIDPipe())`. The routes using `:id` are at lines 58, 63, 72, 81, 86, 92, 102, 107, 116, 129, 148 and 158. Nothing in the repo uses `ParseUUIDPipe` yet; it is exported from `@nestjs/common`. If strict UUID is not chosen (C-2), write a small custom pipe with a shared regex constant, placed next to `dtos/parcel-id.constants.ts` (analog `PARCEL_ID_PATTERN`, used via `@Matches` at `survey-upsert.dto.ts:35-44`).

Global validation setup (`configureApp`) lives in `api/src/app.setup.ts`. Pipes on params give 400 through Nest's default exception filter.

---

### `api/src/common/file.utils.ts` (utility)

Current bug (:16-18):
```ts
export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() in ALLOWED_MIME_TYPES
}
```
Fix: `Object.hasOwn(ALLOWED_MIME_TYPES, mimeType.trim().toLowerCase())`. **Verified: `api/tsconfig.json:9` has `"target": "es2021"` and no `lib`, so `Object.hasOwn` does NOT typecheck today.** Either add `"lib": ["es2022"]` to `api/tsconfig.json` (Node 20 supports it at runtime), or use `Object.prototype.hasOwnProperty.call(...)`, the form already used at `surveys-normalize.utils.ts:37,115`. It is the same own-property semantics and satisfies D-09's intent. `extensionFromMime` (:9-14) indexes the object directly; add the same own-property guard there, because `ALLOWED_MIME_TYPES["constructor"]` is a truthy function.

---

### `.github/workflows/ci.yml` (CI, MinIO E2E pass)

**Analog:** the e2e job (:178-262). Postgres service (:185-198):
```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: ibp_test
      POSTGRES_USER: ibp
      POSTGRES_PASSWORD: ibp
    options: >-
      --health-cmd pg_isready
      --health-interval 2s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
```
Job-level env (:200-221) includes `OBJECT_STORAGE_MODE: local`, `OBJECT_STORAGE_BUCKET: ibp-media`, `ATTACHMENTS_UPLOAD_DIR: /tmp/ibp-uploads`. Steps: `E2E run 1` (:246-247), sentinel (:249-250), `E2E run 2` (:252-253), assert (:255-262).

**Pattern for the MinIO pass:** the existing `run 1`/`run 2` steps already show that the suite can run twice in one job with a DB reset. Add, after the sentinel assert:
1. A `docker run -d … quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z server /data` step, with a health wait loop (see C-9; `services:` cannot pass `server /data`).
2. `- name: E2E run 3 (MinIO mode)` with a step-level `env:` override: `OBJECT_STORAGE_MODE: minio`, `OBJECT_STORAGE_ENDPOINT: http://localhost:9000`, `OBJECT_STORAGE_ACCESS_KEY: minio`, `OBJECT_STORAGE_SECRET_KEY: minio123`, `OBJECT_STORAGE_REGION: us-east-1`.

Pin actions by SHA, as the other steps do. Check `timeout-minutes: 20` (:181) against a third full run, or run only the storage-related specs in MinIO mode (`npx jest --runInBand --config jest.config.js attachments auth-profile …` from `api/`). The job is gated by `needs.changes.outputs.api/shared` (:182-183).

---

### `api/test/sync-changes-ordering.e2e-spec.ts` (new, E2E, concurrency)

**Bootstrap analog** (`api/test/database-transaction.e2e-spec.ts:1-40`):
```ts
import "dotenv/config"
import { randomUUID } from "crypto"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
...
const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile()
app = moduleFixture.createNestApplication<NestExpressApplication>()
configureApp(app)
db = moduleFixture.get(DatabaseService)
await app.init()
```

**Login plus a survey to hang events on** (database-transaction.e2e-spec.ts:66-87): `POST /v1/debug/test-token { email }` gives `access_token`, then `POST /v1/surveys`.

**Two out-of-order transactions:** no existing spec opens manual transactions. Use `DatabaseService.connect()` (`api/src/database/database.service.ts:32-34`, which returns a `PoolClient`) twice. Reproduce the C-1 sequence exactly: A `BEGIN` + `SELECT pg_current_xact_id()` (early xid). B `BEGIN` + `SELECT pg_current_xact_id()`. B inserts the event (lower seq). A inserts the event (higher seq) and commits. Poll `/v1/sync/changes` and assert B's event is **absent** and the cursor did not pass it. Commit B, poll with the returned cursor, and assert B's event is present. Release the clients in `finally`. Insert statement shape: database-transaction.e2e-spec.ts:100-103.

Assertion style for the feed: `surveys-idempotency.e2e-spec.ts:1522-1546` (`event_type` list, `cursor_out` string and changed).

**Fault injection helper**, if needed for rollback cases: `api/test/e2e-fault-injection.ts:25-67` (`installEventInsertFailure(db, { surveyId, eventType })` / `removeEventInsertFailures(db)`, with `SAFE_VALUE_PATTERN` `^[A-Za-z0-9_.:-]+$`, which UUIDs pass). Clean up in `afterEach` (database-transaction.e2e-spec.ts:31-33).

---

### `api/test/surveys-idempotency.e2e-spec.ts` (E2E, extend and trim)

- The same-version replay test to extend is at :48-92 ("accepts same id+sync_version replay and rejects older sync_version"). Add a case with the same version and a different `site_name`/`factors` that returns 409 `sync_version_conflict`, and keep the identical replay returning 201/`synced`.
- `/sync` conflict result shape: :1402-1466 ("returns sync_version_conflict details in POST /v1/sync result").
- Feed test: :1467-1548 keeps working unchanged. It only treats `cursor_out` as an opaque string.
- Remove or invert :1549-1693 (C-7), and fix the size fixtures (C-8).

### `api/test/sync-installed-app-compat.e2e-spec.ts` (E2E, legacy cursor)

Header comment convention (:9-16) describes which mobile code the payloads mirror. Pull pattern (:259-266):
```ts
const changes = await request(app.getHttpServer())
  .get("/v1/sync/changes")
  .set("Authorization", `Bearer ${accessToken}`)
  .expect(200)
```
Legacy-cursor case: build `` `${createdAtText}|${eventId}` `` from `SELECT created_at::text, id FROM survey_events …` (the query style at :236-242). Also build a **survey-derived** legacy cursor (C-6). Assert that the result has no skip and no full resend, and that `cursor_out` is in the new format.

### Storage E2E: `attachments-download.e2e-spec.ts` / new `attachments-upload-size.e2e-spec.ts`, and `auth-profile.e2e-spec.ts`

**Mode branch to copy** (`attachments-download.e2e-spec.ts:60-91`):
```ts
const uploadUrl = created.body.upload_url as string
if (uploadUrl.startsWith("http")) {
  const presignedUpload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: JPEG_BYTES,
  })
  ...
  await request(app.getHttpServer())
    .put(`/v1${created.body.confirm_url as string}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200)
} else {
  await request(app.getHttpServer())
    .put(`/v1${uploadUrl}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" })
    .expect(200)
}
```

Size mismatch in MinIO mode: declare N and PUT N+k bytes. Node `fetch` sets Content-Length from the Buffer, so expect a 403 from MinIO if the signed length holds. Then PUT exactly the declared length of *different* content is fine. The mismatch case for 422 needs an object of the wrong size to exist, which is only possible if presign enforcement fails. The robust test is to put the object directly with the S3 client from the spec (`new S3Client` with the env config), then confirm and expect 422, and check the object was deleted (HEAD gives 404). Skip MinIO-only cases in local mode with a guard such as `const itMinio = process.env.OBJECT_STORAGE_MODE === "minio" ? it : it.skip`.

Profile-picture round trip: extend `auth-profile.e2e-spec.ts:47-87` (upload, GET 200 `image/*`, DELETE 204, GET 404). It works in both modes once the service is on StorageService. In MinIO mode, add an assertion that the object exists in the bucket (HEAD via S3 client) and that nothing was written under `ATTACHMENTS_UPLOAD_DIR`.

---

### `api/test/storage.service.spec.ts` (new unit)

**Analog:** `api/test/surveys-attachments-download.spec.ts:1-76`.
```ts
jest.mock("fs/promises", () => {
  const actual = jest.requireActual("fs/promises")
  return { ...actual, readFile: jest.fn() }
})
jest.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: jest.fn() }))
const mockS3Send = jest.fn().mockResolvedValue({})
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3")
  return { ...actual, S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })) }
})

function buildService(objectStorageMode: "local" | "minio") {
  const previousMode = process.env.OBJECT_STORAGE_MODE
  process.env.OBJECT_STORAGE_MODE = objectStorageMode
  process.env.ATTACHMENTS_UPLOAD_DIR = "/tmp/ibp-uploads-test"
  const service = new StorageService()
  process.env.OBJECT_STORAGE_MODE = previousMode
  return { service }
}
```
Cases:
- `resolveLocalPath("../../etc/passwd")` throws; `surveys/<uuid>/<uuid>.jpg` resolves under the root.
- The key builder rejects a `../x` survey id.
- `isAllowedMimeType("constructor")`, `("__proto__")` and `("toString")` return false; `extensionFromMime("constructor")` throws.
- `presignPut` passes `ContentLength` (inspect `mockGetSignedUrl.mock.calls[0][1].input.ContentLength`).
- On a size mismatch, `send` gets `DeleteObjectCommand`.

**users.service.spec.ts** (:1-66) and **surveys-attachments-download.spec.ts** (:58-68): pass a mocked `storage` object as the new last constructor arg, `{ putObject: jest.fn(), getObject: jest.fn(), deleteObject: jest.fn(), … }`. The `jest.mock("fs/promises")` in users.service.spec.ts:5 can then go if nothing else uses fs.

---

### Docs

- `docs/technical/sync-conflict-resolution-v1.md:27-29`: Case B currently reads "same `id`, same `sync_version` → `synced` (idempotent replay)". Split it into B1 (identical content, `synced`) and B2 (different content, `fatal_error` / `sync_version_conflict` 409, with the client keeping its local data). Also add a changes-feed section: snapshot rule, `(xid8, seq)` ordering, legacy cursor accepted, and the cluster-wide xmin delay note (C-11).
- `docs/technical/api-contract-v1.md:709-723`: the `GET /sync/changes` cursor is documented as `{timestamp}|{event_id}`. Replace it with an opaque `v2:…` format, note that the legacy form is still accepted, and update the example `cursor_in`/`cursor_out`. Line 707 has the phrasing style to copy for the same-version rule in `/sync`.
- `docs/technical/api-contract-v1.md:480-497` (attachment create rules): add "the presigned PUT signs `Content-Length = size_bytes`; the confirm call returns `422` and deletes the object on a size mismatch". `:150-182` (profile picture): stored in object storage; the GET still streams via the API with Bearer auth.
- `docs/technical/data-contract-v1.md:30`: `profile_picture_storage_key` is commented as "local storage key". Change it to "object storage key". Add the `survey_events.seq`/`xid8` columns if the survey_events section exists. No section was found by grep, so add a short one.

---

## Shared Patterns

### Transactions and events
**Source:** `api/src/database/database.service.ts:40-57`
```ts
async transaction<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await this.pool.connect()
  const adapter: Queryable = { query: (text, values) => client.query(text, values) }
  try {
    await client.query("BEGIN")
    const result = await fn(adapter)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
```
**Apply to:** every mutation. Events are inserted inside the transaction, and storage cleanup runs **after** commit, best-effort (`surveys.service.ts:1026-1030`, comment "D-07: object-storage cleanup is best-effort and runs only after commit").

### Ownership before storage
**Source:** `surveys-attachments.service.ts:59-88` (`getSurveyForUserOrThrow`, `WHERE id = $1 AND user_id = $2 … FOR UPDATE`).
**Apply to:** every StorageService caller. StorageService does not authorize.

### Error shapes
- 409 with code: `ConflictException({ code, message, details })` (`surveys.service.ts:306-316`; `surveys-attachments.service.ts:446-449`).
- 422: `UnprocessableEntityException({ code?, message, errors? })` (`surveys.service.ts:196-201`).
- 400: `BadRequestException("…")` plain strings (`surveys-attachments.service.ts:179-193`).
- Sync mapping: `mapSyncError` in `api/src/surveys/sync-error.utils.ts`. 409 and 422 map to `fatal_error`, with no change needed.

### Env reads (pre-01.7)
Plain `process.env.X ?? default` in the constructor (`surveys-attachments.service.ts:36-45`). No new env vars in this phase; use code constants (CONTEXT, Claude's Discretion).

### Code style
Prettier: double quotes, no semicolons, trailing commas, 100 columns. Comments cite decision IDs (`// D-07: …`, `// T-01.4-11`), as throughout `surveys.service.ts`.

---

## No Analog Found

| File / Concern | Role | Reason | Use instead |
|---|---|---|---|
| Migration backfill verification (C-10) | test | E2E resets to an empty schema before migrating; nothing tests migration SQL against data | Seed rows in a spec and execute the backfill statements (or a SQL function) directly; verified SQL in C-5 |
| CI MinIO container | CI | No non-Postgres service in CI; `services:` cannot pass `server /data` | `docker run` step (C-9) |
| Manual two-connection transaction test | test | No spec opens raw `PoolClient` transactions yet | `DatabaseService.connect()` + the C-1 sequence |

---

## Verification performed (read-only on repo; local PG started with `service postgresql start`)

- PostgreSQL 16.13 local: `pg_current_xact_id()` returns type `xid8`; `'123'::xid8 < pg_snapshot_xmin(pg_current_snapshot())` works.
- `pg` driver (repo `node_modules/pg`): `xid8` and `bigint` come back as JS **strings**, and binding a string with `$1::xid8` works. The row comparison `(xid8, seq) > ($1::xid8, $2::bigint)` works.
- The C-5 backfill runs in one transaction on PG16, and the order matches `(created_at, id)`.
- Skip reproduction for a seq-only cursor under the D-02 filter (C-1): **confirmed skip**. `(xid8, seq)` ordering places the late event after the cursor.
- `@aws-sdk/client-s3`/`s3-request-presigner` 3.1004.0: `ContentLength` on `PutObjectCommand` gives `X-Amz-SignedHeaders=content-length;host`.
- Mobile cursor handling (`mobile/src/storage/sync.ts:1126-1166`, `mobile/src/storage/utils.ts:351-357`) is opaque: the cursor is URL-encoded, stored and replayed, never parsed. The mobile save path bumps `sync_version` on every edit (`mobile/src/storage/surveys.ts:357`), so D-04 does not affect normal single-device editing.

## Metadata

**Analog search scope:** `api/src/**`, `api/migrations/`, `api/scripts/`, `api/test/`, `.github/workflows/ci.yml`, `infra/`, `docs/technical/`, `mobile/src/storage/`, `mobile/src/screens/AccountScreen.tsx`
**Files scanned:** ~45
**Pattern extraction date:** 2026-09-25
