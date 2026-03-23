# ADR-001 - Technical Stack and V1 Engineering Principles

## Status
Accepted

## Date
2026-03-08

## Context
The IBP project must work in low-connectivity conditions, on iOS and Android, with reliable synchronization, and with a team that is still building technical architecture experience.

## Decision (proposed)
- Mobile: React Native + Expo + TypeScript
- Backend API: Node.js + NestJS
- Database: PostgreSQL
- Photo storage: S3-compatible object storage
- Authentication: JWT (access + refresh token)
- Synchronization: offline-first model with local queue and retry

## Why these choices
- React Native + Expo: fast setup and a single mobile codebase.
- TypeScript: fewer data-structure mistakes and safer refactoring.
- NestJS: clear modular architecture and good long-term maintainability.
- PostgreSQL: robust relational model, well suited for surveys and audit history.
- S3-compatible storage: simple and standard approach for media files.

## V1 Engineering Principles
- Offline-first: users can complete a survey without network access.
- Server source of truth: at sync time, the server validates and acknowledges data.
- Idempotent sync operations: replaying a request must not duplicate records.
- Versioned API: `/v1` prefix.
- Baseline security: TLS, short-lived tokens, encrypted local storage for sensitive data.
- Baseline observability: structured logs and sync error tracing.

## Consequences
- Explicit sync statuses are required on both mobile and backend.
- A stable data contract must be defined early (Survey, status, timestamps).
- The sync engine must be tested from the beginning.

## Out of Scope for This Decision (later)
- Final cloud provider selection
- Full event sourcing
- Microservices (V1 stays modular within a single backend service)

## Cloud Provider Note (France-first option)
Scaleway is a valid option for this project.

Why it fits:
- French/EU hosting option aligned with data sovereignty expectations.
- Managed PostgreSQL and S3-compatible object storage are available.
- Good fit for a pragmatic V1 architecture.

Tradeoffs to evaluate before final choice:
- Team familiarity and operational tooling.
- Service maturity/features versus alternatives.
- Cost predictability for mobile media traffic and storage growth.

## Expected Validation
- [x] Stack validated
- [x] V1 principles validated
- [x] Out-of-scope confirmed
