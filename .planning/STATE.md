---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 1
current_phase_name: Species Recognition — Approach Decision
status: executing
stopped_at: Completed 01-04-PLAN.md iteration 3 (export, evaluation, three-way comparison, promotion)
last_updated: "2026-09-25T06:42:03.774Z"
last_activity: 2026-09-25
last_activity_desc: Phase 1 plan 04 iteration 3 complete -- 1/34 genera clear the D-02 bar
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 6
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-22)

**Core value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.
**Current focus:** Phase 1 — Species Recognition — Approach Decision

## Current Position

Phase: 1 (Species Recognition — Approach Decision) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-09-25 — 01-04 iteration 3 complete (1/34 genera clear the D-02 bar, model promoted)

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
| Phase 01-species-recognition-approach-decision P03 | ~3h | 2 tasks | 18 files |
| Phase 01 P04 | 50min | 2 tasks | 8 files |
| Phase 01 P04b | ~5.5h | 1 tasks | 5 files |
| Phase 01 P04-iter3 | ~9-10h (2 sessions, corpus expansion+2 bug fixes) | 2 tasks | 1 files |

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
- [Phase 01]: GATE-HARNESS PASS (corrected from an earlier, wrong BUILD-FAILED) -- react-native-fast-tflite built, linked AND RAN on a real iPhone 15 Pro (iOS 27.0, FLAGSHIP -- not the D-18 low-spec floor), 10/10 real benchmark passes (preprocess ms median 77.9/worst 93.2, inference ms median 4.8/worst 13.7). Android build succeeded but was not run on real hardware (no device connected, by user decision this milestone) -- recorded as a gap, not a runtime failure. D-06 offline behaviour not empirically re-verified in airplane mode on real hardware -- open item for plan 05.
- [Phase 01]: react-native-vision-camera@5.2.3 ships no Expo config plugin; fixed with a project-local plugin injecting camera permissions directly
- [Phase 01]: pod install must run once after all expo install calls finish, not interleaved -- interleaving left a stale Podfile.lock path that broke the iOS build
- [Phase 01]: TensorFlowLiteC/RCTDeprecation deployment targets (12.0/4.3) fall below Xcode 27's real-device floor (15.0) -- invisible on Simulator, fixed with a Podfile post_install hook plugin
- [Phase 01]: iOS 26+ scene-lifecycle-adoption crash (EXC_BREAKPOINT/SIGTRAP) is invisible on Simulator and only appears on a real device -- fixed by porting mobile/plugins/with-scene-delegate.js into the harness; this is the clearest evidence for why D-18's real-hardware requirement exists
- [Phase 01-04]: Shipped float16 quantisation instead of int8 dynamic-range after measuring int8 caused a real 79.4% parity-agreement drop vs 100% for float16 — Export-parity check required by the plan caught real prediction degradation from int8, not noise
- [Phase 01-04]: Evaluated per-genus accuracy against the raw, composition-unfiltered test split rather than hand-filtering it — Per-image filtering at 1,183-image test-split scale is the same hand-classify-at-scale work plan 02's coordinator guidance ruled out, and results already miss the bar by wide margins except one genus
- [Phase 01-04-iter2]: User rejected iteration 1's no-go as premature (150 img/class vs 4200+ available, smallest backbone vs 36x unused latency headroom); coordinator directed a second iteration rather than accepting the first result — Iteration 1 constrained itself by assumptions its own measurements invalidated
- [Phase 01-04-iter2]: Iteration 2 (MobileNetV3-Large, ~2000 img/class, season-stratified) found a data-limited result: 32/34 genera improved by mean +19.9pp top-3, still 0/34 clearing the 95% bar — Distinguishes data-limited from approach-limited for the ADR; neither a clean go nor a clean no-go
- [Phase 01-04-iter3]: Iteration 3 (MobileNetV3-Large, iteration 2's exact hyperparameters, corpus expanded 3.05x to 194,653 images at each class's real per-class ceiling) found 1/34 genera (Tamarix, 95.04%) clearing the D-02 95% bar for the first time, with a mean +6.74pp top-3 gain for the other 33 (vs +19.9pp for 1->2) — Diminishing but explicitly confounded by a fixed, never-saturating epoch budget at both iterations (EarlyStopping never triggered in either) -- a floor on the achievable gain, not proof of a hard ceiling. Model genuinely beat iteration 2 and was promoted to the canonical path.
- [Phase 01-04-iter4]: User asked for a rebalance targeted at weak Ile-de-France temperate genera (spring specifically); reconnaissance-only per "report back before a long download" — found Section 11.5's "real property of GBIF's holdings" conclusion for Acer/Pinus/Prunus autumn scarcity is wrong: GBIF's own `month` filter (never used by the fetch) returns 40,603/23,517/34,016 autumn-dated permissive-licence records for those three genera against the 66/30/60 the corpus actually captured, traced to an unsound early-exit + non-season-aware fetch in prepare_dataset.py, not a real GBIF scarcity — every weak temperate genus checked has 2.3x-83.5x headroom against GBIF's true pool vs. what the flat 6,000/class cap captured. Four alternative sources checked: Pl@ntNet-300K rejected (CC-BY-4.0 but zero of the 34 CNPF genera in its 1,081-species list, confirmed directly); Tela Botanica blocked on SSO-gated API access (licence would clear the gate; flagged for a human decision, not routed around); iNaturalist-direct usable but redundant with GBIF's existing iNat-sourced records; Wikimedia Commons usable, licence-verifiable per-file, recommended as a supplement only if a gap remains. Recommendation: fix+rescale the existing GBIF pipeline first (no new licence risk, order-of-magnitude headroom already confirmed) before any new-source integration — full findings in measurement doc Section 13, awaiting user go-ahead before corpus expansion/retrain proceeds.
- [Phase 01-04-iter4-exec]: Coordinator approved pipeline-fix-first plan (Tela Botanica parked, not pursued). Fixed prepare_dataset.py's early-exit (widened 2->8 pages' zero-progress threshold) and added GBIF month= season-scoped fetching; raised target to 10,000/class for the 20 weak temperate genera only, routed Pinus through the same season fetch at its unchanged 6,000 target for its autumn gap specifically. Corpus grew 194,653->265,546 selected (269,341 raw on disk), 1.36x — deliberately moderate. Acer/Prunus/Pinus autumn counts: 66/30/60 -> 2,500/2,500/1,500, directly reopening Section 12.6's "cannot tell" verdict. verify_corpus_complete() PASSED. Found and fixed a genuine memory bug before training: make_dataset()'s shuffle(8192) ran post-decode (~4.9GB of float32 image tensors) rather than pre-decode on lightweight path/label pairs. Training launched (EfficientNetB0, --finetune-epochs 20 vs iteration 3's fixed 8, EarlyStopping confirmed monitor=val_top3/restore_best_weights=True unchanged) — PID 19098, 2026-09-25 13:29 CEST, expected 5-12h wall-clock. Machine-wide load/swap during the run traced to pre-existing shared-machine contention (confirmed present before this iteration's work began), not a new pipeline leak — training process RSS itself 1.04GB.
- [Phase 01-04-iter4-complete]: Training finished (23.47h wall-clock: 5.80h head + 17.66h finetune, 20/20 epochs run). EarlyStopping on val_top3 did NOT fire despite genuine overfitting onset from epoch 15 (val_loss bottomed then rose while train loss kept falling) — a coarse, ceiling-bounded monitor metric missed what val_loss would have caught; flagged for a future iteration's EarlyStopping config, not re-run (D-19). This flips iteration 3's schedule-limited finding: the backbone/corpus combination is now saturated. Exported genus_classifier_v4.tflite (8.24MB, up from 6.13MB — plan 01-05 must re-time on device), 100% export parity. Evaluated on 26,557 test images: pooled top3 85.24%->88.25%, 32/34 genera improved. Decisive split: Île-de-France temperate genera (21, targeted) +4.93pp mean top-3 (21/21 positive) vs +1.65pp for untouched Mediterranean/other (11/13) — the targeted rebalance worked ~3x better where it was aimed. All 136 genus×season cells now clear n≥30 (previously 5 thin); Acer/Pinus/Prunus autumn resolved (82.40%/81.60%/95.35%, Pinus clearing D-02 in isolation). Still only Tamarix (96.88%) clears D-02 overall — no new partial-go. Promoted to canonical path after explicitly verifying the beat is on the targeted genera, not just the mean. Session survived a subscription rate-limit interruption mid-training with zero work lost — raw numbers were committed at each stage per explicit instruction.

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1 is a real go/no-go.** On-device species recognition has no stack, architecture or contract coverage anywhere in the document set. If the spike returns a no-go, Phases 2 and 3 fall away and REQ-C-species-recognition moves to the next milestone.
- **Schedule.** The published plan put MVP finalization at September 2026 (today) with field tests October–December. Phases 1–3 are unstarted unknowns; the December field-test window is at risk.
- **Codebase concerns carried in** (`.planning/codebase/CONCERNS.md`): string-interpolated SQL in `users.service.ts`, 9 of 12 screens untested, missing indexes — all scheduled in Phases 6 and 7.
- **Next-milestone prerequisite:** Epics E and G need a back-office / CMS surface that no spec or architecture doc defines.
- 01-03: plan 05 still needs a lower-spec real iOS device (iPhone SE/11-class, not a flagship) and a first real Android device -- the iPhone 15 Pro figures from 01-03 are a flagship ceiling, not the D-18 representative floor. D-06 (offline) also still needs an airplane-mode confirmation on real hardware.

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

Last session: 2026-09-26T13:35:00.000Z
Stopped at: 01-04-PLAN.md iteration 4 — COMPLETE. genus_classifier_v4.tflite (EfficientNetB0, 8.24MB) promoted to the canonical path after beating iteration 3 on the Île-de-France temperate genera specifically (+4.93pp mean top-3, 21/21 positive). Measurement doc Sections 14.1-14.6 all written and committed. eval/GATE: GATE-MODEL PASS. Next: plan 01-05 (device latency, must re-time the larger 8.24MB model) and plan 01-06 (ADR) can proceed against this promoted model.
Resume file: none — iteration 4 closed out; next work is plan 01-05/01-06
