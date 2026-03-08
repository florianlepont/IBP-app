# IBP App Monorepo (V1 Scaffold)

This repository is scaffolded for:
- `mobile/`: Expo + React Native + TypeScript app
- `api/`: NestJS API
- `infra/`: local PostgreSQL + MinIO via Docker Compose
- `specifications/`: product and technical specs

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop

## Setup
```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose -f infra/docker-compose.yml up -d
```

## Run
Terminal 1:
```bash
npm run dev:api:migrated
```

Terminal 2:
```bash
npm run dev:mobile
```

## First end-to-end check
- API: open `http://localhost:3000/v1/health`
- Mobile: tap **Check API /health** in the app

## Step 3 Vertical Slice (Current)
Implemented:
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/surveys`
- `POST /v1/surveys` (idempotent on `id + sync_version`)
- Mobile local SQLite drafts + sync queue

Manual test flow:
1. Start Postgres/MinIO: `docker compose -f infra/docker-compose.yml up -d`
2. Start API: `npm run dev:api`
3. Start mobile: `npm run dev:mobile -- --clear`
4. In app:
   - Login
   - Create offline draft
   - Sync pending drafts
5. Confirm survey persisted in API DB (`surveys` table) and local item becomes `synced`.

## Step 4 Hardening (Current)
Implemented:
- API auth hardened with JWT (`access` + `refresh`) and password hashing (`bcrypt`)
- SQL migrations system (`api/migrations`, `api/scripts/migrate.js`)
- User profile partial update endpoint: `PATCH /v1/me`
- Survey workflow endpoints:
  - `PATCH /v1/surveys/:id`
  - `POST /v1/surveys/:id/submit`
  - `GET /v1/surveys/:id/events`
- Mobile sync improvements:
  - retry backoff for transient failures
  - terminal handling for `409`/`422`
  - local `last_sync_error` persisted for diagnostics

## Step 5 IBP Business Rules (Current)
Implemented:
- Server-side IBP factor validation for A..J
- Allowed score sets enforced:
  - A..H: `0|1|2|5`
  - I,J: `0|2|5`
- Server-side score computation:
  - `ibp_peuplement_gestion = A+B+C+D+E+F+G`
  - `ibp_contexte = H+I+J`
  - `ibp_total = ibp_peuplement_gestion + ibp_contexte`
- Submit is blocked with `422` if required IBP fields are missing/invalid
- Mobile form now captures `region_version`, `vegetation_stage`, and A..J factor scores
