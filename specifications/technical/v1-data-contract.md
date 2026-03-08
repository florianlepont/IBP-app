# Data Contract V1

## Status
Accepted (validated on 2026-03-08)

## Purpose
Define the shared data model between mobile app, backend API, and database for the V1 scope.

## Core Design Rules
- IDs are UUID v4.
- Timestamps are ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`).
- Backend is the source of truth for business validation.
- Sync operations must be idempotent.

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
- `status` (enum: `draft` | `submitted` | `synced` | `error` | `expired`)
- `visibility` (enum: `private` | `public`)
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
- `last_sync_error` (string, nullable)
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

### 5) Survey Event (Audit Trail)
Minimal audit history for reliability and moderation.

Required fields:
- `id` (uuid)
- `survey_id` (uuid)
- `actor_id` (uuid, nullable for system events)
- `event_type` (enum: `created` | `updated` | `submitted` | `synced` | `sync_failed` | `expired` | `visibility_changed` | `deleted` | `reported`)
- `payload` (jsonb, nullable)
- `created_at` (timestamp)

### 6) Sync Operation (Mobile Queue)
Tracks local operations waiting for server acknowledgment.

Required fields:
- `id` (uuid)
- `entity_type` (enum: `survey` | `attachment` | `report`)
- `entity_id` (uuid)
- `operation` (enum: `upsert` | `delete`)
- `payload` (jsonb)
- `status` (enum: `pending` | `processing` | `failed`)
- `retry_count` (integer)
- `next_retry_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

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
- `display_location` (jsonb) // reduced precision
- `survey_date` (date)
- `region_code` (string)
- `ibp_total` (integer)

## Survey State Transitions (V1)
- `draft -> submitted` (required fields complete and not expired)
- `submitted -> synced` (server accepted)
- `submitted -> error` (sync failed)
- `error -> submitted` (retry attempt)
- `draft -> expired` (now > `expires_at`)

## Consistency Rules
- `expires_at = created_at + 7 days`
- `visibility` default is `private`
- Only `public` surveys are eligible for community surfaces
- Switching `public -> private` must remove the survey from community surfaces
- Deleted surveys must be excluded from user list and community surfaces
- Server recomputes/validates scores before final accept

## Idempotency Rules
- Primary key for survey upsert idempotency: (`id`, `sync_version`)
- Same payload replay must return success without duplication
- Older `sync_version` must be rejected with conflict (`409`)

## Out of Scope for Data Contract V1
- Full event sourcing model
- Advanced anti-cheat scoring model
- Team/organization rankings data model
