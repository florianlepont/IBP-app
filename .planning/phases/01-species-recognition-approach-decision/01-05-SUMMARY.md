---
phase: 01-species-recognition-approach-decision
plan: 05
subsystem: ml-spike
tags: [confidence-calibration, tflite, device-harness, react-native-fast-tflite, expo-prebuild, spike, real-device, checkpoint]

requires:
  - phase: 01-species-recognition-approach-decision (plan 03)
    provides: "device-harness (Expo 57/RN 0.86), GATE-HARNESS: PASS, real-hardware iOS build proof, model cache path convention"
  - phase: 01-species-recognition-approach-decision (plan 04)
    provides: "Promoted iteration-4 genus_classifier.tflite (EfficientNet-B0, float16, 8,238,676 bytes), GATE-MODEL: PASS, per-genus and per-genus-per-season test-split results"
provides:
  - "Per-genus calibrated 'strong' confidence thresholds for all 34 genera, fit on the validation split (26,553 images, never previously used for any accuracy claim in this document) and reported on the held-out test split (26,557 images) -- closes the D-04/D-12 amendment's calibration requirement. Collapses the old single-global-threshold per-genus accuracy spread (79.49%-97.23%, stdev 4.56pp) to 85.91%-91.92% (stdev 1.50pp) around the 90% target, at a 0.59pp pooled coverage cost."
  - "A re-cut four-level confidence scale (strong/medium/weak/very-weak, thresholds 0.7775/0.4866/0.3461) fixing D-12's 'weak band never fires' defect -- the bottom band now captures ~6% of predictions instead of 0 of 26,557."
  - "Four genera (Ulmus, Prunus, Populus, Fraxinus) flagged explicitly as keeping 'strong' below one third of predictions even after calibration -- the honest 'model rarely knows confidently' message plan 06's ADR needs."
  - "device-harness re-wired (gitignored, spike/-throwaway) to load and time the PROMOTED genus classifier instead of plan 03's stock ImageNet pipeline-proof model: float32 in/out inference path, byte-identical bundled model+labels, online/airplane-mode run buttons, extended CSV schema (network_state, run_index, total_ms, genus label names). GATE-MEASURE: READY."
  - "GATE-MEASURE: READY, not COMPLETE -- the physical device-measurement checkpoint (Task 2/B) is unresolved: `xcrun devicectl list devices` shows the only real device (iPhone 15 Pro) as `available (paired)`, not `connected`, at the time this plan stopped."
affects: [01-06]

tech-stack:
  added: []
  patterns:
    - "Fit-on-validation, report-on-test discipline for any calibration/threshold figure -- reusing the same test split a threshold was tuned against (as the pre-existing pooled confidence_bands.json did) measures the threshold against its own tuning noise, not a genuine held-out check"
    - "Nested-remainder threshold sweep for multi-level confidence scales: fitting each band below the top one against the FULL pooled set is a dead end when pooled accuracy exceeds the lower bands' targets (a naive full-set sweep degenerates to 'include everything'); each band must be fit only against the remainder already excluded by the band(s) above it"

key-files:
  created:
    - spike/species-recognition/eval/calibrate_confidence.py (gitignored -- runs the promoted model over the validation split)
    - spike/species-recognition/eval/analyze_calibration.py (gitignored -- per-genus threshold fitting + pooled re-cut)
    - spike/species-recognition/eval/results_v4/val_per_genus_confidence.csv (gitignored, 26,553 rows)
    - spike/species-recognition/eval/results_v4/per_genus_calibration.csv (gitignored, 34 rows -- committed into the measurement doc as Section 15.2's raw table)
    - spike/species-recognition/eval/results_v4/confidence_scale_recut.json (gitignored)
    - spike/species-recognition/eval/GATE-MEASURE (gitignored -- GATE-MEASURE: READY)
    - spike/species-recognition/device-harness/assets/models/genus_classifier.tflite (gitignored, byte-identical copy of the canonical model)
    - spike/species-recognition/device-harness/assets/genus_labels.txt (gitignored, byte-identical copy, diff -q verified)
    - spike/species-recognition/device-harness/src/genusLabels.ts (gitignored)
    - .planning/phases/01-species-recognition-approach-decision/01-05-SUMMARY.md (this file)
  modified:
    - docs/technical/species-recognition-spike-measurements-v1.md (new Section 15; Section 7 rewritten from a placeholder to a "harness ready, measurement not yet run" statement; Section 9 gained gap entries 12-13)
    - spike/species-recognition/device-harness/src/modelCache.ts (gitignored -- added seedGenusModelIntoCache)
    - spike/species-recognition/device-harness/src/inference.ts (gitignored -- added runGenusSample/p95/preprocessGenusImage/top3FromFloatOutput, float32 path)
    - spike/species-recognition/device-harness/src/resultsLog.ts (gitignored -- rewritten CSV schema)
    - spike/species-recognition/device-harness/App.tsx (gitignored -- rewritten for genus model + online/airplane buttons)
    - spike/species-recognition/device-harness/README.md (gitignored -- new "Run sheet for measurement day" section)

key-decisions:
  - "Task A (calibration) executed FIRST and to completion, per the objective's explicit 'needs no human' framing -- fully autonomous, two commits (raw table, then analysis), no deviations requiring a checkpoint."
  - "Chose cumulative-precision-from-the-top for the 'strong' band (correct for an unbounded-above band) but a NESTED/remainder-restricted version of the same sweep for medium/weak, after a first attempt against the full pooled set produced a degenerate result (pooled accuracy 72% exceeds both the 50% and 30% targets, so a naive sweep never finds a threshold above the dataset's minimum confidence) -- diagnosed directly via a 20-bin local-accuracy sweep before fixing, not assumed."
  - "GATE-MEASURE written as READY, not COMPLETE or SKIPPED -- both upstream gates (GATE-HARNESS, GATE-MODEL) read PASS, so the plan's early-exit branch does not apply, but the Task 2 human checkpoint (physical device connection) could not be completed this session, so task 3 (field-photo validation, document closure) was correctly not attempted."
  - "Did not substitute a Simulator run for the real-device measurement -- checked `xcrun devicectl list devices` directly (state: `available (paired)`, not `connected`) before deciding to stop rather than assuming the device was unreachable."
  - "SUMMARY.md written despite the plan being incomplete, given this phase's documented history of lost turns to API errors/session ends/rate limits and the explicit 'raw numbers go in before any write-up' instruction -- status is NOT `complete` (see status field) so the audit/progress tooling does not mistake this for a finished plan."

requirements-completed: []

duration: ~2h (val-split inference ~7min background run, remainder calibration analysis + harness re-wiring + documentation)
completed: 2026-09-26
status: partial
---

# Phase 1 Plan 05: Device Latency + Field-Photo Validation (Task A calibration complete; Task B/C blocked at physical-device checkpoint) Summary

**Per-genus confidence calibration is DONE and committed: fitting each of 34 genera's "strong" threshold on the validation split and reporting accuracy on the held-out test split collapses the old single-global-threshold accuracy spread (79.49%-97.23% per genus) to a tight 85.91%-91.92% band around the 90% target, fixes D-12's "weak band never fires" defect with a working four-level re-cut, and flags Ulmus/Prunus/Populus/Fraxinus as genera where the ecologist will see a confident suggestion on well under one-third of encounters even after calibration. The device-latency and field-photo tasks (B/C) are prepared in software — the harness now loads and times the PROMOTED genus classifier instead of plan 03's stock model — but the physical measurement itself is blocked: the only real device on hand is `available (paired)`, not `connected`, per `xcrun devicectl list devices`, so this plan stops at that checkpoint rather than substitute a Simulator reading.**

## Performance

- **Started:** 2026-09-26 (continuation of phase 01, wave 4)
- **Completed (this session):** 2026-09-26 — Task A fully done; Task B software-prepared and checkpointed; Task C not started (depends on Task B's measurement)
- **Duration:** ~2h, including a ~7min background inference run over the 26,553-image validation split
- **Tasks:** 1 of 3 plan tasks fully done (Task 1/gate-check-and-harness-wiring done in substance, though re-scoped to the promoted model); the objective's separate Task A (calibration) fully done; Task 2 (checkpoint) reached and returned; Task 3 not attempted
- **Files modified:** 1 tracked (`docs/technical/species-recognition-spike-measurements-v1.md`, 3 commits), plus the gitignored `spike/` tree (2 new Python scripts, 3 new CSV/JSON result files, 1 new GATE-MEASURE file, and the device-harness's model/labels/source files)

## Accomplishments

- **Task A (calibration, fully autonomous, complete):** Ran the promoted iteration-4 model
  (`train/genus_classifier.tflite`, no retraining) over the 26,553-image validation split via a
  new `eval/calibrate_confidence.py` (structurally identical to `eval/evaluate_seasonal_accuracy.py`,
  `val.txt` substituted for `test.txt`). Fit a per-genus "strong" threshold on that split via a
  cumulative-precision sweep targeting 90% accuracy, then measured each threshold's actual
  performance on the untouched 26,557-image test split (`eval/analyze_calibration.py`). All 34
  genera reached a valid threshold (minimum val sample: Ceratonia, 363 images — well above the
  30-image reporting floor). Result: per-genus test accuracy in the "strong" band now ranges
  85.91%-91.92% (stdev 1.50pp), against 79.49%-97.23% (stdev 4.56pp) under the old single global
  threshold — a 3x tighter spread around the 90% target, at a 0.59 percentage-point pooled
  coverage cost (63.70% vs 64.29% of predictions labelled "strong"). The four genera D-04's
  amendment specifically named (Ulmus, Populus, Prunus, Fraxinus) move from 20+pp below the
  promised 90% reliability to within 1pp of it. Also re-cut the confidence scale to four levels
  (strong/medium/weak/very-weak; thresholds 0.7775/0.4866/0.3461, val-fit / test-reported
  accuracy 90.06%/49.73%/30.27%/19.95%), fixing D-12's "weak band received zero of 26,557
  predictions" defect — the bottom band now captures ~6% of test predictions. Flagged Ulmus
  (26.83% strong-share), Prunus (29.30%), Populus (32.66%) and Fraxinus (35.18%) as genera where
  even calibrated "strong" will rarely fire — the honest message for the ADR is "the model rarely
  knows confidently" for these four, not a threshold to loosen.
- **Task B (device timing, software-prepared, checkpoint returned):** Confirmed both upstream
  gates read PASS (`GATE-HARNESS: PASS` from plan 03, `GATE-MODEL: PASS` from plan 04) before
  touching the harness, per the plan's own early-exit discipline. Re-wired
  `spike/species-recognition/device-harness/` to load and time the PROMOTED genus classifier
  (EfficientNet-B0, float16, 8,238,676 bytes) instead of plan 03's stock ImageNet pipeline-proof
  model: bundled a byte-identical copy of `genus_classifier.tflite` and `genus_labels.txt`, added
  a float32-in/float32-out inference path (`runGenusSample`, matching the model's actual dtypes —
  the stock model's uint8 path is unchanged and kept as a regression check), added a
  warm-up-then-10-runs protocol with separate ONLINE and AIRPLANE MODE buttons (D-06), extended
  the results CSV with `network_state`/`run_index`/`total_ms` columns and genus label names
  (not indices), and added a "Run sheet for measurement day" section to the harness README
  spelling out the exact tap order, including the missing-model pass (D-08) and the
  Auto-Lock-Never / cable-connect / `xcrun devicectl` verification steps the prior measurement
  day's own lessons call for. `npx tsc --noEmit` passes cleanly; `npx expo lint` reports 5
  pre-existing-style warnings (0 errors). Wrote `GATE-MEASURE: READY`. **Checked
  `xcrun devicectl list devices` directly before proceeding to the physical run: the only real
  device (iPhone 15 Pro, UDID `00008130-001829D822F2001C`) is `available (paired)`, not
  `connected`** — exactly the state the plan's own checkpoint instructions flag as an idle link
  that would hang a build. Per RESEARCH.md Pitfall 4 and this plan's explicit "under no
  circumstance substitute a simulator" instruction, no measurement was attempted. **Returning
  this as a checkpoint, not a failure** — the software side of Task B is done and re-usable the
  moment the phone is connected.
- **Task C (gaps + document closure): not started.** Depends on Task B's actual measurement
  (field-photo validation was already recorded as not-performed in Section 6/9 well before this
  plan; nothing new to add there until Task B produces latency numbers). Section 7 was updated
  from a bare placeholder to an explicit "harness ready, measurement not yet run" statement
  naming exactly what changed and why no number exists yet — this is not the same as Task C's
  full document-closure work, which still needs the actual measurement.

## Task Commits

1. **Task A, raw table** — `d2d628c` (docs) — Section 15.2's 34-row per-genus calibration table,
   committed before any interpretation
2. **Task A, analysis** — `acc0c4c` (docs) — before/after comparison, four-level re-cut, overfitting
   guard, rare-strong-genera flag, Section 9 gap entries 12-13
3. **Task B, Section 7 status update** — `fd63315` (docs) — records the harness re-wiring and why
   the physical measurement did not happen this session

All three commits are on `docs/technical/species-recognition-spike-measurements-v1.md` only. The
device-harness re-wiring itself (model/labels/source files) lives entirely in the gitignored
`spike/` tree, per this phase's established "throwaway spike code" convention (`01-03-SUMMARY.md`,
`01-04-SUMMARY.md`) — `git status --porcelain spike/` stays empty throughout, confirmed after each
change.

**Plan metadata:** this SUMMARY + STATE.md follow in a final commit, per convention — but see
"Next Phase Readiness" below: this plan is NOT being marked complete, since Task 2's checkpoint is
unresolved.

## Files Created/Modified

- `docs/technical/species-recognition-spike-measurements-v1.md` — new Section 15 (per-genus
  confidence calibration: method, raw table, before/after, four-level re-cut, overfitting guard,
  rare-strong-genera flag), Section 7 rewritten, Section 9 gained gap entries 12-13
- `spike/species-recognition/eval/calibrate_confidence.py` (gitignored) — inference over the
  validation split
- `spike/species-recognition/eval/analyze_calibration.py` (gitignored) — per-genus threshold
  fitting + pooled four-level re-cut
- `spike/species-recognition/eval/results_v4/val_per_genus_confidence.csv` (gitignored, 26,553 rows)
- `spike/species-recognition/eval/results_v4/per_genus_calibration.csv` (gitignored, 34 rows)
- `spike/species-recognition/eval/results_v4/confidence_scale_recut.json` (gitignored)
- `spike/species-recognition/eval/GATE-MEASURE` (gitignored) — `GATE-MEASURE: READY`
- `spike/species-recognition/device-harness/assets/models/genus_classifier.tflite` (gitignored,
  byte-identical copy of the canonical promoted model)
- `spike/species-recognition/device-harness/assets/genus_labels.txt` (gitignored, byte-identical
  copy, `diff -q` verified against `train/genus_labels.txt`)
- `spike/species-recognition/device-harness/src/genusLabels.ts` (gitignored)
- `spike/species-recognition/device-harness/src/modelCache.ts` (gitignored) — added
  `seedGenusModelIntoCache`
- `spike/species-recognition/device-harness/src/inference.ts` (gitignored) — added
  `runGenusSample`/`p95`/`preprocessGenusImage`/`top3FromFloatOutput`
- `spike/species-recognition/device-harness/src/resultsLog.ts` (gitignored) — rewritten CSV schema
- `spike/species-recognition/device-harness/App.tsx` (gitignored) — rewritten UI
- `spike/species-recognition/device-harness/README.md` (gitignored) — new run sheet section

## Decisions Made

See `key-decisions` in the frontmatter for the full list, including the fit-on-val/report-on-test
discipline, the nested-remainder sweep fix for the four-level re-cut, and the decision not to mark
this plan complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Naive full-pooled-set threshold sweep degenerated for the medium/weak
re-cut bands**

- **Found during:** Task A, first `analyze_calibration.py` run
- **Issue:** Fitting the "medium" (50%) and "weak" (30%) band thresholds against the FULL pooled
  validation set (rather than the remainder left after removing the "strong" band) produced
  thresholds at the dataset's minimum confidence value — because pooled accuracy (72%) exceeds
  both targets, a naive cumulative-from-the-top sweep never needs to stop before including
  everything.
- **Fix:** Restricted each band's fit to the subset not already claimed by the band(s) above it
  (nested-remainder sweep). Diagnosed first via a 20-equal-rank-bin local-accuracy sweep on the
  validation split, confirming local accuracy steps cleanly from 99.9% to 18.0% with no plateau,
  before writing the fix.
- **Files modified:** `spike/species-recognition/eval/analyze_calibration.py` (gitignored)
- **Verification:** Re-ran; the four-level scale now shows clean, well-separated thresholds
  (0.7775/0.4866/0.3461) with val-fit accuracy landing almost exactly on target (90.00%/50.00%/
  30.00%) and close val-to-test agreement (90.06%/49.73%/30.27%/19.95%).

### Auto-added critical functionality

**2. [Rule 2 - Missing functionality] Harness had no way to attribute a run to online vs. airplane
mode**

- **Found during:** Task B, reviewing the plan's D-06 airplane-mode-pass requirement against the
  existing single "Run benchmark" button
- **Issue:** The plan requires an explicit airplane-mode pass whose CSV rows are attributable to
  that network state (D-18: "a latency figure with no device attached is not a measurement" —
  the same logic applies to network state). The existing harness had one undifferentiated
  benchmark button and no `network_state` column.
- **Fix:** Split into two buttons (ONLINE / AIRPLANE MODE), each writing its own `network_state`
  value; deliberately did NOT add a network-detection library (e.g. `expo-network`) to
  auto-label this column, since any new package-manager install is excluded from auto-fix by this
  workflow's own package-legitimacy rule — the operator's physical toggle is the ground truth
  this column exists to attribute a row to, and a manual two-button UI cannot silently mislabel a
  run the way an auto-detection library reading a stale connectivity cache could.
- **Files modified:** `spike/species-recognition/device-harness/App.tsx`,
  `spike/species-recognition/device-harness/src/resultsLog.ts` (both gitignored)
- **Verification:** `npx tsc --noEmit` passes; manual code review confirms both buttons write
  distinct, correctly-labelled rows.

---

**Total deviations:** 1 auto-fixed bug, 1 auto-added missing functionality. Neither touched
production workspaces or expanded scope beyond what Task A/B's own instructions call for.

## Issues Encountered

- **The only real device on hand (iPhone 15 Pro, UDID `00008130-001829D822F2001C`) is
  `available (paired)`, not `connected`, per `xcrun devicectl list devices`.** This is the exact
  state the plan's checkpoint instructions name as an idle link that would hang or time out a
  build attempt. No workaround was attempted; per RESEARCH.md Pitfall 4 and the plan's explicit
  instruction, no Simulator substitute was run either. This is the reason Task 2/B's physical
  measurement and Task 3/C's document closure did not happen this session.

## User Setup Required

**Before a continuation agent can complete this plan's remaining tasks:**
- Connect the iPhone 15 Pro by cable. Confirm `xcrun devicectl list devices` shows `connected`,
  not `available (paired)`.
- Unlock it and keep it on the home screen; set Settings → Display & Brightness → Auto-Lock →
  Never for the duration.
- Follow `spike/species-recognition/device-harness/README.md`'s "Run sheet for measurement day"
  section exactly, in order (missing-model pass, seed genus model, ONLINE benchmark, physically
  enable Airplane Mode, AIRPLANE MODE benchmark, pull the CSV).
- Report back: both device model/OS version (read from the device, not typed in), median/p95/worst
  preprocess/inference/total ms for each network state, and whether the on-screen D-05 (3s) verdict
  read MET or MISSED.
- No field photographs have been supplied at any point in this phase (`no-field-photos`, recorded
  since the Task 1/01-01 checkpoint) — Task 3/C's field-photo half is expected to remain a
  documented gap, not a new blocker, unless photographs arrive before plan 06's ADR is written.

## Next Phase Readiness

- **This plan is NOT complete.** `GATE-MEASURE: READY` (not `COMPLETE` or `PARTIAL`) is the
  authoritative signal: the harness is prepared for measurement day, but measurement day has not
  happened. Plan 06 must not read this SUMMARY as a substitute for a real device-latency figure.
- **Task A's calibration work is fully usable by plan 06 regardless of when Task B/C finish** —
  it does not depend on the device measurement and is committed on the measurement document
  already (Section 15).
- **A continuation agent resuming this plan should:** verify the device is `connected` (not just
  `available (paired)`), run the harness per the README's run sheet, fill Section 7 with the real
  numbers, then proceed to Task 3/C (field-photo gap restatement — expected to remain a gap — and
  final `GATE-MEASURE: COMPLETE`/`PARTIAL` + Status: Complete flip on the measurement document).
- STATE.md is updated to reflect a blocker (physical device checkpoint), not plan-05 completion —
  `current plan` stays at 5, `completed_plans` stays at 4.

---
*Phase: 01-species-recognition-approach-decision*
*Completed (partial, this session): 2026-09-26*

## Self-Check: PASSED

All 16 claimed files found on disk (docs measurement doc; both new eval scripts;
val_per_genus_confidence.csv, per_genus_calibration.csv, confidence_scale_recut.json,
GATE-MEASURE; the bundled genus model + labels; genusLabels.ts; modelCache.ts, inference.ts,
resultsLog.ts, App.tsx, README.md; this SUMMARY.md). All three claimed commits (`d2d628c`,
`acc0c4c`, `fd63315`) found in `git log --oneline --all`. `git status --porcelain spike/` confirmed
empty before this SUMMARY was written.
