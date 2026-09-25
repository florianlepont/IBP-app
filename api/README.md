# API (NestJS)

## Current scope
- NestJS app with global prefix `/v1`
- JWT auth with refresh flow
- PostgreSQL-backed users and surveys
- SQL migration runner

## Environment
Create `api/.env` from `.env.example`:

```bash
cp api/.env.example api/.env
```

Email confirmation can run in two modes:
- `SMTP_ENABLED=false` (default): no SMTP send, token is logged in API output (dev flow).
- `SMTP_ENABLED=true`: real SMTP delivery using `SMTP_*` variables.

Auth0 configuration:
- `AUTH0_DOMAIN`: tenant Auth0 domain used by the backend for management API calls.
- `AUTH0_PUBLIC_DOMAIN`: optional public/custom Auth0 domain used by the mobile login flow. Set this when the app authenticates through a custom domain so JWT issuer validation matches the issued tokens.
- `AUTH0_AUDIENCE`: API identifier expected in access tokens.

Cadastre resolution mode:
- `CADASTRE_PROVIDER=synthetic` (default, offline-safe).
- `CADASTRE_PROVIDER=ign` to resolve real parcel metadata through IGN reverse geocoding (`CADASTRE_IGN_REVERSE_URL`).
- With `ign`, the provider also attempts parcel polygon fetch from API Carto (`CADASTRE_IGN_APICARTO_PARCEL_URL`).
- `CADASTRE_PROVIDER_ALLOW_FALLBACK=true` keeps synthetic fallback if IGN is unavailable.

## Run
```bash
npm run migrate
npm run dev:api
```
