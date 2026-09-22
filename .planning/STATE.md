---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1
current_phase_name: Species Recognition — Approach Decision
status: planning
stopped_at: Phase 1 context gathered
last_updated: "2026-09-22T09:01:30.506Z"
last_activity: 2026-09-22
last_activity_desc: Project initialized from ingested docs and codebase maps; PROJECT.md, REQUIREMENTS.md and ROADMAP.md written
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-22)

**Core value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.
**Current focus:** Phase 1 — Species Recognition: Approach Decision

## Current Position

Phase: 1 of 7 (Species Recognition — Approach Decision)
Plan: 0 of 0 in current phase
Status: Ready to plan
Last activity: 2026-09-22 — Project initialized from ingested docs and codebase maps; PROJECT.md, REQUIREMENTS.md and ROADMAP.md written

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md — 14 LOCKED ADR-001 decisions plus this milestone's Key
Decisions table. Decisions affecting current work:

- Milestone is **internal-only**; the whole community/social dimension moves to the next milestone
- **Multi-parcel linkage wins** (`survey_parcels`); `ibp-form-spec.md` §4 is stale — the code is the arbiter
- **Shipped status enum wins** (`draft|submitted|synced|error|expired`, `submitted_at`/`deleted_at`); `ibp-form-spec.md` §10.1 is stale
- US-C9 species recognition stays in MVP but is gated behind an ML ADR (Phase 1) and a contract extension (Phase 2)
- The current VPS is ratified as the hosting target, not migrated (Phase 6)

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1 is a real go/no-go.** On-device species recognition has no stack, architecture or contract coverage anywhere in the document set. If the spike returns a no-go, Phases 2 and 3 fall away and REQ-C-species-recognition moves to the next milestone.
- **Schedule.** The published plan put MVP finalization at September 2026 (today) with field tests October–December. Phases 1–3 are unstarted unknowns; the December field-test window is at risk.
- **Codebase concerns carried in** (`.planning/codebase/CONCERNS.md`): string-interpolated SQL in `users.service.ts`, 9 of 12 screens untested, missing indexes — all scheduled in Phases 6 and 7.
- **Next-milestone prerequisite:** Epics E and G need a back-office / CMS surface that no spec or architecture doc defines.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Community/social | REQ-F-france-map, REQ-B-parcel-status-map, REQ-B-explore-analysis, REQ-C-privacy-choice | Deferred to next milestone | 2026-09-22 |
| Epics | E (data quality), F (gamification), G (association/donation), I (workshops) | Deferred to next milestone | 2026-09-22 |
| Analytics | Epic H (regional overviews, parcel trends, factor distributions) | Deferred to V2 | 2026-09-22 |
| Infrastructure | Back-office / CMS surface | Prerequisite for next milestone | 2026-09-22 |

## Session Continuity

Last session: 2026-09-22T09:01:30.500Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-species-recognition-approach-decision/01-CONTEXT.md
