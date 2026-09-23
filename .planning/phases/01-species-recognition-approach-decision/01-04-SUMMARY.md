---
phase: 01-species-recognition-approach-decision
plan: 04
subsystem: ml-spike
tags:
  [
    tensorflow,
    keras,
    mobilenetv3,
    tflite,
    quantisation,
    transfer-learning,
    genus-classification,
    evaluation,
  ]

requires:
  - phase: 01-species-recognition-approach-decision (plan 02)
    provides: 34-class genus label set, licence-clean GBIF image corpus, train/val/test splits, GATE-CORPUS PASS
  - phase: 01-species-recognition-approach-decision (plan 03)
    provides: on-device model cache path convention (Paths.document/models/genus_classifier.tflite), device-harness proof
provides:
  - "A fine-tuned, quantised genus classifier: spike/species-recognition/train/genus_classifier.tflite (2,000,768 bytes, float16, 34 output classes)"
  - "spike/species-recognition/train/finetune.py and export_tflite.py: gitignored transfer-learning and TFLite-export scripts (MobileNetV3-Small, ImageNet-pretrained)"
  - "spike/species-recognition/eval/evaluate_accuracy.py: gitignored per-genus top-1/top-3 evaluation harness against the held-out test split"
  - "spike/species-recognition/eval/results/per_genus_accuracy.csv: 34-row per-genus accuracy table with raw hit counts, clears-bar flag, status"
  - "spike/species-recognition/eval/GATE: GATE-MODEL: PASS"
  - "Measurement document Section 4 (model, licence chain, quantisation choice) and Section 5 (per-genus accuracy, confidence bands, candidate ordering) filled in full"
  - "Central finding: 0 of 34 genera clear the D-02 top-3 95% bar; closest (Olea) misses by one test image (33/35, 94.29%)"
affects: [01-05, 01-06]

tech-stack:
  added: []
  patterns:
    - "Training directly in TensorFlow/Keras (tf.keras.applications.MobileNetV3Small) rather than PyTorch->ONNX->TF, to keep the TFLite export path a native TFLiteConverter.from_saved_model call and avoid the awkward-conversion contingency RESEARCH.md flagged"
    - "Measure-before-assume quantisation choice: tried int8 dynamic-range and float16 post-training quantisation, compared export parity on a held-out sample, and shipped whichever actually preserved predictions rather than defaulting to the smaller file"
    - "Fixed tensorflow.lite's broken from tensorflow.lite import Interpreter path inside the venv's own site-packages (tensorflow/lite/__init__.py was shipped empty in this TF 2.21.0 wheel) rather than installing a new package to work around it"

key-files:
  created:
    - spike/species-recognition/train/finetune.py (gitignored)
    - spike/species-recognition/train/export_tflite.py (gitignored)
    - spike/species-recognition/eval/evaluate_accuracy.py (gitignored)
  modified:
    - docs/technical/species-recognition-spike-measurements-v1.md (Sections 4, 5, 6, 9)

key-decisions:
  - "Float16 quantisation shipped instead of int8 dynamic-range, after measuring: int8 gave only 79.4% top-1 export-parity agreement with the trained model (a real accuracy cost, not noise -- probability shifts up to 2x on the same predicted class), float16 gave 100% agreement at roughly 2x the file size (2.0 MB vs 1.16 MB) -- still single-digit MB either way"
  - "Test images evaluated against the RAW (composition-unfiltered) test split, not a composition-filtered subset -- explicit decision, justified in Section 5: per-image classification at full test-split scale (1,183 images) is the same 'hand-classify at scale' work plan 02's coordinator guidance ruled out, and every genus already misses the 95% bar by a wide margin except Olea's one-image miss, so no plausible filtered subset changes the outcome"
  - "Second candidate model (EfficientNet-Lite0) not run -- MobileNetV3-Small's full pipeline (two training attempts, export, quantisation comparison, evaluation) consumed well under the remaining timebox, and the time was judged better spent tuning the first candidate and investigating the quantisation-parity finding than running a second, equally shallow candidate (D-19)"
  - "Fixed a broken tensorflow.lite import path (empty tensorflow/lite/__init__.py in this TF 2.21.0 wheel, a documented TF packaging quirk as tf.lite.Interpreter is being deprecated in favour of ai_edge_litert) by re-exporting the same public names into that file from the already-approved, already-installed tensorflow package -- no new package installed, purely a same-package bug fix so both the plan's own automated verify script and this plan's export/eval scripts could use the from tensorflow.lite import Interpreter path the plan's verify script expects on its happy path"

requirements-completed: []

duration: ~50min (two training runs ~245s and ~576s CPU-only, plus quantisation investigation, evaluation, and write-up)
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 04: Genus Classifier Fine-Tuning and Per-Genus Accuracy Measurement Summary

**MobileNetV3-Small fine-tuned on the 34-class CNPF genus corpus and exported to a 2.0 MB float16-quantised `.tflite`; per-genus top-1/top-3 accuracy measured on the held-out test split found 0 of 34 genera clear the D-02 95% top-3 bar, with the closest (Olea) missing by a single test image — `GATE-MODEL: PASS`.**

## Performance

- **Started:** 2026-09-23 (continuation of phase 01, wave 3)
- **Completed:** 2026-09-23
- **Duration:** ~50 min wall-clock, including two full training runs (~245s and ~576s, CPU-only,
  10-core Mac, no GPU) and a quantisation-scheme investigation
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 1 tracked (`docs/technical/species-recognition-spike-measurements-v1.md`),
  plus the gitignored spike tree (`train/finetune.py`, `train/export_tflite.py`,
  `eval/evaluate_accuracy.py`, the trained SavedModel, the exported `.tflite`, evaluation results
  CSV/JSON, `eval/GATE`)

## Accomplishments

- **Task 1:** Checked the corpus gate (`GATE-CORPUS: PASS`, `CLASSES-USABLE: 32`) before spending
  any compute, per the plan's gate discipline. Wrote `train/finetune.py` (MobileNetV3-Small,
  ImageNet-pretrained via `tf.keras.applications`, class order read from `genus_labels.txt`,
  freeze-then-fine-tune recipe) and `train/export_tflite.py` (TFLite conversion + export-parity
  verification). Ran two training attempts; the second (20 head-only epochs + 15 fine-tune epochs,
  unfreezing the last 60 backbone layers) reached validation top-1/top-3 of 0.3816/0.5897 and was
  kept as the trained model. **Discovered and fixed a genuine parity problem during export:**
  the plan's own instruction to verify parity "before trusting it" caught that int8 dynamic-range
  quantisation was materially degrading predictions (79.4% top-1 agreement with the trained model,
  some class probabilities shifting by 2x). Switched to float16 quantisation (100% agreement) and
  shipped that instead. Exported model: `spike/species-recognition/train/genus_classifier.tflite`,
  2,000,768 bytes, 34 output classes confirmed in `genus_labels.txt` order.
- **Task 2:** Wrote `eval/evaluate_accuracy.py` and measured top-1/top-3 accuracy per genus on the
  1,183-image held-out test split (never touched during training). All 34 classes reported with
  raw hit/sample counts alongside percentages, a clears-bar flag, and status (all 34 landed at
  `status=measured`, none `insufficient-samples`/`no-samples` — every class's raw test count
  cleared the 30-image reporting threshold). Computed data-derived confidence-band cut points
  (D-12) and a candidate-ordering/confusion analysis (D-11). Wrote
  `eval/results/per_genus_accuracy.csv` (34 rows) and `eval/GATE` (`GATE-MODEL: PASS`).

## The central finding

**0 of 34 genera clear the D-02/D-04 top-3 95% bar.** The closest is **Olea at 33/35 (94.29%) —
exactly one test image short of clearing**, illustrating the resolution limit this sample size
imposes (95% at n=35 requires 34/35; a single different test image could flip that row). Next
closest: Phillyrea 88.57%, Ceratonia 85.71%, Pistacia 81.82%. The weakest: Fraxinus 22.86%,
Acer 25.71%, Ulmus 16.67% (0 top-1 hits at all on its 30-image test set). Full 34-row table:
`docs/technical/species-recognition-spike-measurements-v1.md` Section 5.

This is not a partial-go result in D-04's useful sense — there is no genus for which this
document can recommend enabling suggestions while manual entry stays default for the rest. It is
a broad, well-evidenced miss across the whole genus list, not a mixed picture with clear winners
and losers. Whether this reads as a full no-go, and on what terms, is the ADR's call
(plan 01-06), not this document's.

## Model size finding — bears on D-07/D-08, not re-decided here

The exported model is **2.0 MB**. D-07 (locked) chose a separate first-launch download
specifically to keep the app binary light on the stores; D-08 (locked) added an explicit
model-unavailable UI state as the cost of that choice. At 2.0 MB, this model is well within the
range many app binaries already ship as bundled assets, which would let a future implementation
remove the download flow, the cache-path handling and the unavailable-state UI entirely. This
plan does **not** re-decide D-07 or D-08 — both are locked user decisions and plan 01-06's ADR is
where any change to them is proposed to the user — but Section 4/9 of the measurement document
record the number so the ADR has it in front of it.

## Corpus caveats carried forward, not smoothed away

All three caveats plan 02 recorded apply in full to Section 5's figures, restated there and in
Section 9 rather than diluted:

1. **Composition.** The raw corpus is not reliably single-subject (Section 3a). This plan
   evaluated the RAW test split explicitly, not a composition-filtered one — justified in Section
   5 (filtering at test-split scale is the same "hand-classify at scale" work plan 02's
   coordinator guidance ruled out, and the raw results already miss the bar by margins no
   plausible filter would close, except Olea's one-image miss).
2. **Seasonal skew.** 23 of 34 classes have zero autumn-dated images in the training corpus
   (Section 3b), against an October field-test start. Nothing in this plan's measurement corrects
   for that.
3. **No field photographs.** The lab figure in Section 5 stands alone; D-16's field-validation
   half was not performed, and given the lab figure's result, a field pass would only be able to
   confirm or worsen it, not rescue it (Section 6).

## Task Commits

1. **Task 1: fine-tune and export the genus classifier** — `1490ec6` (feat) — measurement document
   Section 4 (model, licence chain, quantisation-scheme investigation, size finding)
2. **Task 2: measure per-genus accuracy** — `ff07741` (docs) — measurement document Sections 5, 6,
   9 (per-genus table, confidence bands, candidate ordering, corpus caveats, model-size finding)

Both commits are on the measurement document only. `finetune.py`, `export_tflite.py`,
`evaluate_accuracy.py` and all model/results artefacts live in the gitignored `spike/` tree, per
the phase's explicit "throwaway spike" scope (`01-CONTEXT.md`: "Spike code is throwaway by design
and is not a deliverable").

## Files Created/Modified

- `docs/technical/species-recognition-spike-measurements-v1.md` — Section 4 (model candidates,
  licence chain, quantisation-scheme investigation, exported size, D-07/D-08 size finding),
  Section 5 (34-row per-genus accuracy table, composition-filtering decision, resolution limit,
  confidence-band analysis, candidate-ordering observation, corpus caveats), Section 6 (confirmed
  still no field photos at plan 04), Section 9 (renumbered to fix a pre-existing duplicate-number
  bug from plan 02's edits, updated the composition item to record plan 04's resolution, added the
  central-finding and model-size-finding entries)
- `spike/species-recognition/train/finetune.py` (gitignored) — transfer-learning script
- `spike/species-recognition/train/export_tflite.py` (gitignored) — TFLite export + parity check
- `spike/species-recognition/eval/evaluate_accuracy.py` (gitignored) — per-genus evaluation harness
- `spike/species-recognition/train/genus_classifier_keras/` (gitignored) — trained SavedModel
- `spike/species-recognition/train/genus_classifier.tflite` (gitignored) — exported model, 2,000,768 bytes
- `spike/species-recognition/train/training_report.json`, `export_report.json` (gitignored) —
  training/export metrics
- `spike/species-recognition/eval/results/per_genus_accuracy.csv`, `confidence_bands.json`,
  `candidate_ordering_sample.json` (gitignored) — evaluation outputs
- `spike/species-recognition/eval/GATE` (gitignored) — `GATE-MODEL: PASS`
- `spike/species-recognition/.venv/lib/python3.12/site-packages/tensorflow/lite/__init__.py`
  (gitignored, inside the venv) — bug fix, see Deviations

## Decisions Made

See `key-decisions` in frontmatter for the four load-bearing ones (quantisation scheme,
composition-filtering, second-candidate skip, tflite import fix). Additionally: chose to run a
second training attempt with a wider unfreeze (60 vs 30 backbone layers) and more epochs after the
first attempt's validation curve showed a clear plateau, rather than accepting the first attempt's
numbers or continuing to hyperparameter-tune indefinitely — one retry judged sufficient given both
attempts' validation curves behaved as expected (genuine convergence, not a bug) and D-19's
"one candidate measured properly" discipline argues against open-ended tuning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a broken `tensorflow.lite` import path inside the approved `tensorflow` package**

- **Found during:** Task 1, first `export_tflite.py --verify-parity` run
- **Issue:** `from tensorflow.lite import Interpreter` raised `ImportError` in this
  `tensorflow==2.21.0` wheel, even though `tf.lite.Interpreter` (attribute access after
  `import tensorflow as tf`) worked fine. Root cause: `tensorflow/lite/__init__.py` ships empty on
  disk; the real, populated `tf.lite` is bound as an attribute of the `tensorflow` package object
  via `from tensorflow._api.v2 import lite` inside `tensorflow/__init__.py`, but that assignment
  never registers `sys.modules['tensorflow.lite']` — so `from tensorflow.lite import X` resolves to
  the empty on-disk stub instead. This is a real TF packaging effect of `tf.lite.Interpreter` being
  deprecated in favour of the separate `ai_edge_litert` package (a `UserWarning` confirms this once
  the import works: "tf.lite.Interpreter is deprecated and is scheduled for deletion in TF 2.20.
  Please use the LiteRT interpreter from the ai_edge_litert package"). This plan's own automated
  verify script (baked into `01-04-PLAN.md`, not editable) uses exactly the
  `from tensorflow.lite import Interpreter` pattern on its happy path, with an `ai_edge_litert`
  fallback only if that raises `ImportError` — and `ai_edge_litert` was not part of the
  package set approved at plan 02's legitimacy checkpoint.
- **Fix:** Re-exported the same public names (`Interpreter`, `TFLiteConverter`, `Optimize`, etc.)
  into `tensorflow/lite/__init__.py` from their real locations
  (`tensorflow.lite.python.interpreter`, `tensorflow.lite.python.lite`, etc.) — the exact same
  content `tensorflow/_api/v2/lite/__init__.py` (the module `tf.lite` actually resolves to) already
  contains. This is a bug fix to a file inside the already-approved, already-installed `tensorflow`
  package's own site-packages, entirely within the gitignored `.venv/` — not a new package
  install, not a new dependency, no network fetch involved, and no change to any tracked project
  file. Considered and rejected: authoring a fake local `ai_edge_litert` shim package (would have
  satisfied the verify script's fallback path without genuinely fixing anything, and would misrepresent
  that a real interpreter package was installed when it was not — judged worse than a direct fix).
- **Files modified:** `spike/species-recognition/.venv/lib/python3.12/site-packages/tensorflow/lite/__init__.py`
  (gitignored, inside the venv — not a tracked project file)
- **Verification:** `from tensorflow.lite import Interpreter` succeeds after the fix; both this
  plan's `export_tflite.py --verify-parity` and its own baked-in automated verify snippet
  (the exact `try: from tensorflow.lite import Interpreter` block from `01-04-PLAN.md`) pass
  cleanly. **Caveat for future sessions using this same venv:** since this is a hand-edited file
  inside `.venv/site-packages`, recreating the venv from scratch (e.g. `pip install -r
  requirements.txt` into a fresh `.venv`) would need this fix reapplied — it is not captured in
  any requirements file, by design, since it is not a new dependency to pin.

**2. [Rule 1 - Bug] Switched quantisation scheme from int8 dynamic-range to float16 after measuring real prediction degradation**

- **Found during:** Task 1, export-parity verification (the exact step the plan instructs: "Verify
  the exported model produces the same predictions as the trained model on a handful of test
  images before trusting it")
- **Issue:** The originally-implemented default (`tf.lite.Optimize.DEFAULT` with no
  `target_spec.supported_types` override — post-training int8 dynamic-range quantisation) produced
  a smaller file (1,162,304 bytes) but only 79.4% top-1 agreement with the trained model on a
  68-image parity sample, with individual class probabilities shifting by as much as 2x on the same
  predicted class (0.211 → 0.417) and outright top-1 label flips observed in a manual spot-check.
  This is a real accuracy cost of quantisation, not measurement noise — a silently-degraded export
  is exactly the known failure mode RESEARCH.md and the plan both flag, and it would have been
  wrongly attributed to "the model" rather than "the export" if not caught here.
- **Fix:** Re-converted with `converter.target_spec.supported_types = [tf.float16]` (float16
  post-training quantisation). This gave 100% top-1 agreement (68/68) on the identical sample, at
  roughly 2x the int8 file size (2.0 MB vs 1.16 MB — both still single-digit MB, within
  RESEARCH.md's A1 assumption's expected range). Shipped as the final exported model.
- **Files modified:** `spike/species-recognition/train/export_tflite.py` (gitignored)
- **Verification:** `export_tflite.py --verify-parity` reports 100% top-1 agreement on the
  68-image sample; the plan's own automated verify script's separate output-shape check
  (34 classes matching `genus_labels.txt`) also passes against the float16 file.

---

**Total deviations:** 2 auto-fixed (1 blocking environment fix, 1 correctness bug caught by the
plan's own required parity check). Both were necessary for the plan's Task 1 `<done>` criteria
("Export parity against the trained model is checked") to be genuinely satisfied rather than
nominally satisfied against a broken interpreter or a degraded export. No scope creep — neither
fix touches any tracked project file outside `docs/technical/species-recognition-spike-measurements-v1.md`.

## Issues Encountered

Two full training attempts were run before settling on a final trained model (see "Decisions
Made" and Section 4 of the measurement document) — this is documented as a deliberate tuning
choice, not an interruption; both attempts completed cleanly and both sets of numbers are
recorded in the training report. No session interruptions, network failures, or environment
blockers occurred during this plan's actual execution (the `tensorflow.lite` import issue above
was diagnosed and fixed within the same session, not an interruption).

## User Setup Required

None — all work is within the gitignored spike tree and the CPU-only local training/evaluation
run. No external service configuration required.

## Next Phase Readiness

- `spike/species-recognition/eval/GATE` reads `GATE-MODEL: PASS` — plan 01-05 (device latency
  measurement) may proceed. Plan 01-05 does not need this model's *accuracy* to be good to do its
  own job (measuring inference latency of whatever model is present), but should be aware the
  model it is timing is not one that would ship as-is.
- The measurement document Sections 4–6 and 9 give plan 01-06 (the ADR) everything it needs: the
  full licence chain, the exported model's measured size (2.0 MB, bearing on D-07/D-08), the
  complete 34-row per-genus accuracy table with raw counts, the confidence-band cut points for
  D-12, the candidate-ordering evidence for D-11, and all corpus caveats carried forward intact.
- **The central number plan 01-06 needs to reckon with:** 0 of 34 genera clear the D-02 95%
  top-3 bar. This is very likely a no-go signal for US-C9 in this milestone, though the ADR
  authors that decision, not this plan. The evidence is unusually clean for a no-go: every genus
  misses by a wide margin except one (Olea, missing by exactly one test image), so this does not
  read as "the measurement was too noisy to tell" — it reads as "the approach, on this corpus,
  with this backbone, in this timebox, did not clear the bar."
- **Possible confounds for the ADR to weigh, all already flagged in the measurement document and
  not resolved by this plan:** the corpus composition problem (Section 3a — some genera's raw test
  images are substantially landscape/herbarium/in-hand rather than single-subject), the seasonal
  skew (Section 3b — almost no autumn training data against an autumn field season), and the
  possibility that a longer training run, a different backbone, or more/cleaner data would improve
  the picture. None of these were tested further here, per D-19's timebox discipline — the ADR
  should decide whether any of them are worth a follow-up spike in a later milestone, or whether
  the result stands as measured.
- No blockers for plan 01-05. Plan 01-06 should read this plan's Section 4/5/6/9 in full before
  drafting the ADR.

---

_Phase: 01-species-recognition-approach-decision_
_Completed: 2026-09-23_

## Self-Check: PASSED

All claimed files found on disk: `docs/technical/species-recognition-spike-measurements-v1.md`,
the gitignored `spike/species-recognition/train/finetune.py`, `export_tflite.py`,
`spike/species-recognition/eval/evaluate_accuracy.py`, `train/genus_classifier.tflite`,
`eval/results/per_genus_accuracy.csv`, `eval/GATE`, and this SUMMARY.md. Both task commits
(`1490ec6`, `ff07741`) verified present in `git log`.
