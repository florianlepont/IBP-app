# Sync Conflict Resolution V1 (Step 15 Preparation)

## Status
In progress (API + mobile baseline implemented)

## Goal
Define a robust conflict and retry strategy for offline-first synchronization, so the mobile queue can recover safely from network and business errors.

## Scope
- Conflict policy for `survey.upsert` and attachment lifecycle operations.
- Retry policy and terminal failure policy in mobile queue processing.
- User-visible diagnostics for actionable sync failures.
- Test plan for deterministic conflict scenarios.

## Non-goals (Step 15)
- Full collaborative editing (real-time multi-user merges).
- CRDT/event sourcing conflict model.
- Admin moderation workflows.

## Conflict Policy (Canonical)

### Survey upsert (`entity=survey`, `action=upsert`)
- Case A: same `id`, lower `sync_version` than server.
  - Server result: `fatal_error`
  - Error code: `sync_version_conflict`
  - Client action: stop retry, mark local survey `failed`, keep payload for manual resolution.
- Case B: same `id`, same `sync_version` as the server. The server compares the payload with the stored survey by value (not by hashing raw JSON: JSONB reorders object keys). The compared read-only fields are `site_name`, `parcel_id`, `parcel_ids` (as a set, trimmed and upper-cased), `observation_year`, `version_number`, `previous_survey_id`, `region_version`, `vegetation_stage` and `factors`; `visibility` is compared separately. `scores`, `status` and `expires_at` are excluded, and a field that is absent or `null` in the payload never counts as a change. The rule applies to `POST /v1/surveys` and to `survey.upsert` in `POST /v1/sync`.
  - Case B1: identical read-only fields and visibility.
    - Server result: `synced` (idempotent replay, nothing written; `updated_at` is the stored one).
    - Client action: mark queue item synced.
  - Case B2: only `visibility` differs.
    - Server result: the new visibility is applied last-writer-wins, exactly like the version-less `visibility_update` action (`visibility`, `updated_at`, one `visibility_changed` event), and the operation is answered `synced`. `sync_version` is unchanged. On a soft-deleted survey nothing is written and the answer is still `synced`.
    - Why: installed apps rewrite a pending upsert's visibility without bumping `sync_version`, so a retry after a lost response must not be blocked.
    - Client action: mark queue item synced.
  - Case B3: any compared read-only field differs (with or without a visibility change).
    - Server result: `fatal_error`, HTTP `409`, error code `sync_version_conflict`, message `Same sync_version with different content`, with `survey_id`, `server_sync_version` and `client_sync_version` in `details`. Nothing is written.
    - Client action: stop retry, mark local survey `failed`, keep the local data for manual resolution (same handling as Case A).
    - This check runs before the submitted-survey read-only check, so a same-version resend of a submitted survey with a changed read-only field also gets `sync_version_conflict` (at a higher `sync_version` it gets `survey_submitted_read_only`).
    - Two concurrent upserts at the same new `sync_version` with different content produce one `synced` result and one `409 sync_version_conflict`; the winner's content is stored with one `updated` event. The loser is never silently overwritten or silently dropped.
- Case C: same `id`, higher `sync_version`.
  - Server result: `synced` if validation passes.
- Case D: validation/business failure (`422`).
  - Server result: `fatal_error`.
  - Client action: stop retry and surface clear message.

### Attachment create/upload
- `attachment.create` validation errors (`400/422`) are `fatal_error`.
- Upload errors:
  - `5xx`, `429`, network timeout -> retryable.
  - `400/401/403/404` -> fatal by default.
- Confirm URL failure after successful binary upload:
  - retryable for `5xx/429`, fatal for `4xx`.
- Declared size mismatch: the presigned PUT signs `Content-Length = size_bytes`, so MinIO/S3 refuses a body of another length (`403`, fatal). If the stored object's size still differs from `size_bytes` at confirm time (or the local-mode multipart body differs), the API answers `422 attachment_size_mismatch`, deletes the object (or never writes it) and leaves the attachment unconfirmed. This is fatal: the client must re-create the attachment with the real size.

### Deterministic database errors
- PostgreSQL SQLSTATE classes `22` (data exception) and `23` (integrity constraint violation) are always `fatal_error` and never retried — retrying a deterministic constraint or type violation can never succeed, and retrying would only produce a retry storm.
- The client-facing error uses a fixed generic code (`invalid_operation`) and message; the raw database message (constraint names, values, SQL) is never returned to the client, only logged server-side.

## Changes Feed Ordering (`GET /v1/sync/changes`)

The changes feed must never skip an event, even when transactions commit out of order.

### Position columns
- Migration `014_survey_events_seq_xid8.sql` adds two columns to `survey_events`:
  - `seq`: `BIGINT` identity, backfilled for existing rows in `(created_at, id)` order.
  - `xid8`: `xid8 NOT NULL DEFAULT pg_current_xact_id()`, the id of the transaction that wrote the event.
- A unique index on `(xid8, seq)` serves the feed. Both values come from column defaults, so no insert site names them.

### Snapshot rule
- The feed returns only events with `xid8 < pg_snapshot_xmin(pg_current_snapshot())`, ordered and paged by `(xid8, seq)`.
- `pg_snapshot_xmin` is the oldest transaction still running. Every event below it was written by a finished transaction, so it is visible now and stays visible.
- Any event that becomes visible later belongs to a transaction at or above that minimum, so its `xid8` sorts after everything already returned. Paging on `(xid8, seq)` therefore cannot skip it.
- Paging on `seq` alone (or on `created_at`) would skip events: a transaction that took its id early can insert a higher `seq` and commit after a later transaction's events were already served. An E2E test (`api/test/sync-changes-ordering.e2e-spec.ts`) reproduces this with two real transactions.
- A rolled-back transaction leaves no gap to wait for: its events never exist.

### Cluster-wide delay
- The snapshot minimum is cluster-wide. A long-running or idle-in-transaction writing session in any database on the same PostgreSQL cluster holds the minimum back.
- While it is open, the feed withholds newer events. It delays them; it never skips them. Once the transaction ends, the feed catches up in order.
- Read-only transactions do not count, because they never get a transaction id.

### Cursor
- The cursor is opaque: `v2:<xid8>:<seq>`. Clients store `cursor_out` and replay it verbatim; they never parse it. `xid8` and `seq` are kept as strings end to end (they can exceed JavaScript's safe integer range).
- Legacy cursors `<created_at>|<id>` (emitted before migration 014; the id is an event id or, from the removed fallback, a survey id) are still accepted. The server resumes after the user's last event with `(created_at, id) <= cursor`, or from the beginning if there is none. When nothing new is available it returns the translated `v2:` cursor, so installed apps switch format on their own.
- A malformed cursor, or a `v2:` cursor whose values are out of range (`xid8` above 2^64-1 or `seq` above 2^63-1), gets `400 Invalid sync cursor`.
- Future-cursor guard: a `v2:` cursor whose `xid8 >= pg_snapshot_xmax(pg_current_snapshot())` cannot come from this cluster's history. The feed restarts from the beginning for that request and logs a warning with the user id (never the cursor).

### Removed fallback
- Before phase 01.6, when a user had no newer event the feed re-sent surveys that had no event at all, on every poll. That fallback is removed.
- Migration 014 inserted one synthetic `backfilled` event (`actor_id` NULL, payload `{"reason":"migration_014"}`) per owned survey that had none, so those surveys reach other devices exactly once.

### Database restore
- `xid8` values are transaction ids of the cluster that wrote them.
- A logical dump restored into a new cluster (`pg_dump`/`pg_restore`, a new VPS, a major-version upgrade by dump) starts with a lower transaction counter. The restored rows then carry `xid8` values in the future: `xid8 < pg_snapshot_xmin` stays false for them, and the feed would withhold every restored event.
- Procedure after any logical restore, before starting the API, in one transaction:

```sql
UPDATE survey_events SET xid8 = pg_current_xact_id();
```

- All rows then share the restore transaction's id and keep their relative `seq` order.
- Cursors held by installed apps now point in the future; the future-cursor guard restarts their feed from the beginning.
- A physical copy of the data directory (same cluster, volume move) is not affected.
- Operator steps for the VPS: `infra/vps/README.md`, "Restoring the database".

## Retry Policy (Mobile)
- Exponential backoff already exists and stays default.
- Add hard retry cap:
  - queue item becomes terminal after `retry_count >= 8`.
  - terminal reason stored in `last_sync_error`.
- Distinguish statuses in queue processing:
  - `retryable_error`: keep in queue with `next_retry_at`.
  - `fatal_error`: remove queue item, mark local entity failed.

## UX Rules (Mobile)
- Show explicit sync diagnostics per survey/attachment:
  - error code
  - last error message
  - retry count
- Add two actions:
  - `Retry now` (reset `next_retry_at` to now for selected entity).
  - `Discard local change` (delete queued operation for selected entity).
- If a survey has fatal conflict, block automatic submit until user resolves or discards local change.

## API Contract Additions (Step 15)
- Keep `POST /v1/sync` shape unchanged.
- Standardize error payload in operation result:
```json
{
  "status": "fatal_error",
  "error": {
    "code": "sync_version_conflict",
    "message": "Older sync_version received",
    "http_status": 409,
    "details": {
      "survey_id": "survey-123",
      "server_sync_version": 7,
      "client_sync_version": 6
    }
  }
}
```
- For retryable failures, return stable code:
  - `transient_upstream_error`
  - `rate_limited`
  - `network_gateway_error`

## Data Contract Additions (Step 15)
- Local survey and local attachment diagnostics:
  - `last_sync_error_code` (nullable string)
  - `last_sync_error_at` (nullable timestamp)
- Optional queue extension:
  - `terminal_at` (nullable timestamp)
  - `terminal_reason` (nullable string)

## Implementation Plan

### API
1. Add normalized sync error mapper with `code` and `details`.
2. Include server/client version details for `409` conflicts.
3. Add e2e coverage for explicit conflict and retryable mapping.

### Mobile
1. Extend local schema with conflict diagnostics fields.
2. Update sync processor to persist `error_code` and terminal metadata.
3. Add UI controls: `Retry now` and `Discard local change`.
4. Prevent submit for surveys flagged with unresolved fatal sync error.

### Tests
1. API e2e:
  - older `sync_version` returns `fatal_error` + conflict details.
  - forced transient failure returns `retryable_error`.
2. Mobile integration:
  - retry counter increments then terminal state at cap.
  - retry now resets timer and retries successfully.
  - discard removes queue row and clears blocking state.

## Definition of Done
- Conflict errors are explicit and actionable (`code`, `message`, `details`).
- Mobile differentiates retryable vs fatal in both data and UI.
- Retry cap prevents infinite loops.
- Tests cover conflict and retry behavior end-to-end.

## Manual Validation Checklist
- Create a survey, sync once, then replay older `sync_version`: see fatal conflict with version details.
- Force API temporary failure: item remains queued with increased retry count.
- Trigger retry cap: item stops auto-retrying and shows terminal state.
- Use `Retry now`: item is retried immediately.
- Use `Discard local change`: item is removed from queue and no longer blocks submit.
