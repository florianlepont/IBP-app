# IBP App Monorepo (V1 Scaffold)

This repository is scaffolded for:
- `mobile/`: Expo + React Native + TypeScript app
- `api/`: NestJS API
- `infra/`: local PostgreSQL + MinIO via Docker Compose
- `specifications/`: product and technical specs

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop

## Setup
```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose -f infra/docker-compose.yml up -d
```

## Run
Terminal 1:
```bash
npm run dev:api:migrated
```

Terminal 2:
```bash
npm run dev:mobile
```

## First end-to-end check
- API: open `http://localhost:3000/v1/health`
- Mobile: tap **Check API /health** in the app

## Step 3 Vertical Slice (Current)
Implemented:
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/surveys`
- `POST /v1/surveys` (idempotent on `id + sync_version`)
- Mobile local SQLite drafts + sync queue

Manual test flow:
1. Start Postgres/MinIO: `docker compose -f infra/docker-compose.yml up -d`
2. Start API: `npm run dev:api`
3. Start mobile: `npm run dev:mobile -- --clear`
4. In app:
   - Login
   - Create offline draft
   - Sync pending drafts
5. Confirm survey persisted in API DB (`surveys` table) and local item becomes `synced`.

## Step 4 Hardening (Current)
Implemented:
- API auth hardened with JWT (`access` + `refresh`) and password hashing (`bcrypt`)
- SQL migrations system (`api/migrations`, `api/scripts/migrate.js`)
- User profile partial update endpoint: `PATCH /v1/me`
- Survey workflow endpoints:
  - `PATCH /v1/surveys/:id`
  - `POST /v1/surveys/:id/submit`
  - `GET /v1/surveys/:id/events`
- Mobile sync improvements:
  - retry backoff for transient failures
  - terminal handling for `409`/`422`
  - local `last_sync_error` persisted for diagnostics

## Step 5 IBP Business Rules (Current)
Implemented:
- Server-side IBP factor validation for A..J
- Allowed score sets enforced:
  - A..H: `0|1|2|5`
  - I,J: `0|2|5`
- Server-side score computation:
  - `ibp_peuplement_gestion = A+B+C+D+E+F+G`
  - `ibp_contexte = H+I+J`
  - `ibp_total = ibp_peuplement_gestion + ibp_contexte`
- Submit is blocked with `422` if required IBP fields are missing/invalid
- Mobile form now captures `region_version`, `vegetation_stage`, and A..J factor scores

## Step 6.2 Observation Inputs + Contextual Help (Current)
Implemented:
- Mobile now captures observation-oriented inputs for all factors A..J (instead of score-only fields)
- Contextual help toggles are available for each factor section in the mobile form
- Backend IBP rule engine supports raw observation objects per factor and computes scores server-side
- Backward compatibility kept for direct numeric factor scores during transition

## Step 7 Validation Matrix + Non-Blocking Warnings (Current)
Implemented:
- Validation result now distinguishes:
  - blocking errors (`errors`)
  - non-blocking warnings (`warnings`)
  - structured issue entries (`issues`)
- Added non-blocking consistency warnings (cross-factor checks) and F-group capping warning
- Added region compatibility special case: `montagnard_mediterraneen` uses ACA thresholds
- Added e2e test for full raw A..J payload with exact expected score computation

## Step 8 Canonical Factor Model + Detail Endpoint (Current)
Implemented:
- Survey persistence now stores canonical IBP factor outputs in `surveys.factor_results` (JSONB)
- New migration: `002_factor_results.sql`
- `POST /v1/surveys` and `POST /v1/surveys/:id/submit` now persist canonical factor results
- New endpoint: `GET /v1/surveys/:id` returns full survey payload including:
  - `factors` (raw observation payload)
  - `factor_results` (canonical normalized model)
  - `scores` (computed IBP aggregates)
- Added e2e coverage to assert canonical factor results are returned by detail endpoint

## Step 9 IBP Validation Matrix + Unit Test Harness (Current)
Implemented:
- Dedicated unit test suite for IBP rule engine (`api/test/ibp-rules.spec.ts`)
- New API script: `npm --workspace api run test:unit`
- Separate Jest config for unit tests: `api/jest.unit.config.js`
- Reference validation matrix documented in:
  - `specifications/technical/ibp-validation-matrix-v1.md`
- Coverage includes:
  - per-factor normalization A..J
  - canonical class mapping and score points
  - non-blocking warnings (`factor_f_group_capped`, consistency checks)
  - submit-time blocking checks and aggregate score validation

## Step 10 Attachments API Baseline (Current)
Implemented:
- New DB migration: `api/migrations/003_attachments.sql` (`attachments` table + indexes)
- New endpoints:
  - `POST /v1/surveys/:id/attachments`
  - `DELETE /v1/surveys/:id/attachments/:attachmentId`
- Attachment creation validates `mime_type` and `size_bytes` (25MB max in V1)
- API returns `attachment_id`, `storage_key`, and a generated upload target URL
- Attachment deletion is soft-delete (`deleted_at`)
- Audit trail records:
  - `attachment_created`
  - `attachment_deleted`
- e2e coverage added for full create/delete attachment flow

## Step 11 Mobile Attachment Queue + Upload Target Consumption (Current)
Implemented:
- New API migration: `api/migrations/004_attachment_upload_tracking.sql`
  - `attachments.upload_token`
  - `attachments.uploaded_at`
- New API endpoint:
  - `PUT /v1/surveys/:id/attachments/:attachmentId/upload?token=...`
- `POST /v1/surveys/:id/attachments` now returns:
  - `upload_url` (binary upload target)
  - `confirm_url` (server acknowledgment endpoint)
- Mobile:
  - Added image picker (`expo-image-picker`)
  - Added local attachment table (`local_attachments`) in SQLite
  - Added attachment queue payload type (`kind: attachment_upload`)
  - Added per-survey UI action: `Attach photo (queue)`
  - Sync engine now processes two operation types:
    - survey upsert
    - attachment create + upload target call
- Added sync-state visibility for local attachments (`pending/synced/failed`) in UI

## Step 12 Real File Upload + Attachment Detail Visibility (Current)
Implemented:
- Added object storage modes:
  - `OBJECT_STORAGE_MODE=local`: upload through API (`multipart/form-data`) and local disk persistence
  - `OBJECT_STORAGE_MODE=minio`: presigned `PUT` upload URL generated for MinIO, then confirmation call
- MinIO setup env (API): `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`, `OBJECT_STORAGE_BUCKET`
- API confirmation endpoint:
  - `PUT /v1/surveys/:id/attachments/:attachmentId/upload?token=...`
- Local mode persistence path:
  - `ATTACHMENTS_UPLOAD_DIR` (default `/tmp/ibp-uploads`)
- Added attachment listing endpoint:
  - `GET /v1/surveys/:id/attachments`
- Attachment delete now removes stored file/object (best-effort)
- Mobile sync uploads actual selected image file (API mode or direct presigned mode)
- Mobile survey list now shows local attachment thumbnails and sync states
- e2e attachment flow now validates:
  - create attachment
  - binary upload call
  - list attachments
  - delete + post-delete list check

## Step 13 Batch Sync Endpoint (Current)
Implemented:
- New endpoint: `POST /v1/sync`
- Supports mixed operations in one request (V1):
  - `survey.upsert`
  - `attachment.create`
- Returns per-operation results with stable `client_ref`:
  - `synced`
  - `retryable_error`
  - `fatal_error`
- Keeps operation order deterministic in the response
- Mobile sync now sends due queue rows as a single batch request

## Step 14 Incremental Downsync (Current)
Implemented:
- New endpoint: `GET /v1/sync/changes?cursor=&limit=`
- Cursor-based incremental feed of user-scoped changes:
  - `events`
  - changed `surveys`
  - changed `attachments`
- Cursor format includes event timestamp + event id for deterministic pagination
- Mobile:
  - added `local_meta` table to persist `downsync_cursor`
  - added pull function that applies server deltas in pages
  - integrated pull after push sync
  - added manual UI action: **Pull server changes**
- e2e coverage added for:
  - mixed batch sync success/failure
  - incremental changes with cursor progression

## Step 15 Conflict Resolution + Robust Recovery (Current)
Implemented:
- API `/v1/sync` error mapping now returns normalized `error.code` and optional `error.details`
- `sync_version_conflict` now includes:
  - `survey_id`
  - `server_sync_version`
  - `client_sync_version`
- Mobile local diagnostics added:
  - `last_sync_error_code`
  - `last_sync_error_at`
  - `sync_blocked` (survey-level)
- Mobile retry policy hardened:
  - hard retry cap (`8`) before terminal failure
- New mobile conflict actions:
  - `Retry now`
  - `Discard local change`
- Submit guard: blocked if unresolved survey sync conflict is present
- Added e2e coverage for explicit `sync_version_conflict` payload in `/v1/sync`

Reference spec:
- `specifications/technical/sync-conflict-resolution-v1.md`

## Step 16 Survey Deletion End-to-End (Current)
Implemented:
- API survey deletion endpoint:
  - `DELETE /v1/surveys/:id` (soft delete, idempotent `204`)
- Sync batch supports survey deletion:
  - `entity=survey`, `action=delete`
- Deleting a survey now:
  - sets `surveys.deleted_at`
  - marks linked attachments deleted
  - emits `deleted` audit event
- Mobile:
  - per-survey action: `Delete survey` (confirmation dialog)
  - local purge + queued remote delete operation for offline-first behavior
- Downsync:
  - deleted surveys purge local surveys, attachments, and pending queue rows
- e2e coverage:
  - direct delete endpoint behavior
  - survey delete operation via `/v1/sync`
