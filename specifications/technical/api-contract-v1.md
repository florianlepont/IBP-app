# V1 API Contract

## Status
Accepted for current scope (validated on 2026-03-08, non-exhaustive by design)

Base path: `/v1`

## Principles
- JSON request/response format
- Bearer token authentication for protected endpoints
- Idempotent survey upsert via (`id`, `sync_version`)
- UTC timestamps in ISO-8601 format

## Entity Coverage (Data Contract -> API)
- `User`: covered
- `Auth Session`: covered
- `Survey`: covered
- `Attachment`: covered
- `Survey Event`: covered
- `Sync Operation`: covered via `/sync` payload
- `Report`: covered
- `Public Map Item` (optional V1 read model): covered

## 1) Authentication

### POST /auth/login
Authenticate a user and create a session.

Request:
```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response `200`:
```json
{
  "access_token": "jwt",
  "refresh_token": "jwt",
  "user": {
    "id": "0f5f57bb-4c0f-4adb-97b9-faf7a1e33b9a",
    "display_name": "Florian",
    "role": "contributor"
  }
}
```

### POST /auth/refresh
Rotate tokens using refresh token.

Request:
```json
{
  "refresh_token": "jwt"
}
```

Response `200`:
```json
{
  "access_token": "jwt",
  "refresh_token": "jwt"
}
```

### POST /auth/logout
Revoke refresh token and close session.

Response `204`.

## 1.1) User Profile

### GET /me
Get current authenticated user profile.

Response `200`:
```json
{
  "id": "0f5f57bb-4c0f-4adb-97b9-faf7a1e33b9a",
  "email": "user@example.com",
  "role": "contributor",
  "first_name": "Florian",
  "last_name": "Lepont",
  "display_name": "Florian",
  "profile_picture_url": null
}
```

### PATCH /me
Partially update editable profile fields.
Editable fields in V1: `first_name`, `last_name`, `display_name`, `email`, `profile_picture_url`.
Rules:
- `email` change requires uniqueness check and verification flow.
- `profile_picture_url` must reference a valid uploaded asset.

Request:
```json
{
  "first_name": "Florian",
  "last_name": "Lepont",
  "display_name": "Florian L.",
  "email": "florian@example.com",
  "profile_picture_url": "https://storage.example/profiles/0f5f57bb/avatar.jpg"
}
```

Response `200`:
```json
{
  "id": "0f5f57bb-4c0f-4adb-97b9-faf7a1e33b9a",
  "first_name": "Florian",
  "last_name": "Lepont",
  "display_name": "Florian L.",
  "email": "florian@example.com",
  "profile_picture_url": "https://storage.example/profiles/0f5f57bb/avatar.jpg",
  "updated_at": "2026-03-08T12:10:00Z"
}
```

## 2) Surveys

### POST /surveys
Create or update one survey (idempotent upsert).

Request:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "sync_version": 3,
  "site_name": "Foret de Rambouillet",
  "status": "submitted",
  "visibility": "private",
  "region_version": "ACA",
  "vegetation_stage": "collineen",
  "factors": {},
  "scores": {
    "ibp_peuplement_gestion": 20,
    "ibp_contexte": 8,
    "ibp_total": 28
  },
  "location": {
    "source": "gps",
    "lat": 48.643,
    "lng": 1.829,
    "accuracy_m": 12,
    "collected_at": "2026-03-09T09:10:00Z"
  },
  "expires_at": "2026-03-15T10:00:00Z"
}
```

`location` accepted shapes in V1:
- GPS: `{ "source": "gps", "lat": number, "lng": number, "accuracy_m"?: number, "collected_at"?: string }`
- Manual fallback: `{ "source": "manual", "address_line": string, "postal_code": string, "city": string, "country": string }`
- Submit validation requires either valid GPS coordinates or a complete manual fallback address.

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "server_status": "synced",
  "updated_at": "2026-03-08T12:00:00Z",
  "warnings": [],
  "factor_results": {}
}
```

### GET /surveys?status=&from=&to=&q=
List current user surveys with filters.

Response `200`:
```json
{
  "items": [
    {
      "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "site_name": "Foret de Rambouillet",
      "status": "draft",
      "visibility": "private",
      "updated_at": "2026-03-08T11:00:00Z"
    }
  ],
  "next_cursor": null
}
```

### GET /surveys/{id}
Get one survey with full payload.

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "site_name": "Foret de Rambouillet",
  "status": "draft",
  "visibility": "private",
  "region_version": "ACA",
  "vegetation_stage": "collineen",
  "factors": {},
  "factor_results": {},
  "scores": {
    "ibp_peuplement_gestion": 20,
    "ibp_contexte": 8,
    "ibp_total": 28
  },
  "location": {
    "source": "gps",
    "lat": 48.643,
    "lng": 1.829,
    "accuracy_m": 12,
    "collected_at": "2026-03-09T09:10:00Z"
  },
  "created_at": "2026-03-08T11:00:00Z",
  "updated_at": "2026-03-08T12:00:00Z",
  "submitted_at": null,
  "expires_at": "2026-03-15T10:00:00Z",
  "sync_version": 3
}
```

### PATCH /surveys/{id}
Partially update survey fields.

Request:
```json
{
  "site_name": "Foret de Rambouillet - Secteur Nord",
  "visibility": "public",
  "region_version": "ACA",
  "vegetation_stage": "collineen",
  "factors": {},
  "scores": {
    "ibp_peuplement_gestion": 20,
    "ibp_contexte": 8,
    "ibp_total": 28
  },
  "location": {
    "source": "manual",
    "address_line": "12 Rue de la Foret",
    "postal_code": "75001",
    "city": "Paris",
    "country": "France"
  }
}
```

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "updated_at": "2026-03-08T12:15:00Z"
}
```

### POST /surveys/{id}/submit
Attempt submission transition (`draft` -> `submitted`) with server-side checks.
Blocking checks include:
- all required IBP factors complete and valid
- survey not expired
- location present with either GPS (`lat`,`lng`) or complete manual address fallback

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "status": "submitted",
  "submitted_at": "2026-03-08T12:20:00Z",
  "scores": {
    "ibp_peuplement_gestion": 20,
    "ibp_contexte": 8,
    "ibp_total": 28
  },
  "warnings": []
}
```

If location is missing/invalid, API returns `422` with error code `location_required`.

### DELETE /surveys/{id}
Soft-delete a survey.

Response `204`.

Notes:
- Idempotent in V1: returns `204` even if survey was already deleted or not found.

### GET /surveys/{id}/events
Get survey audit trail events.

Response `200`:
```json
{
  "items": [
    {
      "id": "7d95ec64-f5aa-4f28-8942-26dfdb6dce16",
      "event_type": "submitted",
      "created_at": "2026-03-08T12:20:00Z"
    }
  ]
}
```

## 2.1) Attachments

### POST /surveys/{id}/attachments
Create an attachment record and return an upload target URL.

Request:
```json
{
  "mime_type": "image/jpeg",
  "size_bytes": 2450000,
  "captured_at": "2026-03-09T09:10:00Z",
  "metadata": {
    "device": "ios",
    "orientation": "portrait"
  }
}
```

Response `201`:
```json
{
  "attachment_id": "6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0",
  "storage_key": "surveys/2f3d8a59/photo-1.jpg",
  "upload_url": "https://minio.local/ibp-surveys/surveys/.../photo-1.jpg?X-Amz-...",
  "confirm_url": "/surveys/2f3d8a59-7c53-4fdf-8df4-8e2325b6172c/attachments/6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0/upload?token=generated-token"
}
```

Rules:
- `size_bytes` must be a positive integer and <= 25MB in V1
- `upload_url` is the generated upload target for binary data
- `confirm_url` must be called after upload to mark `uploaded_at`
- In local mode, `upload_url` can be the same API upload endpoint as `confirm_url`

### PUT /surveys/{id}/attachments/{attachment_id}/upload?token=
Consume the upload target with a real file upload and mark attachment as uploaded.

Request:
- Content type: `multipart/form-data`
- Field: `file` (binary image payload)

Response `200`:
```json
{
  "attachment_id": "6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0",
  "uploaded_at": "2026-03-09T09:12:00Z"
}
```

### DELETE /surveys/{id}/attachments/{attachment_id}
Remove attachment link (and optionally underlying object).

Response `204`.

## 3) Sync (Batch, Recommended)

### POST /sync
Submit multiple operations in one request.

Request:
```json
{
  "operations": [
    {
      "client_ref": "queue-101",
      "entity": "survey",
      "action": "upsert",
      "payload": {
        "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
        "sync_version": 3,
        "site_name": "Forest Plot 12"
      }
    },
    {
      "client_ref": "queue-102",
      "entity": "attachment",
      "action": "create",
      "survey_id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "payload": {
        "mime_type": "image/jpeg",
        "size_bytes": 2450000
      }
    },
    {
      "client_ref": "queue-103",
      "entity": "survey",
      "action": "delete",
      "survey_id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "payload": {
        "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c"
      }
    }
  ]
}
```

Response `200`:
```json
{
  "results": [
    {
      "client_ref": "queue-101",
      "entity": "survey",
      "action": "upsert",
      "status": "synced",
      "data": {
        "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
        "server_status": "synced",
        "updated_at": "2026-03-09T10:20:00Z"
      }
    },
    {
      "client_ref": "queue-102",
      "entity": "attachment",
      "action": "create",
      "status": "synced",
      "data": {
        "attachment_id": "6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0",
        "storage_key": "surveys/2f3d8a59/photo-1.jpg",
        "upload_url": "https://minio.local/ibp-surveys/surveys/.../photo-1.jpg?X-Amz-...",
        "confirm_url": "/surveys/2f3d8a59-7c53-4fdf-8df4-8e2325b6172c/attachments/6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0/upload?token=generated-token"
      }
    },
    {
      "client_ref": "queue-103",
      "entity": "survey",
      "action": "delete",
      "status": "synced",
      "data": {
        "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
        "deleted_at": "2026-03-09T11:00:00Z",
        "already_deleted": false,
        "missing": false
      }
    },
    {
      "client_ref": "queue-104",
      "entity": "survey",
      "action": "upsert",
      "status": "fatal_error",
      "error": {
        "code": "http_400",
        "message": "site_name is required",
        "http_status": 400,
        "details": null
      }
    }
  ]
}
```

Rules:
- Batch size max in V1: `100` operations.
- Each operation is processed independently.
- Supported operation set in V1:
  - `survey.upsert`
  - `survey.delete`
  - `attachment.create`
- `status` can be:
  - `synced`
  - `retryable_error` (typically `429` or `5xx`)
  - `fatal_error` (typically `4xx` validation/business errors)
- `error.details` can include structured conflict metadata (example: `server_sync_version` / `client_sync_version`).
- Retryable code family:
  - `rate_limited`
  - `network_gateway_error`
  - `transient_upstream_error`
- `client_ref` is echoed back for local queue reconciliation.

### GET /sync/changes?cursor=&limit=
Fetch user-scoped incremental changes for downsync (server -> mobile).

Query params:
- `cursor` (optional): opaque cursor from previous response (`{timestamp}|{event_id}`)
- `limit` (optional): default `50`, max `200`

Response `200`:
```json
{
  "cursor_in": "2026-03-09T10:12:00.123+00|d4f...",
  "cursor_out": "2026-03-09T10:20:31.991+00|8ac...",
  "has_more": false,
  "events": [
    {
      "id": "8ac4ff29-5f7d-4f3b-9f4f-040f5df516a6",
      "survey_id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "actor_id": "0b3127b6-021a-4805-a9de-b3e9f3eb2f6b",
      "event_type": "attachment_created",
      "payload": { "attachment_id": "6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0" },
      "created_at": "2026-03-09T10:20:31.991+00"
    }
  ],
  "surveys": [
    {
      "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "site_name": "Forest Plot 12",
      "status": "draft",
      "visibility": "private",
      "sync_version": 3,
      "updated_at": "2026-03-09T10:20:00.002+00",
      "deleted_at": null
    }
  ],
  "attachments": [
    {
      "id": "6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0",
      "survey_id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "storage_key": "surveys/2f3d8a59/photo-1.jpg",
      "mime_type": "image/jpeg",
      "size_bytes": 2450000,
      "created_at": "2026-03-09T10:20:31.991+00",
      "uploaded_at": null,
      "deleted_at": null
    }
  ]
}
```

## 4) Reports

### POST /reports
Report suspicious survey content.

Request:
```json
{
  "survey_id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "reason": "Suspicious values and duplicate photos"
}
```

Response `201`:
```json
{
  "id": "e81fbbab-06a8-49a0-87f8-e9b7f0c8dca5",
  "status": "open"
}
```

### GET /reports?status=open
List reports (moderator/admin).

### PATCH /reports/{id}
Review a report (moderator/admin).

Request:
```json
{
  "status": "reviewed"
}
```

Response `200`:
```json
{
  "id": "e81fbbab-06a8-49a0-87f8-e9b7f0c8dca5",
  "status": "reviewed",
  "reviewed_at": "2026-03-08T13:00:00Z"
}
```

## 5) Public Map (Optional in V1)

### GET /public/map-items?from=&to=&region=
Return anonymized public survey map items.

Response `200`:
```json
{
  "items": [
    {
      "survey_id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "display_location": { "lat": 48.64, "lng": 1.83 },
      "survey_date": "2026-03-08",
      "region_code": "FR-IDF",
      "ibp_total": 28
    }
  ]
}
```

## Standard Error Codes
- `400` validation error
- `401` unauthorized
- `403` forbidden
- `404` not found
- `429` rate limited
- `409` conflict/version mismatch
- `422` business rule violation
- `500` internal server error
