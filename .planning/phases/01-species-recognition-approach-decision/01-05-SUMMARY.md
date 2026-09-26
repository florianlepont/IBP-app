---
phase: 01-species-recognition-approach-decision
plan: 05
subsystem: ml-spike
tags: [confidence-calibration, tflite, device-harness, react-native-fast-tflite, expo-prebuild, spike, real-device, on-device-latency]

requires:
  - phase: 01-species-recognition-approach-decision (plan 03)
    provides: "device-harness (Expo 57/RN 0.86), GATE-HARNESS: PASS, real-hardware iOS build proof, model cache path convention"
  - phase: 01-species-recognition-approach-decision (plan 04)
    provides: "Promoted iteration-4 genus_classifier.tflite (EfficientNet-B0, float16, 8,238,676 bytes), GATE-MODEL: PASS, per-genus and per-genus-per-season test-split results"
provides:
  - "Per-genus calibrated 'strong' confidence thresholds for all 34 genera, fit on the validation split (26,553 images, never previously used for any accuracy claim in this document) and reported on the held-out test split (26,557 images) -- closes the D-04/D-12 amendment's calibration requirement. Collapses the old single-global-threshold per-genus accuracy spread (79.49%-97.23%, stdev 4.56pp) to 85.91%-91.92% (stdev 1.50pp) around the 90% target, at a 0.59pp pooled coverage cost."
  - "A re-cut four-level confidence scale (strong/medium/weak/very-weak, thresholds 0.7775/0.4866/0.3461) fixing D-12's 'weak band never fires' defect -- the bottom band now captures ~6% of predictions instead of 0 of 26,557."
  - "Four genera (Ulmus, Prunus, Populus, Fraxinus) flagged explicitly as keeping 'strong' below one third of predictions even after calibration -- the honest 'model rarely knows confidently' message plan 06's ADR needs."
  - "REAL on-device latency for the PROMOTED iteration-4 genus classifier (EfficientNet-B0, float16, 8,238,676 bytes) on a real iPhone 15 Pro (iOS 27.0), Release build: online median total 90.41ms (p95 115.30, worst 142.94, n=30); airplane-mode median total 90.49ms (p95 93.61, worst 108.34, n=30). D-05 (3s) MET for both, ~33x headroom. D-06 (offline, no network in the inference path) is now a CHECKED PROOF -- online vs airplane medians differ by 0.08ms."
  - "GATE-MEASURE: COMPLETE. Measurement document Status flipped to Complete. Every gap (Android not measured, field photos not supplied, model load time not captured, flagship-not-D-18-floor) stated plainly in Sections 6/7/9 rather than smoothed over."
affects: [01-06]

tech-stack:
  added: []
  patterns:
    - "Fit-on-validation, report-on-test discipline for any calibration/threshold figure -- reusing the same test split a threshold was tuned against (as the pre-existing pooled confidence_bands.json did) measures the threshold against its own tuning noise, not a genuine held-out check"
    - "Nested-remainder threshold sweep for multi-level confidence scales: fitting each band below the top one against the FULL pooled set is a dead end when pooled accuracy exceeds the lower bands' targets (a naive full-set sweep degenerates to 'include everything'); each band must be fit only against the remainder already excluded by the band(s) above it"
    - "`xcrun devicectl device info details --device <UDID>` wakes an idle `available (paired)` link into `connected` without requiring a physical replug -- device state shown by `list devices` can go idle between operations even while the cable stays connected, and re-querying device info re-engages it"
    - "Pool ALL valid CSV rows for a network state when the operator pressed a benchmark button multiple times, rather than reading off only the last press -- each press already contains its own internal warm-up-then-N-runs cycle, so multiple presses are independent, poolable trials, not a reason to discard earlier ones"

key-files:
  created:
    - spike/species-recognition/eval/calibrate_confidence.py (gitignored -- runs the promoted model over the validation split)
    - spike/species-recognition/eval/analyze_calibration.py (gitignored -- per-genus threshold fitting + pooled re-cut)
    - spike/species-recognition/eval/results_v4/val_per_genus_confidence.csv (gitignored, 26,553 rows)
    - spike/species-recognition/eval/results_v4/per_genus_calibration.csv (gitignored, 34 rows -- committed into the measurement doc as Section 15.2's raw table)
    - spike/species-recognition/eval/results_v4/confidence_scale_recut.json (gitignored)
    - spike/species-recognition/eval/GATE-MEASURE (gitignored -- GATE-MEASURE: COMPLETE)
    - spike/species-recognition/device-harness/assets/models/genus_classifier.tflite (gitignored, byte-identical copy of the canonical model)
    - spike/species-recognition/device-harness/assets/genus_labels.txt (gitignored, byte-identical copy, diff -q verified)
    - spike/species-recognition/device-harness/src/genusLabels.ts (gitignored)
    - spike/species-recognition/device-harness/results/results.csv (gitignored -- real 60-row sample pulled off the iPhone 15 Pro via devicectl, 30 online + 30 airplane, plus 10 preserved rows from plan 03's stock-model pass)
    - .planning/phases/01-species-recognition-approach-decision/01-05-SUMMARY.md (this file)
  modified:
    - docs/technical/species-recognition-spike-measurements-v1.md (new Section 15; Section 7 filled with real device figures; Section 9 gaps 3-5 rewritten, gap 5 resolved; header Status flipped to Complete; spike-duration-vs-timebox note added)
    - spike/species-recognition/device-harness/src/modelCache.ts (gitignored -- added seedGenusModelIntoCache)
    - spike/species-recognition/device-harness/src/inference.ts (gitignored -- added runGenusSample/p95/preprocessGenusImage/top3FromFloatOutput, float32 path)
    - spike/species-recognition/device-harness/src/resultsLog.ts (gitignored -- rewritten CSV schema)
    - spike/species-recognition/device-harness/App.tsx (gitignored -- rewritten for genus model + online/airplane buttons)
    - spike/species-recognition/device-harness/README.md (gitignored -- new "Run sheet for measurement day" section)

key-decisions:
  - "Task A (calibration) executed FIRST and to completion, per the objective's explicit 'needs no human' framing -- fully autonomous, two commits (raw table, then analysis), no deviations requiring a checkpoint."
  - "Chose cumulative-precision-from-the-top for the 'strong' band (correct for an unbounded-above band) but a NESTED/remainder-restricted version of the same sweep for medium/weak, after a first attempt against the full pooled set produced a degenerate result (pooled accuracy 72% exceeds both the 50% and 30% targets, so a naive sweep never finds a threshold above the dataset's minimum confidence) -- diagnosed directly via a 20-bin local-accuracy sweep before fixing, not assumed."
  - "Initially returned a checkpoint after `xcrun devicectl list devices` showed `available (paired)`, not `connected`, and no Simulator substitute was run (RESEARCH.md Pitfall 4). The coordinator relayed that the user had connected/unlocked/disabled-Auto-Lock the phone and that `available (paired)` is an idle-not-disconnected state resolvable via `devicectl device info details --device <UDID>` -- verified this independently (re-ran `list devices` myself before and after that command; state genuinely flipped to `connected`) rather than trusting the relay blindly, then proceeded."
  - "Took the CSV's own numbers as authoritative over the coordinator's relayed on-screen readout (94ms/95ms relayed vs 90.41ms/90.49ms computed from the full pooled CSV) -- the coordinator explicitly flagged this distinction and it proved correct: the relayed figures likely reflected a single button press rather than the full pooled sample."
  - "Pooled all 30 online and all 30 airplane CSV rows (the operator pressed each benchmark button 3 times) rather than reporting only one press, since each press already ran its own internal warm-up-then-10 cycle independently -- more data, not a reason to discard earlier presses."
  - "Reported model load time as an honest, uncaptured gap rather than estimating it from CSV timestamp gaps, which would conflate JS-thread/UI time with actual `loadTensorflowModel()` duration."
  - "GATE-MEASURE written as COMPLETE (not PARTIAL) -- both benchmark passes, the CSV pull and the missing-model check all completed successfully; the remaining gaps (Android, field photos, model load time, flagship-not-floor) are recorded plainly in Sections 6/7/9 rather than treated as blocking COMPLETE."

requirements-completed: []

duration: ~3.5h total (Task A ~2h: val-split inference ~7min background run + calibration analysis + documentation; Task B/C ~1.5h: harness re-wiring, Release build (~7min), device measurement, CSV pull, document closure)
completed: 2026-09-26
status: complete
---

# Phase 1 Plan 05: Device Latency + Field-Photo Validation, with Per-Genus Confidence Calibration Summary

**Per-genus confidence calibration collapses the old single-global-threshold accuracy spread (79.49%-97.23% per genus) to a tight 85.91%-91.92% band around the 90% target, fixes D-12's "weak band never fires" defect with a working four-level re-cut, and flags Ulmus/Prunus/Populus/Fraxinus as genera where the ecologist will see a confident suggestion on well under one-third of encounters even after calibration. The PROMOTED iteration-4 genus classifier (EfficientNet-B0, 8.24MB) was timed on a real iPhone 15 Pro: median total latency ~90ms both online and in airplane mode (D-05's 3s budget MET with ~33x headroom; D-06's on-device-only claim is now a checked proof, not a code inspection argument) -- a ~7.7-7.8ms increase over the only prior figure on record, which was itself from a stock ImageNet pipeline-proof model, not any trained genus classifier. Android remains unmeasured and field photographs remain unsupplied, both stated plainly rather than smoothed over. `GATE-MEASURE: COMPLETE`, measurement document Status flipped to Complete.**

## Performance

- **Started:** 2026-09-26 (continuation of phase 01, wave 4)
- **Completed:** 2026-09-26
- **Duration:** ~3.5h total across two sub-sessions (Task A calibration ~2h; Task B/C device measurement + document closure ~1.5h, including a checkpoint that was resolved mid-session once the coordinator relayed that the physical device had been connected)
- **Tasks:** All 3 plan tasks complete (Task 1 gate-check-and-harness-wiring, re-scoped to the promoted model; Task 2 the physical benchmark, initially checkpointed then completed after the device came online; Task 3 document closure), plus the objective's separate Task A (calibration) fully done
- **Files modified:** 1 tracked file (`docs/technical/species-recognition-spike-measurements-v1.md`, 6 commits total), plus the gitignored `spike/` tree (2 new Python scripts, 3 new CSV/JSON result files, 1 GATE-MEASURE file, a real 60-row device latency sample, and the device-harness's model/labels/source files)

## Accomplishments

- **Task A (calibration, fully autonomous):** Ran the promoted iteration-4 model
  (`train/genus_classifier.tflite`, no retraining) over the 26,553-image validation split via a
  new `eval/calibrate_confidence.py`. Fit a per-genus "strong" threshold on that split via a
  cumulative-precision sweep targeting 90% accuracy, then measured each threshold's actual
  performance on the untouched 26,557-image test split (`eval/analyze_calibration.py`). All 34
  genera reached a valid threshold. Result: per-genus test accuracy in the "strong" band now
  ranges 85.91%-91.92% (stdev 1.50pp), against 79.49%-97.23% (stdev 4.56pp) under the old single
  global threshold — a 3x tighter spread around the 90% target, at a 0.59 percentage-point pooled
  coverage cost. The four genera D-04's amendment specifically named (Ulmus, Populus, Prunus,
  Fraxinus) move from 20+pp below the promised 90% reliability to within 1pp of it. Also re-cut
  the confidence scale to four levels (strong/medium/weak/very-weak; thresholds
  0.7775/0.4866/0.3461, val-fit / test-reported accuracy 90.06%/49.73%/30.27%/19.95%), fixing
  D-12's "weak band received zero of 26,557 predictions" defect. Flagged Ulmus (26.83%
  strong-share), Prunus (29.30%), Populus (32.66%) and Fraxinus (35.18%) as genera where even
  calibrated "strong" will rarely fire.
- **Task B (device timing, software then physical measurement):** Confirmed both upstream gates
  read PASS before touching the harness. Re-wired `spike/species-recognition/device-harness/` to
  load and time the PROMOTED genus classifier instead of plan 03's stock ImageNet pipeline-proof
  model: bundled a byte-identical copy of `genus_classifier.tflite`/`genus_labels.txt`, added a
  float32-in/float32-out inference path (`runGenusSample`), added a warm-up-then-10-runs protocol
  with separate ONLINE and AIRPLANE MODE buttons, extended the CSV schema, added a "Run sheet for
  measurement day" section to the README. Wrote `GATE-MEASURE: READY`. **Initially checked
  `xcrun devicectl list devices` directly and found the only real device `available (paired)`,
  not `connected` — returned this as a checkpoint rather than substitute a Simulator run
  (RESEARCH.md Pitfall 4).** The coordinator relayed that the user had physically connected,
  unlocked and disabled Auto-Lock on the phone, and that `available (paired)` is an idle-but-
  connected state resolvable via `xcrun devicectl device info details --device <UDID>` — **verified
  this independently** (re-ran `list devices` before and after that command myself; state
  genuinely flipped to `connected`) before proceeding, rather than trusting the relay blindly.
  Built and installed a Release configuration (`npx expo run:ios --device
  00008130-001829D822F2001C --configuration Release`, JS bundle embedded, ~7min build, "Build
  Succeeded"). The operator ran the missing-model pass (confirmed working), seeded the genus
  model, and ran the ONLINE and AIRPLANE MODE benchmarks (each pressed multiple times). Pulled
  `results.csv` off the device via `xcrun devicectl device copy from` and computed statistics
  directly from the raw file (not from the coordinator's relayed on-screen numbers, which were
  close but not identical — 94/95ms relayed vs 90.41/90.49ms computed from the full 30-row pooled
  sample per network state). **Result: online median total 90.41ms (p95 115.30, worst 142.94,
  n=30); airplane median total 90.49ms (p95 93.61, worst 108.34, n=30). D-05 MET both ways, ~33x
  headroom. D-06 confirmed as a checked proof (0.08ms median difference between online and
  airplane).**
- **Task C (document closure):** Filled Section 7 with the real figures, the iteration-1-model
  comparison (with the honest caveat that the "83ms" prior figure was from the stock ImageNet
  model, not any trained genus classifier), and an explicit Android-not-measured statement.
  Rewrote Section 9 gaps 3-5: gap 5 (D-06 airplane-mode) marked RESOLVED; gap 4 restated as the
  genuine remaining Android gap; gap 3 clarified that the device-representativeness cap applies
  to real numbers now, not just unmeasured ones. Added a spike-duration-vs-D-19-timebox note.
  Flipped the document's header Status line to Complete. Wrote `GATE-MEASURE: COMPLETE`.

## Task Commits

1. **Task A, raw table** — `d2d628c` (docs) — Section 15.2's 34-row per-genus calibration table,
   committed before any interpretation
2. **Task A, analysis** — `acc0c4c` (docs) — before/after comparison, four-level re-cut,
   overfitting guard, rare-strong-genera flag, Section 9 gap entries 12-13
3. **Task B, Section 7 status update (checkpoint)** — `fd63315` (docs) — recorded the harness
   re-wiring and the initial `available (paired)` blocker
4. **Checkpoint record** — `8e05dbc` (docs) — interim SUMMARY.md + STATE.md while blocked
5. **Task B, raw device-latency figures** — `49a4461` (docs) — Section 7 filled with the real
   pulled-CSV numbers, committed before the interpretive comparison
6. **Task C, document closure** — `92c0734` (docs) — iteration-1 comparison, Section 9 gap
   rewrites, `GATE-MEASURE: COMPLETE`, Status flipped to Complete

All six commits are on `docs/technical/species-recognition-spike-measurements-v1.md` (or, for
commit 4, that file plus `.planning/`). The device-harness re-wiring and the real `results.csv`
pull live entirely in the gitignored `spike/` tree, per this phase's established "throwaway spike
code" convention — `git status --porcelain spike/` stayed empty throughout, confirmed after every
change.

**Plan metadata:** this SUMMARY + STATE.md follow in a final commit.

## Files Created/Modified

- `docs/technical/species-recognition-spike-measurements-v1.md` — new Section 15 (per-genus
  confidence calibration), Section 7 filled with real device figures, Section 9 gaps 3-5
  rewritten, Status flipped to Complete
- `spike/species-recognition/eval/calibrate_confidence.py` (gitignored) — inference over the
  validation split
- `spike/species-recognition/eval/analyze_calibration.py` (gitignored) — per-genus threshold
  fitting + pooled four-level re-cut
- `spike/species-recognition/eval/results_v4/val_per_genus_confidence.csv` (gitignored, 26,553 rows)
- `spike/species-recognition/eval/results_v4/per_genus_calibration.csv` (gitignored, 34 rows)
- `spike/species-recognition/eval/results_v4/confidence_scale_recut.json` (gitignored)
- `spike/species-recognition/eval/GATE-MEASURE` (gitignored) — `GATE-MEASURE: COMPLETE`
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
- `spike/species-recognition/device-harness/results/results.csv` (gitignored) — real 60-row sample
  pulled off the iPhone 15 Pro (30 online + 30 airplane new-schema rows, plus 10 preserved
  stock-model rows from plan 03)

## Decisions Made

See `key-decisions` in the frontmatter for the full list, including the fit-on-val/report-on-test
discipline, the nested-remainder sweep fix, the independent verification of the `devicectl`
idle-link behaviour before proceeding past the checkpoint, and taking the CSV's own numbers as
authoritative over the coordinator's relay.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Naive full-pooled-set threshold sweep degenerated for the medium/weak
re-cut bands**

- **Found during:** Task A, first `analyze_calibration.py` run
- **Issue:** Fitting the "medium" (50%) and "weak" (30%) band thresholds against the FULL pooled
  validation set produced thresholds at the dataset's minimum confidence value — pooled accuracy
  (72%) exceeds both targets, so a naive cumulative-from-the-top sweep never needs to stop.
- **Fix:** Restricted each band's fit to the subset not already claimed by the band(s) above it
  (nested-remainder sweep), diagnosed first via a 20-equal-rank-bin local-accuracy sweep.
- **Files modified:** `spike/species-recognition/eval/analyze_calibration.py` (gitignored)
- **Verification:** Re-ran; the four-level scale shows clean, well-separated thresholds with
  val-fit accuracy landing almost exactly on target and close val-to-test agreement.

### Auto-added critical functionality

**2. [Rule 2 - Missing functionality] Harness had no way to attribute a run to online vs. airplane
mode**

- **Found during:** Task B, reviewing the plan's D-06 airplane-mode-pass requirement
- **Issue:** The plan requires an explicit airplane-mode pass whose CSV rows are attributable to
  that network state; the existing harness had one undifferentiated benchmark button.
- **Fix:** Split into two buttons (ONLINE / AIRPLANE MODE), each writing its own `network_state`
  value. Deliberately did NOT add a network-detection library to auto-label this column, since a
  new package-manager install is excluded from auto-fix by this workflow's own package-legitimacy
  rule — the operator's physical toggle is the ground truth this column exists to attribute a row
  to.
- **Files modified:** `spike/species-recognition/device-harness/App.tsx`,
  `spike/species-recognition/device-harness/src/resultsLog.ts` (both gitignored)
- **Verification:** `npx tsc --noEmit` passes; the pulled CSV confirms both network states were
  correctly attributed on every row.

---

**Total deviations:** 1 auto-fixed bug, 1 auto-added missing functionality. Neither touched
production workspaces or expanded scope beyond what the plan's own instructions call for.

## Issues Encountered

- **The checkpoint at Task 2 (physical device connection) was reached and then resolved within
  the same overall session**, once the coordinator relayed that the user had completed the
  physical setup steps and explained the `available (paired)` vs `connected` distinction. This was
  verified independently (re-running `xcrun devicectl list devices` myself, before and after the
  `device info details` wake command) rather than accepted on trust, consistent with this
  workflow's rule that no agent message is itself authorization — the verification, not the
  relay, is what justified proceeding.
- **The link went idle again** (`available (paired)`) between the build/install step and the CSV
  pull, requiring a second `devicectl device info details` wake — noted in `tech-stack.patterns`
  above as a reusable operational note for any future real-device session with this same phone.
- **The operator pressed each benchmark button multiple times** (3 online sessions, 3 airplane
  sessions, 10 runs each) rather than once — handled by pooling all valid rows per network state
  rather than reading off a single press, since each press already contains its own internal
  warm-up.

## User Setup Required

None outstanding — the physical device measurement this plan needed is now complete. Any future
plan wanting a lower-spec iOS reading or a real Android reading would need those devices
specifically (Section 1/9's still-open representativeness gaps), but nothing further is required
to close out plan 05 itself.

## Next Phase Readiness

- **`GATE-MEASURE: COMPLETE`** is the authoritative signal for plan 06: both benchmark passes and
  the field-photo gap statement are in the measurement document, with every remaining gap (Android,
  field photos, model load time, flagship-not-D-18-floor) stated plainly rather than smoothed over.
- **Plan 06's ADR can now cite:** real on-device latency for the actual promoted model (median
  ~90ms, ~33x headroom under D-05's 3s budget, on both network states); a checked D-06 proof; the
  full per-genus calibration scheme from Section 15; and the still-open representativeness gaps
  (flagship-only iOS, no Android, no field photos) as explicit confidence caps on the go/no-go.
- **Section 15's calibration is usable by plan 06 independent of the device measurement** — it was
  complete and committed before Task B/C even started.

---
*Phase: 01-species-recognition-approach-decision*
*Completed: 2026-09-26*

## Self-Check: PASSED

All claimed files found on disk: `docs/technical/species-recognition-spike-measurements-v1.md`;
both new eval scripts; `val_per_genus_confidence.csv`, `per_genus_calibration.csv`,
`confidence_scale_recut.json`, `GATE-MEASURE` (reads `GATE-MEASURE: COMPLETE`); the bundled genus
model + labels; `genusLabels.ts`; `modelCache.ts`, `inference.ts`, `resultsLog.ts`, `App.tsx`,
`README.md`; the real `results.csv` (60 new-schema rows, 30 online + 30 airplane, verified via
direct recomputation of median/p95/worst from the raw file); this SUMMARY.md. All six claimed
commits (`d2d628c`, `acc0c4c`, `fd63315`, `8e05dbc`, `49a4461`, `92c0734`) found in
`git log --oneline --all`. All 14 of the plan's own automated verify checks re-run and pass on
the measurement document. `git status --porcelain spike/` confirmed empty.
