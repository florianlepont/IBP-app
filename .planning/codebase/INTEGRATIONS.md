# External Integrations

**Analysis Date:** 2026-09-22

## APIs & External Services

**Auth0:**
- Service: OAuth 2.0 / OpenID Connect identity provider
- What it's used for: User authentication, profile management, password reset
- SDK/Client: `react-native-auth0` (Mobile), `jwks-rsa` (API)
- Auth: RS256 JWT validated against Auth0 JWKS endpoint
- Configuration:
  - Mobile: `mobile/.env` - `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID`, `EXPO_PUBLIC_AUTH0_AUDIENCE`
  - API: `api/.env` - `AUTH0_DOMAIN`, `AUTH0_PUBLIC_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`, `AUTH0_APP_CLIENT_ID`
  - Default domain (fallback): `cortege-auth.algernon.ovh`
  - Default audience: `https://api.ibp-app`
- Implementation file: `api/src/auth/auth.guard.ts` (JWT validation), `api/src/auth/auth0-management.service.ts` (user management)

## Data Storage

**Databases:**

**PostgreSQL 16** (Primary)
- Connection: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Client: `pg` library (raw SQL, connection pooling via `Pool`)
- Service: `api/src/database/database.service.ts`
- Local dev connection: `postgres:5432` (Docker Compose)
- Migrations: `api/migrations/` - ordered SQL files executed via `api/scripts/migrate.js`
- No ORM — all queries are raw parameterized SQL

**Expo SQLite** (Mobile Local Storage)
- Database file: `cortege-local.db` (device-local, encrypted on iOS Keychain)
- Schema: `mobile/src/storage/db.ts`
- Tables:
  - `local_surveys` — survey drafts with sync state and payload
  - `sync_queue` — pending operations for server sync
  - `local_attachments` — photo metadata and upload state
  - `app_metadata` — key/value app-level settings
- Offline-first design: all changes written locally before network sync

**File Storage:**

**S3-Compatible Object Storage** (Primary)
- Service: MinIO (local dev), AWS S3 (production)
- SDK: `@aws-sdk/client-s3` (DeleteObjectCommand, S3Client)
- Configuration:
  - `OBJECT_STORAGE_MODE` - `local` or `minio`
  - `OBJECT_STORAGE_BUCKET` - S3 bucket name (e.g., `ibp-media`)
  - `OBJECT_STORAGE_ENDPOINT` - S3 endpoint URL
  - `OBJECT_STORAGE_REGION` - AWS region (e.g., `us-east-1`)
  - `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY` - Credentials
  - `ATTACHMENTS_UPLOAD_DIR` - Local filesystem fallback (when mode = `local`)
- Local dev: MinIO on port 9000 (Docker), console on port 9001
- Usage:
  - Survey attachment upload/download
  - Presigned URL generation via `@aws-sdk/s3-request-presigner`
  - Attachment deletion on survey removal
- Implementation: `api/src/surveys/surveys-attachments.service.ts`

**Caching:**
- Not detected — no Redis or caching layer; all queries hit PostgreSQL

## Authentication & Identity

**Auth Provider:**
- Auth0 (OAuth 2.0 / OpenID Connect)
  - Mobile: Native Auth0 SDK with iOS/Android deep linking
  - API: JWT validation via JWKS endpoint

**Token Management:**
- Access Token: Short-lived JWT for API requests
  - Environment variables: `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN` (e.g., `15m`)
- Refresh Token: Long-lived token for obtaining new access tokens
  - Environment variables: `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRES_IN` (e.g., `7d`)
- Mobile secure storage: Tokens stored in `expo-secure-store` (encrypted)
- API token validation: `api/src/auth/auth.guard.ts` verifies JWT signature and claims

**Current User Injection:**
- Decorator: `@CurrentUser()` in `api/src/auth/current-user.decorator.ts`
- Extracts authenticated user from JWT claims into controller methods

**Auth0 Management API:**
- Service: `api/src/auth/auth0-management.service.ts`
- Capabilities:
  - Email updates (with verification flow)
  - User deletion (with Auth0 removal)
  - Password reset email sending
- Token caching: Management tokens cached with expiration check

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry, Datadog, or error aggregation service configured

**Logs:**
- Console logging via `Logger` from `@nestjs/common` (API)
- Log level: configurable via `NODE_ENV`
- Development logs to stdout
- Startup log explicit at `http://localhost:${port}/v1/health` for debugging

**Health Check:**
- Endpoint: `GET /v1/health` (API)
- Implementation: `api/src/app.controller.ts`

## CI/CD & Deployment

**Hosting:**
- GitHub Container Registry: `ghcr.io/florianlepont/cortege:latest` (API image)
- VPS deployment: Pull-based via systemd timer (polls registry every 5 minutes)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Triggers: Pushes to `main`, PRs to `main`, manual `workflow_dispatch`
- Jobs:
  1. Lint & Format (ESLint, Prettier)
  2. Type check (TypeScript)
  3. Unit tests — API (Jest)
  4. Unit tests — Mobile (Jest)
  5. E2E tests — API (Jest + PostgreSQL service)
  6. Docker build & push (only when `api/**` changed or manual trigger)
- Test PostgreSQL service: PostgreSQL 16 in-container with health checks
- Node version: 22 (enforced via `actions/setup-node@v4`)

**Container Registry:**
- GitHub Container Registry (GHCR)
- Authentication: GitHub token (`secrets.GITHUB_TOKEN`)
- Docker build: Multistage, x86_64 (linux/amd64) optimized for VPS

## Maps Integration

**React Native Maps:**
- Package: `react-native-maps` 1.27.2
- Implementation: Map display in survey site selection
- Providers: Google Maps (Android), Apple Maps (iOS)
- Not explicitly configured for API keys in this codebase; assumes platform-provided keys via Xcode/AndroidManifest

## Email Service (Optional)

**SMTP:**
- Service: Nodemailer
- Configuration:
  - `SMTP_ENABLED` - Enable/disable email (default: false)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
  - `SMTP_SECURE` - TLS/SSL mode
- Implementation: `api/src/users/email.service.ts`
- Use cases:
  - Email change confirmation (token-based)
  - Optionally, password reset notifications
- Disabled in test environment (`NODE_ENV=test`)

## Webhooks & Callbacks

**Incoming:**
- Not detected — API does not expose webhook endpoints for external services

**Outgoing:**
- Auth0 callback URLs (mobile deep linking):
  - iOS: `fr.etatssauvages.cortege.auth0://cortege-auth.algernon.ovh/ios/fr.etatssauvages.cortege/callback`
  - Registered in `app.json` via `react-native-auth0` plugin configuration

## Rate Limiting

**Throttler (API):**
- Framework: NestJS Throttler
- Configuration:
  - Development: 10,000 requests per 60s (essentially unlimited)
  - Production: 10 requests per 60s
- Applied globally via `ThrottlerGuard` in `app.module.ts`

## Security Features

**CORS:**
- Enabled via NestJS `enableCors()`
- Origin: Configurable via `CORS_ORIGIN` environment variable (comma-separated list)
- Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Credentials: Allowed

**Security Headers:**
- Helmet 8.1.0 middleware enabled in `api/src/main.ts`
- Protects against common vulnerabilities (XSS, MIME sniffing, etc.)

**Request Validation:**
- Global validation pipe: `ValidationPipe` in `api/src/main.ts`
- Config: whitelist mode, forbid non-whitelisted fields, auto-transform
- DTO validation: `class-validator` decorators on DTO classes

## IGN Cadastre Integration (Optional)

**Cadastre Provider:**
- Environment variable: `CADASTRE_PROVIDER`
- Options:
  - `synthetic` - Offline test data (default for dev/test)
  - `ign` - Real IGN (French Land Registry) parcel data
- Fallback: `CADASTRE_PROVIDER_ALLOW_FALLBACK` (if set, falls back to synthetic)
- Not explicitly integrated via API client in codebase; queries handled server-side

## Environment Variables Summary

**Critical (required):**
- API: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- API: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`
- Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID`, `EXPO_PUBLIC_AUTH0_AUDIENCE`

**Optional:**
- Mobile: `EXPO_PUBLIC_API_TIMEOUT_MS` (default: 15000ms)
- API: `OBJECT_STORAGE_MODE` (default: local)
- API: `SMTP_ENABLED` (default: false)
- API: `CORS_ORIGIN` (default: allow all)

---

*Integration audit: 2026-09-22*
