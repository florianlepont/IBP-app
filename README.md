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

If you need a native iOS development build instead of Expo Go:

```bash
npm run ios -- --device
```

If the iOS build fails with a missing `ReactCodegen.modulemap`, regenerate Pods from the real mobile project:

```bash
cd mobile/ios
pod install
```

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

## License

Copyright (c) 2026 Florian Lepont. All rights reserved.

This repository is **source-available, not open source**: the code is published
for transparency and review, and no reuse is permitted without prior written
consent. See [LICENSE](LICENSE).

Brand assets under `media/` belong to the association **Etats Sauvages** and the
IBP methodology is the work of **CNPF / INRAE Dynafor** — neither is covered by
the above. See [NOTICE.md](NOTICE.md).
