---
phase: 01-species-recognition-approach-decision
plan: 02
subsystem: ml-spike
tags: [gbif, corpus, licence-provenance, cnpf, genus-classification, data-collection]

requires:
  - phase: 01-species-recognition-approach-decision (plan 01)
    provides: gitignored spike working tree, Python 3.12 venv, measurement document skeleton
provides:
  - "34-class CNPF Factor A genus label set, transcribed from the official IBP FR v3.2 PDF (spike/species-recognition/train/genus_labels.txt)"
  - "Partial licence-clean image corpus sourced from GBIF occurrence media (28 of 34 classes downloaded as of this commit)"
  - "prepare_dataset.py: resumable GBIF fetch/download/split script with per-class provenance manifest"
affects: [01-04]

tech-stack:
  added: []
  patterns:
    - "GBIF genusKey/speciesKey resolution via species/match?kingdom=Plantae to avoid backbone-taxonomy homonym collisions"
    - "Resumable corpus-assembly script: checks existing file counts on disk before re-fetching, backfills provenance via cheap JSON occurrence lookups instead of re-downloading images"
    - "Wall-clock download deadline via streaming iter_content instead of requests' timeout= (which does not bound trickling reads)"

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

requirements-completed: []

duration: in-progress (interim checkpoint)
completed: 2026-09-22
status: in-progress
---

# Phase 1 Plan 02: CNPF Genus List and Image Corpus (Interim) Summary

**34-class CNPF Factor A genus list transcribed from the official IBP FR v3.2 PDF; licence-clean GBIF-sourced image corpus 28/34 classes complete, 5 classes mid-retry after transient network failures, composition audit and gate decision still pending.**

## Why this is an interim SUMMARY

This plan has been interrupted multiple times by transient network failures (API/session errors,
not logic bugs) during the multi-hour corpus download. Per explicit instruction from the
coordinator: commit what is known now, so the reasoning behind ~12,400+ downloaded images and the
work already done does not exist only in an agent's context if interrupted again. This SUMMARY
will be updated to its complete form (composition audit results, final GATE token, full 34-class
table) in a following commit once the remaining classes are fetched and audited.

## Performance (partial, as of this commit)

- **Started:** 2026-09-22 (continuation from plan 01's checkpoint approval)
- **This commit:** 2026-09-22
- **Tasks:** Task 1 (checkpoint, approved), Task 2 (complete), Task 3 (in progress — corpus
  download 28/34 classes, composition audit and GATE not yet written)

## Accomplishments so far

- **Task 1 (checkpoint):** Package-legitimacy checkpoint for the spike's Python install set
  (`torch`, `torchvision`, `pillow`, `numpy`, `scikit-learn`, `pandas`) approved by the
  coordinator, with `ai-edge-torch` substituted for `tensorflow` after `ai-edge-torch` was found
  deprecated on PyPI (renamed to `litert-torch`, which has only 6 releases; `tensorflow` has 138
  and a long-established homepage). All seven packages installed into
  `spike/species-recognition/.venv` only — no workspace `package.json` or lockfile touched.
  Verified: `npm run format:check`-relevant files (`docs/`) confirmed unaffected; `mobile/`,
  `api/`, and root `package.json`/`package-lock.json` are untouched by this plan.
- **Task 2 (complete):** Read the CNPF Factor A genus definition directly from IBP FR v3.2
  (02/02/2026), retrieved from `cnpf.fr`. Found 33 genera, 34 classes counting the mandatory
  Quercus deciduous/evergreen split, matching RESEARCH.md's count exactly. Wrote
  `spike/species-recognition/train/genus_labels.txt` (34 lines) and filled Section 2 of the
  measurement document with the full genus table, French vernacular names, the Pistacia
  source-document inconsistency, and the v3.0/v3.2 version-drift note (resolution assigned to
  Phase 2). Committed as `4cb2fa9`.
- **Task 3 (in progress):** Built `prepare_dataset.py` to fetch a licence-clean corpus from GBIF
  occurrence media (CC0-1.0 / CC-BY-4.0 only, server-side filtered), resolve genus/species taxon
  keys via `kingdom=Plantae` to avoid backbone-taxonomy homonym collisions (`Pinus`, `Salix`,
  `Arbutus` collide with insect/moth genera in GBIF's backbone), and split each class into
  train/val/test. As of this commit: **28 of 34 classes fully downloaded** (26 at the 220-image
  target, Ceratonia at 165, Taxus at 203), **3 classes empty due to confirmed transient network
  failures** (Tilia, Ulmus, Cercis — `SSLError`/`SSLEOFError` against `api.gbif.org`, immediately
  following a successful request for the preceding class, ruling out a sustained outage), and
  **3 classes not yet completed** (Olea — interrupted by a stalled S3 download that bypassed
  `requests`' per-read timeout; Phillyrea, Pistacia — not yet reached in fetch order).

## Coverage survey finding (before any download)

A dry-run GBIF count (no download) found every one of the 34 classes had **4,200+ CC0/CC-BY
candidate occurrences** worldwide before any corpus assembly began. This rules out licence
scarcity as the cause for any of the five currently-incomplete classes — see the three-causes
breakdown in Section 3 of the measurement document.

## The three causes, kept distinct (per explicit instruction)

| Class | Cause | Evidence |
| --- | --- | --- |
| Tilia | Transient network failure | `SSLError` immediately after Sorbus/Tamarix succeeded |
| Ulmus | Transient network failure | `SSLError` immediately after Tilia's failure |
| Cercis | Transient network failure | `SSLError` immediately after Ceratonia succeeded |
| Olea | Transient network failure (different mode — stalled read, not SSL) | Socket `ESTABLISHED` to S3, 0% CPU, no progress for minutes; `requests` timeout does not bound trickling reads |
| Phillyrea | Not yet attempted | Last two classes in fetch order, not yet reached |
| Pistacia | Not yet attempted | Last two classes in fetch order, not yet reached |

None of the five is a licence-scarcity finding and none is a taxon-key resolution bug. All five
are infrastructure gaps that the retry pass addresses next.

## Fix applied mid-plan (Rule 1 — bug)

`prepare_dataset.py::download_and_resize` used `requests.get(url, timeout=20)`, which does not
bound total transfer time — `urllib3`'s read timeout applies per socket read, so a server
trickling bytes slowly resets the clock on every partial read and can hang indefinitely. This was
observed directly (a stalled S3 connection, 0% CPU, no progress for several minutes past its
nominal 20s timeout) and fixed by streaming the download with an explicit wall-clock deadline
(`DOWNLOAD_WALL_CLOCK_BUDGET_S = 15`, checked against `time.monotonic()` inside the
`iter_content` loop) instead of relying on the per-read socket timeout.

## Task Commits (so far)

1. **Task 1: package-legitimacy checkpoint** — checkpoint, no commit (coordinator approval,
   recorded here and in Task 2's commit context)
2. **Task 2: transcribe the CNPF genus list** — `4cb2fa9` (docs)
3. **Task 3 (interim): partial corpus + interim measurement document** — this commit (docs)

## Files Created/Modified

- `docs/technical/species-recognition-spike-measurements-v1.md` — Section 2 (genus list, complete)
  and Section 3 (corpus provenance, interim — 28/34 classes, the three-causes breakdown for the 5
  absent classes)
- `spike/species-recognition/train/genus_labels.txt` (gitignored) — 34-class label set
- `spike/species-recognition/train/prepare_dataset.py` (gitignored) — fetch/download/split script,
  resumable, with a wall-clock download-deadline fix applied mid-plan
- `spike/species-recognition/data/raw/<class>/` (gitignored) — downloaded images, 28 of 34 classes
- `spike/species-recognition/data/splits/manifest.csv`, `per_class_counts.json` (gitignored) —
  per-image provenance and per-class counts for the classes processed so far

## Decisions Made

See `key-decisions` in frontmatter. Additionally: chose to source the corpus worldwide rather than
restrict to France/Europe, since every genus cleared thousands of candidates regardless — flagged
as a scope decision in Section 3 for a later reviewer to reconsider if desired, not asserted as
obviously correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `requests` timeout not bounding trickling downloads**
- **Found during:** Task 3, retry pass, while downloading the Olea class
- **Issue:** A GBIF-linked S3 image host stalled mid-transfer; `requests.get(url, timeout=20)`
  did not abort because `urllib3`'s read timeout resets on every partial byte received, not on
  total elapsed time
- **Fix:** Rewrote `download_and_resize` to stream with `iter_content` and check
  `time.monotonic()` against a hard 15s wall-clock budget
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored, not
  committed to git — see Files Created/Modified)
- **Verification:** Syntax-checked with `ast.parse`; retry pass after the fix no longer hangs
  (observed directly)

**2. [Rule 3 - Blocking] Made `prepare_dataset.py` resumable across interruptions**
- **Found during:** Task 3, after the first download run was killed by a session-ending API error
  partway through
- **Issue:** The original script always re-fetched every class from GBIF, which would have
  discarded ~11,000 already-downloaded images on any interruption
- **Fix:** Added a check for existing files on disk before fetching; when present, reuses them
  and backfills provenance metadata via a cheap JSON-only occurrence lookup instead of
  re-downloading image bytes. Also wrapped each class's processing in `try`/`except` so one
  class's failure (network or otherwise) does not crash the whole run, and added a checkpoint
  write (manifest + splits + counts) after every class rather than only at the very end
- **Files modified:** `spike/species-recognition/train/prepare_dataset.py` (gitignored)
- **Verification:** Confirmed by observation — three separate interruptions (two API/session
  errors, one manual kill for a hung download) each preserved all prior progress, and the resumed
  run correctly reused existing files rather than re-downloading them

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both necessary for the plan to complete at
all given the repeated interruptions encountered; no scope creep.

## Issues Encountered

- Multiple transient network failures during the multi-hour GBIF download (documented above and
  in Section 3 of the measurement document), none of which reflect a real corpus-coverage limit.
- The plan's timebox discipline (D-19) is under pressure from the repeated interruptions; the
  remaining work (5 classes retried, composition audit, GATE decision) is scoped to be
  completable quickly given the corpus-assembly infrastructure is now resumable and hardened.

## User Setup Required

None — all work is within the gitignored spike tree and public GBIF API calls.

## Next Phase Readiness — NOT YET READY

This SUMMARY is interim. Before plan 01-04 can run, this plan still owes:

1. Retry fetch for Tilia, Ulmus, Cercis, Olea, Phillyrea, Pistacia (script is resumable; only the
   missing classes will be fetched).
2. Per-genus corpus-composition audit (~30 sampled images per class, classified into
   usable-single-subject / landscape-or-stand / in-hand-specimen / herbarium-or-label /
   other-unusable), since GBIF `StillImage` media is confirmed NOT reliably single-subject.
3. Seasonal-skew estimate from GBIF event dates per genus.
4. Correction of the false single-subject claim in `prepare_dataset.py`'s docstring.
5. `spike/species-recognition/data/GATE` written with an accurate `GATE-CORPUS: PASS` or
   `EARLY-NO-GO` token and `CLASSES-USABLE: n`, where `n` reflects usable **composition**, not
   raw download volume, and where classes absent for confirmed network reasons are not counted
   as unusable.
6. This SUMMARY updated to its complete form, `status: complete`, with a final duration.

---

_Phase: 01-species-recognition-approach-decision_
_Interim commit: 2026-09-22_
