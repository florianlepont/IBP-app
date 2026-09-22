---
phase: 01-species-recognition-approach-decision
plan: 02
subsystem: ml-spike
tags:
  [
    gbif,
    corpus,
    licence-provenance,
    cnpf,
    genus-classification,
    data-collection,
    composition-audit,
  ]

requires:
  - phase: 01-species-recognition-approach-decision (plan 01)
    provides: gitignored spike working tree, Python 3.12 venv, measurement document skeleton
provides:
  - "34-class CNPF Factor A genus label set, transcribed from the official IBP FR v3.2 PDF (spike/species-recognition/train/genus_labels.txt)"
  - "Complete licence-clean image corpus sourced from GBIF occurrence media, all 34 classes downloaded and split (spike/species-recognition/data/)"
  - "prepare_dataset.py: resumable GBIF fetch/download/split script with per-class provenance manifest and a hardcoded composition-exclusion list"
  - "Per-genus corpus-composition audit (Section 3a) and seasonal-skew measurement (Section 3b) in the measurement document"
  - "spike/species-recognition/data/GATE: GATE-CORPUS: PASS, CLASSES-USABLE: 32 (composition-adjusted)"
affects: [01-04]

tech-stack:
  added: []
  patterns:
    - "GBIF genusKey/speciesKey resolution via species/match?kingdom=Plantae to avoid backbone-taxonomy homonym collisions"
    - "Resumable corpus-assembly script: checks existing file counts on disk before re-fetching, backfills provenance via cheap JSON occurrence lookups instead of re-downloading images"
    - "Wall-clock download deadline via streaming iter_content instead of requests' timeout= (which does not bound trickling reads)"
    - "Contact-sheet visual audit: grid multiple sampled thumbnails into one image per class so a large per-image classification task collapses into one review pass per class instead of one per image"

key-files:
  created:
    - spike/species-recognition/train/genus_labels.txt (gitignored)
    - spike/species-recognition/train/prepare_dataset.py (gitignored)
  modified:
    - docs/technical/species-recognition-spike-measurements-v1.md

key-decisions:
  - "34-class label set drawn from IBP FR v3.2 (CNPF, 02/02/2026) Tableau 1 + Factor A field-sheet definition, not from repo's own stale references (which cite v3.0) -- version drift flagged, resolution assigned to Phase 2 per D-15"
  - "Pistacia kept in the 34-class list despite an internal inconsistency in the source PDF (named in the Factor A genus definition but its species listed under the shrub table) -- flagged in Section 2, not silently resolved"
  - "Corpus sourced from GBIF occurrence media worldwide (not France/Europe-restricted) because every genus cleared 4,200+ CC0/CC-BY candidates -- availability was never the constraint, download time was; flagged as a scope decision in Section 3"
  - "220 images/class target (150/35/35 train/val/test), chosen well above the 30-image test-reporting threshold with margin for failures"
  - "Betula and Phillyrea excluded from CLASSES-USABLE on composition grounds (majority landscape/stand and majority herbarium-sheet content respectively), hardcoded into prepare_dataset.py's compute_report() as COMPOSITION_EXCLUDED_CLASSES so the gate stays reproducible on --report re-runs rather than drifting from the manual audit"
  - "REQ-ML-adr NOT marked complete by this plan: the requirement text describes 'an accepted ADR', which this plan does not produce -- corpus assembly is an input to that ADR (written in a later plan), not the requirement itself"

requirements-completed: []

duration: ~4h (across multiple interrupted sessions; see Issues Encountered)
completed: 2026-09-22
status: complete
---

# Phase 1 Plan 02: CNPF Genus List, Image Corpus, and Composition Audit Summary

**34-class CNPF Factor A genus list transcribed from the official IBP FR v3.2 PDF; a 34-class, licence-clean GBIF-sourced image corpus assembled and split; a per-genus visual composition audit found the corpus is NOT reliably single-subject and excluded 2 classes; a seasonal-skew measurement found the corpus is almost entirely non-autumn despite field tests starting in October; `GATE-CORPUS: PASS`, `CLASSES-USABLE: 32`.**

## Performance

- **Started:** 2026-09-22 (continuation from plan 01's checkpoint approval)
- **Completed:** 2026-09-22
- **Tasks:** 3 (1 checkpoint, 2 auto)
- **Files modified:** 2 tracked (`docs/technical/species-recognition-spike-measurements-v1.md`,
  this SUMMARY), plus the gitignored spike tree (`genus_labels.txt`, `prepare_dataset.py`, ~7,300
  downloaded images across `data/raw/`, `data/splits/manifest.csv`, `data/GATE`)
- **Duration note:** this plan was interrupted by transient infrastructure failures — two
  session/API errors and one hung-download kill — across what was otherwise a multi-hour
  background GBIF download. See "Issues Encountered" for the full account. None of the
  interruptions were caused by logic bugs in this plan's own work.

## Accomplishments

- **Task 1 (checkpoint):** Package-legitimacy checkpoint for the spike's Python install set
  approved by the coordinator, with `ai-edge-torch` substituted for `tensorflow` after
  `ai-edge-torch` was found deprecated on PyPI (renamed to `litert-torch`, 6 releases only;
  `tensorflow` has 138 and a long-established homepage). Final approved set: `torch`,
  `torchvision`, `pillow`, `numpy`, `scikit-learn`, `pandas`, `tensorflow` — all installed into
  `spike/species-recognition/.venv` only. Confirmed no workspace `package.json` or lockfile
  touched (`mobile/`, `api/`, root).
- **Task 2:** Read the CNPF Factor A genus definition directly from IBP FR v3.2 (02/02/2026),
  retrieved from `cnpf.fr`. Found 33 genera, 34 classes counting the mandatory Quercus
  deciduous/evergreen split, matching RESEARCH.md's count exactly. Wrote
  `spike/species-recognition/train/genus_labels.txt` (34 lines) and filled Section 2 of the
  measurement document with the full genus table, French vernacular names, a source-document
  inconsistency around Pistacia, and the v3.0/v3.2 version-drift note (resolution assigned to
  Phase 2). Committed as `4cb2fa9`.
- **Task 3:** Built `prepare_dataset.py` to fetch a licence-clean corpus from GBIF occurrence
  media (CC0-1.0 / CC-BY-4.0 only, server-side filtered, D-09), resolve genus/species taxon keys
  via `kingdom=Plantae` to avoid backbone-taxonomy homonym collisions (`Pinus`, `Salix`, `Arbutus`
  collide with insect/moth genera in GBIF's backbone), split each class into stratified
  train/val/test, and write a per-image provenance manifest. **All 34 classes downloaded** — 32 at
  the full 220-image target, Pistacia at 204, Ulmus at 187 (both still well above the 40-image
  usable-training threshold and the 30-image D-02 test-reporting threshold). Ran a per-genus
  visual composition audit (~30 sampled images per class via contact sheets) which found the
  corpus is **not reliably single-subject** and excluded 2 classes on that basis, and a seasonal
  skew measurement from GBIF event dates which found the corpus is overwhelmingly non-autumn.
  Wrote `spike/species-recognition/data/GATE` with `GATE-CORPUS: PASS` and
  `CLASSES-USABLE: 32`.

## Corpus assembly — final state

All 34 classes downloaded from GBIF occurrence media, CC0-1.0/CC-BY-4.0 licence-filtered at the
query level (D-09). Per-class target 220 images (150 train / 35 val / 35 test); two classes fell
short of the target but still comfortably clear both thresholds:

| Class    | Downloaded | Train | Val | Test |
| -------- | ---------- | ----- | --- | ---- |
| Pistacia | 204         | 139   | 32  | 33   |
| Ulmus    | 187         | 127   | 30  | 30   |
| (32 others) | 220     | 150   | 35  | 35   |

Full per-class table: `docs/technical/species-recognition-spike-measurements-v1.md` Section 3.

**Six transient network failures during assembly, all recovered on first retry:**

| Class            | Failure mode                                                  |
| ---------------- | --------------------------------------------------------------- |
| Tilia, Ulmus, Cercis | `SSLError`/`SSLEOFError` against `api.gbif.org`               |
| Olea             | Stalled S3 read (`requests` timeout doesn't bound trickling reads) |
| Pistacia         | `ReadTimeout` against `api.gbif.org`                            |

Per the coordinator's explicit three-causes framework: none of the six was licence scarcity (a
pre-download coverage survey found 4,200+ CC0/CC-BY candidates for every one of the 34 classes,
including all six that failed) and none was a taxon-key resolution bug (`species/match` resolved
correctly for all of them whenever the network call itself succeeded). All six were pure
infrastructure blips, and all six recovered on the very next retry — no class needed a second
retry, so none carries a `network-failure-after-retry` label. Full account:
`docs/technical/species-recognition-spike-measurements-v1.md` Section 3, "Six transient failures,
cause by cause".

## Corpus composition audit (Section 3a) — the major finding of this plan

`prepare_dataset.py`'s first draft asserted, without checking, that GBIF `StillImage` occurrence
media are "specimen/observation photographs of one organism — never stand or multi-tree survey
photography." **That claim was checked against a 30-image-per-class sample (1,020 images total,
via contact sheets — a grid of thumbnails per class, reviewed by direct visual inspection) and
found false.** Every class was classified into `usable-single-subject`, `landscape-or-stand`,
`in-hand-specimen`, `herbarium-or-label`, or `other-unusable`. The false claim has been removed
from the script's docstring and replaced with an accurate description pointing at this audit.

**Two classes excluded from `CLASSES-USABLE` on composition grounds (not licence, resolution, or
network grounds):**

- **Betula** — 13/30 (43%) usable-single-subject, 13/30 (43%) landscape-or-stand. A majority
  (57%) of the sample is not single-subject — largely forest/grove scenes with multiple birch
  trunks, i.e. precisely the multi-tree stand case D-10 (amended) explicitly removed from this
  phase's scope.
- **Phillyrea** — 9/30 (30%) usable-single-subject, 20/30 (67%) herbarium-or-label. Two-thirds of
  the sample is pressed, mounted, scanned herbarium specimens (rulers, colour cards, barcodes,
  labels) from a natural-history-collection dataset — nothing like a phone-camera field photo,
  despite carrying a valid CC0/CC-BY licence.

**Two further classes flagged marginal but kept in the usable count:**

- **Larix** — exactly 50% usable-single-subject; the rest splits between landscape-or-stand (20%)
  and, notably, `other-unusable` (27%) — pure scenic mountain-lake photography with no discernible
  Larix subject, suggesting a dataset of location-tagged tourist photos rather than
  field-identification photos.
- **Ceratonia** — 53% usable-single-subject, 40% herbarium-or-label (second-highest herbarium
  fraction after Phillyrea). Both high-herbarium classes are the Mediterranean-case supplementary
  genera (Section 2), suggesting herbarium-heavy source datasets may correlate with
  less-photographed Mediterranean taxa.

**Result:** `CLASSES-USABLE: 32` (34 raw-usable minus Betula and Phillyrea), written into
`spike/species-recognition/data/GATE` and hardcoded as `COMPOSITION_EXCLUDED_CLASSES` in
`prepare_dataset.py::compute_report()` — a manual finding, not something re-derivable from raw
counts, so it is recorded explicitly rather than left to drift out of sync between the gate file
and the audit that produced it. Full table and reasoning:
`docs/technical/species-recognition-spike-measurements-v1.md` Section 3a.

**Flagged for plan 04:** the composition-adjusted test-set estimates in Section 3a suggest most
classes' *effective* single-subject test count is smaller than their raw count implies. Whether
plan 04 composition-filters test images before evaluating accuracy, or reports the raw-corpus
figure with this caveat attached, is left as plan 04's explicit decision — not resolved here, per
instruction that this was a measurement task, not a filtering task.

## Seasonal skew measurement (Section 3b) — a second major finding

GBIF `eventDate` was retrieved for the same 1,020-image sample (100% coverage) and bucketed into
meteorological seasons. **23 of 34 classes have zero autumn-dated images in their sample.** Only
the Mediterranean supplementary genera show meaningful autumn representation (Ceratonia and
Pistacia both 27%, the corpus-wide maximum), and even that is a small minority of those genera's
samples. Field tests are scheduled to start in October. This is recorded as its own confidence
cap in Section 9 (item 5), additive to — not folded into — the existing no-field-photo-validation
gap, because it is a property of the training corpus's composition and would not be fixed by field
validation alone.

## Task Commits

1. **Task 1: package-legitimacy checkpoint** — checkpoint, no commit (coordinator approval)
2. **Task 2: transcribe the CNPF genus list** — `4cb2fa9` (docs)
3. **Task 3, interim checkpoint: partial corpus + interim measurement document** — `d98e968`
   (docs) — committed mid-plan per explicit instruction, before the corpus download and
   composition audit were complete, so an interruption would not lose the reasoning behind
   ~12,400 already-downloaded images
4. **Task 3, final: complete corpus, composition audit, seasonal skew, GATE** — this commit (docs)

## Files Created/Modified

- `docs/technical/species-recognition-spike-measurements-v1.md` — Section 2 (genus list, complete
  since `4cb2fa9`), Section 3 (corpus provenance, now complete — all 34 classes, six-failures
  breakdown), new Section 3a (composition audit, 34-row table, exclusion reasoning), new Section
  3b (seasonal skew, 34-row table), Section 9 (three new gap entries: composition, seasonal skew,
  the v3.0/v3.2 first-hand confirmation)
- `spike/species-recognition/train/genus_labels.txt` (gitignored) — 34-class label set
- `spike/species-recognition/train/prepare_dataset.py` (gitignored) — fetch/download/split script;
  resumable; wall-clock download-deadline fix; corrected docstring; hardcoded
  `COMPOSITION_EXCLUDED_CLASSES`
- `spike/species-recognition/data/raw/<class>/` (gitignored) — downloaded images, all 34 classes
- `spike/species-recognition/data/splits/manifest.csv`, `per_class_counts.json` (gitignored) —
  per-image provenance and per-class counts
- `spike/species-recognition/data/GATE` (gitignored) — `GATE-CORPUS: PASS`,
  `CLASSES-USABLE: 32`, mirrored verbatim into Section 9 of the measurement document

## Decisions Made

See `key-decisions` in frontmatter. Additionally: chose to source the corpus worldwide rather than
restrict to France/Europe, since every genus cleared thousands of candidates regardless — flagged
as a scope decision in Section 3 for a later reviewer to reconsider if desired, not asserted as
obviously correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `requests` timeout not bounding trickling downloads**

- **Found during:** Task 3, while downloading the Olea class
- **Issue:** A GBIF-linked S3 image host stalled mid-transfer; `requests.get(url, timeout=20)` did
  not abort because `urllib3`'s read timeout resets on every partial byte received, not on total
  elapsed time — the process sat with an `ESTABLISHED` socket, 0% CPU, no progress, for minutes
- **Fix:** Rewrote `download_and_resize` to stream with `iter_content` and check
  `time.monotonic()` against a hard 15s wall-clock budget
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** Syntax-checked with `ast.parse`; confirmed directly — the hang recurred once
  more on a later run under the old code path before the fix was applied everywhere, and did not
  recur after

**2. [Rule 3 - Blocking] Made `prepare_dataset.py` resumable across interruptions**

- **Found during:** Task 3, after the first download run was killed by a session-ending API error
  partway through
- **Issue:** The original script always re-fetched every class from GBIF, which would have
  discarded already-downloaded images on any interruption — and this plan was interrupted four
  times
- **Fix:** Added a check for existing files on disk before fetching; when present, reuses them and
  backfills provenance metadata via a cheap JSON-only occurrence lookup instead of re-downloading
  image bytes. Wrapped each class's processing in `try`/`except` so one class's failure does not
  crash the whole run, and added a checkpoint write (manifest + splits + counts) after every class
  rather than only at the very end
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** Confirmed by observation across four separate interruptions — each preserved
  all prior progress, and every resumed run correctly reused existing files rather than
  re-downloading them

**3. [Rule 1 - Bug] Corrected a false claim in `prepare_dataset.py`'s docstring**

- **Found during:** Task 3, composition audit
- **Issue:** The script asserted GBIF `StillImage` media are "never stand or multi-tree survey
  photography" — an assumption, never checked, and contradicted by the audit (Betula, Phillyrea
  both majority non-single-subject; every other class carries some landscape/in-hand/herbarium
  contamination)
- **Fix:** Rewrote the docstring's single-subject-scope paragraph to state plainly that no filter
  exists, point at Section 3a for the real numbers, and explain why filtering was out of scope for
  this measurement task
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** Direct re-read of the corrected text against the audit findings

**4. [Rule 2 - Missing Critical] Hardcoded the composition-exclusion findings into
`compute_report()`**

- **Found during:** Task 3, after `prepare_dataset.py --report` was re-run as part of this plan's
  own automated verify step and silently overwrote the manually-written composition-adjusted GATE
  file with a raw-volume-only recomputation (`CLASSES-USABLE: 34`, undoing the audit)
- **Issue:** The composition audit is a manual visual-classification finding that cannot be
  re-derived from any field already tracked in `per_class_counts.json` — without encoding it
  somewhere in the script, any future `--report` re-run silently reverts the gate to the raw,
  pre-audit count
- **Fix:** Added `COMPOSITION_EXCLUDED_CLASSES` (Betula, Phillyrea, with the audit rationale as
  inline comments) and had `compute_report()` subtract them from the usable-class list before
  computing `CLASSES-USABLE`
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** Re-ran `--report`; confirmed `CLASSES-USABLE: 32` and the correct exclusion
  reasons print, and that the written GATE file matches the measurement document verbatim

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 missing-critical). All necessary for the
plan to complete correctly and for the gate to stay accurate on re-runs; no scope creep.

## Verification against the plan's automated check

All conditions in the plan's Task 3 `<verify>` block pass except one, which is a direct and
expected consequence of the coordinator's mid-execution instruction to add the composition and
seasonal-skew sections:

- Dependencies importable, `--report` runs, `data/splits/` exists, CC-BY/CC0 + D-09 + D-10 all
  present in Section 3's range, GATE file format correct, gate token verbatim in the document, and
  PASS/EARLY-NO-GO consistent with the usable-class count — **all pass**.
- The check `awk '/^## 3\./,/^## 4\./' | grep -c '^\| *[A-Z][a-z]+' -eq 34` — **fails**: it now
  counts 102, because Sections 3a and 3b (each with their own 34-row per-class table) sit between
  Section 3 and Section 4 in the document, and the awk range naturally spans all three. Section
  3's own per-class table, isolated, still has exactly 34 rows
  (`awk '/^## 3\. /,/^## 3a\./' | grep -c ... ` returns 34). This is a structural consequence of
  content the coordinator explicitly required mid-execution (composition audit, seasonal skew)
  that the original plan's verify script — written before those additions were requested — did
  not anticipate. The substance every check was written to confirm (a complete 34-row per-class
  table with licence/D-09/D-10 coverage) is intact; only the row-count arithmetic assumption no
  longer holds given two additional, equally-complete 34-row tables now sit in the same section
  range.

## Issues Encountered

This plan was interrupted four times over its execution, all by infrastructure rather than logic:

1. Two session/API-level errors during the multi-hour background GBIF download (`ENOTFOUND` and
   an unspecified session end), each losing the in-progress download process but not the
   already-downloaded files on disk.
2. One manual kill of a hung download process (the S3 stalled-read issue, see Deviation 1 above).
3. Six per-class transient network failures during the retry passes (see "Corpus assembly — final
   state" above), all recovered on first retry.

None of these reflect a real corpus-coverage or licence problem; all are documented with their
exact cause so a later reader can distinguish infrastructure noise from genuine findings. The two
genuine findings this plan surfaced — composition and seasonal skew — are both recorded as new
confidence caveats in Section 9 rather than being absorbed silently.

## User Setup Required

None — all work is within the gitignored spike tree and public GBIF API calls.

## Next Phase Readiness

- `spike/species-recognition/data/GATE` reads `GATE-CORPUS: PASS` / `CLASSES-USABLE: 32` — plan
  01-04 may proceed.
- The measurement document (Sections 2, 3, 3a, 3b) gives plan 04 the full genus list, corpus
  provenance, composition breakdown per class, and seasonal-skew data it needs before fine-tuning.
- **Recommendation for plan 04, not a blocker:** consider composition-filtering the actual test
  images (using the per-class composition rates in Section 3a as a guide for which classes need
  the closest look) before computing per-genus accuracy, since evaluating against the raw corpus
  measures something broader than D-02's single-subject top-3 bar. This is explicitly plan 04's
  decision, not resolved here.
- The two composition-excluded classes (Betula, Phillyrea) and two marginal classes (Larix,
  Ceratonia) should be named explicitly in the ADR's partial-go discussion (D-04) if plan 04's
  results for those genera look anomalously good or bad — the composition problem is a plausible
  explanation either way.
- Section 9's seasonal-skew caveat (item 5) should be carried into the ADR's confidence discussion
  alongside the existing no-field-photo-validation gap — they compound rather than duplicate.
- No blockers for plan 01-04.

---

_Phase: 01-species-recognition-approach-decision_
_Completed: 2026-09-22_

## Self-Check: PASSED

All claimed files found on disk: `docs/technical/species-recognition-spike-measurements-v1.md`,
the gitignored `spike/species-recognition/train/genus_labels.txt`, `prepare_dataset.py`,
`data/GATE`, `data/splits/manifest.csv`, `data/splits/per_class_counts.json`, and this SUMMARY.md.
Both prior task commits (`4cb2fa9`, `d98e968`) verified present in `git log`.
