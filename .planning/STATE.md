---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1
current_phase_name: Species Recognition — Approach Decision
status: executing
stopped_at: Completed 01-01-PLAN.md
last_updated: "2026-09-22T18:12:11.499Z"
last_activity: 2026-09-22
last_activity_desc: Phase 1 execution started
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 6
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-22)

**Core value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.
**Current focus:** Phase 1 — Species Recognition — Approach Decision

## Current Position

Phase: 1 (Species Recognition — Approach Decision) — EXECUTING
Plan: 3 of 6
Status: Ready to execute
Last activity: 2026-09-22 — Phase 1 execution started

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
| Phase 01 P01 | 25min | 3 tasks | 5 files |
| Phase 01 P02 | ~4h | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md — 14 LOCKED ADR-001 decisions plus this milestone's Key
Decisions table. Decisions affecting current work:

- Milestone is **internal-only**; the whole community/social dimension moves to the next milestone
- **Multi-parcel linkage wins** (`survey_parcels`); `ibp-form-spec.md` §4 is stale — the code is the arbiter
- **Shipped status enum wins** (`draft|submitted|synced|error|expired`, `submitted_at`/`deleted_at`); `ibp-form-spec.md` §10.1 is stale
- US-C9 species recognition stays in MVP but is gated behind an ML ADR (Phase 1) and a contract extension (Phase 2)
- The current VPS is ratified as the hosting target, not migrated (Phase 6)
- [Phase 01]: Benchmark devices (D-18) fallback: lowest-spec real iOS (iPhone SE 2nd/3rd gen or iPhone 11 class) and lowest-spec real Android (2022-2023 mid-range, Galaxy A-series class); no flagship. Recorded as a provisional confidence cap, not a phase failure. — Association did not confirm which phones its observers carry; RESEARCH.md Pitfall 4 rules out flagship test devices.
- [Phase 01]: Field photographs (D-16) fallback: no-field-photos. Spike reports the public-dataset accuracy figure only; field validation deferred and recorded as a stated gap in the measurement document, not silently dropped. — No field photo set was available at the Task 1 checkpoint.
- [Phase 01]: 34-class corpus assembled from GBIF occurrence media (CC0/CC-BY only); composition audit found the corpus is NOT reliably single-subject, excluding Betula and Phillyrea from the usable-class count (CLASSES-USABLE: 32, GATE-CORPUS: PASS)
- [Phase 01]: Seasonal-skew measurement found 23 of 34 classes have zero autumn-dated images in the training corpus, despite field tests starting in October -- recorded as a new confidence cap on any accuracy figure this phase reports

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1 is a real go/no-go.** On-device species recognition has no stack, architecture or contract coverage anywhere in the document set. If the spike returns a no-go, Phases 2 and 3 fall away and REQ-C-species-recognition moves to the next milestone.
- **Schedule.** The published plan put MVP finalization at September 2026 (today) with field tests October–December. Phases 1–3 are unstarted unknowns; the December field-test window is at risk.
- **Codebase concerns carried in** (`.planning/codebase/CONCERNS.md`): string-interpolated SQL in `users.service.ts`, 9 of 12 screens untested, missing indexes — all scheduled in Phases 6 and 7.
- **Next-milestone prerequisite:** Epics E and G need a back-office / CMS surface that no spec or architecture doc defines.

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: Reconcile the IBP method version — repo implements Fr v3.0, CNPF publishes FR v3.2 (URGENT)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Community/social | REQ-F-france-map, REQ-B-parcel-status-map, REQ-B-explore-analysis, REQ-C-privacy-choice | Deferred to next milestone | 2026-09-22 |
| Epics | E (data quality), F (gamification), G (association/donation), I (workshops) | Deferred to next milestone | 2026-09-22 |
| Analytics | Epic H (regional overviews, parcel trends, factor distributions) | Deferred to V2 | 2026-09-22 |
| Infrastructure | Back-office / CMS surface | Prerequisite for next milestone | 2026-09-22 |

## Session Continuity

Last session: 2026-09-22T18:11:40.308Z
Stopped at: Completed 01-01-PLAN.md
Resume file: None
