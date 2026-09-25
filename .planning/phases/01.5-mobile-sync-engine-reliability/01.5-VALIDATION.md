---
phase: 01.5
slug: mobile-sync-engine-reliability
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-25
---

# Phase 01.5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mobile: Jest 29 + ts-jest, real SQL through the node:sqlite double behind the `expo-sqlite` mock (`mobile/test/node-sqlite-db.ts`), renderHook from `@testing-library/react-native/pure`, new doubles for expo-crypto / expo-file-system/legacy / expo-image-manipulator / expo-image (plan 01). API: Jest unit specs in `api/test/*.spec.ts`; Jest + Supertest E2E on PostgreSQL 16 (`api/test/*.e2e-spec.ts`, dedicated `*_test` database reset by `api/test/global-setup.js`) |
| **Config file** | `mobile/jest.unit.config.js` (moduleNameMapper, coverage ratchet), `api/jest.unit.config.js`, `api/jest.config.js` (E2E) |
| **Quick run command** | `cd mobile && npx jest --config jest.unit.config.js <path-or-pattern>`; `npm --workspace api run test:unit -- <spec>` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run test:unit && npm run format:check && npm --workspace api run test:e2e`, plus from `mobile/`: `EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK=1 npx --yes expo-doctor@1.20.4` and `npx expo export --platform android --output-dir "$(mktemp -d)"` |
| **Estimated runtime** | ~90 s unit (api + mobile); ~3-4 min E2E; ~2 min expo-doctor + export |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (targeted Jest file, or the API E2E suite for plan 02)
- **After every plan wave:** full suite command including `npm --workspace mobile run test:unit:coverage` (ratchet thresholds enforced) and, for waves touching native modules or screens (1, 3), `expo export`
- **Before `/gsd:verify-work`:** local gate green, the phase PR's CI green (Mobile build check, E2E run twice), and the owner device check (plan 12 Task 3) approved
- **Max feedback latency:** 120 seconds (unit); one E2E run for the API endpoint

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01.5-01-T1 | 01 | 1 | REQ-AUD-photos | T-01.5-SC, T-01.5-02 | Four SDK 57 modules in package.json + lockfile; expo-doctor and expo export green | install + build check | node deps check `&& expo-doctor@1.20.4 && expo export` (plan 01 Task 1) | ✅ mobile/package.json | ✅ green |
| 01.5-01-T2 | 01 | 1 | REQ-AUD-photos | — | Deterministic doubles wired; thresholds untouched | unit (suite) | `npm --workspace mobile run test:unit && npm run typecheck && npm run format:check` | W0: `mobile/test/expo-crypto.mock.ts`, `expo-file-system-legacy.mock.ts`, `expo-image-manipulator.mock.ts`, `expo-image.mock.ts` (new) | ✅ green |
| 01.5-01-T3 | 01 | 1 | REQ-AUD-photos | T-01.5-01 | Photo paths in documentDirectory/attachments/, old-container re-basing, deletes confined | unit | `cd mobile && npx jest --config jest.unit.config.js src/storage/attachment-files.test.ts` | W0: `mobile/src/storage/attachment-files.test.ts` (new) | ✅ green |
| 01.5-02-T1 | 02 | 1 | REQ-AUD-photos | T-01.5-03, T-01.5-04, T-01.5-05 | Owner-only download URL, same shape both modes, 404/409, path containment | unit | `npm --workspace api run test:unit -- surveys-attachments-download` | W0: `api/test/surveys-attachments-download.spec.ts` (new) | ✅ green |
| 01.5-02-T2 | 02 | 1 | REQ-AUD-photos | T-01.5-03, T-01.5-06 | Owner 200 + bytes, other user 404, not uploaded 409, deleted 404, no token 401 on PostgreSQL | E2E | `npm --workspace api run test:e2e` | W0: `api/test/attachments-download.e2e-spec.ts` (new) | ✅ green |
| 01.5-03-T1 | 03 | 1 | REQ-AUD-local-storage | T-01.5-10, T-01.5-10b | runInTransaction rolls back, rethrows, serialises, releases; explicit tx join; dead handle throws; reentrant call without handle rejects "runInTransaction called reentrantly" (30 s guard) while an unrelated concurrent call waits and commits; op_type derivation | unit (real SQL) | `cd mobile && npx jest --config jest.unit.config.js src/storage/transaction.sqlite.test.ts` | W0: `mobile/src/storage/transaction.sqlite.test.ts` (new) | ✅ green |
| 01.5-03-T2 | 03 | 1 | REQ-AUD-local-storage | T-01.5-08, T-01.5-09 | v0 → v1 keeps every row, retry_count reset (D-06), op_type/file_state backfilled, indexes, idempotent | unit (real SQL, seeded v0) | `npm --workspace mobile run test:unit:coverage` (incl. `db.migration.sqlite.test.ts`, `db.migration-legacy.sqlite.test.ts`) | W0: both migration test files (new) | ✅ green |
| 01.5-04-T1 | 04 | 1 | REQ-AUD-offline-start | T-01.5-11, T-01.5-13 | Profile cache keyed by sub, best-effort, never another account's profile | unit (real SQL) | `cd mobile && npx jest --config jest.unit.config.js src/storage/profile-cache.sqlite.test.ts` | W0: `mobile/src/storage/profile-cache.sqlite.test.ts` (new) | ✅ green |
| 01.5-04-T2 | 04 | 1 | REQ-AUD-offline-start | T-01.5-11, T-01.5-12, T-01.5-14 | Offline cold start → signed in with cached profile; refresh when reachable; cleared only on session end | unit (renderHook) | `cd mobile && npx jest --config jest.unit.config.js src/hooks/useAuth0Session.test.ts` | ✅ `mobile/src/hooks/useAuth0Session.test.ts` (extended) | ✅ green |
| 01.5-04-T3 | 04 | 1 | REQ-AUD-sync-engine | — | Autosave in flight reschedules the latest draft | unit (renderHook, fake timers) | `cd mobile && npx jest --config jest.unit.config.js src/hooks/useEditingDraft.autosave.test.ts` | W0: `mobile/src/hooks/useEditingDraft.autosave.test.ts` (new) | ✅ green |
| 01.5-05-T1 | 05 | 2 | REQ-AUD-local-storage, REQ-AUD-sync-engine | T-01.5-15, T-01.5-16, T-01.5-17 | Trigger-injected failures leave nothing half-written; UUIDs; op_type; file cleanup after commit; every writer completes without waiting on its own mutex (RED) | unit (real SQL) | `cd mobile && npx jest --config jest.unit.config.js src/storage/surveys.transactions.sqlite.test.ts` | W0: `mobile/src/storage/surveys.transactions.sqlite.test.ts` (new) | ✅ green |
| 01.5-05-T2 | 05 | 2 | REQ-AUD-local-storage, REQ-AUD-sync-engine | T-01.5-15, T-01.5-16, T-01.5-17 | Same tests GREEN; full suite + ratchet | unit (suite + coverage) | `npm --workspace mobile run test:unit:coverage` + grep gates (plan 05 Task 2) | ✅ | ✅ green |
| 01.5-06-T1 | 06 | 2 | REQ-AUD-photos | T-01.5-18, T-01.5-19, T-01.5-20, T-01.5-21 | On-demand download via download-url, bearer only when required, missing marked not deleted, timeouts; 404/409 → persisted 'unavailable', no further network call | unit (real SQL) | `cd mobile && npx jest --config jest.unit.config.js src/storage/attachment-cache.sqlite.test.ts src/api/ibp-api.test.ts` | W0: `mobile/src/storage/attachment-cache.sqlite.test.ts` (new) | ✅ green |
| 01.5-06-T2 | 06 | 2 | REQ-AUD-photos | T-01.5-20, T-01.5-21, T-01.5-22 | Bounded, de-duplicated, owner-gated, purge-safe preview downloads; 'unavailable' rows never re-requested in a session (until a pull resets them) | unit (renderHook) | `cd mobile && npx jest --config jest.unit.config.js src/hooks/survey-sync/useAttachmentPreviews.test.ts src/hooks/useSurveySync` | W0: `mobile/src/hooks/survey-sync/useAttachmentPreviews.test.ts` (new) | ✅ green |
| 01.5-07-T1 | 07 | 2 | REQ-AUD-photos | T-01.5-23, T-01.5-24, T-01.5-26 | Resize longer axis ≤ 2048, JPEG 0.7, documents dir, real size; streaming upload targets; 120 s cancel; legacy cache photos rescued | unit + real SQL | `cd mobile && npx jest --config jest.unit.config.js src/storage/attachments` | W0: `mobile/src/storage/attachments.test.ts`, `attachments.sqlite.test.ts` (new) | ✅ green |
| 01.5-07-T2 | 07 | 2 | REQ-AUD-photos | T-01.5-23 | Capture uses the pipeline; no 500 000 fallback; orphan file removed on queue failure | unit (hook) | `cd mobile && npx jest --config jest.unit.config.js src/hooks/survey-sync/useSurveySyncSurveyOperations.test.ts` | ✅ (extended) | ✅ green |
| 01.5-08-T1 | 08 | 3 | REQ-AUD-sync-engine | T-01.5-28, T-01.5-29, T-01.5-30 | fatal / retryable / unknown classifiers; apiRequest body timeout | unit | `cd mobile && npx jest --config jest.unit.config.js src/storage/sync-classification.test.ts src/api/client.test.ts` | W0: `mobile/src/storage/sync-classification.test.ts` (new) | ✅ green |
| 01.5-08-T2 | 08 | 3 | REQ-AUD-sync-engine, REQ-AUD-photos | T-01.5-27, T-01.5-28, T-01.5-29, T-01.5-31 | 20× network/5xx/429/timeout not counted; 8 counted → sync_blocked; fatal at once; batch 401 rethrown; pull never overwrites/deletes pending or blocked; pulled change resets 'unavailable' → 'remote' | unit (real SQL) | `cd mobile && npx jest --config jest.unit.config.js src/storage/sync.retry.sqlite.test.ts src/storage/sync.pull.sqlite.test.ts src/storage.test.ts` | W0: `sync.retry.sqlite.test.ts`, `sync.pull.sqlite.test.ts` (new) | ✅ green |
| 01.5-09-T1 | 09 | 3 | REQ-AUD-photos | T-01.5-33 | Preview state image / loading / missing / unavailable decided by a pure helper; unavailable excluded from ensure candidates | unit | `cd mobile && npx jest --config jest.unit.config.js src/screens/survey-screen-helpers.test.ts` | ✅ (extended) | ✅ green |
| 01.5-09-T2 | 09 | 3 | REQ-AUD-photos | T-01.5-32, T-01.5-34 | expo-image rendering; remote/missing visible; 'Photo non disponible' static state (no spinner); dev-only simulate control | build + coverage | `npm --workspace mobile run test:unit:coverage && npx expo export` (plan 09 Task 2) + grep gates | ✅ screens | ✅ green |
| 01.5-10-T1 | 10 | 4 | REQ-AUD-sync-engine | T-01.5-35, T-01.5-38 | Same-kind join, cross-kind serialisation, rejection clears the flight | unit | `cd mobile && npx jest --config jest.unit.config.js src/storage/sync-flight.test.ts` | W0: `mobile/src/storage/sync-flight.test.ts` (new) | ✅ green |
| 01.5-10-T2 | 10 | 4 | REQ-AUD-sync-engine, REQ-AUD-local-storage | T-01.5-35, T-01.5-36, T-01.5-37, T-01.5-39 | Two triggers → one POST /sync; 250 ops → 100/100/50; synced only with empty queue; sync.ts writes atomic | unit (real SQL) | `npm --workspace mobile run test:unit:coverage` (incl. `sync.engine.sqlite.test.ts`) | W0: `mobile/src/storage/sync.engine.sqlite.test.ts` (new) | ✅ green |
| 01.5-11-T1 | 11 | 5 | REQ-AUD-photos, REQ-AUD-sync-engine | T-01.5-40, T-01.5-41, T-01.5-42 | Streaming targets, missing file kept as 'missing', upload failures classified (RED) | unit (real SQL) | `cd mobile && npx jest --config jest.unit.config.js src/storage/sync.attachments.sqlite.test.ts` | W0: `mobile/src/storage/sync.attachments.sqlite.test.ts` (new) | ✅ green |
| 01.5-11-T2 | 11 | 5 | REQ-AUD-photos, REQ-AUD-sync-engine | T-01.5-40, T-01.5-41, T-01.5-43 | No fetch/blob left in sync.ts; tests GREEN; files cleaned after commit | unit (suite + coverage) + grep | `npm --workspace mobile run test:unit:coverage` + grep gates (plan 11 Task 2) | ✅ | ✅ green |
| 01.5-12-T1 | 12 | 6 | all four | T-01.5-46 | Integrated local gate incl. E2E twice, expo-doctor, expo export; thresholds only raised | full suite | plan 12 Task 1 command + ratchet check | ✅ | ✅ green |
| 01.5-12-T2 | 12 | 6 | all four | T-01.5-45 | Every CI job green on the phase PR; evidence recorded | CI run | GitHub Actions run of the phase PR (URLs, job table, quoted lines below) | n/a | ✅ green |
| 01.5-12-T3 | 12 | 6 | all four | T-01.5-44, T-01.5-47 | Owner merges; fresh dev build after `npx expo prebuild --clean`; device steps 1-9 | manual | — (checkpoint) | n/a | ✅ green (offline cold start carried over) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## ROADMAP Criteria → Proof

| # | Criterion | Automated proof | Device step (plan 12 Task 3) |
|---|-----------|-----------------|------------------------------|
| 1 | One drain or pull at a time; two triggers → one POST /sync | `sync-flight.test.ts`, `sync.engine.sqlite.test.ts` | 8 |
| 2 | 250 operations in batches ≤ 100; synced only with an empty queue | `sync.engine.sqlite.test.ts` | 6, 8 |
| 3 | Retry cap 8, network/5xx not counted, timeouts, pull never overwrites pending/blocked | `sync-classification.test.ts`, `sync.retry.sqlite.test.ts`, `client.test.ts`, `sync.pull.sqlite.test.ts`, `sync.attachments.sqlite.test.ts` | 8 |
| 4 | Transactions, PRAGMA user_version, UUIDs | `transaction.sqlite.test.ts`, `db.migration*.sqlite.test.ts`, `surveys.transactions.sqlite.test.ts`, `sync.engine.sqlite.test.ts` | 4 |
| 5 | Resize 2048 / JPEG 0.7 / documents dir / streaming / missing file shown | `attachments.test.ts`, `attachments.sqlite.test.ts`, `sync.attachments.sqlite.test.ts`, `attachment-cache.sqlite.test.ts`, `survey-screen-helpers.test.ts` | 6, 7, 8 |
| 6 | Server photos displayable via presigned URL; expo-image | `attachments-download.e2e-spec.ts`, `surveys-attachments-download.spec.ts`, `attachment-cache.sqlite.test.ts`, `useAttachmentPreviews.test.ts` | 9 |
| 7 | Offline cold start with last known profile; refresh from /me | `useAuth0Session.test.ts`, `profile-cache.sqlite.test.ts` | 5 |

---

## Wave 0 Requirements

- [ ] `mobile/test/expo-crypto.mock.ts`, `expo-file-system-legacy.mock.ts`, `expo-image-manipulator.mock.ts`, `expo-image.mock.ts` + moduleNameMapper entries (plan 01 Task 2)
- [ ] `mobile/src/storage/attachment-files.test.ts` (plan 01 Task 3)
- [ ] `api/test/surveys-attachments-download.spec.ts`, `api/test/attachments-download.e2e-spec.ts` (plan 02)
- [ ] `mobile/src/storage/transaction.sqlite.test.ts`, `db.migration.sqlite.test.ts`, `db.migration-legacy.sqlite.test.ts` (plan 03)
- [ ] `mobile/src/storage/profile-cache.sqlite.test.ts`, `mobile/src/hooks/useEditingDraft.autosave.test.ts` (plan 04)
- [ ] `mobile/src/storage/surveys.transactions.sqlite.test.ts` (plan 05)
- [ ] `mobile/src/storage/attachment-cache.sqlite.test.ts`, `mobile/src/hooks/survey-sync/useAttachmentPreviews.test.ts` (plan 06)
- [ ] `mobile/src/storage/attachments.test.ts`, `attachments.sqlite.test.ts` (plan 07)
- [ ] `mobile/src/storage/sync-classification.test.ts`, `sync.retry.sqlite.test.ts`, `sync.pull.sqlite.test.ts` (plan 08)
- [ ] `mobile/src/storage/sync-flight.test.ts`, `sync.engine.sqlite.test.ts` (plan 10)
- [ ] `mobile/src/storage/sync.attachments.sqlite.test.ts` (plan 11)
- New packages: expo-crypto, expo-file-system, expo-image, expo-image-manipulator (plan 01, SDK 57, slopcheck [OK])

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Result (2026-09-25, owner, iPhone) |
|----------|-------------|------------|-------------------|--------|
| Existing on-device data survives the upgrade on a real phone | REQ-AUD-local-storage | Real SQLite file and photo files written by the previous app version | Plan 12 Task 3 steps 1, 3, 4 | ✅ existing surveys present after the upgrade (dev build) |
| Offline cold start opens the signed-in screens | REQ-AUD-offline-start | Real Auth0 credentials manager and airplane mode | Step 5 | ⚠ carried over: needs a Release build (dev builds load JS from Metro); the Release build currently shows the JS tab bar and a non-working "Mes relevés" tab, tracked separately |
| Photo capture, resize, streaming upload | REQ-AUD-photos | Native camera, image manipulator and upload task | Steps 6, 8 | ✅ photos taken offline appear at once, upright, well under 2 MB |
| Missing local file shown to the user | REQ-AUD-photos | Needs a real file removed on the device (dev-only control) | Step 7 | ✅ photo shows "Photo introuvable sur cet appareil…" |
| Many queued operations sync in one go | REQ-AUD-sync-engine | Real network transitions | Steps 6, 8 | ✅ 5 surveys × 2 photos created offline synced with no error |
| Server photo displayed after reinstall | REQ-AUD-photos | Needs the deployed download-url route and a fresh install | Steps 2, 9 | ✅ photos downloaded from the server after reinstall |

---

## CI Evidence (plan 12, Task 2)

- PR: _pending_
- Runs: _pending_

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## CI Evidence (plan 12, Task 2)

- PR: https://github.com/florianlepont/cortege/pull/150 (head `715f4be`)
- CI run: https://github.com/florianlepont/cortege/actions/runs/36115841093

| Job | Conclusion | Steps of note |
|-----|------------|---------------|
| Detect changed paths | success | |
| Lint, format, typecheck | success | Lint, Format check, Typecheck, actionlint all success |
| Unit tests — API | success | Run unit tests with coverage (raised thresholds enforced) |
| Unit tests — Mobile | success | Run unit tests with coverage (raised thresholds enforced) |
| E2E tests — API | success | E2E run 1, E2E run 2 (same database), reset asserted; includes `attachments-download.e2e-spec.ts` |
| Mobile build check | success | expo-doctor success, expo export success |
| Dependency audit | success | npm audit (all dependencies, high+) |
| Docker image check | success | non-root, no mobile deps, healthcheck, container answers health |
| CI OK | success | |
| Build & push Docker image | skipped (PR) | |

Local evidence (same head): E2E 83/83 run twice with `PASS test/attachments-download.e2e-spec.ts` in both runs; expo-doctor 20/20; `expo export --platform android` OK; unit API 162, mobile 757; ratchet check `ratchet ok` for both configs.

### Device check notes

- Method: dev build (`npx expo run:ios --device`) on the owner's iPhone. Airplane mode was switched on after the app loaded, because a dev build fetches its JS from Metro.
- Carried over: **offline cold start (ROADMAP criterion 7).** It is covered by unit and renderHook tests (plan 04), but it could not be checked on a device. It needs a Release build, and `--configuration Release` currently renders the JS tab bar instead of the native liquid-glass one, and "Mes relevés" does not work there. The owner chose to investigate that separately; it looks like the SDK 57 native-tabs issue fixed for dev builds in #119. Phase 01.5 changed no navigation package or navigator-selection code: versions are identical before and after, and a clean iOS prebuild shows no liquid-glass opt-out.
- Also observed: the dev build now shows a non-liquid-glass tab bar. Suspected cause: a local `EXPO_PUBLIC_ENABLE_NATIVE_TABS=false` left in `mobile/.env` from the #119 investigation. Deferred by the owner.

**Approval:** approved 2026-09-25 (owner), with the offline cold start device check carried over.
