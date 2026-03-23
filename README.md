# IBP App — Etats-Sauvages

A mobile field survey application for assessing forest biodiversity using the **IBP method** (Indice de Biodiversité Potentielle), designed for French metropolitan forest stands.

Field surveyors use the app to fill in the 10 IBP factors, attach photos, link surveys to cadastral parcels, and sync data back to a central API — all with offline-first support.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo + TypeScript |
| API | NestJS + PostgreSQL |
| Local infra | Docker (PostgreSQL + MinIO) |
| Object storage | MinIO (local) / S3-compatible (production) |
| Cadastral data | IGN reverse geocoding + API Carto |

## Repository layout

```
.
├── api/            # NestJS backend (REST API + migrations)
├── mobile/         # Expo mobile app (iOS + Android)
├── infra/          # Local Docker services
└── docs/           # Product, design, technical and reference documents
```

---

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

### Setup

```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose -f infra/docker-compose.yml up -d
```

### Run locally

**Terminal 1 — API:**
```bash
npm run dev:api:migrated
```

**Terminal 2 — Mobile:**
```bash
npm run dev:mobile
```

**Health check:**
- API: `http://localhost:3000/v1/health`
- Mobile: open the app, tap **Check API /health**

### Run on a physical phone

Fastest path for device debugging:

```bash
npm run dev:mobile
```

Then:
- open **Expo Go** on the phone
- connect the phone to the same Wi-Fi as the Mac
- scan the QR code shown by Expo

API URL on a physical phone:
- if you want to hit the deployed API already configured in `mobile/.env`, keep `EXPO_PUBLIC_API_URL` as-is
- if you want to hit your local API, use `http://<YOUR_MAC_LAN_IP>:3000/v1`
- inside the app, on the auth screen, tap the **API** pill to edit the URL manually

If you need a native iOS development build instead of Expo Go:

```bash
npm run ios -- --device
```

If the iOS build fails with a missing `ReactCodegen.modulemap`, regenerate Pods from the real mobile project:

```bash
cd mobile/ios
pod install
```

---

## Environment variables

### API (`api/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default: 3000) |
| `POSTGRES_HOST/PORT/USER/PASSWORD/DB` | PostgreSQL connection |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | JWT secrets |
| `OBJECT_STORAGE_MODE` | `local` or `minio` |
| `ATTACHMENTS_UPLOAD_DIR` | Local upload path (when mode = local) |
| `SMTP_ENABLED`, `SMTP_HOST/PORT/USER/PASS/FROM` | Email confirmation |
| `WEB_CONFIRM_EMAIL_BASE_URL` | Email confirmation link base URL |
| `CADASTRE_PROVIDER` | `synthetic` (offline) or `ign` (real parcels) |
| `CORS_ORIGIN` | Allowed origin for CORS |

### Mobile (`mobile/.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Request timeout in ms (optional) |

Common values for `EXPO_PUBLIC_API_URL`:
- iOS Simulator: `http://localhost:3000/v1`
- Android Emulator: `http://10.0.2.2:3000/v1`
- Physical device (same Wi-Fi): `http://<YOUR_LAN_IP>:3000/v1`

---

## Quality checks

```bash
# API
npm --workspace api run build
npm --workspace api run test:unit
npm --workspace api run test:e2e

# Mobile
npm --workspace mobile run typecheck
npm --workspace mobile run test:unit

# Coverage reports
npm run test:coverage:api
npm run test:coverage:mobile
```

---

## Useful scripts

```bash
# Root shortcuts
npm run migrate:api        # Run DB migrations
npm run dev:api            # Start API (no migration)
npm run dev:api:migrated   # Migrate then start API
npm run dev:mobile         # Start Expo dev server

# Workspace-level
npm --workspace api run migrate
npm --workspace api run start:dev
npm --workspace mobile run start
```

---

## Specifications

Key documents to get oriented:

- [Docs Index](docs/README.md)
- [Technical Architecture V1](docs/technical/technical-architecture-v1.md)
- [API Contract V1](docs/technical/api-contract-v1.md)
- [Data Contract V1](docs/technical/data-contract-v1.md)
- [IBP Form Spec](docs/specs/ibp-form-spec.md)

Detailed feature specs and implementation notes live in `docs/`.

---

## Delivery Traceability Snapshot

Audit baseline: `2026-03-23`.

Status legend:
- `Delivered`: implemented end-to-end in the current app/API.
- `Partial`: meaningful implementation exists, but one or more important acceptance criteria are still missing.
- `Missing`: no meaningful implementation found yet.

Notes:
- This is a working implementation snapshot, not a contractual release checklist.
- Epic D currently contains duplicate user-story IDs in the source specs (`US-D1`, `US-D2`, `US-D3` each appear twice). The list below preserves the source wording to avoid rewriting spec identifiers here.
- Epic H is intentionally omitted from this trace because it is explicitly V2 in the current product spec set.

### [Epic A - Access and Security](specs/epic-a-access-and-security.md)

- `US-A1` `Delivered` - Email/password login, error feedback, and persistent session restore are implemented.
- `US-A2` `Delivered` - Logout is implemented and returns the app to the auth flow.
- `US-A3` `Delivered` - Sign up exists with email validation, password rules, auto-login, and email verification handling.
- `US-A4` `Missing` - No Apple/Google or other third-party login provider is implemented.
- `US-A5` `Delivered` - Profile editing exists for first name, last name, display name, and profile picture via camera or gallery.

### [Epic B - Survey Preparation](specs/epic-b-survey-preparation.md)

- `US-B1` `Partial` - Survey list, offline visibility, completion rate, and core filters exist, but parcel/year/version are not surfaced clearly and filtering is still incomplete versus the spec.
- `US-B2` `Partial` - Survey detail, deadline, completion rate, and edit access for editable drafts exist, but previous parcel surveys, score comparison, and submitted-survey update flow are missing.
- `US-B3` `Delivered` - Visibility toggle and survey deletion are implemented from survey detail.
- `US-B4` `Partial` - High-zoom parcel boundaries and studied/not-studied status exist, but opening latest survey/history directly from a studied parcel is not delivered yet.
- `US-B5` `Partial` - Explore includes the public map, filters, and parcel status layer, but it is still marker-centric and does not yet expose parcel-first analysis/history as described by the spec.

### [Epic C - IBP Survey Data Entry](specs/epic-c-ibp-survey-data-entry.md)

- `US-C1` `Partial` - Guided flow across factors `A` to `J` exists, but the form model remains simplified compared with the detailed IBP functional spec and some metadata/field fidelity is still missing.
- `US-C2` `Delivered` - Draft creation, local persistence, offline availability, autosave behavior, and near-expiration warning are in place.
- `US-C3` `Partial` - Photos can be added, previewed, removed, and synchronized, but the explicit `10 photos max` rule is not clearly enforced in the current code.
- `US-C4` `Delivered` - Parcel selection by map, multi-parcel linkage, current-location centering, and submit blocking on invalid linkage are implemented.
- `US-C5` `Partial` - Submit, expiration, read-only state, and automatic synchronization exist, but explicit blocking reasons and the full submission UX expected by the spec are not complete.
- `US-C6` `Partial` - Contextual pedagogical help exists inside factor detail views, but it remains lightweight compared with the richer help expected by the spec.
- `US-C7` `Delivered` - Private/public choice exists with `private` as default and later visibility changes from survey detail.
- `US-C8` `Partial` - Parcel versioning is implemented server-side and surfaced partially, but previous scores/history are not available inside the survey flow as required.
- `US-C9` `Missing` - No species recognition or suggestion flow exists for Factor A photo capture.

### [Epic D - Offline and Synchronization](specs/epic-d-offline-and-synchronization.md)

- `US-D1` `Missing` - Offline map mode with downloaded basemap/parcels and explicit offline indicator is not implemented.
- `US-D1` `Partial` - Offline draft work and queued actions are implemented, but reusable offline cadastral map context is still limited.
- `US-D2` `Partial` - Automatic synchronization on reconnect is implemented, but the parcel-history downsync expected by comparison views is still missing.
- `US-D2` `Missing` - Downloading an area for offline use is not implemented.
- `US-D3` `Partial` - Parcel/version conflict handling exists in the backend and the app can retry or discard, but the conflict UX/details are still thinner than the spec target.
- `US-D3` `Missing` - Warning when a parcel is not available offline is not implemented.
- `US-D4` `Missing` - No basemap selector for Satellite/Map switching is implemented.

### [Epic E - Data Quality and Trust](specs/epic-e-data-quality-and-trust.md)

- `US-E1` `Partial` - Survey events and timestamps exist, but the dedicated moderation interface described by the spec is not present.
- `US-E2` `Partial` - Text search and some filters exist, but parcel/year/version search coverage is incomplete.
- `US-E3` `Partial` - Suspicious-content reporting exists with required reason and moderator review, but the report entry point is not yet aligned with the spec detail-page flow.

### [Epic F - Participatory Experience and Gamification](specs/epic-f-participatory-experience-and-gamification.md)

- `US-F1` `Delivered` - A France-wide public map of public IBP surveys exists with date/region filters and anonymized public payloads.
- `US-F2` `Partial` - The contributor profile exists, but points, validated-survey counters, and activity history are not implemented.
- `US-F3` `Missing` - No leaderboard exists.
- `US-F4` `Missing` - No badges or milestones system exists.
- `US-F5` `Missing` - No rare-species scan, scoring, or anti-abuse flow exists.

### [Epic G - IBP Information, Association Visibility and Donation](specs/epic-g-ibp-information-association-visibility-and-donation.md)

- `US-G1` `Partial` - The app includes factor-level educational hints, but not the broader in-app IBP information section required by the spec.
- `US-G2` `Missing` - No dedicated Etats-Sauvages mission/impact section exists.
- `US-G3` `Missing` - No donation CTA or donation conversion flow exists.


---

## Production cost estimate

### One-time costs

| Item | Cost |
|------|------|
| Google Play Console | ~€25 |
| **Total** | **~€25** |

### Recurring costs

| Item | Cost |
|------|------|
| OVH VPS (2 GB RAM) | ~€3.50/month |
| Domain name | ~€1/month (~€12/year) |
| Apple Developer Program | €99/year |
| OVH Object Storage (photos) | <€1/month (pay-as-you-go) |
| **Monthly average** | **~€13/month** |
| **Annual total** | **~€155/year** |

### Free tier

- PostgreSQL — included on the VPS
- HTTPS — Let's Encrypt (free)
- SMTP — Brevo (ex-Sendinblue): free up to 300 emails/day
- EAS Build / EAS Update — free tier sufficient for a solo developer

### First full year

~€25 (Google) + €42 (VPS) + €12 (domain) + €99 (Apple) = **~€178**

> **Note:** If the app is run by a French non-profit (association loi 1901), Apple's non-profit program may waive the €99/year fee, bringing annual costs down to ~€55/year after the first year.
