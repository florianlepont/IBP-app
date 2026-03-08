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
npm run dev:api
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
