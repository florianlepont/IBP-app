# Roadmap: Cortege — IBP

## Overview

Most of the MVP is already built. This milestone closes the gap between "business logic works on my
phone" and "an ecologist trusts it in a forest". It opens with the milestone's one real unknown —
on-device tree species recognition — behind two deliberate gates: an ADR that measures the approach
on real devices, and a data/API contract extension, so a no-go costs days rather than months. It
then completes the offline map the field actually needs, gives the surveyor a way to get a survey
out of the app as a PDF, takes PostgreSQL out of PoC status and ratifies the hosting that has been
running unofficially, and finishes by proving the whole thing in the field — which is the milestone's
success metric, not its afterthought.

**Milestone framing:** internal-only. The community and social dimension (public map, gamification,
moderation, association section, donation) is deferred to the next milestone. See
`.planning/REQUIREMENTS.md` for what is deferred and why.

**Schedule reality:** the published plan (May 2026) put MVP finalization at September 2026, field
tests October–December 2026, store publication January 2027. Today is 2026-09-22 and species
recognition is unbuilt and unresearched. Phases 1–3 front-load that unknown so the slip is measured
in October rather than discovered in December.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Species Recognition — Approach Decision** - Measure on-device ML on real devices and ratify a go/no-go in an ADR
- [ ] **Phase 1.1: Reconcile the IBP method version** (INSERTED) - Establish whether the app still implements the current CNPF method, and what changes if not
- [x] **Phase 1.2: Stop field data loss and account exposure** (INSERTED) - Session errors never delete offline data; no account takeover or open debug surface (completed 2026-09-24)
- [x] **Phase 1.3: CI and test safety net** (INSERTED) - Typecheck in CI, reproducible image, tests that run real SQL (completed 2026-09-24)
- [x] **Phase 1.4: API sync integrity** (INSERTED) - Validated sync payloads, no submit bypass, transactional writes (completed 2026-09-24)
- [x] **Phase 1.5: Mobile sync engine reliability** (INSERTED) - Single-flight drain, bounded batches, durable photos (completed 2026-09-25)
- [x] **Phase 1.6: Sync feed ordering and unified object storage** (INSERTED) - No skipped change between devices; one bounded storage service (completed 2026-09-25)
- [x] **Phase 1.7: API configuration, service split and database tuning** (INSERTED) - Fail-fast config, split SurveysService, bounded and indexed queries (completed 2026-09-26)
- [ ] **Phase 1.8: Shared IBP domain package and test completeness** (INSERTED) - IBP rules defined once; RS256 path tested
- [ ] **Phase 1.9: Mobile state architecture, i18n, accessibility and hygiene** (INSERTED) - Targeted re-renders, French catalogue, accessible controls, accurate docs
- [ ] **Phase 2: Species Contracts & Data-Contract Corrections** - Give species a data model, an API surface and a migration; correct the stale form spec
- [ ] **Phase 3: Species Recognition for Factor A** - Photograph a tree, get a species suggestion, keep or reject it
- [ ] **Phase 4: Offline Map & Own-Survey Navigation** - Navigate a parcel with no network, and see your own surveys on the map
- [ ] **Phase 5: Survey Export & Ownership** - Export a survey as a PDF offline and delete your own surveys
- [ ] **Phase 6: Durable Backend** - Backups that restore, migrations that hold, hosting ratified, dead and unsafe code gone
- [ ] **Phase 7: Field Validation** - Prove the offline survey-to-sync loop on real parcels with real observers

## Phase Details

### Phase 1: Species Recognition — Approach Decision

**Goal**: We know, with numbers from real devices, how on-device tree species recognition will work — or that it cannot ship in this milestone.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-ML-adr
**Success Criteria** (what must be TRUE):

  1. An accepted ADR in `docs/technical/` names the inference runtime, the model and its licence, the on-device model size, and how suggestions behave when the model or the network is unavailable.
  2. A throwaway spike on a real iOS device and a real Android device produces recorded figures for inference latency, model size on disk, and top-1/top-3 accuracy on a handful of French tree species.
  3. The ADR states an explicit go/no-go for US-C9 in this milestone, and if it is a no-go, describes the fallback (manual species entry) and what moves to the next milestone.
  4. The ADR adds no recurring inference cost to the ~€346/yr budget, or states plainly what it would cost.

**Plans**: 6 plans
Plans:

- [ ] 01-01-PLAN.md — Spike scaffold, benchmark-device and field-photo asks, measurement document skeleton
- [ ] 01-02-PLAN.md — CNPF Factor A genus label set (34 classes) and a licence-clean image corpus
- [ ] 01-03-PLAN.md — On-device TFLite harness on real iOS and Android, proven with a stock model
- [ ] 01-04-PLAN.md — Fine-tune, export quantised .tflite, measure top-1/top-3 accuracy per genus
- [ ] 01-05-PLAN.md — Real-device latency against the 3 s budget and field-photograph validation
- [ ] 01-06-PLAN.md — ADR-002 with the go / partial go / no-go for US-C9, ratified

### Phase 01.1: Reconcile the IBP method version — repo implements Fr v3.0, CNPF publishes FR v3.2 (INSERTED)

**Goal**: Know whether the app still implements the current CNPF IBP method, and exactly what changes if it does not.
**Depends on**: Nothing — independent of the species-recognition track. Must land before Phase 2, which writes the Factor A genus list.
**Requirements**: REQ-QA-ibp-version
**Success Criteria** (what must be TRUE):

  1. A written comparison of IBP Fr v3.0 (the version this repo cites, PDFs dated 2023-03-23 in `docs/references/README.md`) against the CNPF's currently published FR v3.2 (dated 2026-02-02), covering all ten factors: field definitions, class thresholds, and the Factor A native-genus list.
  2. Every divergence found is recorded with its concrete impact on `api/src/surveys/ibp-rules.service.ts`, `mobile/src/app/ibp-scoring.ts`, and the 17 reference cases in `docs/technical/ibp-validation-matrix-v1.md`.
  3. An explicit decision is recorded in `docs/technical/`: this milestone either migrates to v3.2 or stays on v3.0. Staying is a legitimate outcome for internal-only use, but it must be a stated choice with its reasoning, not an accident.
  4. If migration is chosen, the effect on surveys already recorded under v3.0 is stated plainly: whether their computed scores change, and what happens to them.
  5. `docs/references/README.md` and `docs/specs/ibp-form-spec.md` cite the version the app actually implements, whichever that turns out to be.

**Why this exists**: surfaced by the Phase 1 research (`01-RESEARCH.md`), which recovered the Factor A genus list from the current official CNPF PDF and found it was v3.2, three years newer than the v3.0 this repo cites. If the method moved, the app computes outdated scores — which matters more than any single feature in this milestone.

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd-plan-phase 01.1 to break down)

### Phase 01.2: Stop field data loss and account exposure (INSERTED)

**Goal**: Nothing an ecologist records offline can be destroyed by a session error, and no account or endpoint can be taken over or opened by configuration mistake.
**Depends on**: Nothing — independent of the species-recognition track. Must land before Phase 7.
**Requirements**: REQ-AUD-session-data-loss, REQ-AUD-rate-limit, REQ-AUD-debug-surface, REQ-AUD-identity, REQ-AUD-mobile-quick-fixes
**Source**: audit lots L1–L4 (`docs/audits/plan-remediation-2026-09.md`), findings M-C1, A-C1, A-H1, A-H4, A-M6, M-H3, M-H5 (`docs/audits/audit-2026-09-code-complet.md`)
**Success Criteria** (what must be TRUE):

  1. A network error, a timeout or an unknown error while refreshing the Auth0 token never deletes `local_surveys`, `sync_queue` or `local_attachments`; only an explicit refresh-token rejection (`invalid_grant`, Auth0 401/403) ends the session, and even then the local queue is kept and syncs after re-login with the same account.
  2. Logging out with unsynced surveys or photos shows how many will be lost and purges only after explicit confirmation; local data is never attached to a different account after re-login.
  3. Behind Caddy, rate limiting keys on the real client (`trust proxy` on loopback, per-user tracker when authenticated); the global production limit no longer lets one syncing device lock out every user.
  4. `DebugModule` and the HS256 test-token path are not loaded in production; `/v1/debug/*` returns 404 there.
  5. An unknown Auth0 `sub` is linked to an existing account by email only when Auth0 reports `email_verified === true` (Google/Apple social login keeps working); first-login provisioning is race-free (`INSERT … ON CONFLICT`); a report no longer exposes the reporter's identity to the reported surveyor.
  6. Developer tools (API URL override, data reset) are absent from production builds, and the nearby-parcels bbox is sent as `minLng,minLat,maxLng,maxLat`.
  7. The pre-Auth0 session stubs are gone (`handleVerifyEmail`, `handleResendVerification`, `handleCancelEmailVerification`, `pendingEmailVerification`, `devVerificationToken`, `refreshToken: ""`), and no caller still tests `accessToken || refreshToken`.

**Plans**: 9 plans

Plans:

- [x] 01.2-01-PLAN.md — API rate limiting: per-client tracker (bearer hash / trusted IP), trust proxy, raised production limits, tighter /sync and upload limits (wave 1)
- [x] 01.2-02-PLAN.md — API identity and reports: email_verified-gated linking, race-free provisioning, private reported events, reason bound, migration 013 (wave 1)
- [x] 01.2-03-PLAN.md — Mobile test tooling (RNTL) and Auth0 error classification in useAuth0Session, forced refresh on 401 (wave 1)
- [x] 01.2-04-PLAN.md — Mobile quick fixes: dev tools only in __DEV__, nearby-parcels bbox order (wave 1)
- [x] 01.2-05-PLAN.md — DebugModule and HS256 path absent in production, /v1/debug/* 404 (wave 2)
- [x] 01.2-06-PLAN.md — Session end never purges; retry-later handling; pre-Auth0 stubs removed (wave 2)
- [x] 01.2-07-PLAN.md — Local-data owner marker, unsynced-work count, useLocalDataOwner hook (wave 2)
- [x] 01.2-08-PLAN.md — Confirmed-purge logout, owner-gated sync, blocking conflict screen (wave 3)
- [x] 01.2-09-PLAN.md — Phase gate and on-device verification (wave 4, checkpoint)

### Phase 01.3: CI and test safety net (INSERTED)

**Goal**: A change that breaks types, the Docker image or the sync storage layer cannot reach `main` or production unnoticed.
**Depends on**: Nothing. Must land before Phases 01.4 and 01.5, which rely on its test infrastructure.
**Requirements**: REQ-AUD-ci-pipeline, REQ-AUD-reproducible-image, REQ-AUD-test-infra
**Source**: audit lots L5, L6 and the core of L7, findings CI-1…CI-6, T1, T3, T4, T5
**Success Criteria** (what must be TRUE):

  1. CI runs `npm run typecheck`; a PR with a deliberate type error fails, and a docs-only PR runs only the cheap checks (path filters, one aggregating `ci-ok` required check).
  2. Every job has `timeout-minutes`, the workflow declares least-privilege `permissions`, PR runs cancel superseded runs, and third-party actions are pinned by SHA.
  3. The API image is built from the repo root with `npm ci` against the root lockfile, runs as a non-root user, is tagged with the commit SHA as well as `latest`, and can only be pushed from `main`.
  4. Mobile unit tests execute real SQL (in-memory SQLite behind the `expo-sqlite` mock), hooks are tested with `renderHook`, `*.test.tsx` files are picked up, and the E2E database is reset before each run.
  5. Coverage runs in CI with per-directory thresholds set at today's measured values (ratchet).
  6. Mobile changes run `expo-doctor` and `expo export`; a dependency audit fails CI on `high` vulnerabilities; CodeQL scans JavaScript/TypeScript.

**Plans**: 7 plans

Plans:

- [x] 01.3-01-PLAN.md — Mobile test infra: real-SQL expo-sqlite mock by default, storage.test.ts on table state, .test.tsx collected, Node engines floor (wave 1)
- [x] 01.3-02-PLAN.md — API: E2E globalSetup drops schema and re-migrates; reproducible non-root Dockerfile from the root lockfile, .dockerignore, VPS runbook (wave 1)
- [x] 01.3-03-PLAN.md — expo-doctor fixes: newArchEnabled removed, Metro override proven obsolete with a single-React export check (wave 1)
- [x] 01.3-04-PLAN.md — Coverage ratchet: per-directory coverageThreshold at measured floor values (wave 2)
- [x] 01.3-05-PLAN.md — CI rewrite: path filters, check/typecheck, unit+coverage, E2E twice, mobile-build, audit, image smoke, CI OK, main-only SHA-tagged push; CodeQL; Dependabot actions (wave 2)
- [x] 01.3-06-PLAN.md — Phase gate: local suite, PR CI evidence, owner device check and merge (wave 3, checkpoint)
- [x] 01.3-07-PLAN.md — Post-merge: main push tags, type-error and docs-only PR proofs, VPS health and CI OK branch protection (wave 4, checkpoint)

### Phase 01.4: API sync integrity (INSERTED)

**Goal**: The server accepts only valid, correctly-sequenced sync operations and never commits half of a write.
**Depends on**: Phase 01.3
**Requirements**: REQ-AUD-sync-validation, REQ-AUD-transactions
**Source**: audit lots L8, L9, findings A-H2, A-M1, A-M2 (validation), A-M5, A-M7, A-M9, ARCH-3 (API)
**Success Criteria** (what must be TRUE):

  1. Every `POST /v1/sync` operation payload is validated by a class DTO; an invalid payload yields a per-operation `fatal_error` with a generic message instead of a retried 500, and deterministic PostgreSQL errors (22xxx/23xxx) are never retryable.
  2. A sync upsert can no longer submit a survey or move its `expires_at`: `status` and `expires_at` from the client are ignored (installed apps keep working), and read-only fields of a submitted survey cannot be overwritten.
  3. Upsert, patch, submit, delete, attachment writes and report creation each run in one transaction with their event; an injected failure on the event insert leaves nothing committed; the upsert UPDATE is guarded on `sync_version`.
  4. Two concurrent submits on the same parcel give one success and one 409, never a 500 or a duplicate version; `parcel_ids` is bounded and validated.
  5. Account deletion commits the database transaction before deleting the Auth0 user.

**Plans**: 6 plans

Plans:

- [x] 01.4-01-PLAN.md — Transaction helper, E2E fault injection, account deletion commits before Auth0 (wave 1)
- [x] 01.4-02-PLAN.md — Sync DTO validation, fatal 22xxx/23xxx, parcel_ids bound (wave 1)
- [x] 01.4-03-PLAN.md — Survey writes transactional, guarded upsert, concurrent submit lock (wave 2)
- [x] 01.4-04-PLAN.md — Attachment and report writes transactional (wave 2)
- [x] 01.4-05-PLAN.md — Upsert ignores status/expires_at, submitted read-only, installed-app replay (wave 3)
- [x] 01.4-06-PLAN.md — Phase gate: local gate, CI evidence, owner device check (wave 4)

### Phase 01.5: Mobile sync engine reliability (INSERTED)

**Goal**: The queue on the phone drains exactly once, in bounded batches, survives crashes, and never loses or silently drops a photo.
**Depends on**: Phase 01.3
**Requirements**: REQ-AUD-sync-engine, REQ-AUD-local-storage, REQ-AUD-photos, REQ-AUD-offline-start
**Source**: audit lots L11a, L11b, L12, findings M-H1, M-H2, M-H4, ARCH-3 (mobile), ARCH-5, and the retry-cap, timeout, pull-overwrite, autosave and ID findings
**Success Criteria** (what must be TRUE):

  1. Only one drain or pull runs at a time (module-level single flight); two concurrent triggers produce one `POST /sync`.
  2. A queue of 250 operations syncs in batches of at most 100; a survey is marked `synced` only when no other queue row exists for it.
  3. The documented retry cap applies (8 attempts then `sync_blocked`), network and 5xx errors do not consume it, every sync request has a timeout, and a pull never overwrites a survey that has a pending or blocked local change.
  4. SQLite writes that span several statements run in a transaction, the schema is versioned with `PRAGMA user_version`, and new IDs are UUIDs.
  5. Photos are resized (2048 px, JPEG 0.7) and copied to the document directory at capture, uploaded by streaming, and a missing local file is shown to the user instead of being deleted silently.
  6. Attachments pulled from the server are displayable (no more `local_uri=""` dead rows: fetched on demand through their presigned URL and cached), and thumbnails and the detail carousel render through `expo-image` from downsized sources.
  7. A cold start with no network and valid stored credentials opens the app on the signed-in screens with the last known profile, instead of the login overlay; the profile refreshes from `/me` once the API is reachable.

**Plans**: 12 plans

Plans:

- [x] 01.5-01-PLAN.md — Install the 4 Expo modules, Jest mocks, photo path helpers (wave 1)
- [x] 01.5-02-PLAN.md — API: attachment download URL / content route (wave 1)
- [x] 01.5-03-PLAN.md — SQLite user_version migrations, transaction helper with reentrancy guard (wave 1)
- [x] 01.5-04-PLAN.md — Offline cold start with cached profile, autosave fix (wave 1)
- [x] 01.5-05-PLAN.md — Transactional survey writes, UUIDs (wave 2)
- [x] 01.5-06-PLAN.md — Server photos fetched on demand and cached, unavailable state (wave 2)
- [x] 01.5-07-PLAN.md — Photo capture: resize, durable storage, streaming upload helper (wave 2)
- [x] 01.5-08-PLAN.md — Retry classification, timeouts, pull guard (wave 3)
- [x] 01.5-09-PLAN.md — expo-image thumbnails and carousel, missing/unavailable states (wave 3)
- [x] 01.5-10-PLAN.md — Single flight, batches of 100, synced only when queue empty (wave 4)
- [x] 01.5-11-PLAN.md — Streaming upload wired into sync, missing file handling (wave 5)
- [x] 01.5-12-PLAN.md — Phase gate: local gate, CI evidence, owner device check (wave 6)

### Phase 01.6: Sync feed ordering and unified object storage (INSERTED)

**Goal**: No change is ever skipped or silently dropped between devices, and every stored file lives in object storage behind one service that bounds what it accepts.
**Depends on**: Phase 01.4
**Requirements**: REQ-AUD-changes-feed, REQ-AUD-object-storage
**Source**: audit lots L10, L13, findings ARCH-6, A-H3, A-M3, A-M4, the `isAllowedMimeType` finding, the unbounded `/sync/changes` fallback
**Success Criteria** (what must be TRUE):

  1. `/v1/sync/changes` pages on a commit-safe monotonic order (`survey_events` `(xid8, seq)`, filtered by the snapshot minimum `xid8 < pg_snapshot_xmin(pg_current_snapshot())`), still accepts the old `(created_at, id)` cursor, and an event committed late is never skipped (E2E test).
  2. Two devices sending the same `sync_version` with different content get a `sync_version_conflict` instead of a silent replay; the fallback that re-sends event-less surveys on every poll is gone.
  3. One `StorageService` owns the S3 client, bucket and local mode for surveys, attachments and users; profile pictures are in object storage and survive a container restart.
  4. Storage keys are built only from validated identifiers and stay inside the upload directory in local mode; the presigned PUT enforces `ContentLength` and confirmation rejects a size mismatch with 422.
  5. `isAllowedMimeType` uses an own-property check, so `"constructor"` and other prototype keys are rejected.
  6. `sync-conflict-resolution-v1.md` and `api-contract-v1.md` describe the new cursor and same-version rule.

**Plans**: 9 plans

Plans:

- [x] 01.6-01-PLAN.md — Migration 014 (seq + xid8, backfill, synthetic events), migration E2E, v2 cursor helpers (wave 1)
- [x] 01.6-02-PLAN.md — StorageService + module, safe-id rule, own-property MIME check (wave 1)
- [x] 01.6-03-PLAN.md — /sync/changes on (xid8, seq) with snapshot filter, legacy cursor, fallback removed, concurrency E2E (wave 2)
- [x] 01.6-04-PLAN.md — Profile pictures through StorageService, bytes served by the API (wave 2)
- [x] 01.6-05-PLAN.md — Safe-id validation at the API boundary (pipe + DTOs) (wave 2)
- [x] 01.6-06-PLAN.md — Same-version conflict rule (visibility-only applied), SurveysService drops its S3 client (wave 3)
- [x] 01.6-07-PLAN.md — Attachments through StorageService, presigned ContentLength, 422 on size mismatch (wave 3)
- [x] 01.6-08-PLAN.md — MinIO-mode E2E CI job and documentation (wave 4)
- [x] 01.6-09-PLAN.md — Phase gate: local gate, CI evidence, owner device check (wave 5)

### Phase 01.7: API configuration, service split and database tuning (INSERTED)

**Goal**: The API fails fast on bad configuration, its survey logic is split into reviewable units, and its queries are bounded and indexed.
**Depends on**: Phase 01.6
**Requirements**: REQ-AUD-config, REQ-AUD-surveys-split, REQ-AUD-db-tuning
**Source**: audit lots L14, L15, the remainder of L16, findings A-M8, ARCH-2, CORS and logging findings, every API efficiency finding
**Success Criteria** (what must be TRUE):

  1. Configuration is read through `@nestjs/config` with a schema validated at startup; production refuses to start on default credentials or an empty `AUTH0_AUDIENCE`; `CORS_ORIGIN` is required in production; `REFRESH_TOKEN_SECRET` and `ACCESS_TOKEN_*` are gone.
  2. The `pg` pool has `max`, `idleTimeoutMillis`, `statement_timeout` and an `error` listener; services log through the Nest `Logger`, and a failed authentication logs only its message and code.
  3. `SurveysService` is split into a repository, survey, events, parcels (merging the internal IGN client with `CadastreProviderService`) and public-map services; `getSurveyForUser` and `insertEvent` exist once.
  4. Parcel ids are written in one batched statement, ownership checks select only the columns they need, list endpoints (`listForUser`, `getEvents`, `listReports`) paginate by cursor while still answering unpaginated callers, and the IGN fetch caches per tile and times out on the body as well as the headers. A 100-operation sync batch issues at least three times fewer queries than today.
  5. The public-surveys partial index and generated `centroid_lat`/`centroid_lng` columns with a btree index exist (no PostGIS), migrations take a `pg_advisory_lock`, and the dead `auth_sessions` tables are dropped — `EXPLAIN ANALYZE` on 10 000 surveys attached to the PR.

**Plans**: TBD

### Phase 01.8: Shared IBP domain package and test completeness (INSERTED)

**Goal**: The IBP rules and the sync contract types are defined once and proven identical on both sides, and the API's authentication path is tested for real.
**Depends on**: Phase 01.3. Should follow Phase 01.1, so the extracted rules are the ratified method version.
**Requirements**: REQ-AUD-ibp-domain, REQ-AUD-test-infra-rest
**Source**: audit lot L17 and the remainder of L7, findings ARCH-1, T6, the untested RS256 path, the catch-all E2E suite
**Success Criteria** (what must be TRUE):

  1. A `packages/ibp-domain` workspace exports the factor keys, allowed sets, scoring and draft/submit validation as pure functions, plus the sync contract types; `IbpRulesService` and `mobile/src/app/ibp-scoring.ts` delegate to it and `mobile/src/app/types.ts` imports its contract types.
  2. One parity fixture runs in the package, and the known drift (`factor_f_group_capped` exists only in the API today) is resolved.
  3. The API image builds with the package and `expo export` resolves it in CI.
  4. `AuthGuard`'s RS256 path is tested against a locally served JWKS: valid, expired, wrong audience and unknown `kid` tokens.
  5. `surveys-idempotency.e2e-spec.ts` is split by feature (submit, visibility, public map, attachments, parcel history) and uses `randomUUID()` instead of `Date.now()`.

**Plans**: TBD

### Phase 01.9: Mobile state architecture, i18n, accessibility and hygiene (INSERTED)

**Goal**: The app renders only what changed, reads in one language with proper accessibility, and the repository and its docs describe what is actually there.
**Depends on**: Phase 01.5, Phase 01.8
**Requirements**: REQ-AUD-mobile-state, REQ-AUD-i18n-a11y, REQ-AUD-hygiene
**Source**: audit lots L18, L19, the remainder of L20, findings ARCH-4, ARCH-7, ARCH-8, every mobile efficiency finding, the i18n and accessibility findings
**Success Criteria** (what must be TRUE):

  1. Session, sync and surveys state come from memoised contexts; `useSurveySync` no longer returns a new ~60-key object each render, and a status update no longer re-renders every mounted tab (React DevTools profile before/after attached).
  2. The survey list is a `FlatList` with memoised rows and stays fluid with 500 surveys; completion is precomputed at write time instead of parsing every payload; no screen file exceeds 400 lines; the 158 unused style keys are gone; navigation is typed (no `useNavigation() as any`).
  3. The map requests by bbox, clusters markers, memoises them and debounces region changes.
  4. Every user-facing string comes from a French i18n catalogue, status messages carry no ids or technical text, and every `Pressable` in the survey detail, survey form and map screens has an accessibility role and label.
  5. The root `App.tsx`, the root runtime dependencies and the Expo-flavoured root tsconfig are gone; `bcryptjs`, `@nestjs/schedule` and the unused tab library are removed and `@expo/ngrok` is a dev dependency, with native iOS and Android builds still passing.
  6. `CLAUDE.md` and the technical docs match the final state (versions, `/v1/sync`, `local_meta`, test conventions, CI steps, new modules), and the audit report links each finding to the PR that closed it.

**Plans**: 32 plans

Plans:

- [x] 01.9-01-PLAN.md — Build the render-count harness that stands in for the React DevTools before/after profile (D-02), run it on th (wave 1)
- [x] 01.9-02-PLAN.md — Rewrite four of the ten React-spying hook tests, starting with `useSurveySync.test.ts`, onto the `renderHook` (wave 1)
- [x] 01.9-03-PLAN.md — Move the six remaining React-spying hook tests onto `renderHook`, with their assertions unchanged, before any (wave 1)
- [x] 01.9-04-PLAN.md — Create the measuring tools the rest of the phase is checked against: the unused-style-key script D-04 asks for (wave 1)
- [x] 01.9-05-PLAN.md — Create the French catalogue skeleton, the status message type and the sync-error texts, and translate the iOS (wave 1)
- [x] 01.9-06-PLAN.md — Add native Android and iOS build jobs to CI, prove them green on a PR before any dependency change, document t (wave 1)
- [x] 01.9-07-PLAN.md — Add the optional `bbox` filter to `GET /v1/public/map-items`, prove it with a new E2E spec and an EXPLAIN, doc (wave 1)
- [x] 01.9-08-PLAN.md — Precompute survey completion at write time in a new SQLite column, stop parsing every payload when listing, an (wave 1)
- [x] 01.9-09-PLAN.md — Introduce the five memoised contexts and the single assembler, make `useSurveySync` return memoised slices wit (wave 2)
- [x] 01.9-10-PLAN.md — Remove the unused e-mail service and every SMTP setting from the API, its configuration, examples, CI and docs (wave 2)
- [x] 01.9-11-PLAN.md — Move the status and alert texts of the survey-operations and profile sync hooks to the French catalogue, drop (wave 2)
- [x] 01.9-12-PLAN.md — Split the survey detail screen (1 344 lines + 836-line styles) into parts under 400 lines, delete its unused s (wave 2)
- [x] 01.9-13-PLAN.md — Split the survey form screen (1 190 lines + 644-line styles + 167-line components file) into parts under 400 l (wave 2)
- [x] 01.9-14-PLAN.md — Split the sign-in screen (752 lines) under 400 lines per file, delete unused styles, and move its text to the (wave 2)
- [x] 01.9-15-PLAN.md — Split the account screen (596 lines) under 400 lines per file, delete unused styles, move its text and alerts (wave 2)
- [x] 01.9-16-PLAN.md — Bring the Home screen under 400 lines and move the text of Home, the cards, the splash and the UI primitives t (wave 2)
- [x] 01.9-17-PLAN.md — Move the text of the five small screens and of the shared label modules to the catalogue, and delete their unu (wave 2)
- [x] 01.9-18-PLAN.md — Replace the navigation prop funnel with one memoised route component per screen that reads its own contexts, m (wave 3)
- [x] 01.9-19-PLAN.md — Do every dependency change of the phase in one plan: remove the root leftovers and the unused API packages, mo (wave 3)
- [x] 01.9-20-PLAN.md — Move the status and dialog texts of the session, owner, network and central sync hooks to the catalogue, remov (wave 3)
- [x] 01.9-21-PLAN.md — Move the remaining hook status messages (editing, draft patching, GPS, app bootstrap) and the form validation (wave 4)
- [x] 01.9-22-PLAN.md — Turn the survey list into a virtualised `Animated.FlatList` with memoised rows, prove it stays fluid with 500 (wave 4)
- [x] 01.9-23-PLAN.md — Build the map's data layer: bbox-aware API client and explorer hook with stale-response and duplicate-request (wave 4)
- [x] 01.9-24-PLAN.md — Split the 961-line navigation file into `mobile/src/navigation/`, type navigation globally, mount screens with (wave 5)
- [x] 01.9-25-PLAN.md — Apply the owner's tab decisions: remove the Recherche tab in favour of the native header search in Mes Relevés (wave 6)
- [x] 01.9-26-PLAN.md — Document the tab changes of 01.9-25 in the native README and the search user story (wave 7)
- [x] 01.9-27-PLAN.md — Split the rest of the survey list screen (hero, stat tiles, filters, attention and continue sections) under 40 (wave 7)
- [ ] 01.9-28-PLAN.md — Rebuild the public map screen on the 01.9-23 data layer: viewport loading with debounce and no auto-refit loop (wave 7)
- [ ] 01.9-29-PLAN.md — Lock the phase's text, accessibility and structure rules: narrow status setters to the catalogue type, turn th (wave 8)
- [x] 01.9-30-PLAN.md — Record this phase's facts in CLAUDE.md, in the same PR as the code (RESEARCH "two passes"; split out of the st (wave 7)
- [ ] 01.9-31-PLAN.md — Prove the phase: run and record the full local gate and every measurement, record PR #158's CI evidence suppli (wave 9)
- [ ] 01.9-32-PLAN.md — Close phase 01.9 after phase 01.8: final documentation sweep, complete audit status links, and the French vali (wave 10)

### Phase 2: Species Contracts & Data-Contract Corrections

**Goal**: A species observation can be stored, synced and read back through contracts written down before any UI exists — and the two stale spec sections that contradict shipped behaviour are corrected.
**Depends on**: Phase 1, Phase 1.1 (the Factor A genus list must come from the ratified method version)
**Requirements**: REQ-ML-contracts, REQ-DOC-form-spec
**Success Criteria** (what must be TRUE):

  1. `docs/technical/data-contract-v1.md` defines a species entity linked to a survey's Factor A, carrying the species, its confidence score, and whether the suggestion was confirmed, edited or rejected.
  2. `docs/technical/api-contract-v1.md` documents the species endpoint(s) under `/v1` with request and response shapes and standard error codes.
  3. A migration creates the species schema and `npm run migrate:api` applies it cleanly on an empty database.
  4. Species data survives a round-trip through `POST /surveys/sync`: an E2E test replays the same payload twice and no species row is duplicated.
  5. `docs/specs/ibp-form-spec.md` §4 states that a survey may reference one or many parcels (`parcel_ids[]`), and §10.1 lists the shipped status enum `draft | submitted | synced | error | expired` with `submitted_at` and `deleted_at` — no `deleted` value, no `published_at`.

**Plans**: TBD

### Phase 3: Species Recognition for Factor A

**Goal**: A surveyor fills Factor A faster by photographing a tree than by naming it from memory.
**Depends on**: Phase 2
**Requirements**: REQ-C-species-recognition
**Success Criteria** (what must be TRUE):

  1. From the Factor A section, the surveyor adds one or more photos and sees suggested species, each with a confidence score.
  2. The surveyor can confirm, edit or reject each suggestion; the retained species is saved with the survey and is there again when the survey is reopened.
  3. With the device in airplane mode, suggestions still work on-device — or the app states plainly that recognition needs connectivity, exactly as the Phase 1 ADR decided.
  4. Confirmed species reach the server through the normal sync flow and appear in the survey read back from the API.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Offline Map & Own-Survey Navigation

**Goal**: The surveyor can find their way around a parcel and see their own past work on the map, with no network at all.
**Depends on**: Nothing (independent of the species-recognition track; sequenced after it)
**Requirements**: REQ-B-own-surveys-map, REQ-D-offline-map, REQ-D-area-download, REQ-D-offline-parcel-warning, REQ-D-basemap-switch
**Success Criteria** (what must be TRUE):

  1. The map screen shows the surveyor's own surveys instead of the public anonymized set, with its navigation unchanged.
  2. The surveyor switches between a satellite and a map basemap, and the choice persists while navigating.
  3. The surveyor selects an area, sees its estimated download size and progress, and the downloaded area is still usable after force-quitting and relaunching the app; downloaded areas can be listed and deleted.
  4. In airplane mode the map shows an offline indicator, renders the downloaded basemap and cached parcels, follows GPS, and still allows zoom, pan and parcel selection.
  5. When a parcel is missing from the offline cache, the app says so plainly and offers a download action that runs once the network returns — no infinite spinner.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Survey Export & Ownership

**Goal**: The surveyor can get a survey out of the app and clean up their own surveys — with no network and no back-office.
**Depends on**: Nothing (independent of Phases 1–4)
**Requirements**: REQ-C-pdf-export, REQ-B-manage-published
**Success Criteria** (what must be TRUE):

  1. From a survey's detail, the surveyor generates a PDF on the device and sends it through the OS share sheet to any installed target — Google Drive, Wimi, mail, AirDrop.
  2. The export works in airplane mode: the PDF is produced and shared with no API call.
  3. The PDF contains the survey's identifying data (site, parcel ids, observation year, version, date), the ten factor scores and the IBP total.
  4. The surveyor deletes their own survey behind a confirmation step, and it disappears from their list.
  5. No private/public visibility control is presented anywhere in the app.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Durable Backend

**Goal**: The production database can survive a failure, the hosting that is actually running is the hosting that is written down, and the API no longer carries dead or unsafe code.
**Depends on**: Nothing (independent of Phases 1–5)
**Requirements**: REQ-INF-hosting-adr, REQ-INF-backups, REQ-INF-migrations, REQ-INF-deadcode, REQ-QA-sql-injection, REQ-QA-indexes
**Success Criteria** (what must be TRUE):

  1. An accepted ADR ratifies the current VPS stack — Docker + Caddy + GHCR + systemd timer + MinIO on `cortege.algernon.ovh` — as the hosting target, superseding the unratified alwaysdata + Cloudflare R2 note.
  2. A scheduled PostgreSQL backup runs unattended, and a restore of one of those backups into a clean database has been performed and recorded at least once.
  3. A fresh database and the production database reach the same schema version through one documented path, and a deliberately failed migration leaves the schema unchanged rather than half-applied.
  4. `api/src/users/email.service.ts` and the vestigial `SMTP_*` variables are gone from the repo, from `api/.env.example` and from the deployment env.
  5. A lint rule rejects interpolating values into SQL strings (account deletion already interpolates only constant subqueries and binds `$1`, verified 2026-09-23); `survey_events(actor_id)` is indexed and the redundant `idx_users_auth0_sub`, `idx_survey_parcels_survey_id` and `idx_surveys_parcel_id` are dropped — confirmed by `EXPLAIN` on account deletion and the survey list.

**Plans**: TBD

### Phase 7: Field Validation

**Goal**: An ecologist completes a full IBP survey offline on a real parcel, and it syncs back with no data loss and no duplicates — on record.
**Depends on**: Phases 1.2, 1.4, 1.5, 1.6 (field tests must not run on the data-loss and sync defects), 3, 4, 5, 6
**Requirements**: REQ-FT-field-tests, REQ-QA-bug-a3-4, REQ-QA-bug-a6-2, REQ-QA-screen-tests, REQ-DOC-taxonomy, REQ-DOC-epicd-ids
**Success Criteria** (what must be TRUE):

  1. A field-test report exists for each of Epics B, C and D, in the form of `docs/user-tests/epic-a-access-and-security.md`, with a recorded outcome for every case.
  2. At least one full run is recorded end to end — survey created offline on a real parcel, ten factors scored, photos attached, submitted offline, synced on reconnection — with the resulting server record checked for completeness and for the absence of duplicate surveys and attachments.
  3. Signing up with an already-registered email shows a specific message inviting the user to log in (`BUG-A3-4`), and password-reset deliverability is closed as an Auth0 tenant configuration item with the change recorded (`BUG-A6-2`).
  4. The survey list, survey detail, survey form and map screens have tests covering their sync-status, filter and error states, so the flows the field tests exercise are protected against regression.
  5. Every field-test case cites a unique story ID: the six Epic D stories have six distinct IDs, and `docs/specs/user-stories.md` §4 uses the MVP / V1 / V2 taxonomy.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 1.2 → … → 1.9 → 2 → 3 → 4 → 5 → 6 → 7

Phases 1.2–1.9 (audit remediation) do not depend on the species-recognition track and should run while Phase 1 waits on real devices. Phases 2–6 do not depend on 1.6–1.9 either, so they can interleave if the schedule requires it.

Phases 4, 5 and 6 declare no dependency on the species-recognition track and can be reordered ahead
of it if Phase 1 returns a no-go, or run in parallel with it.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Species Recognition — Approach Decision | 0/6 | Not started | - |
| 1.1. Reconcile the IBP method version | 0/TBD | Not started | - |
| 1.2. Stop field data loss and account exposure | 9/9 | Complete    | 2026-09-24 |
| 1.3. CI and test safety net | 7/7 | Complete    | 2026-09-24 |
| 1.4. API sync integrity | 6/6 | Complete    | 2026-09-24 |
| 1.5. Mobile sync engine reliability | 12/12 | Complete    | 2026-09-25 |
| 1.6. Sync feed ordering and unified object storage | 9/9 | Complete    | 2026-09-25 |
| 1.7. API configuration, service split and database tuning | 13/14 | Complete    | 2026-09-26 |
| 1.8. Shared IBP domain package and test completeness | 0/TBD | Not started | - |
| 1.9. Mobile state architecture, i18n, accessibility and hygiene | 28/32 | In Progress|  |
| 2. Species Contracts & Data-Contract Corrections | 0/TBD | Not started | - |
| 3. Species Recognition for Factor A | 0/TBD | Not started | - |
| 4. Offline Map & Own-Survey Navigation | 0/TBD | Not started | - |
| 5. Survey Export & Ownership | 0/TBD | Not started | - |
| 6. Durable Backend | 0/TBD | Not started | - |
| 7. Field Validation | 0/TBD | Not started | - |

## Coverage

All 66 MVP requirements map to exactly one phase. 47 carry build work across Phases 1–7 (24 of them
from the 2026-09 code audit, Phases 1.2–1.9); the other 19 are already built and are verified in Phase 7's field tests. Full mapping in
`.planning/REQUIREMENTS.md` → Traceability.

## Deferred

Recorded in `.planning/REQUIREMENTS.md`, not dropped:

- **Next milestone (community / social):** `REQ-F-france-map`, `REQ-B-parcel-status-map`, `REQ-B-explore-analysis`, `REQ-C-privacy-choice`, and all of Epics E, F, G and I. Code already exists for several of them. **Prerequisite:** a back-office / CMS surface, which needs its own ADR, architecture block and contract before Epics E and G can be planned.
- **V2:** all of Epic H (regional overviews, parcel trends, factor distributions, analytics trust).

---
*Roadmap created: 2026-09-22*
