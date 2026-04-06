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
| `OBJECT_STORAGE_BUCKET/ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY` | S3-compatible storage config |
| `ATTACHMENTS_UPLOAD_DIR` | Local upload path (when mode = local) |
| `SMTP_ENABLED`, `SMTP_HOST/PORT/USER/PASSWORD/FROM` | Email confirmation |
| `EMAIL_CHANGE_CONFIRM_URL_TEMPLATE` | Email confirmation URL template |
| `AUTH0_DOMAIN`, `AUTH0_PUBLIC_DOMAIN`, `AUTH0_AUDIENCE` | Auth0 backend validation settings |
| `CADASTRE_PROVIDER` | `synthetic` (offline) or `ign` (real parcels) |
| `CORS_ORIGIN` | Allowed origin for CORS |

### Mobile (`mobile/.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Request timeout in ms (optional) |
| `EXPO_PUBLIC_AUTH0_DOMAIN` | Public Auth0 domain used by the app |
| `EXPO_PUBLIC_AUTH0_CLIENT_ID` | Auth0 native/mobile application client id |
| `EXPO_PUBLIC_AUTH0_AUDIENCE` | API audience requested during login |

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

## Deployment roadmap

### Step 1 — Secure the API before production

- [x] Disable `DEBUG_DATA_RESET_ENABLED` in production (default changed to `false`)
- [x] Disable `AUTH_DEV_EXPOSE_EMAIL_TOKEN` in production (auto-disabled when `NODE_ENV=production`)
- [ ] Replace `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` with strong secrets (see `api/.env.production.example`)
- [ ] Configure SMTP for email confirmation (see `api/.env.production.example` for Brevo)
- [x] Add rate limiting on auth endpoints (5 req/min on login and register)
- [x] Restrict CORS to the production domain (`CORS_ORIGIN` variable)

### Step 2 — Infrastructure (OVH VPS)

- [ ] Create an OVH VPS (Value, 2 GB RAM, ~€3.50/month)
- [ ] Install Node.js 20 + PM2 on the server
- [ ] Install and configure PostgreSQL
- [ ] Configure OVH Object Storage (S3-compatible) for attachments
- [ ] Obtain a domain name and configure DNS
- [ ] Set up HTTPS with Certbot (Let's Encrypt)
- [ ] Deploy the API via git + `npm run build` + `pm2 start`

### Step 3 — GDPR & legal

- [ ] Write a privacy policy (CNIL templates for associations)
- [ ] Write legal notices
- [ ] Verify account deletion endpoint (right to erasure)
- [ ] Maintain a data processing register (internal document)

### Step 4 — Mobile app (stores)

- [ ] Create an Expo EAS account (`eas login`)
- [ ] Configure `eas.json` for iOS and Android builds
- [ ] Apple Developer Program ($99/year — required for iOS)
- [ ] Google Play Console ($25 one-time — required for Android)
- [ ] Add privacy policy link in the app settings
- [ ] Production build: `eas build --platform all`
- [ ] Store submission: `eas submit`

### Step 5 — Continuous updates

- [ ] Configure EAS Update for JS-only updates (no store re-submission)
- [ ] Document the deployment process (`git push` → rebuild → `pm2 reload`)

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
