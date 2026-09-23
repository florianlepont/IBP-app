---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01.2-01-PLAN.md
last_updated: "2026-09-23T14:42:11.322Z"
last_activity: 2026-09-23
progress:
  total_phases: 16
  completed_phases: 0
  total_plans: 15
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-22)

**Core value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.
**Current focus:** Phase 01.2 — Stop field data loss and account exposure

## Current Position

Phase: 01.2 (Stop field data loss and account exposure) — EXECUTING
Plan: 2 of 9
Status: Ready to execute
Last activity: 2026-09-23

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01.2 P01 | 45min | 3 tasks | 13 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md — 14 LOCKED ADR-001 decisions plus this milestone's Key
Decisions table. Decisions affecting current work:

- Milestone is **internal-only**; the whole community/social dimension moves to the next milestone
- **Multi-parcel linkage wins** (`survey_parcels`); `ibp-form-spec.md` §4 is stale — the code is the arbiter
- **Shipped status enum wins** (`draft|submitted|synced|error|expired`, `submitted_at`/`deleted_at`); `ibp-form-spec.md` §10.1 is stale
- US-C9 species recognition stays in MVP but is gated behind an ML ADR (Phase 1) and a contract extension (Phase 2)
- The current VPS is ratified as the hosting target, not migrated (Phase 6)
- [Phase 01.2]: Tracker key = SHA-256(bearer token) when present, else client IP; trust proxy defaults to loopback
- [Phase 01.2]: Production default raised 10/min shared to 600/min per client (60/min /sync, 240/min uploads) plus a 3000/min per-IP ceiling against token rotation

### Pending Todos

None yet.

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

Last session: 2026-09-23T14:42:11.315Z
Stopped at: Completed 01.2-01-PLAN.md
Resume file: None
