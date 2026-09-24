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
- Case B: same `id`, same `sync_version`.
  - Server result: `synced` (idempotent replay).
  - Client action: mark queue item synced.
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

### Deterministic database errors
- PostgreSQL SQLSTATE classes `22` (data exception) and `23` (integrity constraint violation) are always `fatal_error` and never retried — retrying a deterministic constraint or type violation can never succeed, and retrying would only produce a retry storm.
- The client-facing error uses a fixed generic code (`invalid_operation`) and message; the raw database message (constraint names, values, SQL) is never returned to the client, only logged server-side.

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
