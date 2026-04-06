# IBP App

Monorepo for the IBP field-survey product:

- `mobile/`: Expo / React Native client for field data collection
- `api/`: NestJS API with PostgreSQL persistence
- `infra/`: local Docker stack and Freebox deployment compose file
- `docs/`: product, technical and design documentation

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

## Local setup

```bash
npm install
cp api/.env.example api/.env
cp mobile/.env.example mobile/.env
docker compose -f infra/docker-compose.yml up -d
```

## Run locally

API:

```bash
npm run dev:api:migrated
```

Mobile:

```bash
npm run dev:mobile
```

Useful local URLs:

- API health: `http://localhost:3000/v1/health`
- Default mobile API base URL: `http://localhost:3000/v1`

For a physical device, point the mobile app to `http://<YOUR_LAN_IP>:3000/v1`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run format:check
```

Coverage helpers:

```bash
npm run test:coverage:api
npm run test:coverage:mobile
```

## Root scripts

```bash
npm run dev:api
npm run dev:api:migrated
npm run dev:mobile
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

## Environment files

- `api/.env.example`: local API configuration
- `api/.env.production.example`: production-oriented API example
- `mobile/.env.example`: Expo public variables
- `infra/.env.example`: local infra defaults
- `infra/.env.freebox.example`: Freebox deployment example

## Deployment

- CI builds and tests the repo on pushes and pull requests to `main`
- `Deploy` publishes the API image and restarts the Freebox stack through the self-hosted runner
- Runtime secrets for Freebox live on the machine in `/home/freebox/.env.freebox`

## Documentation

- [Docs index](docs/README.md)
- [Technical architecture](docs/technical/technical-architecture-v1.md)
- [API contract](docs/technical/api-contract-v1.md)
- [Data contract](docs/technical/data-contract-v1.md)
- [IBP form spec](docs/specs/ibp-form-spec.md)
