---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 01.9
current_phase_name: audit-remediation track
status: executing
stopped_at: "01.9-31 checkpoint: waiting for final PR #159 CI, merge, deploy and owner device check"
last_updated: "2026-09-26T13:23:15.713Z"
last_activity: 2026-09-26
last_activity_desc: Phase 1 closed (ADR-002 Accepted; verification passed with one accepted Android deviation), branch merged with origin/main
progress:
  total_phases: 16
  completed_phases: 7
  total_plans: 95
  completed_plans: 63
  percent: 44
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-22)

**Core value:** An ecologist can complete a full IBP survey offline on a real parcel and have it reach the server intact on reconnection — no data loss, no duplicates.
**Current focus:** Two parallel tracks. **Audit-remediation track** — Phase 1.8 next, Phase 1.9 planned. **Species-recognition track** — Phase 1 closed 2026-09-26 (ADR-002 Accepted); Phase 1.1 (IBP method version) is next and must precede Phase 2, which builds the Factor A genus list.

## Current Position

Phase: 01.9 (audit-remediation track) — 30/32 plans done; 01.9-31 gate at its CI/merge checkpoint, 01.9-32 waits for 01.8
Plan: 01.9-31 (gate)
Status: Executing Phase 01.9
Last activity: 2026-09-26 — Phase 01.9 plans 01–30 merged on PR #159; origin/main (Phase 1 closed, ADR-002 Accepted) merged into the branch

Progress: [█░░░░░░░░░] 13%

## Performance Metrics

**Velocity:**

- Total plans completed: 56
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
| 01.7 | 13 | - | - |

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
| Phase 01-species-recognition-approach-decision P05 (partial: Task A) | ~2h | - tasks | - files |
| Phase 01-species-recognition-approach-decision P05 (complete) | ~3.5h total | - tasks | - files |
| Phase 01 P06 | ~2h | 3 tasks | 6 files |
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
- [Phase 01-05]: Per-genus confidence calibration (D-04/D-12 amended) fit on validation split, reported on test split -- collapses old single-global-threshold per-genus accuracy spread (79.49%-97.23%) to 85.91%-91.92% around the 90% target, at a 0.59pp pooled coverage cost. Ulmus/Prunus/Populus/Fraxinus flagged as genera where 'strong' will rarely fire even after calibration.
- [Phase 01-05]: Real on-device latency measured for the PROMOTED iteration-4 genus classifier on a real iPhone 15 Pro (Release build): median total 90.41ms online / 90.49ms airplane mode (D-05 3s budget MET, ~33x headroom). D-06 (offline, on-device-only) confirmed as a checked proof, not a code-inspection argument. GATE-MEASURE: COMPLETE.
- [Phase 01]: ADR-002 Accepted: full go for US-C9 this milestone, all 34 CNPF genera suggested with per-genus calibrated confidence, none withheld (D-04 amended); no partial-go list, since the partial-go rule would have enabled only Tamarix.
- [Phase 01]: D-07 amended at ratification: model bundled in the app binary (8.24MB), not downloaded separately -- the original download-to-stay-light premise assumed a large model; measured size invalidated it.
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

- Malformed legacy sync cursor returns 500 (from the phase 01.6 verification, 2026-09-25): `parseSyncChangesCursor` in `api/src/surveys/surveys-normalize.utils.ts` (~465-475) accepts `2024-02-30T00:00:00Z|x` or `2024-01-01 12:00:00 junk|x`, and the Postgres `::timestamptz` cast then fails with 22007/22008, which nothing maps to 400. This predates phase 01.6, and installed apps never send such cursors. Fix it in phase 01.7: validate strictly or map 22007/22008 to 400. That also makes `sync-conflict-resolution-v1.md:84` and `api-contract-v1.md:770` true.
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
- **Still open for plan 06's ADR:** no lower-spec real iOS device (iPhone SE/11-class, not a flagship) and no real Android device have ever been used in this phase -- every latency figure (plan 03's stock model, plan 05's promoted genus classifier) is from the same flagship iPhone 15 Pro, a ceiling not the D-18 representative floor. D-06 (offline, on-device-only) IS now confirmed on real hardware (plan 05: online/airplane medians differ by 0.08ms) -- this part is resolved.

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

Last session: 2026-09-26T12:54:55.117Z
Stopped at: Completed 01-06-PLAN.md -- ADR-002 Accepted, phase 1 closed (6/6 plans)
Resume file: None
