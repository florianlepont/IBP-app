# Cortege

Monorepo for the IBP field-survey product:

- `mobile/`: Expo / React Native client for field data collection
- `api/`: NestJS API with PostgreSQL persistence
- `infra/`: local Docker stack and VPS deployment
- `docs/`: product, technical and design documentation

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop

For native builds:

The `mobile/ios` and `mobile/android` projects are generated, not committed —
run `npx expo prebuild` in `mobile/`, or let `npx expo run:ios` do it. See
[`mobile/README-native.md`](mobile/README-native.md).

- **iOS** — Xcode and CocoaPods. Run `pod install` in `mobile/ios` after
  generating or after any dependency change.
- **Android** — Android Studio for the SDK, plus a **JDK 17**. Gradle 8.14
  cannot read the JDK 25 that Android Studio bundles (`Unsupported class file
  major version 69`), so command-line builds need it pointed elsewhere:

  ```bash
  brew install openjdk@17
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
  export ANDROID_HOME=$HOME/Library/Android/sdk
  ```

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
| `PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MS`, `PG_CONNECTION_TIMEOUT_MS`, `PG_STATEMENT_TIMEOUT_MS`, `PG_IDLE_IN_TRANSACTION_TIMEOUT_MS`, `AUTH0_HTTP_TIMEOUT_MS` | Optional pool and timeouts (defaults: 10, 30000, 5000, 10000, 60000, 5000) |
| `OBJECT_STORAGE_MODE` | `local` or `minio` |
| `OBJECT_STORAGE_BUCKET/ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY` | S3-compatible storage config |
| `ATTACHMENTS_UPLOAD_DIR` | Local upload path (when mode = local) |
| `AUTH0_DOMAIN`, `AUTH0_PUBLIC_DOMAIN`, `AUTH0_AUDIENCE` | Auth0 backend validation settings |
| `CADASTRE_PROVIDER` | `synthetic` (offline) or `ign` (real parcels) |
| `CORS_ORIGIN` | Required in production: `none` (no browser origin) or a comma-separated origin list; startup refuses otherwise |

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

`npm run test:e2e` runs against a separate `ibp_test` database (settings in `api/.env.test.example`, override with a gitignored `api/.env.test`), created on the docker-compose Postgres if missing and wiped before every run; it refuses any database whose name does not end in `_test`, so the dev database `ibp` is never touched.

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
- `infra/vps/env.example`: VPS runtime environment

## Deployment

- CI builds and tests the repo on pushes and pull requests to `main`
- Deployment is pull-based: the VPS polls the registry and updates itself, so
  nothing reaches into the machine from GitHub. See
  [`infra/vps/README.md`](infra/vps/README.md)
- Runtime secrets live on the VPS in `/home/ubuntu/cortege.env`, outside the clone

## Documentation

- [Docs index](docs/README.md)
- [Technical architecture](docs/technical/technical-architecture-v1.md)
- [API contract](docs/technical/api-contract-v1.md)
- [Data contract](docs/technical/data-contract-v1.md)
- [IBP form spec](docs/specs/ibp-form-spec.md)

## Contributing and security

This repository does not accept code contributions — see
[CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately through
GitHub's [security advisories](https://github.com/florianlepont/cortege/security/advisories/new),
never in a public issue — see [SECURITY.md](SECURITY.md).

## License

Copyright (c) 2026 Florian Lepont. All rights reserved.

This repository is **source-available, not open source**: the code is published
for transparency and review, and no reuse is permitted without prior written
consent. See [LICENSE](LICENSE).

Brand assets under `mobile/assets/` belong to the association **Etats Sauvages** and the
IBP methodology is the work of **CNPF / INRAE Dynafor** — neither is covered by
the above. See [NOTICE.md](NOTICE.md).
