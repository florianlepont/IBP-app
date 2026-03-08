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

## Run
```bash
npm run migrate
npm run dev:api
```
