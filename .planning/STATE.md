---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01.2-09-PLAN.md
last_updated: "2026-09-25T16:28:27.014Z"
last_activity: 2026-09-25
progress:
  total_phases: 16
  completed_phases: 5
  total_plans: 49
  completed_plans: 43
  percent: 31
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-22)

**Core value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.
**Current focus:** Phase null

## Current Position

Phase: 01.7
Plan: Not started
Status: Executing Phase null
Last activity: 2026-09-25

Progress: [█░░░░░░░░░] 13%

## Performance Metrics

**Velocity:**

- Total plans completed: 43
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01.2 | 9 | - | - |
| 01.3 | 7 | - | - |
| 01.4 | 6 | - | - |
| 01.5 | 12 | - | - |
| 01.6 | 9 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01.2 P01 | 45min | 3 tasks | 13 files |
| Phase 01.2 P02 | 55min | 2 tasks | 9 files |
| Phase 01.2 P03 | 55min | 3 tasks | 9 files |
| Phase 01.2 P04 | 12min | 2 tasks | 8 files |
| Phase 01.2 P05 | 8min | 2 tasks | 4 files |
| Phase 01.2 P06 | 22min | 2 tasks | 8 files |
| Phase 01.2 P07 | 10min | 2 tasks | 8 files |
| Phase 01.2 P08 | 21min | 2 tasks | 6 files |
| Phase 01.2 P09 | 37min | 2 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md — 14 LOCKED ADR-001 decisions plus this milestone's Key
Decisions table. Decisions affecting current work:

- Milestone is **internal-only**; the whole community/social dimension moves to the next milestone
- **Multi-parcel linkage wins** (`survey_parcels`); `ibp-form-spec.md` §4 is stale — the code is the arbiter
- **Shipped status enum wins** (`draft|submitted|synced|error|expired`, `submitted_at`/`deleted_at`); `ibp-form-spec.md` §10.1 is stale
- US-C9 species recognition stays in MVP but is gated behind an ML ADR (Phase 1) and a contract extension (Phase 2)
- The current VPS is ratified as the hosting target, not migrated (Phase 6)
- [2026-09-25] **Owner device checks are delegated to Claude for the audit phases (1.6–1.9).** The owner no longer tests on the phone. Each phase gate replays the owner steps against the built API (MinIO mode through the pinned `pgsty/minio` image, plus the debug test-token) with a committed simulation script, and records the results in VALIDATION.md. Only checks that genuinely need a phone UI go back to the owner, and they must be explicitly justified.
- [Phase 01.2]: Tracker key = SHA-256(bearer token) when present, else client IP; trust proxy defaults to loopback
- [Phase 01.2]: Production default raised 10/min shared to 600/min per client (60/min /sync, 240/min uploads) plus a 3000/min per-IP ceiling against token rotation
- [Phase 01.2]: Email linking requires email_verified===true; unverified emails refuse to link and never write auth0_sub
- [Phase 01.2]: First-login provisioning uses INSERT ... ON CONFLICT (auth0_sub) with a 23505 re-select fallback for race-free user creation
- [Phase 01.2]: Reported survey events carry only {report_id}; reporter identity and reason stay in the moderator-only reports table, with migration 013 scrubbing historic rows
- [Phase 01.2]: sessionOwner (Auth0 sub+email) exposed from useAuth0Session for the D-04 local-data owner check in later plans
- [Phase 01.2]: buildBboxAroundPoint shares map-viewport's formatBbox helper with computeRegionBbox (D-12)
- [Phase 01.2]: shouldShowDevTools(isDev = __DEV__) gates the Settings dev-tools section and the App.tsx stored API URL override (D-11)
- [Phase 01.2]: DebugModule and the HS256 test-token path load only when NODE_ENV !== "production" (isDebugSurfaceEnabled); no new env var, so CI's NODE_ENV=test setup is unchanged
- [Phase 01.2]: clearSurveySessionState no longer purges local data on session end (D-02); AUTH_TEMPORARILY_UNAVAILABLE keeps the session as retry-later in sync/pull/report; pre-Auth0 stubs removed from useAuth0Session and every caller
- [Phase 01.2]: resolveLocalDataOwnership implements the D-04 owner decision table (adopt/match/purge-and-adopt/conflict/unknown-session) as a pure function; useLocalDataOwner's syncAllowed is default-deny (true only when status is ok)
- [Phase 01.2]: local_meta keys session_owner_sub/session_owner_email persist the D-04 owner marker; clearLocalIbpData also forgets them
- [Phase 01.2]: syncAllowed gates every automatic/manual sync and pull path in useSurveySyncNetwork (runSync, maybeAutoSync, handlePullChanges); handleReportSurvey stays ungated since it carries no local survey data
- [Phase 01.2]: handleLogout now counts unsynced work and purges only after an explicit destructive confirmation (D-03); performDeleteAccount purges via the same performLogoutAndPurge helper without the unsynced-work alert
- [Phase 01.2]: LocalDataOwnerConflictScreen (French) blocks the app with exactly two choices when localDataOwnerStatus is conflict; App.tsx keeps it mutually exclusive with the profile-setup overlay
- [Phase 01.2]: Device verification: steps 1-5 confirmed on real hardware (offline session keep, revoked refresh token, logout with unsynced work, other-account conflict, dev tools absent in release build); steps 6-7 (nearby-parcels list, production rate limiting) carried over as they require field conditions / a live deploy

### Pending Todos

- Switch local and VPS MinIO image (2026-09-25): upstream MinIO is archived; `quay.io/minio/minio` answers 401 and Docker Hub `minio/minio` is gone. `infra/docker-compose.yml` and `infra/docker-compose.vps.yml` still use `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`, which works only while cached, so a fresh host or a `docker image prune` breaks storage. The owner chose the `pgsty/minio` fork, already used by CI since phase 01.6. Move both compose files to it (pinned by digest) and check that the existing `/data` volume starts on the VPS.
- Investigate iOS Release build navigation (2026-09-25): `npx expo run:ios --device --configuration Release` shows the JS tab bar instead of the native liquid-glass one, and "Mes relevés" does not work. The dev build also shows a non-glass bar; first check `mobile/.env` for a leftover `EXPO_PUBLIC_ENABLE_NATIVE_TABS=false`. Then re-run the offline cold-start device check (phase 01.5 criterion 7) on a working Release build.

- Verify nearby-parcels list on device near known parcels (carried over from Phase 01.2-09 step 6; automated coverage exists in `useNearbyParcels.test.ts` / `map-viewport.test.ts`)
- After API deploy: check Caddy/API logs for 429 bursts under concurrent sync; set `TRUST_PROXY=loopback,uniquelocal` in `/home/ubuntu/cortege.env` if unauthenticated requests share one bucket (carried over from Phase 01.2-09 step 7)

### Blockers/Concerns

- **Phase 1 is a real go/no-go.** On-device species recognition has no stack, architecture or contract coverage anywhere in the document set. If the spike returns a no-go, Phases 2 and 3 fall away and REQ-C-species-recognition moves to the next milestone.
- **Schedule.** The published plan put MVP finalization at September 2026 (today) with field tests October–December. Phases 1–3 are unstarted unknowns, and the audit remediation (Phases 1.2–1.9) adds roughly 60 developer-days; the December field-test window is at risk. Only 1.2, 1.4, 1.5 and 1.6 gate Phase 7.
- **Codebase concerns carried in** (`.planning/codebase/CONCERNS.md`): 9 of 12 screens untested (Phase 7). The "string-interpolated SQL" and "missing indexes" concerns were re-checked on 2026-09-23 against the code and are re-scoped in Phase 6 — no injection exists and the three indexes already exist.
- **Critical data-loss defect in the shipped app** (audit M-C1): a token-refresh failure offline wipes every unsynced survey. Phase 1.2 fixes it; a corrective mobile release should follow before any further field use.
- **Next-milestone prerequisite:** Epics E and G need a back-office / CMS surface that no spec or architecture doc defines.

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: Reconcile the IBP method version — repo implements Fr v3.0, CNPF publishes FR v3.2 (URGENT)
- Phases 01.2–01.5 inserted after Phase 1 from the 2026-09 code audit (URGENT): stop field data loss and account exposure; CI and test safety net; API sync integrity; mobile sync engine reliability. Phase 7 now depends on 1.2, 1.4 and 1.5.
- Phases 01.6–01.9 inserted after Phase 1 to close the rest of the 2026-09 code audit (lots L10, L13–L20 and the remainders of L7, L16, L20): sync feed and object storage; API configuration, service split and database tuning; shared IBP domain package and test completeness; mobile state architecture, i18n, accessibility and hygiene

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Community/social | REQ-F-france-map, REQ-B-parcel-status-map, REQ-B-explore-analysis, REQ-C-privacy-choice | Deferred to next milestone | 2026-09-22 |
| Epics | E (data quality), F (gamification), G (association/donation), I (workshops) | Deferred to next milestone | 2026-09-22 |
| Analytics | Epic H (regional overviews, parcel trends, factor distributions) | Deferred to V2 | 2026-09-22 |
| Infrastructure | Back-office / CMS surface | Prerequisite for next milestone | 2026-09-22 |

## Session Continuity

Last session: 2026-09-23T16:34:41.161Z
Stopped at: Completed 01.2-09-PLAN.md
Resume file: None
