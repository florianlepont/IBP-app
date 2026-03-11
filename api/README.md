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

To hide `email_change_token_dev` outside local dev, keep `NODE_ENV` different from `development` (or set `AUTH_DEV_EXPOSE_EMAIL_TOKEN=false`).

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
