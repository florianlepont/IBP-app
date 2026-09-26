# V1 Technical Architecture (Blocks and Responsibilities)

> **Partly superseded — 2026-09-22.** The `auth_sessions` table listed under core tables below was
> dropped by `api/migrations/011_auth0_migration.sql` when authentication moved to Auth0. For the
> structure as actually implemented, read `.planning/codebase/ARCHITECTURE.md`, generated from the
> code. This document remains the reference for *intent*: block responsibilities, the A–L technical
> flows, and the security baseline.

## Status
Aligned with accepted V1 data/API contracts (updated on 2026-03-08). V1.1 parcel/history extension proposed on 2026-03-10. Auth0 delegation and account deletion flow added on 2026-04-06.

## Objective
Define a simple, scalable, and pragmatic architecture to deliver a reliable IBP MVP.

## Architecture Blocks
- Mobile app (iOS/Android)
- Backend API
- Relational database
- Object storage for photos and profile pictures
- External services (maps/geocoding, donation provider)
- Cadastral parcel service/layer (France)
- Optional public read model for map surfaces
- Optional analytics aggregation read model (V2)

## Responsibilities by Block

### 1) Mobile App
- Screens, IBP form UX, baseline client validation
- Local survey persistence (drafts and pending sync operations)
- Sync queue handling (retry and error state management)
- Photo capture and geolocation collection
- Parcel lookup/selection UX and parcel history visualization
- Profile management UI (`/me`)
- Auth flows via Auth0 SDK (login, sign-up, social providers, logout, token refresh — all delegated to Auth0)

### 2) Backend API
- JWT validation (Auth0 RS256/JWKS) and user auto-provisioning on first login
- Auth0 Management API calls (email update, password reset trigger, account deletion)
- User profile read/update/delete
- Survey CRUD and business workflow enforcement
- Server-side IBP validation and score verification
- Parcel linkage validation (`parcel_id`) and versioning checks (`observation_year`, `version_number`)
- Final survey status transitions
- Minimal audit trail recording
- Attachment upload orchestration (record + signed upload URL)
- Reporting and moderation actions
- Public map read endpoint (anonymized data only)
- Parcel history read endpoints (scores and factors over years)

### 3) PostgreSQL
- Core tables: `users`, `auth_sessions`, `surveys`, `attachments`, `survey_events`, `reports`, `parcels`
- Status integrity constraints
- Query indexes for search (`site_name`, `status`, `date`)
- Query indexes for parcel workflows (`parcel_id`, `observation_year`, `version_number`)
- Role-based access for moderation endpoints

### 4) Object Storage
- Survey media files (photos) and user profile pictures
- One API service, `StorageService` (`api/src/storage/`), owns object storage: the single S3 client, the bucket (default `ibp-media`), key building, presigned PUT/GET, put, head, get and delete. MinIO/S3 in production (`OBJECT_STORAGE_MODE=minio`), the local uploads directory in development (`local`, with every resolved path contained under the upload root).
- Storage keys are built only from ids that match `^[A-Za-z0-9_-]{1,128}$` (checked at routes, DTOs and again in the key builder) and from an allow-listed MIME type.
- Attachments are served through short-lived presigned GET URLs; profile pictures are streamed by the API (`GET /me/profile-picture`, Bearer auth).

### 5) Optional Public Map Read Model
- Materialized/read table for public map payloads
- Reduced geographic precision
- Strict exclusion of private/deleted surveys

### 6) Cadastral Parcel Layer (V1.1 Addendum)
- Resolve parcel from point (`lat/lng`) and serve parcel geometry metadata.
- Provide high-zoom parcel status overlay (`studied` vs `not_studied`).
- Support mobile caching strategy for recently viewed parcel areas.

### 7) Analytics Aggregation Read Model (V2 Addendum)
- Build region/year/factor aggregates for Explore insights.
- Provide trend-oriented payloads without exposing personal data.
- Refresh with scheduled jobs or incremental updates from submitted surveys.

## Main Technical Flows

### A) Login
1. Mobile authenticates via Auth0 (Universal Login, social provider, or email/password)
2. Auth0 issues a signed JWT access token (RS256) and a refresh token
3. Mobile stores tokens in encrypted local storage
4. Mobile sends `Authorization: Bearer <token>` on every API request
5. Backend `AuthGuard` validates the JWT against Auth0's JWKS endpoint
6. On first login, backend auto-provisions a DB user record from Auth0's `/userinfo`; if a user with the same email already exists, the `auth0_sub` is linked to that record
7. Mobile refreshes the access token directly with Auth0 when it expires

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
1. Mobile requests attachment creation (`POST /surveys/{id}/attachments`) with the file's exact `size_bytes`
2. API returns `attachment_id`, `storage_key`, and signed `upload_url`; in MinIO/S3 mode the presigned PUT signs `Content-Length = size_bytes`, so the store refuses a body of another length
3. Mobile uploads file to object storage
4. Mobile calls `confirm_url`; the API compares the stored size with `size_bytes` and answers `422 attachment_size_mismatch` (object deleted, attachment left unconfirmed) on a difference, otherwise sets `uploaded_at`
5. Survey references attachment in subsequent sync payloads

### F) Report and Moderation
1. User creates report (`POST /reports`)
2. Moderator lists open reports (`GET /reports?status=open`)
3. Moderator updates report state (`PATCH /reports/{id}`)

### G) Public Map Read
1. Client requests public items (`GET /public/map-items`), optionally limited to a viewport with `bbox=minLng,minLat,maxLng,maxLat`; without `bbox` the response is unchanged
2. API returns anonymized items from read model
3. Only surveys with `visibility=public` and not deleted are exposed
4. Mobile viewport loading (phase 01.9, D-05):
   - The map loads the items of the visible `bbox` once the region has settled for 400 ms (`useMapViewport`, `useDebouncedValue`). `usePublicMapExplorer` skips a request equal to the one in flight or the last completed one, and drops stale responses.
   - The camera fits the items only after the first load and after an explicit filter apply (which loads every matching item, without `bbox`). It never re-fits after a viewport load: moving the camera would change the `bbox` and trigger another load, in a loop.
   - The Explorer tab press forces a reload of the last viewport `bbox`.
   - The cadastre parcel layer is loaded on the same debounce, from zoom 15.
5. Mobile clustering: markers are grouped on the device with `supercluster` (radius 60 px, clusters up to zoom 16, `useMapClusters`). Survey and cluster markers are memoised and their presses pass ids. A cluster tap zooms to its expansion zoom; when the cluster cannot split (locations are rounded, so several surveys can share one point), it opens the list of its surveys instead.
6. Anonymisation and rounding are unchanged: the API still rounds `display_location` to 2 decimals (about 1 km) and exposes no personal data. The map shows scores, dates and region codes, never survey ids.

### H) Parcel Resolution and Versioning
1. Mobile captures GPS or manual address
2. API/service resolves candidate cadastral parcel (`parcel_id`)
3. User confirms parcel linkage in create/update flow
4. API validates parcel existence and version sequencing at submit

### I) Parcel History Comparison
1. Mobile requests parcel survey history
2. API returns chronological submitted surveys with totals and factor results
3. Detail screen renders trend and deltas for comparison

### J) High Zoom Parcel Map Status
1. Client reaches high zoom threshold in create/update/detail/explore map
2. Mobile requests parcel status layer by bbox/zoom
3. API returns parcel statuses without personal data
4. Client renders parcel boundaries and `studied`/`not_studied` state

### K) Explore Analytics (V2)
1. Client requests analytics aggregates (regions/factors/trends)
2. API serves pre-aggregated read models
3. UI renders insights with confidence/sample indicators

### L) Account Deletion (US-A7)
1. User confirms deletion in the mobile app (explicit confirmation step)
2. Mobile calls `DELETE /me`
3. Backend calls Auth0 Management API (`DELETE /api/v2/users/{auth0_sub}`) using a M2M token with `delete:users` scope
4. Auth0 deletes the user and invalidates all active tokens
5. Backend deletes personal data from DB (name, email, profile picture file and DB fields)
6. Backend anonymises surveys (removes user reference, retains observation data)
7. API returns `204`; mobile clears local state and redirects to login screen

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
- Full national cadastral offline mirror on device
- Explore advanced analytics dashboards (regional/global insights)
