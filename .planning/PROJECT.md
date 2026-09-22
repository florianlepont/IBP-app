# Cortege — IBP (Indice de Biodiversité Potentielle)

## What This Is

Cortege is a French field-survey mobile app (iOS + Android) for the association Etats-Sauvages that
lets ecologists score the ten CNPF IBP factors (A–J) on forest parcels, entirely offline, and sync
to a shared PostgreSQL database when connectivity returns. Most of the MVP is already built and
running: authentication, the ten-factor guided form, cadastral parcel linkage, photos, offline
drafts and automatic sync, parcel history and versioning.

**This milestone is internal-only.** The app is used by the project's own observers, not the public.
The entire community and social dimension — public map, gamification, moderation, association
section and donation — moves to the next milestone.

## Core Value

An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server
intact on reconnection — no data loss, no duplicates.

## Business Context

- **Customer**: Association Etats-Sauvages — field ecologists, observers and coordinators
- **Revenue model**: None. Public-interest project; donation flows are deferred to the next milestone
- **Success metric**: Field tests pass — an ecologist completes a full IBP survey offline on a real parcel, and sync completes with no data loss and no duplicates on reconnection
- **Strategy notes**: `docs/project/presentation-association.md` (stakeholder view, May 2026)

## Requirements

### Validated

Shipped and field-tested (28 manual cases, `docs/user-tests/epic-a-access-and-security.md`):

- ✓ Login, logout, sign-up, social login (Apple/Google), profile management, password reset, account deletion — Epic A

### Built but not yet field-tested

Working in the codebase; their field-test evidence is the deliverable of Phase 7:

- ✓ Survey list and survey detail with parcel history — Epic B
- ✓ Guided ten-factor entry, draft saving, photos, parcel linkage, submission, on-demand help, versioning — Epic C
- ✓ Offline work, automatic sync, conflict resolution — Epic D

### Active

This milestone's build scope. Detail and IDs in `.planning/REQUIREMENTS.md`:

- [ ] On-device tree species recognition for Factor A (US-C9) — gated behind an ML ADR and a data/API contract extension
- [ ] Offline map: offline basemap and parcels, area download, missing-parcel warning, satellite/map basemap switch
- [ ] PDF export of a survey, generated on device and delivered through the OS share sheet, working offline
- [ ] The map shows the user's own surveys instead of the public anonymized set
- [ ] Own-survey management restricted to deletion
- [ ] PostgreSQL out of PoC status: reliable backups and reliable migrations
- [ ] The current VPS ratified as the hosting target in an ADR
- [ ] Dead code and known defects removed; highest-severity codebase concerns addressed
- [ ] Stale specs corrected so documentation matches shipped behaviour
- [ ] Field-test reports for Epics B, C and D

### Out of Scope

Deferred to the **next milestone** (community / social). The code already exists for several of
these — they are deferred, not dropped:

- Nationwide public IBP map (REQ-F-france-map) — internal-only milestone has no public audience
- Public parcel status map (REQ-B-parcel-status-map) — same reason
- Explore as an analysis surface (REQ-B-explore-analysis) — same reason
- Private/public visibility choice (REQ-C-privacy-choice) — meaningless with no community surfaces
- Epic E (data quality, reporting, moderation) — requires a back-office that no spec defines
- Epic F (gamification: points, leaderboard, badges, rare-species points)
- Epic G (IBP information, association visibility, donation) — requires a CMS surface
- Epic I (workshops and training, HelloAsso registration) — uncontracted
- A back-office / CMS web surface — **prerequisite for the next milestone**; needs its own ADR, architecture block and contract before Epics E and G can be planned

Deferred to **V2**:

- Epic H (regional overviews, parcel trend analytics, factor distributions, analytics trust)

Explicitly excluded from this milestone:

- Hosting migration — the current VPS is ratified, not replaced
- alwaysdata + Cloudflare R2 (from the stakeholder presentation) — internal-only removes the scale and cost constraints that motivated it
- An API endpoint or direct Google Drive OAuth for PDF export — on-device generation plus the OS share sheet covers every delivery target

## Context

**Brownfield.** Roughly 20 of the 28 originally-scoped MVP requirements are already implemented and
running. This milestone finishes the remainder and proves the whole thing in the field.

- npm workspaces monorepo: `mobile/` (Expo / React Native) and `api/` (NestJS + PostgreSQL, raw SQL via `pg`, no ORM)
- 12 SQL migrations applied; `009_survey_parcels.sql` established multi-parcel linkage
- Deployed on a self-hosted VPS: Docker + Caddy + GHCR + a systemd timer polling the registry, MinIO for object storage, on `cortege.algernon.ovh`
- Auth0 handles every auth flow; the backend is stateless with respect to sessions
- Codebase maps: `.planning/codebase/{STACK,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,INTEGRATIONS,CONCERNS}.md`
- Ingest intel: `.planning/intel/SYNTHESIS.md` and per-type files; conflict report at `.planning/INGEST-CONFLICTS.md`

**Known issues carried into this milestone** (from `.planning/codebase/CONCERNS.md`):

- SQL built by string interpolation in `api/src/users/users.service.ts` (account deletion path)
- 9 of 12 mobile screens have no test coverage
- Missing indexes on `attachments`, `survey_parcels`, `users(auth0_sub)`
- `api/src/users/email.service.ts` is orphaned — imported nowhere, registered in no module, dead since the Auth0 migration; the `SMTP_*` env vars are vestigial
- `BUG-A3-4`: duplicate-email sign-up shows a generic Auth0 error (medium)
- `BUG-A6-2`: password-reset email lands in spam — an Auth0 tenant setting, **not** an SMTP problem

**Schedule reality.** The stakeholder presentation (May 2026) published: MVP finalized September
2026, field tests October–December 2026, store publication January 2027. Today is 2026-09-22 — the
first date is reached now, with species recognition still unbuilt and unresearched. The roadmap
front-loads that unknown so the slip is measured early rather than discovered in December.

## Constraints

- **Tech stack**: Fixed by ADR-001 (see Locked Decisions) — React Native + Expo, NestJS, PostgreSQL, S3-compatible storage, Auth0. Not reopenable in this milestone
- **Offline-first**: Every survey-entry and map feature must work with no network. This is the product, not a feature
- **Data contract**: Multi-parcel linkage (`survey_parcels`) and the shipped status enum are authoritative — see Key Decisions
- **API contract**: `CON-API-001` — `/v1` prefix, Bearer auth, idempotent upsert on (`id`, `sync_version`), standard error codes
- **Domain rules**: `CON-SCHEMA-002` (ten factors with ACA/M thresholds, caps, blocking and non-blocking validations) and `CON-PROTO-001` (17 reference cases in `api/test/ibp-rules.spec.ts`) constrain any change to scoring
- **Sync protocol**: `CON-PROTO-002` — fatal vs retryable policy, retry cap of 8, error payload contract
- **Design**: `CON-DESIGN-001` — Etats Sauvages graphic charter (9 color tokens, 3 typefaces, logo rules)
- **Platforms**: iOS 17 minimum, Android 12 (API 31) minimum
- **Budget**: ~€346/yr running. The VPS is already paid for; species recognition must not add a recurring inference cost
- **Solo**: One developer plus Claude. No team, no back-office, no second application

## Locked Decisions (ADR-001)

Source: `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md` (Accepted
2026-03-08, updated 2026-04-06 for Auth0 delegation). Precedence 0. These are **LOCKED** — changing
any of them requires a superseding ADR, not a phase decision.

<decisions>

| ID | Decision | Status | Scope |
|----|----------|--------|-------|
| DEC-001 | Mobile client is React Native + Expo + TypeScript | LOCKED | mobile application |
| DEC-002 | Backend is Node.js + NestJS, modular within a **single** service; microservices out of scope | LOCKED | backend service |
| DEC-003 | PostgreSQL is the relational datastore | LOCKED | persistence |
| DEC-004 | Photos are stored in S3-compatible object storage | LOCKED | attachments / media |
| DEC-005 | Authentication is Auth0 — JWT RS256 validated against JWKS; token issuance, session lifecycle, social providers and password reset fully delegated; **the backend is stateless with respect to sessions** | LOCKED | auth, sessions, identity |
| DEC-006 | Offline-first model with a local queue and retry; explicit sync statuses on mobile and backend; the sync engine is tested from the beginning | LOCKED | sync engine, mobile persistence |
| DEC-007 | At sync time the server validates and acknowledges — the server is the source of truth | LOCKED | sync semantics, business validation |
| DEC-008 | Sync is idempotent — replaying a request must not duplicate records | LOCKED | sync API |
| DEC-009 | API is versioned with a `/v1` prefix | LOCKED | API surface |
| DEC-010 | Security baseline: TLS for all API traffic, short-lived Auth0 RS256 JWT, encrypted local storage for sensitive data | LOCKED | security |
| DEC-011 | Observability baseline: structured logs and sync error tracing | LOCKED | observability |
| DEC-012 | A stable data contract (Survey, status, timestamps) must be defined early | LOCKED | data model |
| DEC-013 | Explicitly NOT decided by ADR-001: final cloud provider selection, full event sourcing, microservices | LOCKED (as a non-decision) | scope boundary |
| DEC-014 | Scaleway is recorded as a valid option, **not ratified**. Explicitly out of scope per DEC-013 | LOCKED (as a note, not a decision) | hosting |

</decisions>

**Consequence for this milestone:** DEC-013 and DEC-014 leave hosting undecided at ADR level, which
is why ratifying the current VPS is in scope (Phase 6). DEC-005 is why `BUG-A6-2` is an Auth0 tenant
setting and why `EmailService` is dead code. DEC-006 and DEC-008 are what the field tests prove.

## Key Decisions

Decisions made for this milestone, on top of the locked ADR-001 set.

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| The app is internal-only for this milestone; the community/social dimension moves to the next one | Removes the scale, cost, anonymization and moderation constraints from the critical path; focuses the milestone on completing a survey | — Pending |
| **Multi-parcel linkage wins.** A survey may reference one or many parcels via `survey_parcels`. `docs/specs/ibp-form-spec.md` §4 ("one cadastral parcel") is stale, as is `REQ-X-parcel-required` | The code is the arbiter: `api/migrations/009_survey_parcels.sql` creates the link table (composite PK, backfilled from `surveys.parcel_id`). The API contract, the data contract V1.2 addendum and US-C4 all agree | ✓ Good |
| **The data-contract status enum wins.** `status IN ('draft','submitted','synced','error','expired')` with `submitted_at` and `deleted_at`. No `deleted` enum value, no `published_at` column. `docs/specs/ibp-form-spec.md` §10.1 is stale | The code is the arbiter: `api/migrations/001_init.sql` ships exactly this CHECK constraint | ✓ Good |
| Three-phase taxonomy adopted: MVP / V1 / V2. `docs/specs/user-stories.md` §4 — which calls the whole first release "V1" — gets retitled | Resolves conflict-report warning 3; every phase assignment depended on the ambiguity | — Pending |
| US-C9 species recognition stays in the MVP, behind two blocking gates: an ML ADR and a data/API contract extension | It is the single largest unknown in the milestone and is invisible to every binding contract. Gating it front-loads the risk and makes a no-go cheap | — Pending |
| Ratify the current VPS (Docker + Caddy + GHCR + systemd timer + MinIO on `cortege.algernon.ovh`) as the hosting target in a new ADR; not a hosting migration | Closes conflict-report warning 7. The alwaysdata + Cloudflare R2 target in the stakeholder presentation was motivated by public-scale cost; internal-only removes that motivation | — Pending |
| PDF export is generated on device (expo-print) and delivered through the OS share sheet (expo-sharing) — no API endpoint, no Drive OAuth | Must work offline, which rules out a server-side generator; the share sheet reaches Drive, Wimi, mail and AirDrop without integrating any of them | — Pending |
| `PublicMapScreen` and its navigation are kept; only its data source changes to the user's own surveys. `GET /public/map-items` and `GET /public/parcels/status` stay in place, unused | Keeps the next milestone's public map a data-source swap rather than a rebuild; the offline-map work grafts onto the same screen | — Pending |
| `BUG-A6-2` re-scoped from an SMTP problem to an Auth0 tenant configuration item | DEC-005 delegates password reset entirely to Auth0; there is no SMTP path in the reset flow | ✓ Good |
| A back-office / CMS is **not** built in this milestone, and is recorded as a prerequisite for the next one | Conflict-report warning 6 is moot while Epics E and G are deferred, but it will block them the moment they are picked up | — Pending |

---
*Last updated: 2026-09-22 after initial project definition from ingested docs and codebase maps*
