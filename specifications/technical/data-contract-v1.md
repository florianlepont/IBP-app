# Data Contract V1

## Status
Accepted for V1 baseline (validated on 2026-03-08). V1.1 parcel/history extension proposed on 2026-03-10.

## Purpose
Define the shared data model between mobile app, backend API, and database for the V1 scope.

## Core Design Rules
- IDs are UUID v4.
- Timestamps are ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`).
- Backend is the source of truth for business validation.
- Sync operations must be idempotent.
- Cadastral parcel identifiers (`parcel_id`) are canonicalized server-side.

## Entities

### 1) User
Represents an authenticated contributor or moderator.

Required fields:
- `id` (uuid)
- `email` (string, unique)
- `role` (enum: `contributor` | `moderator` | `admin`)
- `first_name` (string)
- `last_name` (string)
- `display_name` (string)
- `profile_picture_url` (string, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2) Auth Session
Represents a login session with refresh token lifecycle.

Required fields:
- `id` (uuid)
- `user_id` (uuid)
- `refresh_token_hash` (string)
- `expires_at` (timestamp)
- `created_at` (timestamp)
- `revoked_at` (timestamp, nullable)

### 3) Survey
Main IBP form entity.

Required fields:
- `id` (uuid) // generated on mobile
- `user_id` (uuid)
- `site_name` (string)
- `parcel_id` (string, nullable in early draft, required for submit)
- `status` (enum: `draft` | `submitted` | `synced` | `error` | `expired`)
- `visibility` (enum: `private` | `public`)
- `observation_year` (integer)
- `version_number` (integer, starts at 1 per parcel history context)
- `region_version` (enum: `ACA` | `M`)
- `vegetation_stage` (string enum, depends on `region_version`)
- `factors` (jsonb) // IBP factor inputs A..J
- `scores` (jsonb) // subscores + total
- `location` (jsonb) // GPS or manual address
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
- `storage_key` (string) // object storage key/path
- `mime_type` (string)
- `size_bytes` (integer)
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
- `event_type` (enum: `created` | `updated` | `submitted` | `synced` | `sync_failed` | `expired` | `visibility_changed` | `deleted` | `reported` | `attachment_created` | `attachment_uploaded` | `attachment_deleted`)
- `payload` (jsonb, nullable)
- `created_at` (timestamp)

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

### 10) Parcel Study Status (Read Model, V1.1 Addendum)
High-zoom map layer showing whether a parcel is already studied.

Required fields:
- `parcel_id` (string)
- `study_status` (enum: `studied` | `not_studied`)
- `latest_submitted_survey_id` (uuid, nullable)
- `latest_observation_year` (integer, nullable)
- `latest_ibp_total` (integer, nullable)

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
- `parcel_id` is required for `submitted` surveys
- `observation_year` and `version_number` are required for `submitted` surveys
- `submitted` surveys are read-only for observation payload (`site_name`, region/stage, factors, location, scores)
- `submitted` surveys may still change `visibility` (`private` <-> `public`)
- Only `public` surveys are eligible for community surfaces
- Switching `public -> private` must remove the survey from community surfaces
- Deleted surveys must be excluded from user list and community surfaces
- Server recomputes/validates scores before final accept
- Server validates that `parcel_id` exists and is compatible with provided location context
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
