# Data Contract V1

## Status
Accepted for V1 baseline (validated on 2026-03-08). V1.1 parcel/history extension proposed on 2026-03-10. Auth Session entity updated on 2026-04-06 to reflect Auth0 delegation. User entity updated with `auth0_sub`.

## Purpose
Define the shared data model between mobile app, backend API, and database for the V1 scope.

## Core Design Rules
- IDs are UUID v4.
- Timestamps are ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`).
- Backend is the source of truth for business validation.
- Sync operations must be idempotent.
- Cadastral parcel identifiers (`parcel_id`/`parcel_ids[]`) are canonicalized server-side.
- Survey and attachment ids are client- or server-chosen text that must match `^[A-Za-z0-9_-]{1,128}$` (UUIDs today, `survey-<ms>` in early mobile builds), because they become storage key segments.

## Entities

### 1) User
Represents an authenticated contributor or moderator.

Required fields:
- `id` (uuid)
- `auth0_sub` (string, unique) // Auth0 user identifier (e.g. `auth0|xxx`, `google-oauth2|xxx`)
- `email` (string, unique)
- `role` (enum: `contributor` | `moderator` | `admin`)
- `first_name` (string)
- `last_name` (string)
- `display_name` (string)
- `profile_picture_url` (string, nullable)
- `profile_picture_storage_key` (string, nullable) // object storage key for the uploaded picture (`profiles/{user_id}/avatar{ext}`), read and written through `StorageService` (MinIO/S3 bucket, or the local uploads directory in local mode)
- `profile_picture_mime_type` (string, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2) Auth Session
> **Delegated to Auth0.** Session lifecycle (access tokens, refresh tokens, rotation, revocation) is fully managed by the Auth0 tenant. The backend does not store or manage sessions directly.
>
> The backend only validates the JWT access token on each request (RS256, JWKS). No `auth_sessions` table is maintained server-side in V1.

### 3) Survey
Main IBP form entity.

Required fields:
- `id` (uuid) // generated on mobile
- `user_id` (uuid)
- `site_name` (string)
- `parcel_id` (string, nullable compatibility field = primary parcel)
- `parcel_ids` (string[], nullable in early draft, required for submit)
- `status` (enum: `draft` | `submitted` | `synced` | `error` | `expired`)
- `visibility` (enum: `private` | `public`)
- `observation_year` (integer)
- `version_number` (integer, starts at 1 per parcel history context)
- `region_version` (enum: `ACA` | `M`)
- `vegetation_stage` (string enum, depends on `region_version`)
- `factors` (jsonb) // IBP factor inputs A..J
- `scores` (jsonb) // subscores + total
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `submitted_at` (timestamp, nullable)
- `expires_at` (timestamp)
- `sync_version` (integer, incremented on each local update)

Optional fields:
- `previous_survey_id` (uuid, nullable) // link to previous version/year survey on same parcel
- `parcel_snapshot` (jsonb, nullable) // optional denormalized parcel metadata at submit time
- `last_sync_error` (string, nullable)
- `last_sync_error_code` (string, nullable)
- `last_sync_error_at` (timestamp, nullable)
- `sync_blocked` (boolean/integer flag, nullable) // local conflict guard
- `deleted_at` (timestamp, nullable) // soft delete

### 4) Attachment
Photo or media file linked to a survey.

Required fields:
- `id` (uuid)
- `survey_id` (uuid)
- `storage_key` (string) // object storage key built by the server: `surveys/{survey_id}/{attachment_id}{ext}`
- `mime_type` (string)
- `size_bytes` (integer) // must equal the uploaded byte length; a mismatch at confirm is rejected (`422 attachment_size_mismatch`)
- `created_at` (timestamp)

Optional fields:
- `captured_at` (timestamp, nullable)
- `metadata` (jsonb, nullable) // EXIF or device metadata
- `uploaded_at` (timestamp, nullable) // set once upload target is consumed
- `last_sync_error_code` (string, nullable) // local diagnostic mirror
- `last_sync_error_at` (timestamp, nullable) // local diagnostic mirror
- `deleted_at` (timestamp, nullable) // soft delete

### 5) Survey Event (Audit Trail)
Minimal audit history for reliability and moderation.

Required fields:
- `id` (uuid)
- `survey_id` (uuid)
- `actor_id` (uuid, nullable for system events)
- `event_type` (enum: `created` | `updated` | `submitted` | `synced` | `sync_failed` | `expired` | `visibility_changed` | `deleted` | `reported` | `attachment_created` | `attachment_uploaded` | `attachment_deleted` | `backfilled`)
- `payload` (jsonb, nullable)
- `created_at` (timestamp)
- `seq` (bigint, identity) // insertion order; backfilled in `(created_at, id)` order by migration 014
- `xid8` (xid8, `DEFAULT pg_current_xact_id()`) // id of the transaction that wrote the event

Indexes:
- unique (`xid8`, `seq`) // changes-feed order
- (`actor_id`) where `actor_id IS NOT NULL` // `idx_survey_events_actor_id`, migration 015

Rules:
- `seq` and `xid8` always come from the column defaults; inserts never name them.
- `GET /v1/sync/changes` returns events with `xid8 < pg_snapshot_xmin(pg_current_snapshot())`, paged by (`xid8`, `seq`); see `sync-conflict-resolution-v1.md`, "Changes Feed Ordering".
- `backfilled` events (`actor_id` NULL, payload `{"reason":"migration_014"}`) were inserted once by migration 014 for owned surveys that had no event.
- `xid8` values belong to the cluster that wrote them: after a logical dump/restore, run `UPDATE survey_events SET xid8 = pg_current_xact_id();` before starting the API (see `sync-conflict-resolution-v1.md`, "Database restore").

### 6) Sync Operation (Mobile Queue)
Tracks local operations waiting for server acknowledgment.

Required fields:
- `id` (uuid)
- `entity_type` (enum: `survey` | `attachment` | `report`)
- `entity_id` (uuid)
- `operation` (enum: `upsert` | `delete` | `create` | `visibility_update`) // `create` for attachment creation, `delete` for survey/attachment delete, `visibility_update` for offline publication toggle
- `payload` (jsonb)
- `status` (enum: `pending` | `processing` | `failed`)
- `retry_count` (integer)
- `next_retry_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Optional fields:
- `terminal_at` (timestamp, nullable)
- `terminal_reason` (string, nullable)

### 7) Report
User report for suspicious survey content.

Required fields:
- `id` (uuid)
- `survey_id` (uuid)
- `reporter_user_id` (uuid)
- `reason` (string)
- `status` (enum: `open` | `reviewed`)
- `created_at` (timestamp)
- `reviewed_at` (timestamp, nullable)
- `reviewed_by` (uuid, nullable)

Indexes:
- (`status`, `created_at DESC`) // `idx_reports_status_created`, status-filtered list
- (`created_at DESC`, `id DESC`) // `idx_reports_created_id`, migration 015, unfiltered keyset list

### 8) Public Map Item (Read Model, Optional in V1)
Anonymized representation used by community map surfaces.

Required fields:
- `survey_id` (uuid)
- `display_location` (jsonb) // reduced precision (2 decimals in current API read model)
- `survey_date` (date)
- `region_code` (string)
- `ibp_total` (integer)

### 9) Parcel (V1.1 Addendum)
French cadastral parcel reference used for survey linkage and history.

Required fields:
- `id` (uuid)
- `parcel_id` (string, unique canonical cadastral identifier)
- `commune_code` (string)
- `section` (string)
- `number` (string)
- `geometry` (jsonb) // polygon/multipolygon in WGS84
- `centroid` (jsonb) // `{lat, lng}`
- `created_at` (timestamp)
- `updated_at` (timestamp)

Optional fields:
- `area_m2` (number, nullable)
- `source` (string, nullable) // cadastre provider name/version

Generated columns (migration 015, `GENERATED ALWAYS AS … STORED`, never written by the API):
- `centroid_lat` (double precision, nullable) // `centroid.lat` when it is a plain decimal (number or numeric string, no exponent, at most 3 integer digits) within -90..90
- `centroid_lng` (double precision, nullable) // `centroid.lng` when it is a plain decimal within -180..180
- Both are NULL when the centroid is missing, non-numeric or out of range; PostgreSQL recomputes them on every `centroid` update.

Indexes:
- btree (`centroid_lat`, `centroid_lng`) // `idx_parcels_centroid_lat_lng`, bbox lookups (no PostGIS)

### 10) Parcel Study Status (Read Model, V1.1 Addendum)
High-zoom map layer showing whether a parcel is already studied.

Required fields:
- `parcel_id` (string)
- `study_status` (enum: `studied` | `not_studied`)
- `latest_submitted_survey_id` (uuid, nullable)
- `latest_observation_year` (integer, nullable)
- `latest_ibp_total` (integer, nullable)

### 10.1) SurveyParcel Link (V1.2 Addendum)
Association table enabling multi-parcel surveys.

Required fields:
- `survey_id` (uuid/text)
- `parcel_id` (string)
- `created_at` (timestamp)

Rules:
- (`survey_id`, `parcel_id`) is unique.
- One survey can reference multiple parcels.
- `surveys.parcel_id` remains as optional compatibility pointer to primary parcel.
- Lookups by `survey_id` use the primary key (`survey_id`, `parcel_id`); lookups by `parcel_id` use `idx_survey_parcels_parcel_id`.

### 10.2) Index notes (migration 015)
- `idx_surveys_public_submitted` on `surveys (submitted_at DESC)` where `status = 'submitted' AND visibility = 'public' AND deleted_at IS NULL` serves the public community routes.
- Dropped as redundant: `idx_users_auth0_sub` (duplicate of the unique constraint `users_auth0_sub_key`), `idx_surveys_parcel_id` (prefix of `idx_surveys_parcel_year_version`) and `idx_survey_parcels_survey_id` (prefix of `survey_parcels_pkey`).
- `auth_sessions` is dropped again with `DROP TABLE IF EXISTS … CASCADE` as a safety net (migration 011 already removed it).

### 11) Analytics Region Snapshot (V2 Addendum, Out of MVP)
Aggregated IBP metrics by region and period for Explore insights.

Required fields:
- `region_code` (string)
- `year` (integer)
- `sample_size` (integer)
- `ibp_total_avg` (number)
- `ibp_total_median` (number)
- `ibp_pg_avg` (number)
- `ibp_context_avg` (number)
- `factor_avg` (jsonb) // map A..J -> average score
- `refreshed_at` (timestamp)

Optional fields:
- `ibp_total_stddev` (number, nullable)
- `confidence_note` (string, nullable)

## Survey State Transitions (V1)
- `draft -> submitted` (required fields complete and not expired)
- `submitted -> synced` (server accepted)
- `submitted -> error` (sync failed)
- `error -> submitted` (retry attempt)
- `draft -> expired` (now > `expires_at`)

## Consistency Rules
- `expires_at = created_at + 7 days`
- `visibility` default is `private`
- at least one parcel is required for `submitted` surveys (`parcel_ids.length >= 1`)
- `observation_year` and `version_number` are required for `submitted` surveys
- `submitted` surveys are read-only for observation payload (`site_name`, parcel linkage, region/stage, factors, scores)
- `submitted` surveys may still change `visibility` (`private` <-> `public`)
- Only `public` surveys are eligible for community surfaces
- Switching `public -> private` must remove the survey from community surfaces
- Deleted surveys must be excluded from user list and community surfaces
- Server recomputes/validates scores before final accept
- Server validates that all selected parcels exist
- For a given parcel history context, `version_number` must be strictly increasing

## Idempotency Rules
- Primary key for survey upsert idempotency: (`id`, `sync_version`)
- Same payload replay must return success without duplication
- Older `sync_version` must be rejected with conflict (`409`)
- Parcel/version conflicts can return `409` with structured details (`parcel_id`, expected_version_number, client_version_number)

## Out of Scope for Data Contract V1
- Full event sourcing model
- Advanced anti-cheat scoring model
- Team/organization rankings data model
