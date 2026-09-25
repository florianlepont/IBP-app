# Requirements: Cortege — IBP

**Defined:** 2026-09-22
**Milestone:** MVP — internal-only, field-test ready
**Core Value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.

**ID convention:** `REQ-{epic}-{slug}`, carried over from `.planning/intel/requirements.md`. Slug IDs
are used instead of the original `US-*` IDs because Epic D reuses three story IDs for six stories
(see `REQ-DOC-epicd-ids` below). New IDs introduced by this milestone use the same shape with the
prefixes `ML` (species recognition groundwork), `INF` (infrastructure), `QA` (quality and defects),
`DOC` (documentation accuracy) and `FT` (field tests).

**Build status legend:**

| Status | Meaning |
|--------|---------|
| Built | Implemented and working; this milestone verifies it in the field |
| Partial | Implemented but its scope changes in this milestone |
| New | Not built |

> **Scope note.** The release labels in `.planning/intel/requirements.md` are the original ones and
> are partly obsolete. This document is authoritative. The app is internal-only for this milestone;
> the entire community/social dimension is deferred.

---

## MVP Requirements

### A — Access and Security

All seven are Built and field-tested (`docs/user-tests/epic-a-access-and-security.md`, 28 cases).
Two carry open defects, fixed in Phase 7.

- [x] **REQ-A-login** — Contributor logs in with credentials; session survives app restarts. *(Built)*
- [x] **REQ-A-logout** — Contributor logs out from the profile menu and returns to login. *(Built)*
- [ ] **REQ-A-signup** — Contributor creates an account with email + password, with validation, verification and actionable errors. *(Built — `BUG-A3-4` open: duplicate email shows a generic Auth0 error)*
- [x] **REQ-A-social-login** — Sign in with Apple and Sign in with Google, with account-linking on an existing email. *(Built — shipped without field-test coverage)*
- [x] **REQ-A-profile** — Contributor views and edits first name, last name, display name and profile picture (camera or gallery). *(Built)*
- [ ] **REQ-A-forgot-password** — Contributor requests a reset link, single-use and expiring after 24 h. *(Built — `BUG-A6-2` open: reset email lands in spam, an Auth0 tenant setting)*
- [x] **REQ-A-delete-account** — Contributor deletes the account irreversibly; personal data erased, submitted surveys anonymised and retained. *(Built)*

### B — Survey Preparation

- [x] **REQ-B-survey-list** — Contributor sees their surveys with parcel ids, name, last update, version, status and completion rate; filterable by status and date; visible offline. *(Built)*
- [x] **REQ-B-survey-detail** — Contributor sees survey detail with submission deadline, completion rate, previous surveys on the same parcel, and IBP total + factor-level deltas against previous versions. *(Built)*
- [ ] **REQ-B-manage-published** — Contributor deletes their **own** survey with a confirmation step; the deleted survey leaves their list. **Scope reduced: the private/public visibility toggle is removed for this milestone.** *(Partial)*
- [ ] **REQ-B-own-surveys-map** — The map screen shows the contributor's **own** surveys instead of the public anonymized set. `PublicMapScreen` and its navigation are kept; only the data source changes. `GET /public/map-items` and `GET /public/parcels/status` stay in place, unused. *(New — no source doc; created by this milestone)*

### C — IBP Survey Data Entry

- [x] **REQ-C-guided-entry** — Contributor completes all ten IBP factors (A–J) in a guided form with required-field marking, appropriate field types and per-field validation errors. *(Built)*
- [x] **REQ-C-save-draft** — Draft saves automatically while editing, is available offline, shows its last-modified date, and warns under 24 h before expiry. *(Built)*
- [x] **REQ-C-photos** — Contributor adds up to 10 photos per survey, previews and removes them before submission; photos stay linked after sync. *(Built)*
- [x] **REQ-C-parcel-linkage** — Contributor taps parcel polygons to select or deselect them; a survey references one or many parcels (`parcel_ids[]`); the map can centre on current location; submission is blocked when linkage is missing or invalid. *(Built)*
- [x] **REQ-C-submit** — Submission is blocked until all ten factors are scoreable and parcel linkage metadata is present, blocked past 7 days, states the explicit reason when blocked, and transitions to `submitted` + read-only with automatic sync. *(Built)*
- [x] **REQ-C-help** — Each complex field exposes on-demand pedagogical help that does not lose form progress. *(Built)*
- [x] **REQ-C-versioning** — A survey carries an explicit version number and observation year; the app proposes the next version on an already-studied parcel and shows previous scores. *(Built — `api/migrations/008_parcels_and_versioning.sql`. Originally labelled V1; promoted to MVP because parcel history is in scope)*
- [ ] **REQ-C-species-recognition** — From the Factor A section, the contributor adds photos and the app suggests tree species with a confidence score; the contributor confirms, edits or rejects each suggestion; the retained species is saved with the survey; works offline on-device or states plainly when connectivity is required. *(New — US-C9. The single largest unknown in the milestone; gated behind `REQ-ML-adr` and `REQ-ML-contracts`)*
- [ ] **REQ-C-pdf-export** — Contributor exports a survey as a PDF generated **on device** (expo-print) and delivers it through the OS share sheet (expo-sharing) to any installed target — Google Drive, Wimi, mail, AirDrop. Must work offline. No API endpoint, no direct Drive OAuth integration. *(New — no source doc; created by this milestone)*

### D — Offline and Synchronization

- [x] **REQ-D-offline-work** — Contributor views loaded surveys and edits drafts offline; actions are queued; parcel linkage metadata and recent cadastral context are available offline. *(Built)*
- [x] **REQ-D-auto-sync** — On reconnection, pending surveys are sent automatically with no manual trigger; status becomes `synced`, or `error` with an actionable message; downsync includes parcel history. *(Built)*
- [x] **REQ-D-conflict-resolution** — A server-rejected parcel/version conflict is stored as a clear blocking error explaining expected vs local state; the contributor retries after correction or discards. *(Built)*
- [ ] **REQ-D-offline-map** — A clear offline indicator is shown; the map renders a basemap and locally available parcels; GPS position displays and can be followed; zoom, pan and parcel selection work with no connectivity. *(New — verified absent: no offline handling in `mobile/src/screens/`)*
- [ ] **REQ-D-area-download** — Contributor selects an area, sees estimated size and download progress, lists and deletes downloaded areas, and the area survives an app restart. *(New)*
- [ ] **REQ-D-offline-parcel-warning** — When an expected parcel is not cached, a clear message explains it and a quick action starts the download once the network returns; no infinite spinners. *(New)*
- [ ] **REQ-D-basemap-switch** — A basemap selector toggles at least "Satellite" and "Map"; the selection persists while navigating; the default is configurable. *(New — verified absent: no `mapType` or `provider` in `mobile/src/screens/`)*

### ML — Species Recognition Groundwork

Blocking prerequisites for `REQ-C-species-recognition`. Both exist because US-C9 is invisible to
every binding contract (conflict-report warning 5).

- [ ] **REQ-ML-adr** — An accepted ADR records the on-device ML approach: inference runtime, model and licence, on-device model size, measured latency and accuracy on real iOS and Android devices, offline-vs-online behaviour, and an explicit go/no-go for US-C9 in this milestone with a stated fallback. *(New)*
- [ ] **REQ-ML-contracts** — `docs/technical/data-contract-v1.md` gains a species entity linked to a survey's Factor A (species, confidence score, suggestion outcome), `docs/technical/api-contract-v1.md` gains the species endpoint(s) under `/v1`, and a migration implements the schema. Species data round-trips through `POST /surveys/sync` idempotently. *(New)*

### INF — Infrastructure

- [ ] **REQ-INF-hosting-adr** — A new ADR ratifies the **current VPS** as the hosting target: Docker + Caddy + GHCR + systemd timer + MinIO on `cortege.algernon.ovh`. Supersedes the unratified alwaysdata + Cloudflare R2 note. Closes conflict-report warning 7. Not a hosting migration. *(New)*
- [ ] **REQ-INF-backups** — PostgreSQL leaves PoC status: a scheduled backup runs unattended and a restore into a clean database has been performed and recorded at least once. *(New)*
- [ ] **REQ-INF-migrations** — Migrations run reliably on deploy: a fresh database and the production database reach the same schema version through a documented path, and a failed migration does not leave the schema half-applied. *(New)*
- [ ] **REQ-INF-deadcode** — `api/src/users/email.service.ts` (orphaned since the Auth0 migration — imported nowhere, registered in no module) and the vestigial `SMTP_*` env vars are removed from the repo, `api/.env.example` and the deployment env. *(New)*

### QA — Quality and Defects

- [ ] **REQ-QA-ibp-version** — The IBP method version the app implements is established and ratified. The repo cites IBP Fr v3.0 (PDFs dated 2023-03-23); the CNPF's current publication is FR v3.2 (dated 2026-02-02). All ten factors are compared, every divergence is recorded against `ibp-rules.service.ts`, `ibp-scoring.ts` and the 17-case validation matrix, and a documented decision either migrates to v3.2 or stays on v3.0 for stated reasons. *(New — surfaced by Phase 1 research)*
- [ ] **REQ-QA-sql-injection** — A lint rule rejects interpolating values into SQL strings. *(Re-scoped 2026-09-23: account deletion in `api/src/users/users.service.ts` interpolates only constant subqueries and binds the user id as `$1`, so there is no injection today; the requirement now prevents one from appearing)*
- [ ] **REQ-QA-indexes** — `survey_events(actor_id)` is indexed, and the redundant `idx_users_auth0_sub` (duplicates the UNIQUE constraint), `idx_survey_parcels_survey_id` (duplicates the primary-key prefix) and `idx_surveys_parcel_id` are dropped. *(Re-scoped 2026-09-23: the three indexes originally listed already exist — migrations 003, 009 and 011)*
- [ ] **REQ-QA-screen-tests** — The survey list, survey detail, survey form and map screens have tests covering sync-status, filter and error states. 9 of 12 screens have no coverage today. *(New)*
- [ ] **REQ-QA-bug-a3-4** — Sign-up with an already-registered email shows a specific message inviting the user to log in, not a generic Auth0 error. *(New — `BUG-A3-4`, medium)*
- [ ] **REQ-QA-bug-a6-2** — Password-reset email deliverability is closed as an **Auth0 tenant configuration** item (sender domain / DKIM), with the tenant change recorded. Explicitly **not** an SMTP fix. *(New — `BUG-A6-2`, re-scoped)*

### DOC — Documentation Accuracy

- [ ] **REQ-DOC-form-spec** — `docs/specs/ibp-form-spec.md` §4 is corrected to "one or many cadastral parcels (`parcel_ids[]`)" and §10.1 to the shipped status enum `draft | submitted | synced | error | expired` with `submitted_at` and `deleted_at`, no `deleted` value and no `published_at`. Closes conflict-report warnings 1 and 2. *(New)*
- [ ] **REQ-DOC-taxonomy** — The three-phase taxonomy (MVP / V1 / V2) is adopted and `docs/specs/user-stories.md` §4 — currently titled "Scope (V1)" for the whole first release — is retitled accordingly. Closes conflict-report warning 3. *(New)*
- [ ] **REQ-DOC-epicd-ids** — The duplicate `US-D1` / `US-D2` / `US-D3` IDs in `docs/specs/epic-d-offline-and-synchronization.md` are renumbered so the six stories have six distinct IDs. Closes conflict-report warning 4. *(New)*

### FT — Field Tests

- [ ] **REQ-FT-field-tests** — Field-test reports exist for Epics B, C and D in the form of `docs/user-tests/epic-a-access-and-security.md`, each case with a recorded outcome, including at least one full offline-survey-to-sync run on a real parcel verified for completeness and absence of duplicates. *(New — this is the milestone's success metric)*

---

### AUD — Code Audit Remediation (2026-09)

Source: `docs/audits/audit-2026-09-code-complet.md` (findings) and `docs/audits/plan-remediation-2026-09.md`
(lots L1–L20). All twenty lots are in this milestone: the lots that threaten the core value — no data
loss, no duplicates — or that expose accounts run first (Phases 1.2–1.5), the rest right after (Phases 1.6–1.9).

- [x] **REQ-AUD-session-data-loss** — A token-refresh failure caused by the network, a timeout or an unknown error never deletes local surveys, photos or the sync queue; only an explicit refresh-token rejection ends the session, the queue survives re-login with the same account, and logout with unsynced work purges only after a confirmation that counts it. The 401 retry forces a token refresh. The pre-Auth0 session stubs are removed. *(Audit M-C1 — critical. Lot L1)*
- [x] **REQ-AUD-rate-limit** — Rate limiting keys on the real client behind Caddy (`trust proxy` loopback, per-user tracker) with production limits that one syncing device cannot exhaust for everyone. *(Audit A-C1 — critical. Lot L2)*
- [x] **REQ-AUD-debug-surface** — `DebugModule` and the HS256 test-token path are not loaded in production. *(Audit A-H4. Lot L2)*
- [x] **REQ-AUD-identity** — Email-based account linking requires `email_verified === true`; first-login provisioning is race-free; a report does not expose the reporter to the reported surveyor; report reasons are length-bounded. *(Audit A-H1, A-M6. Lot L3)*
- [x] **REQ-AUD-mobile-quick-fixes** — Developer tools are absent from production builds; the nearby-parcels bbox uses `minLng,minLat,maxLng,maxLat`. *(Audit M-H5, M-H3. Lot L4)*
- [x] **REQ-AUD-ci-pipeline** — CI runs typecheck, path-filtered jobs, least-privilege permissions, timeouts, SHA-pinned actions, coverage with ratcheting thresholds, a dependency audit at `high` and a mobile build check (`expo-doctor`, `expo export`). *(Audit CI-1, CI-3–CI-6, T1. Lot L5)*
- [x] **REQ-AUD-reproducible-image** — The API image installs from the root lockfile with `npm ci`, runs as non-root with a healthcheck, is tagged by commit SHA, and is pushed only from `main` under a deploy concurrency group. *(Audit CI-2. Lot L6)*
- [x] **REQ-AUD-test-infra** — Mobile tests run real SQL on in-memory SQLite and test hooks with `renderHook`; `*.test.tsx` is collected; the E2E database is reset before each run. *(Audit T3–T5. Core of lot L7)*
- [x] **REQ-AUD-sync-validation** — Sync operation payloads are validated by class DTOs; upsert ignores client `status`/`expires_at` and cannot overwrite a submitted survey; `parcel_ids` is bounded; deterministic database errors are fatal with generic messages. *(Audit A-H2, A-M2, A-M5. Lot L8)*
- [x] **REQ-AUD-transactions** — Every multi-statement API write runs in one transaction with its event, the upsert is guarded on `sync_version`, concurrent submits on a parcel resolve to one success and one 409, and account deletion commits in the database before deleting the Auth0 user. *(Audit ARCH-3, A-M1, A-M7, A-M9. Lot L9)*
- [x] **REQ-AUD-sync-engine** — The mobile queue drains single-flight, in batches of at most 100, marks a survey synced only when its queue is empty, honours the documented retry cap without counting network/5xx errors, times out every request, and never lets a pull overwrite pending or blocked local changes; autosave reschedules instead of skipping; new IDs are UUIDs. *(Audit M-H1, M-H4 and the mobile medium findings. Lot L11a)*
- [x] **REQ-AUD-local-storage** — Multi-statement SQLite writes are transactional, the local schema is versioned with `PRAGMA user_version`, queue rows carry an explicit operation type, and the queue is indexed. *(Audit ARCH-3 mobile, ARCH-5. Lot L11b)*
- [x] **REQ-AUD-photos** — Photos are resized and persisted in the document directory at capture, uploaded by streaming, network errors do not consume the retry cap, and a missing local file is surfaced instead of silently dropped. Attachments pulled from the server are displayable, and thumbnails render through `expo-image` from downsized sources. *(Audit M-H2 and the remote-attachment and image findings. Lot L12)*

- [x] **REQ-AUD-offline-start** — A cold start with no network and valid stored credentials opens the signed-in app with the last known profile (cached locally) instead of the login overlay; the profile refreshes from `/me` when the API is reachable. *(Found while planning Phase 1.2: `isAuthenticated` depends on a successful `/me` call)*
- [ ] **REQ-AUD-changes-feed** — `/sync/changes` pages on a monotonic sequence and still accepts the old cursor; same-version replays with different content are conflicts; the per-poll re-send of event-less surveys is gone. *(Audit ARCH-6. Lot L10)*
- [ ] **REQ-AUD-object-storage** — One `StorageService` for surveys, attachments and users; profile pictures in object storage; storage keys contained; upload size enforced; MIME allow-list checked by own property. *(Audit A-H3, A-M3, A-M4. Lot L13)*
- [ ] **REQ-AUD-config** — Validated configuration schema, bounded `pg` pool with an error listener, strict CORS in production, Nest `Logger` everywhere, dead token secrets removed. *(Audit A-M8. Lot L14)*
- [ ] **REQ-AUD-surveys-split** — `SurveysService` split into repository, survey, events, parcels and public-map services; batched parcel writes; column-scoped ownership checks; cursor pagination; cached, fully timed-out IGN fetch. *(Audit ARCH-2 and API efficiency findings. Lot L15)*
- [ ] **REQ-AUD-db-tuning** — Public-surveys partial index, generated centroid columns with a btree index (no PostGIS), migration advisory lock, dead `auth_sessions` tables dropped. *(Audit efficiency findings, ARCH-7. Remainder of lot L16)*
- [ ] **REQ-AUD-ibp-domain** — A shared `ibp-domain` workspace package holds the IBP rules and sync contract types used by both API and mobile, verified by one parity fixture. *(Audit ARCH-1, T6. Lot L17)*
- [ ] **REQ-AUD-test-infra-rest** — The RS256 path of `AuthGuard` is tested against a local JWKS; the catch-all E2E suite is split by feature and uses random UUIDs. *(Audit T2, T5. Remainder of lot L7)*
- [ ] **REQ-AUD-mobile-state** — Memoised contexts replace the prop funnel; the survey list is virtualised; completion is precomputed; screens are split under 400 lines; unused styles are removed; navigation is typed; the map requests by bbox and clusters markers. *(Audit ARCH-4 and mobile efficiency findings. Lot L18)*
- [ ] **REQ-AUD-i18n-a11y** — Every user-facing string comes from a French i18n catalogue, status messages are user-facing, and interactive elements carry accessibility roles and labels. *(Audit i18n and accessibility findings. Lot L19)*
- [ ] **REQ-AUD-hygiene** — Root package, tsconfig and unused dependencies cleaned up; `CLAUDE.md` and technical docs match the code; the audit links each finding to its closing PR. *(Audit ARCH-7, ARCH-8. Remainder of lot L20)*

## Cross-Cutting Business Rules

Carried from `.planning/intel/requirements.md`. These are rules that constrain the requirements
above rather than deliverables in their own right, so they are not exclusively phase-mapped; they
are verified within the phases that touch them and in the Phase 7 field tests.

| Rule | Status this milestone |
|------|----------------------|
| `REQ-X-single-site` — a survey is linked to a single site or checkpoint | Active |
| `REQ-X-parcel-required` — a survey must be linked to **one** cadastral parcel | **Overridden** — multi-parcel wins (`survey_parcels`); see `REQ-DOC-form-spec` |
| `REQ-X-gps-not-identifier` — GPS/manual address positions but does not identify | Active |
| `REQ-X-conditional-mandatory` — some fields are mandatory depending on survey type | Active |
| `REQ-X-submit-gate` — submission allowed only when required fields are complete and cadastral linkage is valid | Active |
| `REQ-X-longitudinal` — surveys on a parcel are tracked by observation year and version, with historical comparison | Active |
| `REQ-X-explore-parcel-first` — Explore is a parcel intelligence surface | Deferred with `REQ-B-explore-analysis` |
| `REQ-X-visibility` — each submitted survey has `private`\|`public` | Deferred with `REQ-C-privacy-choice` |
| `REQ-X-pedagogy-on-demand` — pedagogical content on demand without interrupting entry | Active |
| `REQ-X-draft-expiry` — a draft expires 7 days after creation | Active |
| `REQ-X-public-anonymized` — public map data is anonymized | Deferred — no public surface this milestone |
| `REQ-X-parcel-layer-highzoom` — cadastral parcels and `studied`/`not_studied` status at high zoom | Partially deferred: parcel rendering is Active (offline map); public `studied` status is deferred with `REQ-B-parcel-status-map` |
| `REQ-X-points-valid-only` — points only for valid submitted surveys | Deferred with Epic F |
| `REQ-X-anticheat` — anti-cheat rules | Deferred with Epic F |
| `REQ-X-donation-nonblocking` — donation prompts stay non-blocking | Deferred with Epic G |

## Non-Functional Requirements

Active for this milestone; verified in Phase 7 alongside the field tests.

| ID | Requirement |
|----|-------------|
| `REQ-NFR-platforms` | iOS 17 minimum; Android 12 (API 31) minimum |
| `REQ-NFR-launch-time` | App launch under 3 seconds on target devices |
| `REQ-NFR-offline-reliability` | No draft data loss on forced app closure |
| `REQ-NFR-security` | Encrypted local storage for sensitive data; API traffic over TLS |
| `REQ-NFR-gdpr` | Data minimization and a defined retention policy |
| `REQ-NFR-privacy-by-design` | Public map and leaderboard data anonymized — **dormant** this milestone (no public surface), reactivates with the community milestone |

---

## Deferred — Next Milestone (Community / Social)

Recorded, not dropped. The code already exists for several of these.

| Requirement | Note |
|-------------|------|
| `REQ-F-france-map` | Nationwide public map of `public` surveys — built, becomes unused when the map repoints to own surveys |
| `REQ-B-parcel-status-map` | Public parcel `studied`/`not_studied` statuses |
| `REQ-B-explore-analysis` | Explore as a parcel analysis surface |
| `REQ-C-privacy-choice` | Private/public visibility before submission; also restores the toggle removed from `REQ-B-manage-published` |
| `REQ-E-audit-trail`, `REQ-E-search`, `REQ-E-report` | Epic E — data quality and trust |
| `REQ-F-points`, `REQ-F-leaderboard`, `REQ-F-badges`, `REQ-F-rare-species-points` | Epic F — gamification. `REQ-F-rare-species-points` depends on `REQ-C-species-recognition` shipping this milestone |
| `REQ-G-ibp-info`, `REQ-G-association`, `REQ-G-donation` | Epic G — information, association visibility, donation |
| `REQ-I-calendar`, `REQ-I-event-detail`, `REQ-I-register`, `REQ-I-my-registrations`, `REQ-I-events-on-map` | Epic I — workshops and training; uncontracted, HelloAsso dependency |

**Prerequisite for the next milestone:** a back-office / CMS surface. `REQ-E-audit-trail` requires a
moderation interface outside the mobile app; `REQ-G-ibp-info` and `REQ-G-association` require content
updatable without an app release. No SPEC or architecture document defines this surface — it needs
its own ADR, architecture block and contract before Epics E and G can be planned
(conflict-report warning 6, moot for this milestone).

## Deferred — V2

| Requirement | Note |
|-------------|------|
| `REQ-H-regional-overview`, `REQ-H-parcel-trends`, `REQ-H-factor-distribution`, `REQ-H-analytics-trust` | Epic H — forest insights and analytics |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hosting migration | The current VPS is ratified by ADR, not replaced. Internal-only removes the scale pressure |
| alwaysdata + Cloudflare R2 | Named only in a stakeholder presentation, motivated by public-scale cost that no longer applies |
| PDF export API endpoint | Export must work offline; on-device generation is the only way |
| Direct Google Drive OAuth | The OS share sheet reaches Drive, Wimi, mail and AirDrop without integrating any of them |
| Private/public visibility toggle | Meaningless with no community surfaces; returns with `REQ-C-privacy-choice` |
| Back-office / CMS | Deferred with Epics E and G; a second application is out of reach for a solo milestone |
| SMTP email sending | Auth0 owns every auth email (DEC-005); `EmailService` and `SMTP_*` are being deleted, not fixed |

---

## Traceability

Every MVP requirement maps to exactly one phase. **Build** = the phase delivers new work;
**Verify** = the requirement is already built and the phase confirms it in the field.

| Requirement | Status | Phase | Role |
|-------------|--------|-------|------|
| REQ-ML-adr | New | Phase 1 | Build |
| REQ-AUD-session-data-loss | New | Phase 1.2 | Build |
| REQ-AUD-rate-limit | New | Phase 1.2 | Build |
| REQ-AUD-debug-surface | New | Phase 1.2 | Build |
| REQ-AUD-identity | New | Phase 1.2 | Build |
| REQ-AUD-mobile-quick-fixes | New | Phase 1.2 | Build |
| REQ-AUD-ci-pipeline | New | Phase 1.3 | Build |
| REQ-AUD-reproducible-image | New | Phase 1.3 | Build |
| REQ-AUD-test-infra | New | Phase 1.3 | Build |
| REQ-AUD-sync-validation | New | Phase 1.4 | Build |
| REQ-AUD-transactions | New | Phase 1.4 | Build |
| REQ-AUD-sync-engine | New | Phase 1.5 | Build |
| REQ-AUD-local-storage | New | Phase 1.5 | Build |
| REQ-AUD-photos | New | Phase 1.5 | Build |
| REQ-AUD-offline-start | New | Phase 1.5 | Build |
| REQ-AUD-changes-feed | New | Phase 1.6 | Build |
| REQ-AUD-object-storage | New | Phase 1.6 | Build |
| REQ-AUD-config | New | Phase 1.7 | Build |
| REQ-AUD-surveys-split | New | Phase 1.7 | Build |
| REQ-AUD-db-tuning | New | Phase 1.7 | Build |
| REQ-AUD-ibp-domain | New | Phase 1.8 | Build |
| REQ-AUD-test-infra-rest | New | Phase 1.8 | Build |
| REQ-AUD-mobile-state | New | Phase 1.9 | Build |
| REQ-AUD-i18n-a11y | New | Phase 1.9 | Build |
| REQ-AUD-hygiene | New | Phase 1.9 | Build |
| REQ-ML-contracts | New | Phase 2 | Build |
| REQ-DOC-form-spec | New | Phase 2 | Build |
| REQ-C-species-recognition | New | Phase 3 | Build |
| REQ-B-own-surveys-map | New | Phase 4 | Build |
| REQ-D-offline-map | New | Phase 4 | Build |
| REQ-D-area-download | New | Phase 4 | Build |
| REQ-D-offline-parcel-warning | New | Phase 4 | Build |
| REQ-D-basemap-switch | New | Phase 4 | Build |
| REQ-C-pdf-export | New | Phase 5 | Build |
| REQ-B-manage-published | Partial | Phase 5 | Build |
| REQ-INF-hosting-adr | New | Phase 6 | Build |
| REQ-INF-backups | New | Phase 6 | Build |
| REQ-INF-migrations | New | Phase 6 | Build |
| REQ-INF-deadcode | New | Phase 6 | Build |
| REQ-QA-ibp-version | New | Phase 1.1 | Build |
| REQ-QA-sql-injection | New | Phase 6 | Build |
| REQ-QA-indexes | New | Phase 6 | Build |
| REQ-DOC-taxonomy | New | Phase 7 | Build |
| REQ-DOC-epicd-ids | New | Phase 7 | Build |
| REQ-QA-bug-a3-4 | New | Phase 7 | Build |
| REQ-QA-bug-a6-2 | New | Phase 7 | Build |
| REQ-QA-screen-tests | New | Phase 7 | Build |
| REQ-FT-field-tests | New | Phase 7 | Build |
| REQ-A-login | Built | Phase 7 | Verify |
| REQ-A-logout | Built | Phase 7 | Verify |
| REQ-A-signup | Built | Phase 7 | Verify (+ `BUG-A3-4` fix) |
| REQ-A-social-login | Built | Phase 7 | Verify (never field-tested) |
| REQ-A-profile | Built | Phase 7 | Verify |
| REQ-A-forgot-password | Built | Phase 7 | Verify (+ `BUG-A6-2` fix) |
| REQ-A-delete-account | Built | Phase 7 | Verify |
| REQ-B-survey-list | Built | Phase 7 | Verify |
| REQ-B-survey-detail | Built | Phase 7 | Verify |
| REQ-C-guided-entry | Built | Phase 7 | Verify |
| REQ-C-save-draft | Built | Phase 7 | Verify |
| REQ-C-photos | Built | Phase 7 | Verify |
| REQ-C-parcel-linkage | Built | Phase 7 | Verify |
| REQ-C-submit | Built | Phase 7 | Verify |
| REQ-C-help | Built | Phase 7 | Verify |
| REQ-C-versioning | Built | Phase 7 | Verify |
| REQ-D-offline-work | Built | Phase 7 | Verify |
| REQ-D-auto-sync | Built | Phase 7 | Verify |
| REQ-D-conflict-resolution | Built | Phase 7 | Verify |

**Coverage:**

- MVP requirements: **66** total
- Mapped to phases: **66** ✓
- Unmapped: **0** ✓
- Of which carry build work: **47** (19 are already built and are verified in Phase 7)
- Deferred to next milestone: 19 · Deferred to V2: 4

---
*Requirements defined: 2026-09-22*
*Last updated: 2026-09-23 — full code audit remediation inserted as Phases 1.2–1.9*
