# V1 Technical Architecture (Blocks and Responsibilities)

## Status
Aligned with accepted V1 data/API contracts (updated on 2026-03-08)

## Objective
Define a simple, scalable, and pragmatic architecture to deliver a reliable IBP MVP.

## Architecture Blocks
- Mobile app (iOS/Android)
- Backend API
- Relational database
- Object storage for photos
- External services (maps/geocoding, donation provider)
- Optional public read model for map surfaces

## Responsibilities by Block

### 1) Mobile App
- Screens, IBP form UX, baseline client validation
- Local survey persistence (drafts and pending sync operations)
- Sync queue handling (retry and error state management)
- Photo capture and geolocation collection
- Profile management UI (`/me`)
- Local auth token lifecycle (`/auth/login`, `/auth/refresh`, `/auth/logout`)

### 2) Backend API
- Authentication and session lifecycle
- User profile read/update
- Survey CRUD and business workflow enforcement
- Server-side IBP validation and score verification
- Final survey status transitions
- Minimal audit trail recording
- Attachment upload orchestration (record + signed upload URL)
- Reporting and moderation actions
- Public map read endpoint (anonymized data only)

### 3) PostgreSQL
- Core tables: `users`, `auth_sessions`, `surveys`, `attachments`, `survey_events`, `reports`
- Status integrity constraints
- Query indexes for search (`site_name`, `status`, `date`)
- Role-based access for moderation endpoints

### 4) Object Storage
- Survey media files (photos)
- Optional signed URLs for controlled access

### 5) Optional Public Map Read Model
- Materialized/read table for public map payloads
- Reduced geographic precision
- Strict exclusion of private/deleted surveys

## Main Technical Flows

### A) Login
1. Mobile sends user credentials
2. API returns access and refresh tokens
3. Mobile stores tokens in secure storage
4. Mobile refreshes access token with `/auth/refresh` when needed

### B) Save Draft Offline
1. User fills in the form
2. Mobile stores survey locally (SQLite)
3. Local status remains `draft`

### C) Synchronization
1. Connectivity is detected
2. Mobile sends queued operations (`pending`)
3. API validates and persists accepted payloads
4. Mobile updates local status to `synced` or `error`

### D) Profile Update
1. Mobile sends `PATCH /me` with editable fields
2. API validates and persists profile changes
3. Mobile updates local profile cache

### E) Attachment Upload
1. Mobile requests attachment creation (`POST /surveys/{id}/attachments`)
2. API returns `attachment_id`, `storage_key`, and signed `upload_url`
3. Mobile uploads file to object storage
4. Survey references attachment in subsequent sync payloads

### F) Report and Moderation
1. User creates report (`POST /reports`)
2. Moderator lists open reports (`GET /reports?status=open`)
3. Moderator updates report state (`PATCH /reports/{id}`)

### G) Public Map Read
1. Client requests public items (`GET /public/map-items`)
2. API returns anonymized items from read model
3. Only surveys with `visibility=public` and not deleted are exposed

## Security and Compliance Baseline (V1)
- TLS for all API communication
- Encrypted local storage for sensitive mobile data
- Anonymized/pseudonymized data for public surfaces
- Logging of critical actions
- `user_id` ownership enforced server-side from authenticated context

## Out of Scope for V1
- Advanced moderation workflows
- Advanced push notification workflows
- Full data warehouse architecture
