# Decisions (from ADRs)

Synthesized from ADR-type documents in the ingest set.
Precedence: ADR = 0 (highest). All entries below are **LOCKED** unless stated otherwise.

---

## ADR-001 — Technical Stack and V1 Engineering Principles

- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`
- status: **Accepted** (LOCKED)
- date: 2026-03-08 (updated 2026-04-06 for Auth0 delegation)
- validation: stack validated, V1 principles validated, out-of-scope confirmed

### DEC-001 — Mobile stack
- decision: Mobile client is **React Native + Expo + TypeScript**.
- scope: mobile application
- rationale: fast setup, single mobile codebase, fewer data-structure mistakes, safer refactoring.
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-002 — Backend framework
- decision: Backend API is **Node.js + NestJS**.
- scope: backend service
- rationale: clear modular architecture, long-term maintainability.
- constraint: V1 stays **modular within a single backend service** (microservices explicitly out of scope).
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-003 — Database
- decision: **PostgreSQL** is the relational datastore.
- scope: persistence
- rationale: robust relational model, suited to surveys and audit history.
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-004 — Media storage
- decision: Photos are stored in **S3-compatible object storage**.
- scope: attachments / media
- rationale: simple, standard approach for media files.
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-005 — Authentication (full delegation)
- decision: Authentication is **Auth0** — JWT **RS256** validated against **JWKS**.
- scope: auth, sessions, identity
- detail: token issuance, session lifecycle, social providers and password reset are **fully delegated to Auth0**. All auth flows (login, sign-up, social providers, password reset, token rotation) are handled by Auth0.
- constraint: **the backend is stateless with respect to sessions.**
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-006 — Offline-first synchronization
- decision: **Offline-first model with a local queue and retry.**
- scope: sync engine, mobile persistence
- detail: users can complete a survey without network access.
- consequence: explicit sync statuses are required on both mobile and backend; the sync engine must be tested from the beginning.
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-007 — Server is source of truth
- decision: At sync time, **the server validates and acknowledges data**.
- scope: sync semantics, business validation
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-008 — Idempotent sync operations
- decision: **Replaying a sync request must not duplicate records.**
- scope: sync API
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-009 — API versioning
- decision: API is versioned with a **`/v1` prefix**.
- scope: API surface
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-010 — Security baseline
- decision: **TLS** for all API traffic, **short-lived Auth0 JWT (RS256)**, **encrypted local storage** for sensitive data.
- scope: security
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-011 — Observability baseline
- decision: **Structured logs and sync error tracing.**
- scope: observability
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-012 — Stable data contract required early
- decision: A stable data contract (Survey, status, timestamps) **must be defined early**.
- scope: data model
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-013 — Explicitly OUT of scope for ADR-001
- not decided: **final cloud provider selection**
- not decided: **full event sourcing**
- not decided: **microservices** (V1 stays a single modular backend service)
- note: because cloud provider selection is explicitly deferred, no locked decision exists on hosting. See `INGEST-CONFLICTS.md` [WARNING] on hosting target.
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

### DEC-014 — Cloud provider note (NOT a decision)
- note: **Scaleway** is recorded as a *valid option* (French/EU hosting, managed PostgreSQL, S3-compatible storage), with tradeoffs to evaluate: team familiarity, service maturity, cost predictability for media traffic.
- status: **option, not ratified.** Explicitly out of scope per DEC-013.
- source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`

---

## Coverage note

Only one ADR exists in the ingest set. No LOCKED-vs-LOCKED contradiction is possible within ADRs.
Decisions asserted in lower-precedence documents that contradict the above are recorded in
`.planning/INGEST-CONFLICTS.md` (auto-resolved in favor of ADR-001).
