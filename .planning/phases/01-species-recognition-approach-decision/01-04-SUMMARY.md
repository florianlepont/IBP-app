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
  - "ITERATION 1: MobileNetV3-Small fine-tuned on 220 images/class, exported to spike/species-recognition/train/genus_classifier_iteration1.tflite (2,000,768 bytes, float16, 34 classes). 0/34 genera clear the D-02 95% top-3 bar; closest (Olea) misses by one test image (33/35, 94.29%). Preserved on disk (gitignored) and in Sections 4-5 of the measurement document, unmodified by iteration 2."
  - "ITERATION 2 (deviation, coordinator-directed after user rejected iteration 1's no-go as premature): MobileNetV3-Large fine-tuned on ~1,500/class (63,863 images total, season-stratified via GBIF eventDate), exported to spike/species-recognition/train/genus_classifier_v2.tflite (6,127,976 bytes, float16, 34 classes), PROMOTED to the canonical spike/species-recognition/train/genus_classifier.tflite path. 0/34 genera still clear the bar, but 32/34 improved by a mean of +19.9pp top-3 (range +0.5pp to +53.9pp) against an enlarged ~200-image/class test split -- a data-limited, not approach-limited, result."
  - "ITERATION 3 (further deviation, coordinator-directed after user approved a further extension: data alone, backbone/hyperparameters held identical to iteration 2 for a clean isolation): corpus expanded to 194,653 images (3.05x iteration 2), MobileNetV3-Large fine-tuned with iteration 2's exact hyperparameters, exported to spike/species-recognition/train/genus_classifier_v3.tflite (6,127,976 bytes, float16, 34 classes, identical size to iteration 2's export as expected), PROMOTED to the canonical path after genuinely beating iteration 2 on the test set (31/34 genera improved, mean +6.74pp top-3, pooled test top1/top3 58.8%/78.8% -> 67.4%/85.2%). 1 of 34 genera (Tamarix, 95.04%) clears the D-02 95% top-3 bar for the first time across all three iterations. Critical finding: best_finetune_epoch_1indexed = 8 of 8 -- EarlyStopping never triggered, val_top3 still climbing at the final epoch -- so the diminishing-returns figure (+19.9pp for 1->2, +6.74pp for 2->3) is a floor on the achievable data-alone gain, confounded by a fixed, unsaturated epoch budget at both iterations 2 and 3, not proof of a hard approach ceiling."
  - "spike/species-recognition/train/prepare_dataset.py rewritten: reuses already-downloaded images, season-stratifies new downloads via GBIF eventDate with an achieved-vs-attempted report per class"
  - "spike/species-recognition/train/finetune.py, export_tflite.py, eval/evaluate_accuracy.py: gitignored scripts, parameterised (--backbone, --output-suffix, --model, --output-dir) to run either iteration without overwriting the other's artefacts"
  - "spike/species-recognition/eval/results/ (canonical, now promoted to iteration 3), eval/results_v2/ (iteration 2, preserved) and eval/results_iteration1/ (iteration 1, preserved): all three 34-row per-genus accuracy CSVs with raw hit counts, clears-bar flag, status"
  - "spike/species-recognition/eval/GATE: GATE-MODEL: PASS (referencing the promoted iteration-3 model)"
  - "Measurement document Section 4-9 (iteration 1, unmodified), Section 10 (iteration 2, unmodified) and new Section 11 (iteration 3: corpus expansion to per-class ceiling, training with the epoch-budget non-saturation finding, three-way per-genus comparison, confidence bands, promotion verdict, ADR-facing summary) filled in full"
  - "A genuine training-data shuffle bug found and fixed mid-iteration-2 (see key-decisions) -- the first iteration-2 attempt was discarded, not reported"
  - "A genuine corpus-manifest-truncation bug found and fixed mid-iteration-3, unrelated to the iteration-2 shuffle bug (see key-decisions) -- caught before it reached training via a new verify_corpus_complete() precondition check, no data lost"
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
    - docs/technical/species-recognition-spike-measurements-v1.md (Sections 4, 5, 6, 9, 10)
    - spike/species-recognition/train/prepare_dataset.py (gitignored -- iteration 2 corpus expansion)

key-decisions:
  - "Float16 quantisation shipped instead of int8 dynamic-range, after measuring: int8 gave only 79.4% top-1 export-parity agreement with the trained model (a real accuracy cost, not noise -- probability shifts up to 2x on the same predicted class), float16 gave 100% agreement at roughly 2x the file size (2.0 MB vs 1.16 MB) -- still single-digit MB either way"
  - "Test images evaluated against the RAW (composition-unfiltered) test split in both iterations, not a composition-filtered subset -- explicit decision, justified in Section 5: per-image classification at full test-split scale is the same 'hand-classify at scale' work plan 02's coordinator guidance ruled out"
  - "Second candidate model (EfficientNet-Lite0) not run in iteration 1 -- time better spent tuning the first candidate and investigating the quantisation-parity finding (D-19)"
  - "Fixed a broken tensorflow.lite import path (empty tensorflow/lite/__init__.py in this TF 2.21.0 wheel) by re-exporting the same public names from the already-approved, already-installed tensorflow package -- no new package installed"
  - "ITERATION 2 (deviation): user rejected iteration 1's no-go as premature -- iteration 1 used 150 training images/class against >4,200 surveyed CC0/CC-BY candidates, the smallest mobile backbone against 36x unused latency headroom, and a 35-image test split whose 95% bar flips on one image. Coordinator directed a second iteration: corpus expanded to ~2,000/class (season-stratified via GBIF eventDate), test split enlarged to ~200/class, MobileNetV3-Large substituted for MobileNetV3-Small. Iteration 1's result was NOT overwritten -- both are recorded side by side in Section 10"
  - "Found and fixed a genuine training-data shuffle bug mid-iteration-2: tf.data's windowed shuffle(2048) could not adequately mix ~1,200-1,600-image class blocks (vs iteration 1's ~150-image blocks, where the same window worked fine), producing per-genus test accuracy that correlated with class position in genus_labels.txt (r=0.85) rather than reflecting real model capability. Fixed by globally shuffling the (file, label) list in Python before it reaches tf.data. The first iteration-2 training run was discarded entirely (archived, not reported); the corrected retrain (r=0.36, matching iteration 1's own baseline noise level) is what Section 10 reports"
  - "Iteration 2's model promoted to the canonical spike/species-recognition/train/genus_classifier.tflite path (and eval/results/) that plan 03's cache-path convention and plan 05 expect, since it is the more capable, more current candidate. Iteration 1's model/results preserved separately (gitignored, *_iteration1* suffix) and its numbers in Sections 4-5 are unmodified regardless of what sits at the canonical path"
  - "ITERATION 3: held backbone, hyperparameters, the shuffle fix and EarlyStopping identical to iteration 2's finetune.py, changing only the corpus size -- a deliberate single-variable extension so the iteration-2-to-3 delta is a clean read of what more data alone still buys with a fixed model, directed by the coordinator after the user approved a further extension on reviewing iteration 2's data-limited result"
  - "Corpus-assembly target raised to TARGET_TOTAL_PER_CLASS=6,000 -- deliberately above the ~4,200-5,300 candidate ceiling iteration 2 observed, so classes would exhaust their real GBIF candidate pool under the licence filter rather than hit an artificial cap; the resulting per-class ceiling spread (Ceratonia capped at 3,629 candidates vs eight classes still climbing at the 6,000 target) is recorded as a finding, not treated as noise"
  - "Found and fixed a genuine corpus-manifest-truncation bug mid-iteration-3, unrelated to iteration 2's shuffle bug: after a transient GBIF network outage, prepare_dataset.py's per-run manifest_rows started empty on every invocation and was only appended to for classes processed successfully in that run; since write_outputs() checkpoints after every class, the next checkpoint after 4 successful classes silently truncated the other 30 classes' train/val/test split files to empty, even though every one of those classes' downloaded images (nothing below 1,700 files) sat untouched on disk -- confirmed no image was ever lost (find data/raw -name '*.jpg' | wc -l unchanged), only the split-file bookkeeping was wrong. Fixed by loading the prior manifest.csv and per-class counts at the start of every invocation and only replacing a class's entries when that class is actually (re)processed in the current pass"
  - "Added a hard precondition check, verify_corpus_complete(), to finetune.py -- runs immediately after the corpus-gate check and before any data loading, asserting every one of the 34 classes has non-empty, count-consistent train/val/test splits, failing loudly rather than letting training silently proceed on a partial corpus. This is what actually caught and blocked training during the restoration window after the manifest-truncation fix, before this run's real training began"
  - "Fixed a separate, genuine indefinite-hang bug in prepare_dataset.py's network calls (occurrence-search/species-match path, not the already-hardened image-download path): plain requests.get(url, timeout=N) does not reliably bound every hang mode (DNS stalls, connect-then-nothing). Replaced with a thread-based hard deadline (Future.result(timeout=...)) for every network call, with exponential-backoff retry -- verified against an intentionally unreachable address (gave up cleanly in 13s instead of hanging)"
  - "genus_classifier_v3.tflite promoted to the canonical spike/species-recognition/train/genus_classifier.tflite path (and eval/results/) after verifying it genuinely beats iteration 2 on the test set (31/34 genera improved, mean +6.74pp top-3, every pooled/confidence-band measure moved the same direction) -- not assumed, checked explicitly per the plan's own instruction. Iterations 1 and 2's models/results preserved separately (gitignored, *_iteration1*/*_v2* suffixes) and their numbers in Sections 4-5/10 are unmodified regardless of what sits at the canonical path"

requirements-completed: []

duration: ~50min for iteration 1 (two training runs ~245s and ~576s CPU-only), plus ~5.5h for iteration 2 (corpus expansion ~2.5h, two training attempts ~88min + ~84min including a discarded run, evaluation and write-up), plus ~2 sessions / roughly 9-10h wall-clock for iteration 3 (corpus expansion to 194,653 images across two interrupted/hardened runs including bug-fix time, ~4h46min training, export/evaluation/write-up/promotion in this final session) -- across three sessions total, no restart of already-completed work in any of them
completed: 2026-09-25
status: complete
---

# Phase 1 Plan 04: Genus Classifier Fine-Tuning and Per-Genus Accuracy Measurement Summary

**Three iterations. Iteration 1: MobileNetV3-Small on 220 images/class found 0/34 genera clearing the D-02 95% top-3 bar (closest, Olea, missing by one test image). The user rejected that no-go as premature; iteration 2 (MobileNetV3-Large, ~2,000 images/class, season-stratified, ~200-image test split) still found 0/34 clearing the bar, but 32/34 genera improved by a mean of +19.9pp top-3 — a data-limited result, not an approach-limited one. The user approved a further extension to settle whether returns were still climbing or starting to saturate: iteration 3 (MobileNetV3-Large, iteration 2's exact hyperparameters held constant, corpus expanded 3.05x to 194,653 images at each class's real per-class ceiling) found 1 of 34 genera (Tamarix, 95.04%) clearing the bar for the first time, with the other 33 genera improving by a mean of +6.74pp top-3 (2→3) against +19.9pp (1→2) — diminishing but not exhausted, and explicitly confounded by a fixed, never-saturating epoch budget at both iterations 2 and 3 (`EarlyStopping` never triggered in either). All three iterations' full numbers are preserved; iteration 3's model is promoted to the canonical path after genuinely beating iteration 2. `GATE-MODEL: PASS`.**

## Performance

- **Started:** 2026-09-23 (continuation of phase 01, wave 3)
- **Completed:** 2026-09-25
- **Duration:** ~50 min for iteration 1 (two training runs ~245s and ~576s, CPU-only, 10-core Mac,
  no GPU, plus quantisation-scheme investigation), then a coordinator-directed extension:
  ~6h for iteration 2 (corpus expansion ~2.5h; a first training attempt ~88min later discarded for
  a data-pipeline bug; a corrected retrain ~84min; export, evaluation and write-up), then a further
  coordinator-directed extension: roughly 9-10h wall-clock across two prior sessions for iteration 3
  (corpus expansion to 194,653 images, interrupted twice — once by a manifest-truncation bug, once
  by a network hang — both fixed rather than worked around; ~4h46min CPU-only training; export,
  evaluation, three-way comparison, promotion and write-up in this final session) — no restart of
  already-completed work at any point across the three sessions
- **Tasks:** 2 planned (`type="auto"`) + the iteration-2 and iteration-3 deviations described below
- **Files modified:** 1 tracked (`docs/technical/species-recognition-spike-measurements-v1.md`),
  plus the gitignored spike tree (`train/finetune.py`, `train/export_tflite.py`,
  `train/prepare_dataset.py`, `eval/evaluate_accuracy.py`, all three iterations' trained
  SavedModels, exported `.tflite` files, evaluation results CSV/JSON, `eval/GATE`)

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

## Iteration 1 (as originally planned)

The sections below through "Corpus caveats carried forward" describe iteration 1 exactly as
executed and committed (`1490ec6`, `ff07741`) — unmodified by iteration 2. See "Iteration 2"
further down for the coordinator-directed extension and its own findings.

## The central finding (iteration 1)

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

## Iteration 2 (deviation: coordinator-directed extension, user rejected iteration 1's no-go)

**Why.** The user reviewed iteration 1's 0/34 result and rejected it as premature: iteration 1
used 150 training images/class against >4,200 surveyed CC0/CC-BY candidates (3.6% utilisation),
the smallest available mobile backbone (MobileNetV3-Small) against 36x unused latency headroom
(83ms measured vs the 3,000ms D-05 budget), a 2.0 MB model against no real size ceiling, and a
35-image test split whose 95% bar flips on a single image. The coordinator directed a second,
larger iteration rather than accepting the first as final — recorded here as a documented
deviation extending this plan, not a silent redo. **Iteration 1's result is not overwritten
anywhere** — Sections 4–5 of the measurement document and the "Iteration 1" section above remain
exactly as originally committed.

**What changed.** `prepare_dataset.py` was rewritten to expand the corpus toward ~2,000
images/class (from 220), reusing every image already on disk rather than re-fetching it, and
deliberately season-stratifying new downloads via GBIF `eventDate` — specifically targeting the
zero-autumn-representation gap Section 3b found. Result: 63,863 images across 34 classes (up from
~7,432), 51,089 train / 6,387 val / 6,387 test (an 80/10/10 split, versus 150/35/35 per class
nominal in iteration 1). Train/val/test fractions changed accordingly. `finetune.py`,
`export_tflite.py` and `evaluate_accuracy.py` were parameterised (`--backbone`, `--output-suffix`,
`--model`, `--output-dir`) so iteration 2 could run without overwriting iteration 1's artefacts.

**Seasonal stratification result.** 9 of 34 classes reached a perfectly balanced 500/500/500/500
season split (quota attempted: 500/season). Three genera (Acer, Pinus, Prunus) returned **zero**
autumn images even from a ~5,000-candidate fetch — now confirmed, at ~170x iteration 1's 30-image
sample size, as a likely genuine absence in GBIF's CC0/CC-BY `StillImage` collection for those
genera rather than a small-sample artefact. Five more remain thin (Fagus, Fraxinus, Juniperus,
Populus, Salix, all under 4% autumn). The remaining 22 classes show meaningfully improved autumn
representation versus iteration 1's near-total absence. Full table: measurement document Section
10.1.

**A genuine data-pipeline bug was found and fixed mid-iteration, not silently absorbed.** The
first iteration-2 training attempt (MobileNetV3-Large, 6+8 epochs) finished with validation
top1/top3 of 0.325/0.590 — numerically close to iteration 1's, which alone would have already
been an interesting data point. Per-genus test evaluation, however, showed accuracy strongly
correlated with a class's position in `genus_labels.txt` (Pearson r=0.85) — an implausible
pattern with no botanical basis. Root cause: `tf.data`'s windowed `shuffle(buffer_size=2048)`
could not adequately mix a training list whose per-class blocks (~1,200–1,600 images at the new
scale) now approach or exceed the shuffle window, unlike iteration 1's ~150-image blocks where
the same window gave adequate cross-class mixing (iteration 1's own residual correlation is a much
weaker r=0.36, consistent with normal windowed-shuffle imprecision, not the same bug). **Fixed**
by globally shuffling the full (file, label) list in Python (`finetune.py::collect_split`) before
it ever reaches `tf.data`, verified directly (per-class mean position in the shuffled list now
within ~1.3% of the expected midpoint). The invalid first attempt's artefacts are archived on disk
(gitignored, `_INVALID_shuffle_bug` suffix) for traceability; none of its numbers are reported
anywhere. Also added `EarlyStopping(monitor='val_top3', restore_best_weights=True)` to the
retrain, since the first attempt's own curve showed genuine overfitting (val_top3 peaked at 0.6127
partway through, declined to 0.5901 by the final epoch) that would otherwise have silently
discarded the actual best checkpoint.

**Retrained result: validation top1=0.5920, top3=0.7951, still climbing at the final epoch (best
epoch = last epoch; `EarlyStopping` never triggered).** Label-index/accuracy correlation on the
corrected model: r=0.36, statistically indistinguishable from iteration 1's own baseline —
confirms the fix worked and this result is trustworthy. Exported to
`spike/species-recognition/train/genus_classifier_v2.tflite`, 6,127,976 bytes (5.84 MB,
float16 — same quantisation scheme as iteration 1, for the same reasons), **100%** export parity
on a 68-image sample.

**Per-genus test accuracy (6,387-image test split, ~200/class): 0 of 34 genera still clear the
D-02 95% bar — but 32 of 34 improved, by a mean of +19.9 percentage points top-3** (range +0.5pp
to +53.9pp). Only 2 regressed, both narrowly and both already iteration 1's two best-performing
genera (Olea −5.7pp, Phillyrea −0.1pp) — consistent with a ceiling/ranking-shuffle effect among
already-strong classes, not a real capability loss. The largest individual gains (Acer +53.9pp,
Ulmus +50.8pp, Fraxinus +40.3pp) landed on iteration 1's worst-performing classes — exactly the
pattern a **data-limited, not approach-limited**, result produces. Full 34-row side-by-side
comparison table: measurement document Section 10.3.

**Confidence bands (D-12) and candidate ordering (D-11) both improved.** Strong-band coverage
(≈90% in-band precision) rose from 11.2% of predictions to 38.4%. Top confusion pairs became more
botanically coherent (Picea↔Abies, both conifers; Pyrus→Prunus and Prunus→Malus, both Rosaceae;
Phillyrea↔Olea, both Oleaceae) versus iteration 1's more mixed pattern — evidence the larger model
is learning real morphological structure, not noise.

**Resolution limit improved substantially.** At n≈200/class, the 95% bar tolerates up to 10
misses, versus iteration 1's single-image knife-edge at n=35.

**Model size (5.84 MB, up from 2.0 MB) still leaves D-07's separate-download premise weakened**,
just less dramatically — both numbers are on record in Section 4/10 for the ADR; neither D-07 nor
D-08 is re-decided here.

**Promotion.** `genus_classifier_v2.tflite` was promoted to the canonical path
(`spike/species-recognition/train/genus_classifier.tflite`, `genus_classifier_keras/`) that plan
03's cache-path convention and plan 05 expect, and `eval/results/` was updated to iteration 2's
CSV/JSON. Iteration 1's model, keras export and results remain separately archived (gitignored,
`*_iteration1*` suffix) and its numbers in Sections 4–5 are unaffected. `eval/GATE` reads
`GATE-MODEL: PASS`, referencing the promoted (iteration 2) model.

**What this means for the ADR.** The no-go was data-limited, not approach-limited — accuracy
moved broadly and substantially with more data and a larger backbone. It still did not cross the
D-02 bar for any genus at the larger, more statistically solid test-split resolution. This is
neither a clean go nor a clean no-go: on-device genus recognition is not proven infeasible, but it
is also not proven to clear the bar within this milestone's timebox and available compute/data.
That judgement call belongs to the ADR (plan 01-06), not this document.

## Iteration 3 (further deviation: coordinator-directed extension, user approved after reviewing iteration 2's data-limited result)

**Why this iteration changes exactly one variable.** Iteration 2 changed both the corpus (9x more
images) and the backbone (Small → Large) at once, so its mean +19.9pp gain could not be
attributed to either alone. Iteration 3 holds the backbone, hyperparameters, the shuffle fix and
`EarlyStopping` all identical to iteration 2's `finetune.py`, changing only the corpus size — a
clean, single-variable read of what more data alone still buys with a fixed model. That is the
diminishing-returns question the user asked iteration 3 to settle. **Iterations 1 and 2's results
are not overwritten anywhere** — Sections 4–5 and Section 10 of the measurement document remain
exactly as originally committed; iteration 3 lives entirely in a new Section 11.

**Corpus expansion, target raised to the real per-class ceiling.** `TARGET_TOTAL_PER_CLASS` raised
to 6,000 — deliberately above the ~4,200–5,300-candidate ceiling iteration 2 observed, so classes
would exhaust their real GBIF CC0/CC-BY `StillImage` candidate pool under the licence filter
rather than hit an artificial cap. **Result: 194,653 images across 34 classes (3.05x iteration 2's
63,863, 26.2x iteration 1's original 7,432), 155,721 train / 19,466 val / 19,466 test.** The
per-class ceiling turned out to be genuinely uneven, not the flat ~4,200/class RESEARCH.md's own
comment assumed — Ceratonia's candidate pool caps at 3,629 (licence-scarce), while eight classes
were still climbing when capped at the 6,000 target (target-limited, not ceiling-limited). This
spread bounds what any further, data-only iteration could still add.

**Two genuine bugs were found and fixed mid-corpus-expansion, not silently absorbed — both
distinct from iteration 2's training-time shuffle bug.** (1) A transient GBIF network outage
exposed a manifest-bookkeeping defect in `prepare_dataset.py`: after a partial run's checkpoint,
the next class-level checkpoint silently truncated 30 of 34 classes' `train.txt`/`val.txt`/
`test.txt` files to empty, even though every one of those classes' actual downloaded images
(nothing below 1,700 files per class) remained untouched on disk — no image was ever lost, only
the split bookkeeping was wrong, confirmed directly (`find data/raw -name '*.jpg' | wc -l`
unchanged before/after). Fixed by loading the prior manifest and per-class counts at the start of
every invocation and only replacing a class's entries when that class is actually reprocessed in
the current pass. (2) A separate, genuine indefinite-hang bug in the occurrence-search/
species-match network path (not the already-hardened image-download path): a plain
`requests.get(url, timeout=N)` does not reliably bound every hang mode (DNS stalls, connect-then-
nothing). Fixed with a thread-based hard deadline (`Future.result(timeout=...)`) around every
network call, with exponential-backoff retry — verified against an intentionally unreachable
address (gave up cleanly in 13s rather than hanging).

**A hard precondition check, `verify_corpus_complete()`, was added to `finetune.py`** — runs
immediately after the corpus-gate check and before any data loading, asserting every one of the 34
classes has non-empty, count-consistent train/val/test splits. This is what actually caught and
blocked training during the restoration window after the manifest-truncation fix (87 problems, 29
still-empty classes, refused loudly rather than letting a partial corpus silently proceed to
training) — the same category of measurement risk the plan's export-parity requirement guards
against, applied here on the corpus-completeness side. It passed cleanly once restoration finished,
confirming from evidence (not assumption) that the splits actually trained on covered all 34
classes.

**Seasonal stratification, confirmed rather than merely improved.** 31 of 34 classes reached
double-digit autumn percentages (10.9%–32.4%) at this much larger scale. Three genera remain
critically thin even now: **Prunus (0.5%), Pinus (1.0%), Acer (1.1%)** — a revision of iteration
2's "genuinely zero" reading (itself already a revision of iteration 1's "zero" at a 30-image
sample) to "near-absent but not literally zero." At three successive scales the answer for these
three genera has stayed the same in substance: this reads as a real property of GBIF's CC0/CC-BY
holdings for these specific genera, not a sampling artefact.

**Training: same MobileNetV3-Large, same hyperparameters, same augmentation, same 6+8 epoch
budget as iteration 2 — only the corpus changed.** Result: validation top1/top3 = 0.6800/0.8555
(up from iteration 2's 0.5920/0.7951), CPU-only wall-clock 17,138.4s (≈4h46min). **Critical
finding: `best_finetune_epoch_1indexed = 8` of 8 — `EarlyStopping` never triggered, `val_top3`
climbed every single epoch (0.7651→0.8555) with no plateau.** This repeats iteration 2's own
unsaturated curve at 3x the corpus size and the identical fixed epoch budget — meaning the
measured accuracy at every iteration so far is a **floor** on what this training configuration can
reach, not a ceiling. Exported to `genus_classifier_v3.tflite`, 6,127,976 bytes (identical size to
iteration 2's export, as expected for identical architecture/quantisation), export parity 98.53%
(67/68) on the same 68-image sample — above the 90% pass threshold, not the clean 100% both prior
iterations achieved, but not a quantisation regression (both Keras-side and TFLite-side accuracy on
the sample were close, TFLite slightly higher).

**Per-genus test accuracy (19,466-image test split, ~530–600/class): 1 of 34 genera now clears
the D-02 95% top-3 bar for the first time across all three iterations — Tamarix, 95.04%
(517/544).** The other 33 genera improved by a mean of +6.74 percentage points top-3 (2→3),
roughly a third of the 1→2 gain (+19.9pp) — 31 improved, 0 flat, 3 regressed by small margins
(Ceratonia −2.1pp, explained by its licence-scarce corpus ceiling; Tilia −1.2pp and
Quercus_deciduae −0.5pp read as ranking-shuffle noise among mid-strength classes, the same pattern
iteration 2 showed for Olea/Phillyrea). **The diminishing-returns figure is explicitly flagged as
confounded**, not a clean saturation signal: both iteration 2 and iteration 3 trained the identical
fixed epoch budget and both ended still climbing, so some of the shrinking 2→3 gain is plausibly
under-training at the larger corpus size rather than a genuine data-saturation effect — a longer
schedule at iteration 3's corpus size was not tried. Full 34-row three-way comparison table:
measurement document Section 11.3.

**Confidence bands (D-12) and candidate ordering (D-11) both kept improving.** Strong-band
coverage at a fixed ~90% precision target: 11.2% (iteration 1) → 38.4% (iteration 2) → **56.0%**
(iteration 3) of predictions. Near-miss rate (true genus at rank 2 or 3 when top-1 is wrong): 35.0%
→ 48.5% → **54.7%**. Top confusion pairs remain botanically coherent (Picea↔Abies, Cupressus↔
Juniperus, Malus↔Pyrus, Phillyrea↔Olea — all genuine taxonomic or morphological neighbours),
continuing evidence the model is learning real structure rather than noise as the corpus grows.

**Promotion, verified rather than assumed.** `genus_classifier_v3.tflite` genuinely beats
`genus_classifier_v2.tflite` on the test set by every measure this document tracks (31/34 genera
improved, pooled test top1/top3 58.8%/78.8% → 67.4%/85.2%, strong-band coverage 38.4% → 56.0%) —
promoted to the canonical `spike/species-recognition/train/genus_classifier.tflite` path,
`genus_classifier_keras/`, and `eval/results/`. Verified byte-identical to the pre-promotion
`_v3`-suffixed file (MD5 match) and re-passes the plan's own automated verify checks (export
parity, 34-class output shape, 34-row results CSV) run directly against the canonical path.
Iterations 1 and 2's models/results remain separately archived (gitignored, `*_iteration1*`/`*_v2*`
suffixes) and their numbers in Sections 4–5/10 are unaffected. `eval/GATE` reads `GATE-MODEL: PASS`,
now referencing the promoted iteration-3 model.

**What this means for the ADR.** The central number moved from 0/34 to 1/34 genera clearing the
bar — the first concrete partial-go (D-04) evidence in this phase, not merely theoretical. The
diminishing-returns question iteration 3 was run to settle has a qualified answer: yes, returns are
diminishing (+19.9pp then +6.74pp), but this is explicitly confounded by a training schedule that
never saturated at either iteration, so it should be read as a floor on the achievable data-alone
gain, not proof the approach has hit a hard ceiling. Corpus-ceiling and seasonal-skew confounds are
now resolved with direct evidence (Section 11.5); composition audit, field photographs, and
on-device latency remain open, unchanged from iteration 2. Whether one genus's worth of partial-go
value justifies D-15's Factor A rework, and whether the trajectory across three iterations supports
a fourth data-only iteration versus a longer training schedule instead, are the ADR's decisions —
this plan's job across all three iterations has been to put that trajectory in evidence.

## Task Commits

1. **Task 1: fine-tune and export the genus classifier (iteration 1)** — `1490ec6` (feat) —
   measurement document Section 4 (model, licence chain, quantisation-scheme investigation, size
   finding)
2. **Task 2: measure per-genus accuracy (iteration 1)** — `ff07741` (docs) — measurement document
   Sections 5, 6, 9 (per-genus table, confidence bands, candidate ordering, corpus caveats,
   model-size finding)
3. **Iteration 2 deviation, interim: begin corpus expansion** — `5288c0b` (docs) — Section 10
   scaffold recording the user's rejection and the plan
4. **Iteration 2 deviation: corpus expansion complete** — `faadc55` (docs) — Section 10.1
   (63,863 images, season-stratification results)
5. **Iteration 2 deviation: shuffle bug found and fixed** — `1d38b72` (docs) — Section 10.2 bug
   writeup, before the retrain completed
6. **Iteration 2 deviation: training/export/evaluation complete** — `32df24c` (docs) —
   Section 10.2–10.5 (results, promotion, side-by-side comparison)
7. **Iteration 2 deviation: fix a stray cross-reference** — `56816f3` (docs) — minor follow-up
8. **Iteration 3 deviation, begin: scope and single-variable plan** — `abcd423` (docs) — Section 11
   scaffold recording the user's approval and the data-alone plan
9. **Iteration 3 deviation, interim: progress checkpoint after a session interruption** —
   `449c6f4` (docs) — corpus-expansion progress recorded mid-run so it is not lost to interruption
10. **Iteration 3 deviation: manifest-truncation bug found and fixed** — `8d30cd4` (docs) —
    root cause and fix for the 30-class split-file truncation, no image data lost
11. **Iteration 3 deviation: hard corpus-completeness precondition added** — `86afd49` (docs) —
    `verify_corpus_complete()` added to `finetune.py`, guarding against training on a partially
    restored corpus
12. **Iteration 3 deviation: indefinite network hang found and fixed** — `7ee5fc1` (docs) —
    thread-based hard deadline for every network call, plus progress logging and
    least-progressed-class-first ordering
13. **Iteration 3 deviation, interim: progress checkpoint, ~4h40min into the hardened run** —
    `5f29614` (docs) — corpus-expansion progress after the bug fixes, no further hangs
14. **Iteration 3 deviation: corpus expansion complete** — `bb74ad7` (docs) — Section 11.1
    (194,653 images, 3.05x iteration 2, per-class ceiling spread, seasonal confirmation)
15. **Task 1 (iteration 3): fine-tune and export the genus classifier** — `b466279` (feat) —
    Section 11.2 (training, non-saturation finding, export, parity)
16. **Task 2 (iteration 3), raw numbers first: three-way per-genus comparison table** —
    `094def3` (docs) — Section 11.3 raw table, committed before interpretation per this plan's
    anti-interruption discipline
17. **Task 2 (iteration 3): diminishing-returns analysis, confidence bands, candidate ordering** —
    `52bc19e` (docs) — Section 11.3 narrative, Section 11.4
18. **Task 2 (iteration 3): promotion verdict and ADR-facing summary** — `4c3fb27` (docs) —
    Sections 11.5–11.7, promotion to the canonical model path
19. **Iteration 3 deviation: mark Section 11 complete** — `641289d` (docs) — status-line update

All nineteen commits are on the measurement document only. `finetune.py`, `export_tflite.py`,
`evaluate_accuracy.py`, `prepare_dataset.py` and all model/results artefacts (all three
iterations) live in the gitignored `spike/` tree, per the phase's explicit "throwaway spike" scope
(`01-CONTEXT.md`: "Spike code is throwaway by design and is not a deliverable").

## Files Created/Modified

- `docs/technical/species-recognition-spike-measurements-v1.md` — Section 4 (model candidates,
  licence chain, quantisation-scheme investigation, exported size, D-07/D-08 size finding),
  Section 5 (34-row per-genus accuracy table, composition-filtering decision, resolution limit,
  confidence-band analysis, candidate-ordering observation, corpus caveats), Section 6 (confirmed
  still no field photos), Section 9 (renumbered to fix a pre-existing duplicate-number bug from
  plan 02's edits, added the central-finding and model-size-finding entries, plus iteration-2
  entries), Section 10 (iteration 2: corpus expansion, shuffle-bug fix, training, export,
  side-by-side comparison, promotion — unmodified by iteration 3), new Section 11 (iteration 3:
  corpus expansion to per-class ceiling, manifest-truncation and network-hang bug fixes, training
  with the non-saturation finding, export, three-way per-genus comparison, confidence bands,
  promotion verdict, ADR-facing summary)
- `spike/species-recognition/train/finetune.py` (gitignored) — transfer-learning script,
  parameterised for `--backbone`/`--output-suffix` across iterations; fixed the shuffle bug in
  `collect_split()`; added `EarlyStopping`; added `verify_corpus_complete()` precondition check
  (iteration 3)
- `spike/species-recognition/train/export_tflite.py` (gitignored) — TFLite export + parity check,
  parameterised for `--output-suffix`
- `spike/species-recognition/eval/evaluate_accuracy.py` (gitignored) — per-genus evaluation
  harness, parameterised for `--model`/`--output-dir`
- `spike/species-recognition/train/prepare_dataset.py` (gitignored) — corpus-assembly script,
  rewritten for iteration 2's season-stratified expansion (reuses existing downloads, `eventDate`
  capture, quota-based selection); iteration 3 raised `TARGET_TOTAL_PER_CLASS` to 6,000, fixed the
  manifest-truncation bug (`build_corpus()` now loads and preserves prior state per class), fixed
  the network-hang bug (thread-based hard deadline + exponential backoff on every network call,
  consolidated to one shared implementation), added a progress log with 30s heartbeats, and
  reordered class processing to least-progressed-first
- `spike/species-recognition/train/genus_classifier_keras/`, `genus_classifier.tflite` (gitignored)
  — canonical paths, now iteration 3's model (6,127,976 bytes, verified byte-identical to the
  `_v3`-suffixed export via MD5); iteration 1's and iteration 2's originals preserved at
  `*_iteration1*`/`*_v2*` suffix
- `spike/species-recognition/train/genus_classifier_keras_v3/`, `genus_classifier_v3.tflite`
  (gitignored) — iteration 3's model under its own suffix (identical content to the promoted
  canonical files, kept for traceability)
- `spike/species-recognition/train/training_report{,_v2,_v3}.json`,
  `export_report{,_v2,_v3}.json` (gitignored) — training/export metrics per iteration
- `spike/species-recognition/eval/results/` (canonical, now promoted to iteration 3),
  `eval/results_iteration1/`, `eval/results_v2/`, `eval/results_v3/` (gitignored) —
  per_genus_accuracy.csv, confidence_bands.json, candidate_ordering_sample.json for each iteration
- `spike/species-recognition/data/splits/seasonal_balance_report.json` (gitignored) —
  per-class, per-season achieved-vs-attempted counts, updated for iteration 3's corpus expansion
- `spike/species-recognition/data/splits/progress.log` (gitignored, new in iteration 3) — 30s
  heartbeat log during multi-minute corpus-assembly phases, added specifically to distinguish
  "working slowly" from "hung" after that ambiguity cost repeated live investigation
- `spike/species-recognition/.venv/lib/python3.12/site-packages/tensorflow/lite/__init__.py`
  (gitignored, inside the venv) — bug fix, see Deviations
- `spike/species-recognition/eval/GATE` (gitignored) — `GATE-MODEL: PASS`

## Decisions Made

See `key-decisions` in frontmatter for the full list, including the quantisation scheme,
composition-filtering, second-candidate skip, tflite import fix, and iteration-3's
single-variable-extension plan, corpus-ceiling target, and promotion verdict. Additionally: chose
to run a second training attempt with a wider unfreeze (60 vs 30 backbone layers) and more epochs
after the first (iteration 1) attempt's validation curve showed a clear plateau, rather than
accepting the first attempt's numbers or continuing to hyperparameter-tune indefinitely — one
retry judged sufficient given both attempts' validation curves behaved as expected (genuine
convergence, not a bug) and D-19's "one candidate measured properly" discipline argues against
open-ended tuning. For iteration 3, chose not to lengthen the epoch schedule despite the
non-saturation finding (Section 11.2) — the plan's own instruction held hyperparameters identical
to iteration 2 for a clean single-variable comparison, and D-19's timebox discipline argues against
open-ended retuning within this plan; the schedule question is instead surfaced explicitly for the
ADR to weigh rather than silently resolved by extending training further.

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

**3. [Rule 1 - Bug] Fixed a corpus-manifest-truncation bug that silently emptied 30 of 34 classes' split files after a network outage (iteration 3)**

- **Found during:** iteration 3's corpus-expansion run, immediately after a transient GBIF network
  outage interrupted a resumed session
- **Issue:** `prepare_dataset.py`'s `manifest_rows` started as an empty list on every invocation and
  was only ever appended to for classes processed successfully in that run. `write_outputs()`
  checkpoints after every class, so the checkpoint immediately after 4 successfully-processed
  classes (before the network dropped on the remaining 30) persisted a manifest containing only
  those 4 classes — silently truncating the other 30 classes' `train.txt`/`val.txt`/`test.txt`
  files to empty, even though every one of those classes' actual downloaded images (nothing below
  1,700 files per class) remained fully intact on disk. Confirmed directly:
  `find data/raw -name '*.jpg' | wc -l` reported the same file count immediately before and after
  the failure — no image was ever lost — but the script's own end-of-run report showed
  `GATE-CORPUS: EARLY-NO-GO` (4/34 usable) purely as a consequence of the empty split files.
- **Fix:** `build_corpus()` now loads the prior `manifest.csv` (grouped by class) and the prior
  `per_class_counts.json`/`seasonal_balance_report.json` at the start of every invocation, and only
  replaces a class's entries when that class is actually (re)processed successfully in the current
  pass. A class not reached, or that raises, keeps whatever the previous run last wrote for it.
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** re-running `prepare_dataset.py` after the fix regenerated every class's
  manifest entries correctly from the intact files already on disk (no re-download needed). A new
  `verify_corpus_complete()` precondition check (added to `finetune.py`, see Files
  Created/Modified) additionally refused to let training start while restoration was still
  incomplete (87 problems, 29 still-empty classes), confirming the guard works before it was ever
  relied on for real.

**4. [Rule 3 - Blocking] Fixed an indefinite network hang in the occurrence-search/species-match path (iteration 3)**

- **Found during:** iteration 3's corpus-expansion run, live-diagnosed while the restored run was
  in progress (process at 0.1% CPU, no file writes for 5+ minutes)
- **Issue:** A plain `requests.get(url, timeout=N)` does not reliably bound every hang mode — DNS
  resolution stalls and some connect-then-nothing states can block past the nominal timeout on
  certain platforms/resolvers, because the hang can occur before `requests`' own timeout machinery
  gets a chance to apply. This affected the occurrence-search and species-match API calls
  specifically (the image-download path already had a wall-clock-budget fix from an earlier plan
  session).
- **Fix:** Every network call (search, species/match, per-image metadata backfill, and the image
  download itself, consolidated onto one shared implementation) now runs inside a dedicated worker
  thread and is bounded by `Future.result(timeout=...)` from the calling thread — a guarantee that
  holds regardless of what the worker thread is actually doing; a hung worker is simply abandoned
  rather than waited on. Calls retry with exponential backoff rather than hammering a
  possibly-throttling host.
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** tested against an intentionally unreachable address — the guard gave up
  cleanly after 2 retries in 13 seconds rather than hanging.

---

**Total deviations:** 4 auto-fixed across the plan's full execution (1 blocking environment fix
and 1 correctness bug in iteration 1, caught by the plan's own required parity check; 1 correctness
bug and 1 blocking issue in iteration 3's corpus-assembly script, caught by the coordinator's
commit-as-you-go discipline surfacing intermediate state for inspection). All four were necessary
for the plan's own `<done>` criteria to be genuinely satisfied rather than nominally satisfied
against a broken interpreter, a degraded export, a silently truncated corpus, or an
indefinitely-hung assembly run. No scope creep — none of the four fixes touch any tracked project
file outside `docs/technical/species-recognition-spike-measurements-v1.md`.

## Issues Encountered

Two full training attempts were run in iteration 2 before settling on a final trained model (see
"Decisions Made" and Section 10.2 of the measurement document) — a deliberate tuning choice, not an
interruption; both attempts completed cleanly and both sets of numbers are recorded in the training
report. **Iteration 3's corpus-expansion run was genuinely interrupted twice across two prior
sessions** — once when a session ended mid-run (picked back up cleanly via `prepare_dataset.py`'s
existing resumability, no data lost) and once by a transient GBIF network outage that exposed the
manifest-truncation bug (Deviation 3 above), plus a separate indefinite-hang bug diagnosed live in
a later session (Deviation 4 above). Both bugs were root-caused and fixed rather than worked
around, and both are the kind of defect the coordinator's commit-as-you-go discipline was
specifically able to catch because intermediate state was inspected rather than only the final
result. This final session (export, evaluation, three-way comparison, promotion, write-up) ran
without interruption. A separate Claude session operating in the original checkout switched
`/Users/florian/Projects/cortege` to an unrelated branch partway through iteration 3's corpus
expansion — this session's work continued from a git worktree
(`/Users/florian/Projects/cortege-phase1`) with `spike/` symlinked to the original directory, and
the running corpus-assembly process kept writing to the same files throughout with no interruption
or re-download (measurement document Section 11.1).

## User Setup Required

None — all work is within the gitignored spike tree and the CPU-only local training/evaluation
run. No external service configuration required. One environment note for a future session: this
plan's `npm run format:check` verification bullet could not be run from this worktree because
`node_modules/` is not installed here (`sh: prettier: command not found`) — this does not affect
the deliverable, since the measurement document is Markdown and outside `format:check`'s
`**/*.{ts,tsx,json}` glob regardless, but a future session working in this worktree on TypeScript
files would need `npm install` run first.

## Next Phase Readiness

- `spike/species-recognition/eval/GATE` reads `GATE-MODEL: PASS`, referencing the **promoted
  iteration-3 model** (`genus_classifier.tflite`, 6,127,976 bytes, MobileNetV3-Large) — plan 01-05
  (device latency measurement) may proceed and should time this model, not iteration 1's or
  iteration 2's. Its on-disk size is identical to iteration 2's (same architecture/quantisation), so
  no new latency-budget concern is introduced beyond what iteration 2 already established (36x
  headroom against the 3,000ms D-05 budget at iteration 1's measured 83ms, Section 8) — plan 05
  should still measure it directly rather than assume.
- The measurement document Sections 4–11 give plan 01-06 (the ADR) everything it needs: the full
  licence chain (unchanged across all three iterations), all three iterations' exported model sizes
  (2.0 MB → 5.84 MB → 5.84 MB, bearing on D-07/D-08), all three iterations' complete 34-row
  per-genus accuracy tables with raw counts, confidence-band cut points for D-12, candidate-ordering
  evidence for D-11, all corpus caveats carried forward, and the 34-row three-way comparison
  (Section 11.3) that is this plan's final central deliverable for the ADR to reason from.
- **The central number plan 01-06 needs to reckon with, updated by iteration 3: 1 of 34 genera
  (Tamarix, 95.04%) now clears the D-02 95% top-3 bar** — the first genus to do so across all three
  iterations, and the first concrete partial-go (D-04) evidence this phase has produced. The other
  33 genera still do not clear it. Iteration 3's mean top-3 gain (+6.74pp, 2→3) is smaller than
  iteration 2's (+19.9pp, 1→2) — diminishing returns from data volume alone are real — but this
  document explicitly does **not** read that as proof of a hard approach ceiling: both iteration 2
  and iteration 3 trained to a fixed epoch budget without `EarlyStopping` ever triggering (Section
  11.2), so some of the shrinking gain is plausibly under-training at the larger corpus size rather
  than genuine saturation. Whether one genus's worth of partial-go evidence justifies D-15's Factor
  A rework, and whether a further iteration should add more data, a longer schedule, or neither, is
  the ADR's decision — this plan's job across all three iterations has been to put the trajectory in
  evidence, not to make the call.
- **Confounds now resolved with direct evidence, not open items any more:** per-class corpus
  ceilings are measured and uneven (Section 11.5 — Ceratonia licence-scarce at 3,629 candidates,
  eight classes still climbing at the 6,000 target); the seasonal-skew gap is substantially closed
  for 31 of 34 classes and confirmed, at three successive scales, as a genuine data-source absence
  for the remaining three (Prunus, Pinus, Acer) rather than an unexplored caveat; the
  corpus-completeness question the manifest-truncation incident raised is answered by
  `verify_corpus_complete()`'s pass, not assumed.
- **Confounds still open, unchanged from iteration 2:** the composition audit (Section 3a — not
  re-audited at this scale), no field photographs (Section 6), and latency not re-measured (plan
  05's job — see above).
- No blockers for plan 01-05. Plan 01-06 should read this plan's Section 4–11 in full, and
  specifically Section 11.3's three-way comparison table and Section 11.6's promotion verdict,
  before drafting the ADR.

---

_Phase: 01-species-recognition-approach-decision_
_Completed: 2026-09-25_

## Self-Check: PASSED

All claimed files found on disk for all three iterations: `docs/technical/species-recognition-
spike-measurements-v1.md`, the gitignored `spike/species-recognition/train/finetune.py`,
`export_tflite.py`, `prepare_dataset.py`, `spike/species-recognition/eval/evaluate_accuracy.py`,
`train/genus_classifier.tflite` (promoted, iteration 3), `train/genus_classifier_iteration1.tflite`,
`train/genus_classifier_v2.tflite`, `train/genus_classifier_v3.tflite`,
`eval/results/per_genus_accuracy.csv` (promoted, iteration 3),
`eval/results_iteration1/per_genus_accuracy.csv`, `eval/results_v2/per_genus_accuracy.csv`,
`eval/results_v3/per_genus_accuracy.csv`, `eval/GATE`, `data/splits/seasonal_balance_report.json`,
`data/splits/progress.log`, and this SUMMARY.md. All nineteen commits (`1490ec6`, `ff07741`,
`5288c0b`, `faadc55`, `1d38b72`, `32df24c`, `56816f3`, `abcd423`, `449c6f4`, `8d30cd4`, `86afd49`,
`7ee5fc1`, `5f29614`, `bb74ad7`, `b466279`, `094def3`, `52bc19e`, `4c3fb27`, `641289d`) verified
present in `git log`. The canonical model path re-passes the plan's own automated verify checks
(export parity 98.5%, 34 output classes matching `genus_labels.txt` order, 34-row results CSV) run
directly against it post-promotion.
