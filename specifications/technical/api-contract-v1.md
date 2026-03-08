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
    "lat": 48.643,
    "lng": 1.829
  },
  "expires_at": "2026-03-15T10:00:00Z"
}
```

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "server_status": "synced",
  "updated_at": "2026-03-08T12:00:00Z"
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

### PATCH /surveys/{id}/visibility
Update survey visibility.

Request:
```json
{
  "visibility": "public"
}
```

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "visibility": "public"
}
```

### POST /surveys/{id}/submit
Attempt submission transition (`draft` -> `submitted`) with server-side checks.

Response `200`:
```json
{
  "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
  "status": "submitted",
  "submitted_at": "2026-03-08T12:20:00Z"
}
```

### DELETE /surveys/{id}
Soft-delete a survey.

Response `204`.

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
Create an attachment record and return upload target.

Request:
```json
{
  "mime_type": "image/jpeg",
  "size_bytes": 2450000
}
```

Response `201`:
```json
{
  "attachment_id": "6e0417dc-ecdb-4435-aadf-8e11b7f5f2f0",
  "storage_key": "surveys/2f3d8a59/photo-1.jpg",
  "upload_url": "https://storage.example/upload-signed-url"
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
      "entity": "survey",
      "action": "upsert",
      "payload": {
        "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
        "sync_version": 3
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
      "entity": "survey",
      "id": "2f3d8a59-7c53-4fdf-8df4-8e2325b6172c",
      "status": "synced"
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
- `409` conflict/version mismatch
- `422` business rule violation
- `500` internal server error
