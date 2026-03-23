# Publication Visibility & Post-Submit Management (V1)

## Status
Draft for implementation planning (2026-03-09)

## Goal
Make survey publication operational without reopening scientific observations after submit.

## Scope
- Private/public toggle as a first-class API operation.
- Post-submit edit policy (what remains editable vs read-only).
- Audit and public-surface consistency expectations.
- Test matrix for backend and mobile flows.

## Business Rules (V1)
1. Default visibility is `private`.
2. `draft` surveys may edit observation fields and visibility.
3. `submitted` surveys are observation read-only:
   - not editable: `site_name`, `parcel_ids`, `region_version`, `vegetation_stage`, `factors`, `scores`.
   - editable: `visibility` only.
4. Any visibility change must produce a `visibility_changed` event with `{ from, to }`.
5. Public surfaces must never expose:
   - `private` surveys,
   - deleted surveys.
6. Recommended publishability gate for map/read models: include only `submitted` + `public`.

## API Contract Delta (V1)
- Dedicated endpoint: `PATCH /surveys/{id}/visibility`
  - request: `{ "visibility": "private" | "public" }`
  - response: `{ id, visibility, updated_at }`
- Existing endpoint `PATCH /surveys/{id}` remains for generic updates in `draft`.
- For `submitted`, generic patch of non-visibility fields must return `422` (`submitted_read_only_fields`).

## Error Policy
- `401` not authenticated
- `403` not owner / unauthorized role
- `404` survey not found
- `422` invalid business transition / forbidden post-submit field edit

## Audit Events
- `visibility_changed`
  - payload: `{ "from": "private", "to": "public" }`
  - actor: authenticated user id
  - timestamp: server generated

## Test Matrix

### Backend (API/e2e)
1. Draft survey: `PATCH /surveys/{id}/visibility` `private -> public` returns `200`.
2. Submitted survey: `PATCH /surveys/{id}/visibility` `private -> public` returns `200`.
3. Submitted survey: `PATCH /surveys/{id}` with `factors` returns `422` (`submitted_read_only_fields`).
4. Visibility toggle writes `visibility_changed` event in `/surveys/{id}/events`.
5. Public map list includes `submitted+public` and excludes `submitted+private`.
6. `public -> private` removes survey from public map on next read.

### Mobile (functional)
1. Draft survey detail shows visibility control and applies immediately.
2. Submitted survey detail still shows visibility control.
3. Submitted survey detail keeps observation actions disabled (edit factors/parcels).
4. Visibility state survives sync round-trip (local -> server -> local pull).

## Implementation Notes
- Keep compatibility with the direct endpoint (`PATCH /surveys/{id}/visibility`) for online calls.
- For offline-first mobile behavior, V1 also supports queued `survey.visibility_update` in `POST /sync`.
