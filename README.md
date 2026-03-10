# IBP App Monorepo

IBP field survey app workspace with:
- `mobile/`: Expo + React Native + TypeScript
- `api/`: NestJS + PostgreSQL
- `infra/`: local Docker services (PostgreSQL, MinIO)
- `specifications/`: product and technical documents

## Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop

## Repository layout
```text
.
├── api
├── infra
├── mobile
└── specifications
```

## Setup
```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose -f infra/docker-compose.yml up -d
```

## Run locally
Terminal 1:
```bash
npm run dev:api:migrated
```

Terminal 2:
```bash
npm run dev:mobile
```

Quick health check:
- API: `http://localhost:3000/v1/health`
- Mobile: login and trigger a sync flow from the app

## Quality checks
API:
```bash
npm --workspace api run build
npm --workspace api run test:unit
npm --workspace api run test:e2e
```

Mobile:
```bash
npm --workspace mobile run typecheck
npm --workspace mobile run test:unit
```

Coverage:
```bash
npm run test:coverage:api
npm run test:coverage:mobile
```

## Useful scripts
Root:
```bash
npm run migrate:api
npm run dev:api
npm run dev:mobile
```

Workspaces:
```bash
npm --workspace api run migrate
npm --workspace api run start:dev
npm --workspace mobile run start
```

## Main environment variables
API (`api/.env`):
- `PORT`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`
- `OBJECT_STORAGE_MODE` (`local` or `minio`)
- `ATTACHMENTS_UPLOAD_DIR`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `WEB_CONFIRM_EMAIL_BASE_URL`

Mobile (`mobile/.env`):
- `EXPO_PUBLIC_API_URL`

## Specifications
Recommended starting points:
- [API Contract V1](specifications/technical/api-contract-v1.md)
- [Data Contract V1](specifications/technical/data-contract-v1.md)
- [Technical Architecture V1](specifications/technical/technical-architecture-v1.md)
- [IBP Form Spec](specifications/epics/ibp_form_spec.md)

## Notes
- This README intentionally focuses on onboarding and operations.
- Detailed feature history and implementation notes should stay in `specifications/`.
