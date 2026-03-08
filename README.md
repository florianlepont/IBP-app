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
