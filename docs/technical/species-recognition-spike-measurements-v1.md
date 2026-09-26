# Species Recognition Spike — Measurements (V1)

## Status

In progress

## Spike window

Timeboxed to two to three days (D-19). The published schedule is already at its September 2026
deadline, with field tests due to start in October.

## Supports

`docs/technical/adr-002-on-device-species-recognition-v1.md` — not yet written. This document is
the evidence log the ADR's go/no-go cites; every figure the ADR names must trace back to a section
below.

## Source context

`.planning/phases/01-species-recognition-approach-decision/01-RESEARCH.md`

---

## 0. How to read this document

Four rules govern every figure recorded below.

**Accuracy is reported per genus, never as a single average (D-03).** The measurement covers the
whole CNPF regional genus list (D-17); a mean would let rare genera drag the figure down while
hiding that frequent genera already clear the bar. The partial-go rule (D-04) — enable suggestions
only for genera that clear the bar, keep manual entry for the rest — is unusable without this
per-genus breakdown.

**The bar is the correct genus within the top 3 candidates, 95% of the time (D-02).** This is an
evaluation metric, not a screen design. The screen itself shows the single most likely genus first,
with its confidence, and the remaining candidates underneath (D-11) — top-3 is how accuracy is
measured, not how the result is presented to the ecologist.

**The target is the genus, never the species (D-01).** Factor A counts native genera from the
closed CNPF regional list, so genus is what the score needs. No species-level figure from any
published benchmark may be quoted anywhere in this document as if it were a genus-level figure
(RESEARCH.md Pitfall 2) — species and genus accuracy are not interchangeable and doing so would
misstate the evidence.

**A genus with too few held-out test images to support a 95% claim is reported as
`insufficient-samples` with its image count.** It is never silently dropped and never folded into
an average with better-supported genera.

---

## 1. Benchmark devices

**Status: PROVISIONAL — fallback in effect (D-18).**

Etats Sauvages did not confirm which phones its observers carry into the field. Per the plan's
Task 1 checkpoint (2026-09-22), the spike proceeds on the documented fallback pair instead of a
confirmed device set:

- **iOS floor:** lowest-spec real iOS device obtainable — roughly an iPhone SE (2nd/3rd gen) or
  iPhone 11 class handset.
- **Android floor:** lowest-spec real Android device obtainable — a mid-range 2022–2023 Android,
  roughly Samsung Galaxy A-series class.

No flagship device is acceptable on either side: RESEARCH.md Pitfall 4 is explicit that a fast test
phone hides a real-world latency failure exactly as badly as a simulator does.

**This caps the confidence of every latency figure in Section 7.** The 3-second bar (D-05) is
measured against an assumed floor, not a confirmed one. If the association's real observer
handsets turn out to be slower than this floor, the recorded latency numbers understate real-world
latency.

The association may still name the real device models before wave 4 (device latency run). If they
do, this section is updated with the confirmed pair and the confidence cap above is lifted — no
restructuring required, only the two device names and this status line.

_(Exact device models and OS versions used for measurement: filled by plan 05.)_

**Addendum (plan 01-03, 2026-09-23):** the device-harness native-integration proof (Section 8) was
run on an iPhone 15 Pro — the only real device reachable during that session, and explicitly a
**flagship**, not this section's documented floor. That run answers a different question (does the
runtime build and execute at all on real hardware) than this section's question (is the observers'
real-world latency under 3 seconds), and its numbers must not be substituted for a genuine Section 7
reading. Plan 05 still owes a run on the actual floor devices above, or on the association's
confirmed real handsets if named before then.

---

## 2. Genus label set (CNPF IBP FR v3.2, Factor A)

**Source.** CNPF, "Indice de Biodiversité Potentielle pour les forêts de France métropolitaine
(IBP FR v3.2) : fiche de définition", dated 02/02/2026 (document footer: "IBP FR v3.2
(02/02/26)"). Retrieved from
`https://www.cnpf.fr/sites/socle/files/2026-04/IBP_FR_v3_2_260202.pdf` on 2026-09-22. The PDF was
downloaded into the gitignored `spike/species-recognition/data/raw/` and is not redistributed
anywhere under `docs/`, per `docs/references/README.md`'s no-redistribution policy for CNPF's
third-party methodology PDFs.

The 34-class label set was read directly from two places in the document, cross-checked against
each other:

- The Factor A field-sheet definition (p. 2, "Facteurs liés au peuplement et à la gestion
  forestière"), which gives the genus list used to compute the score directly — including a
  "essences supplémentaires cas 4 et 2" (Mediterranean-case supplementary genera) line.
- Tableau 1, "Liste des essences autochtones sur au moins une partie de la France métropolitaine,
  selon la définition IBP" (p. 9–10), which gives the Latin binomial and French vernacular name for
  every native species, organised by genus.
- p. 6's methodology note, which states the mandatory rule for genus Quercus explicitly: species
  within a genus are never differentiated in IBP scoring _except_ Quercus, which is split into two
  groups — "chênes sempervirens (incluant les espèces pseudo-sempervirentes comme Q. suber)" and
  "chênes caducifoliés (incluant les espèces marcescentes)". This is the source of the mandatory
  34th class.

33 genera, 34 classes counting the Quercus split — this matches the count RESEARCH.md's own read
of the document reported.

**Note on Pistacia.** Pistacia is named in the field sheet's "essences supplémentaires cas 4 et 2"
line (p. 2) as one of the 33 Factor A genera, but no Pistacia species appears in Tableau 1's
species-level list (p. 9–10) — the document's own Tableau 2 (p. 11, shrub species _not_ counted in
Factor A) lists Pistacia lentiscus and Pistacia terebinthus instead. This is a minor internal
inconsistency in the source document itself (distinct from the v3.0/v3.2 drift below), not a
transcription error here: Factor A's genus-counting rule (p. 6) says explicitly "On se limite aux
genres listés dans la définition" (limited to the genera listed in the definition), and the
definition on p. 2 includes Pistacia in the supplementary genus line. `Pistacia` is kept in the
34-class label set on that basis, flagged here so a later reader can re-check it against CNPF
directly rather than silently resolving it.

| genus (label)        | french vernacular name              | quercus group | regional note                                                                             |
| -------------------- | ----------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| Abies                | Sapin (pectiné)                     | —             | —                                                                                         |
| Acer                 | Érable                              | —             | —                                                                                         |
| Alnus                | Aulne                               | —             | —                                                                                         |
| Arbutus              | Arbousier                           | —             | —                                                                                         |
| Betula               | Bouleau                             | —             | —                                                                                         |
| Carpinus             | Charme                              | —             | —                                                                                         |
| Castanea             | Châtaignier                         | —             | Archeophyte, treated as native (p. 9)                                                     |
| Celtis               | Micocoulier                         | —             | —                                                                                         |
| Cupressus            | Cyprès (de Provence)                | —             | Archeophyte, treated as native (p. 9)                                                     |
| Fagus                | Hêtre (commun)                      | —             | —                                                                                         |
| Fraxinus             | Frêne                               | —             | —                                                                                         |
| Juglans              | Noyer (commun)                      | —             | Archeophyte, treated as native (p. 9)                                                     |
| Juniperus            | Genévrier                           | —             | J. macrocarpa / J. phoenicea counted coastal-zone only (Tableau 1 footnote)               |
| Larix                | Mélèze (d'Europe)                   | —             | —                                                                                         |
| Malus                | Pommier (sauvage)                   | —             | —                                                                                         |
| Ostrya               | Charme-Houblon                      | —             | —                                                                                         |
| Pinus                | Pin                                 | —             | P. pinea archeophyte, treated as native (p. 9)                                            |
| Picea                | Épicéa (commun)                     | —             | —                                                                                         |
| Populus              | Peuplier                            | —             | All Populus cultivars counted as native (p. 9, identification difficulty)                 |
| Prunus               | Cerisier / Merisier                 | —             | Only arborescent Prunus species count (P. avium, P. padus); shrub Prunus excluded         |
| Pyrus                | Poirier (sauvage)                   | —             | —                                                                                         |
| Quercus_deciduae     | Chênes caducifoliés                 | Deciduous     | Q. cerris, Q. petraea, Q. pubescens, Q. pyrenaica, Q. robur (marcescent species included) |
| Quercus_sempervirens | Chênes sempervirents                | Evergreen     | Q. ilex, Q. rotundifolia, Q. suber (Q. suber explicitly named "pseudo-sempervirente")     |
| Salix                | Saule                               | —             | Only arborescent Salix species count (S. alba, S. caprea, S. fragilis)                    |
| Sorbus               | Sorbier / Alisier                   | —             | —                                                                                         |
| Tamarix              | Tamaris                             | —             | —                                                                                         |
| Taxus                | If (commun)                         | —             | —                                                                                         |
| Tilia                | Tilleul                             | —             | —                                                                                         |
| Ulmus                | Orme                                | —             | —                                                                                         |
| Ceratonia            | Caroubier                           | —             | Mediterranean-specific (cas 2/4 supplementary genus)                                      |
| Cercis               | Arbre de Judée                      | —             | Mediterranean-specific (cas 2/4 supplementary genus)                                      |
| Olea                 | Olivier                             | —             | Mediterranean-specific (cas 2/4 supplementary genus)                                      |
| Phillyrea            | Filaire (à larges feuilles)         | —             | Mediterranean-specific (cas 2/4 supplementary genus)                                      |
| Pistacia             | Pistachier (lentisque / térébinthe) | —             | Mediterranean-specific (cas 2/4 supplementary genus); see Pistacia note above             |

**Version drift (open, not resolved here).** This label set is drawn from **IBP FR v3.2**
(02/02/2026), the document currently published at CNPF's own URL. This repository's own reference
documents — `docs/references/README.md` and `docs/specs/ibp-form-spec.md` — cite **IBP Fr v3.0**.
RESEARCH.md flagged this drift as Open Question 1 and recommended not resolving it silently.
Deciding which version the app follows, and correcting `docs/references/README.md` /
`docs/specs/ibp-form-spec.md` if v3.2 is adopted, belongs to Phase 2, which owns the genus list as
a real entity (D-15) — this phase only needs _a_ sourced, defensible genus list to measure against,
and v3.2's 33/34-class table is that list.

---

## 3. Image corpus and licence provenance

**Status: COMPLETE.** All 34 classes have downloaded, licence-filtered images. Six classes hit
transient network failures during assembly (three `SSLError`, one stalled S3 read, one
`ReadTimeout`) and all six recovered on retry with the resumable script — none needed a second
retry, so no class carries a `network-failure-after-retry` exclusion. See "Six transient failures,
cause by cause" below for the full account, kept separate per instruction from the two real
corpus-quality findings this plan surfaced: composition (Section 3a) and seasonal skew (Section
3b).

### Source

GBIF occurrence media (`api.gbif.org/v1/occurrence/search`), filtered server-side to
`license=CC0_1_0` and `license=CC_BY_4_0` only, `mediaType=StillImage` — the permissive,
redistributable licence D-09 requires of both the model and any dataset used to build it. This is
RESEARCH.md's
first-recommended candidate source, re-verified here rather than trusted second-hand: every
genus's licence-filtered availability was surveyed directly against the live API before any image
was downloaded (see Methodology below), and Pl@ntNet-300K/GBIF-occurrence-media was chosen over
Pl@ntNet-300K itself because the full Pl@ntNet-300K archive (hundreds of thousands of images) is
impractical to fetch inside this spike's timebox, whereas GBIF's occurrence-media API lets the
corpus be built per-class, incrementally, and licence-filtered at the query level. iNaturalist was
considered and rejected as a direct source per RESEARCH.md's own finding (mixed CC0/CC-BY/CC-BY-NC
licensing with a commercial-AI-training prohibition on the NC portion) — but iNaturalist Open Data
records that carry a CC0 or CC-BY licence are themselves mirrored into GBIF and are picked up
through the same GBIF query, filtered the same way, so the usable slice of iNaturalist is included
without needing to separate it by hand.

Retrieval date: 2026-09-22. All requests: `https://api.gbif.org/v1/occurrence/search` and
`https://api.gbif.org/v1/species/match` (for genus/species taxon-key resolution).

### Methodology

**Taxon key resolution.** GBIF's plain genus-name search (`scientificName=<genus>` or
`genus=<genus>`) is unreliable for this corpus: several CNPF genera are backbone-taxonomy homonyms
with animal genera (`Pinus`, `Salix`, `Arbutus` collide with insect/moth genera in GBIF's
backbone), which silently returns zero or wrong-kingdom results. Every genus name is resolved to
its authoritative GBIF `genusKey` via `species/match?name=<genus>&kingdom=Plantae` first, then
occurrences are queried by that numeric key, which is unambiguous.

**Aggregation to genus (D-01, RESEARCH.md Pitfall 2).** The 32 non-Quercus classes are fetched
directly by `genusKey` — GBIF's backbone taxonomy is itself genus-scoped, so every occurrence
returned already belongs to that genus, worldwide, any species, with no species-level label ever
computed or discarded. `Quercus_deciduae` and `Quercus_sempervirens` are fetched by explicit
`speciesKey`, one query per CNPF-listed oak species (5 deciduous: _Q. cerris, Q. petraea, Q.
pubescens, Q. pyrenaica, Q. robur_; 3 evergreen: _Q. ilex, Q. rotundifolia, Q. suber_, per IBP FR
v3.2 p.6's mandatory split and Table 1's species list), so no out-of-list Quercus species (e.g.
American or Asian oaks that also match a bare `Quercus` query) ever enters the corpus. Because
both fetch paths are scoped at the query itself, **zero source species were discarded as
out-of-list** — there is no post-hoc filtering step to report a discard count for.

**Geographic scope (methodological note, not yet reviewed by the user).** Occurrences are
sourced worldwide, not restricted to France or Europe, to reach a licence-filtered sample size
sufficient for fine-tuning within the timebox. Every genus surveyed had 4,200+ CC0/CC-BY
candidate occurrences worldwide (see Coverage survey below) — availability was never the
constraint; download and validation time was. This means the corpus can include, for example, an
American or Asian congener of a European genus (e.g. a non-European _Acer_ species) under the
same genus label. This is defensible for a genus-level classifier (the target is genus, not
species, per D-01) but is a scope decision worth flagging rather than asserting as obviously
correct — a later reviewer may want to re-derive stricter numbers from a Europe-restricted query.

**Licence filter and exclusion count.** The `license=` GBIF query parameter restricts results
server-side, so most non-permitted images are never returned at all rather than being fetched and
discarded. A representative exclusion count for one genus (Quercus, checked directly against the
live API 2026-09-22): `mediaType=StillImage` with no licence filter and `scientificName=Quercus`
returns considerably more candidate occurrences than the CC0_1_0 + CC_BY_4_0-filtered query used
here — the majority of the excluded volume is iNaturalist-sourced CC-BY-NC records, matching
RESEARCH.md's own finding about iNaturalist's licence structure. As a belt-and-braces check (not
the primary filter, since the server-side `license=` parameter already excludes non-permitted
records), each occurrence's own `license` field and, where present, each media item's own
`license` field are checked again in `prepare_dataset.py::fetch_candidates_for_key`, and anything
carrying `NC` or `ND` in its licence string is dropped even if it slipped through the server-side
filter.

**Per-class target.** 220 images per class (150 train / 35 val / 35 test), chosen because every
surveyed genus had thousands of CC0/CC-BY candidates available — the constraint was download and
validation time inside the spike's timebox (D-19), not source availability. 220 is comfortably
above the 30-image test-set reporting threshold (D-02) with margin for download/validation
failures.

### Coverage survey (2026-09-22, before any download)

A dry-run count of CC0_1_0 + CC_BY_4_0 `StillImage` occurrences was taken for every one of the 34
classes before downloading anything, to establish the ceiling before spending timebox on
downloads. All 34 classes cleared at least 4,200 candidate occurrences — availability was never
in doubt; see per-class counts below for what was actually retained.

### Per-class corpus status (final — all 34 classes downloaded)

| class                | train | val | test | downloaded (of target 220) |
| -------------------- | ----- | --- | ---- | -------------------------- |
| Abies                | 150   | 35  | 35   | 220                        |
| Acer                 | 150   | 35  | 35   | 220                        |
| Alnus                | 150   | 35  | 35   | 220                        |
| Arbutus              | 150   | 35  | 35   | 220                        |
| Betula               | 150   | 35  | 35   | 220                        |
| Carpinus             | 150   | 35  | 35   | 220                        |
| Castanea             | 150   | 35  | 35   | 220                        |
| Celtis               | 150   | 35  | 35   | 220                        |
| Ceratonia            | 150   | 35  | 35   | 220                        |
| Cercis               | 150   | 35  | 35   | 220                        |
| Cupressus            | 150   | 35  | 35   | 220                        |
| Fagus                | 150   | 35  | 35   | 220                        |
| Fraxinus             | 150   | 35  | 35   | 220                        |
| Juglans              | 150   | 35  | 35   | 220                        |
| Juniperus            | 150   | 35  | 35   | 220                        |
| Larix                | 150   | 35  | 35   | 220                        |
| Malus                | 150   | 35  | 35   | 220                        |
| Olea                 | 150   | 35  | 35   | 220                        |
| Ostrya               | 150   | 35  | 35   | 220                        |
| Phillyrea            | 150   | 35  | 35   | 220                        |
| Picea                | 150   | 35  | 35   | 220                        |
| Pinus                | 150   | 35  | 35   | 220                        |
| Pistacia             | 139   | 32  | 33   | 204 (below-220 target)     |
| Populus              | 150   | 35  | 35   | 220                        |
| Prunus               | 150   | 35  | 35   | 220                        |
| Pyrus                | 150   | 35  | 35   | 220                        |
| Quercus_deciduae     | 150   | 35  | 35   | 220                        |
| Quercus_sempervirens | 150   | 35  | 35   | 220                        |
| Salix                | 150   | 35  | 35   | 220                        |
| Sorbus               | 150   | 35  | 35   | 220                        |
| Tamarix              | 150   | 35  | 35   | 220                        |
| Taxus                | 150   | 35  | 35   | 220                        |
| Tilia                | 150   | 35  | 35   | 220                        |
| Ulmus                | 127   | 30  | 30   | 187 (below-220 target)     |

Every class's **raw** train count clears the 40-image usable-training threshold and every class's
raw test count clears the 30-image D-02 reporting threshold. This raw-volume picture is not the
final word — see Section 3a, which found composition problems severe enough to exclude two
classes and materially shrink the effective (non-landscape, non-herbarium, non-in-hand) sample
for every other class.

### Six transient failures, cause by cause (not merged into one bucket)

Three distinct causes were checked for every gap that appeared during assembly, per instruction
that they carry different meaning for the phase and must not be conflated:

1. **Licence scarcity** (too few CC0/CC-BY images on GBIF) — ruled out for all six. The coverage
   survey above found 4,200+ CC0/CC-BY candidates for every one of the 34 classes, including all
   six that hit a failure, before any download was attempted.
2. **Taxon-key resolution bug** (a homonym or lookup failure specific to this script) — ruled out
   for all six. `species/match?name=<genus>&kingdom=Plantae` resolves correctly for all of them
   whenever the network call itself succeeds (confirmed both during the coverage survey and on
   retry).
3. **Transient network failure** — confirmed as the cause for all six, in three different failure
   modes:
   - **Tilia, Ulmus, Cercis:** `requests.exceptions.SSLError` / `SSLEOFError: EOF occurred in
violation of protocol` against `api.gbif.org`. Each failure followed a successful request for
     the immediately-preceding class in the fetch order (e.g. Ceratonia succeeded immediately
     before Cercis failed), which rules out a sustained outage.
   - **Olea:** a connection to an S3-hosted image host (`s3-1-w.amazonaws.com`) stalled with the
     socket `ESTABLISHED`, 0% CPU, and no progress for several minutes — a slow trickle of bytes
     resetting `requests`' per-read timeout on every partial read without the transfer ever
     completing, which the process-level `timeout=` parameter does not bound (a known
     `requests`/`urllib3` limitation, not a GBIF-side problem). Fixed in
     `prepare_dataset.py::download_and_resize` by streaming with an explicit 15s wall-clock
     deadline instead of relying on the per-read socket timeout.
   - **Pistacia:** `requests.exceptions.ReadTimeout` against `api.gbif.org` (30s read timeout hit
     on a single occurrence-search page) — a different transient mode again, recovered
     unconditionally on the next run with no further failures.

All six recovered on the very next retry attempt once the resumable script was re-run — none
required a second retry, so none is labelled `network-failure-after-retry`. None of the six is a
licence-scarcity finding and none is a resolution bug; all six were pure infrastructure blips,
resolved before the corpus was considered complete.

---

## 3a. Corpus composition audit (per-genus, ~30-image sample)

**Why this section exists.** `prepare_dataset.py`'s first draft asserted, without checking, that
GBIF `StillImage` occurrence media are "specimen/observation photographs of one organism — never
stand or multi-tree survey photography." That claim was checked by eye against six images sampled
from the downloaded corpus and found false on the first sample: a landscape/stand photograph (a
hillside with roughly a dozen birches), a catkins-only seasonal shot, an in-hand detached-part
photo with no tree visible, and only two genuinely single-subject images out of six. The false
claim has been removed from the script's docstring (see `prepare_dataset.py`, corrected
2026-09-22); this section replaces the assumption with a measurement.

**Method.** For each of the 34 classes, 30 images were sampled at random (not the first N — a
fixed per-class random seed, distinct from the train/val/test split seed, was used to draw from
the full downloaded set) and classified by direct visual inspection into one of five categories:

- `usable-single-subject` — whole tree, trunk/bark close-up, leaf or branch close-up; what an
  ecologist would actually photograph in the field per D-10's single-subject scope
- `landscape-or-stand` — several trees or a habitat/scene shot where no single subject dominates;
  this is precisely the multi-tree stand case D-10 (amended) removed from this phase's scope, so
  its presence in the training corpus is itself a quality problem, not just an odd photo
- `in-hand-specimen` — a leaf, twig or fruit held in a hand, detached from the plant, no tree
  visible; plausible for teaching leaf-shape features but not what an ecologist's in-field camera
  frame looks like
- `herbarium-or-label` — a pressed, dried, mounted specimen sheet (often with a ruler, colour
  card, barcode or handwritten label), or a scanned museum record; visually nothing like a live
  phone-camera field photo
- `other-unusable` — no identifiable plant part in frame, or the composition otherwise does not
  support any of the above (e.g. a pure scenic landscape with no discernible subject)

Each of the 34 contact sheets (one image grid per genus, 30 numbered thumbnails) was inspected
directly; classifications are a single reviewer's direct visual judgement, not an automated
filter, and are therefore a measurement with normal single-rater uncertainty — not exact ground
truth, but a real check against the false assumption the script previously encoded.

**Composition-adjusted counts are estimates, not exact counts.** The "adjusted train/test" columns
below extrapolate the 30-image sample's usable rate onto the full per-class train/test counts
(e.g. a class with train=150 and a 70% usable rate is shown as adj_train≈105). This is a
sampling-based estimate with a margin of error that shrinks the smaller the sample — it is not a
substitute for classifying every downloaded image, which was explicitly out of scope for this
measurement task (plan 01-02 Task 3, coordinator guidance 2026-09-22: "do NOT start building an
image classifier to clean the corpus, and do NOT hand-delete images at scale").

| genus (label)        | usable-single-subject | landscape-or-stand | in-hand-specimen | herbarium-or-label | other-unusable | usable rate | adj. train | adj. test | verdict                                |
| -------------------- | --------------------- | ------------------ | ---------------- | ------------------ | -------------- | ----------- | ---------- | --------- | -------------------------------------- |
| Abies                | 23                    | 2                  | 5                | 0                  | 0              | 77%         | 115        | 27        | usable                                 |
| Acer                 | 21                    | 5                  | 4                | 0                  | 0              | 70%         | 105        | 24        | usable                                 |
| Alnus                | 21                    | 5                  | 4                | 0                  | 0              | 70%         | 105        | 24        | usable                                 |
| Arbutus              | 24                    | 4                  | 2                | 0                  | 0              | 80%         | 120        | 28        | usable                                 |
| Betula               | 13                    | 13                 | 4                | 0                  | 0              | 43%         | 65         | 15        | EXCLUDED (majority non-single-subject) |
| Carpinus             | 18                    | 8                  | 4                | 0                  | 0              | 60%         | 90         | 21        | usable                                 |
| Castanea             | 18                    | 2                  | 10               | 0                  | 0              | 60%         | 90         | 21        | usable                                 |
| Celtis               | 23                    | 4                  | 3                | 0                  | 0              | 77%         | 115        | 27        | usable                                 |
| Ceratonia            | 16                    | 0                  | 1                | 12                 | 1              | 53%         | 80         | 19        | marginal                               |
| Cercis               | 22                    | 2                  | 6                | 0                  | 0              | 73%         | 110        | 26        | usable                                 |
| Cupressus            | 26                    | 3                  | 1                | 0                  | 0              | 87%         | 130        | 30        | usable                                 |
| Fagus                | 21                    | 6                  | 3                | 0                  | 0              | 70%         | 105        | 24        | usable                                 |
| Fraxinus             | 22                    | 5                  | 3                | 0                  | 0              | 73%         | 110        | 26        | usable                                 |
| Juglans              | 21                    | 3                  | 5                | 0                  | 1              | 70%         | 105        | 24        | usable                                 |
| Juniperus            | 25                    | 2                  | 3                | 0                  | 0              | 83%         | 125        | 29        | usable                                 |
| Larix                | 15                    | 6                  | 1                | 0                  | 8              | 50%         | 75         | 18        | marginal                               |
| Malus                | 23                    | 2                  | 4                | 0                  | 1              | 77%         | 115        | 27        | usable                                 |
| Olea                 | 29                    | 1                  | 0                | 0                  | 0              | 97%         | 145        | 34        | usable                                 |
| Ostrya               | 25                    | 2                  | 3                | 0                  | 0              | 83%         | 125        | 29        | usable                                 |
| Phillyrea            | 9                     | 0                  | 0                | 20                 | 1              | 30%         | 45         | 10        | EXCLUDED (majority non-single-subject) |
| Picea                | 21                    | 8                  | 1                | 0                  | 0              | 70%         | 105        | 24        | usable                                 |
| Pinus                | 23                    | 5                  | 2                | 0                  | 0              | 77%         | 115        | 27        | usable                                 |
| Pistacia             | 26                    | 0                  | 3                | 0                  | 1              | 87%         | 120        | 29        | usable                                 |
| Populus              | 19                    | 7                  | 4                | 0                  | 0              | 63%         | 95         | 22        | usable                                 |
| Prunus               | 28                    | 0                  | 1                | 0                  | 1              | 93%         | 140        | 33        | usable                                 |
| Pyrus                | 25                    | 1                  | 4                | 0                  | 0              | 83%         | 125        | 29        | usable                                 |
| Quercus_deciduae     | 26                    | 0                  | 2                | 2                  | 0              | 87%         | 130        | 30        | usable                                 |
| Quercus_sempervirens | 23                    | 7                  | 0                | 0                  | 0              | 77%         | 115        | 27        | usable                                 |
| Salix                | 20                    | 3                  | 7                | 0                  | 0              | 67%         | 100        | 23        | usable                                 |
| Sorbus               | 27                    | 1                  | 2                | 0                  | 0              | 90%         | 135        | 32        | usable                                 |
| Tamarix              | 26                    | 1                  | 3                | 0                  | 0              | 87%         | 130        | 30        | usable                                 |
| Taxus                | 27                    | 1                  | 2                | 0                  | 0              | 90%         | 135        | 32        | usable                                 |
| Tilia                | 24                    | 1                  | 5                | 0                  | 0              | 80%         | 120        | 28        | usable                                 |
| Ulmus                | 23                    | 3                  | 4                | 0                  | 0              | 77%         | 97         | 23        | usable                                 |

**Two classes excluded from the usable-class count on composition grounds.**

- **Betula** — 13/30 (43%) usable-single-subject, 13/30 (43%) landscape-or-stand. Composition is
  split almost exactly between real specimen photos and forest/grove scenes with multiple birch
  trunks — the majority (17/30, 57%) of the sample is _not_ a usable single-subject image. This is
  the same stand-photo composition D-10 (amended) explicitly removed from this phase's scope; a
  corpus built to measure the single-subject case should not be more than half stand photos for
  any one genus.
- **Phillyrea** — 9/30 (30%) usable-single-subject, 20/30 (67%) herbarium-or-label. Two-thirds of
  the sampled corpus for this genus is pressed, mounted, scanned herbarium specimens — visually
  nothing like a phone-camera field photo — sourced from a natural-history-collection dataset that
  happened to clear the CC0/CC-BY licence filter. Raw download volume (220) said nothing about
  this; only visual inspection caught it.

**Two further classes flagged marginal, kept in the usable count but noted for caution.**

- **Larix** — exactly 15/30 (50%) usable-single-subject. The other half splits between
  landscape-or-stand (6) and, more strikingly, `other-unusable` (8/30, 27%) — pure scenic
  mountain-lake photographs with no discernible Larix subject in frame at all, most likely from a
  dataset of location-tagged tourist/landscape photography rather than field-identification
  photos. A 50% split is not "mostly unusable" by the letter of the exclusion rule above, but it
  is not a comfortable pass either.
- **Ceratonia** — 16/30 (53%) usable-single-subject, 12/30 (40%) herbarium-or-label. Clears the
  50% bar but carries the second-largest herbarium fraction of any class after Phillyrea; both are
  the Mediterranean-case supplementary genera (Section 2), suggesting herbarium-heavy source
  datasets may correlate with less-photographed Mediterranean taxa rather than being independent
  per-genus noise.

**What this means for the gate.** `CLASSES-USABLE` in `spike/species-recognition/data/GATE`
reflects usable **composition**, not raw download volume: 34 raw-usable classes minus the two
excluded above (Betula, Phillyrea) = **32**. Both exclusions are composition failures, not
licence, resolution, or network failures — a materially different, and better-evidenced, finding
than a raw undercount would have produced. Larix and Ceratonia remain counted but are flagged
above; a reader relying on either genus's accuracy figure in plan 04 should re-check this
section first.

**What this means for plan 04's accuracy evaluation.** The composition-adjusted test counts above
are estimates from a 30-image sample, not exact per-image classifications — but even taken as
rough estimates, most classes' _effective_ single-subject test count falls below the 30-image D-02
reporting threshold once landscape/in-hand/herbarium images are notionally excluded, despite every
class's _raw_ test count clearing it. Plan 04 evaluating accuracy against the raw (uncomposition-
filtered) corpus will measure something broader than "accuracy on a single-subject field photo" —
whatever the model does with a landscape or herbarium image in the test set is not what D-02's
top-3/95% bar is asking about. This is a decision for plan 04 to make explicitly (composition-
filter the actual test images before evaluating, or report the raw-corpus figure with this caveat
attached) rather than one this measurement task resolves by itself.

---

## 3b. Seasonal skew (from GBIF event dates)

**Why this matters.** IBP surveys are conducted in the field across the association's active
season, but Factor A specifically depends on genus-level foliage/bark recognition working under
whatever conditions the ecologist encounters — and the published schedule (Section "Spike
window") points at field tests starting **October**, i.e. autumn. A training corpus dominated by
spring flowering and summer foliage photographs, with next to no autumn representation, risks a
model that performs well in the lab measurement (Section 5, drawn from this same corpus) and
collapses in the field precisely because the visual conditions it will actually meet — turning or
fallen leaves, bare branches, autumn bark — are barely represented in training. This risk was not
named by anyone before the corpus was inspected; it is a direct consequence of building a corpus
from whatever citizen-science photos happen to be CC0/CC-BY licensed, which skew toward flowering
season (the most commonly photographed phenological stage).

**Method.** For the same 30-image-per-class sample used in Section 3a, each image's GBIF
`eventDate` was retrieved (100% coverage — all 1,020 sampled images carried a usable date) and
bucketed into meteorological seasons (winter: Dec–Feb, spring: Mar–May, summer: Jun–Aug, autumn:
Sep–Nov).

| genus (label)        | winter | spring | summer | autumn | autumn % |
| -------------------- | ------ | ------ | ------ | ------ | -------- |
| Abies                | 11     | 7      | 12     | 0      | 0%       |
| Acer                 | 15     | 15     | 0      | 0      | 0%       |
| Alnus                | 16     | 14     | 0      | 0      | 0%       |
| Arbutus              | 14     | 11     | 5      | 0      | 0%       |
| Betula               | 9      | 21     | 0      | 0      | 0%       |
| Carpinus             | 2      | 24     | 4      | 0      | 0%       |
| Castanea             | 3      | 10     | 17     | 0      | 0%       |
| Celtis               | 5      | 7      | 17     | 1      | 3%       |
| Ceratonia            | 2      | 16     | 4      | 8      | 27%      |
| Cercis               | 6      | 19     | 5      | 0      | 0%       |
| Cupressus            | 13     | 10     | 2      | 5      | 17%      |
| Fagus                | 15     | 15     | 0      | 0      | 0%       |
| Fraxinus             | 14     | 16     | 0      | 0      | 0%       |
| Juglans              | 5      | 7      | 18     | 0      | 0%       |
| Juniperus            | 12     | 18     | 0      | 0      | 0%       |
| Larix                | 8      | 8      | 14     | 0      | 0%       |
| Malus                | 0      | 18     | 11     | 1      | 3%       |
| Olea                 | 7      | 12     | 7      | 4      | 13%      |
| Ostrya               | 4      | 7      | 13     | 6      | 20%      |
| Phillyrea            | 2      | 20     | 4      | 4      | 13%      |
| Picea                | 12     | 18     | 0      | 0      | 0%       |
| Pinus                | 30     | 0      | 0      | 0      | 0%       |
| Pistacia             | 3      | 12     | 7      | 8      | 27%      |
| Populus              | 4      | 26     | 0      | 0      | 0%       |
| Prunus               | 18     | 12     | 0      | 0      | 0%       |
| Pyrus                | 3      | 20     | 7      | 0      | 0%       |
| Quercus_deciduae     | 5      | 14     | 7      | 4      | 13%      |
| Quercus_sempervirens | 2      | 17     | 8      | 3      | 10%      |
| Salix                | 3      | 27     | 0      | 0      | 0%       |
| Sorbus               | 1      | 23     | 6      | 0      | 0%       |
| Tamarix              | 12     | 12     | 5      | 1      | 3%       |
| Taxus                | 10     | 15     | 5      | 0      | 0%       |
| Tilia                | 1      | 14     | 15     | 0      | 0%       |
| Ulmus                | 2      | 28     | 0      | 0      | 0%       |

**Finding.** 23 of 34 classes (23/34) have **zero** autumn-dated
images in their 30-image sample: Abies, Acer, Alnus, Arbutus, Betula, Carpinus, Castanea, Cercis, Fagus, Fraxinus, Juglans, Juniperus, Larix, Picea, Pinus, Populus, Prunus, Pyrus, Salix, Sorbus, Taxus, Tilia, Ulmus. Every temperate genus in the corpus
shows this pattern; the only classes with meaningful autumn representation are the Mediterranean
supplementary genera (Ceratonia, Pistacia both 27%; Ostrya 20%; Cupressus 17%; Olea, Phillyrea,
Quercus_deciduae 13%), and even the highest, Ceratonia at 27%, is a small
minority of that genus's sample. This is a corpus-wide skew, not a per-genus anomaly — it affects
every class this phase measured, and it compounds the D-16 gap already recorded in Section 6/9 (no
field-photo validation available): the public-dataset accuracy figure this phase produces is not
just unvalidated against field conditions in general, it is specifically thin on the exact season
the field tests are scheduled to start in.

**What this means for the ADR.** This is a new, previously-unstated confidence cap on any accuracy
figure this phase reports (Section 5), additive to the two gaps Section 9 already records
(no field-photo validation, unconfirmed benchmark devices). It should be recorded as its own
caveat rather than folded into the existing field-photo gap, because it is a property of the
_training_ corpus's seasonal composition, not only of the _validation_ step's absence — even a
full field-photo validation pass would not fix a model trained on almost no autumn imagery.

---

## 4. Model candidates and on-disk size

**Status: complete (plan 01-04).**

**Backbone: MobileNetV3-Small, the primary candidate named in RESEARCH.md's Standard Stack.**
Loaded via `tensorflow.keras.applications.MobileNetV3Small` (`spike/species-recognition/train/finetune.py`),
ImageNet-pretrained, `include_preprocessing=True` so the model's own input-scaling
(raw `[0,255]` pixel floats in, no separate `preprocess_input` call needed) is baked into
the exported graph rather than left to drift between training, export and the on-device
harness.

**Second candidate (EfficientNet-Lite0) was not run.** MobileNetV3-Small trained,
exported and evaluated cleanly inside a small fraction of the remaining timebox (D-19):
total wall-clock for the two training attempts below was under 14 minutes on a 10-core
CPU with no GPU, and export/evaluation added only a few more minutes. The time saved was
spent instead on tuning MobileNetV3-Small itself (see "Two training attempts" below) and
on the export-quantisation investigation, both of which materially changed the reported
numbers. Per D-19 ("one candidate model measured properly beats two measured badly"),
that tuning and the quantisation-parity investigation were judged the better use of the
remaining time than a second, equally shallow candidate. This is recorded as a deliberate
timebox choice, not an oversight.

**Licence chain (D-09 — permissive, redistributable, traced end to end):**

| Link | Source | Licence |
|------|--------|---------|
| Architecture (MobileNetV3-Small) | `tensorflow.keras.applications.MobileNetV3Small` — TensorFlow/Keras, based on Howard et al., "Searching for MobileNetV3" (ICCV 2019) | Apache License 2.0 (TensorFlow's own licence; the architecture itself is published research, not separately licensed) |
| Pretrained weights | Fetched over HTTPS by the official `tf.keras.applications` API from `https://storage.googleapis.com/tensorflow/keras-applications/mobilenet_v3/` (Google-hosted, no custom download URL — satisfies threat T-01-10's mitigation directly), trained on ImageNet (ILSVRC-2012) | Apache License 2.0 (ships as part of the `tensorflow` package's official weight distribution) |
| Training images | GBIF occurrence media, CC0-1.0 / CC-BY-4.0 only, licence-filtered at the query level (Section 3) | CC0-1.0 / CC-BY-4.0 per image, recorded per-image in `data/splits/manifest.csv` |

All three links are permissive and redistributable; no restrictive licence enters the
chain at any point, so D-09 is satisfied by construction rather than asserted after the
fact.

**Training configuration.** Class order read from `train/genus_labels.txt` (34 classes,
never a directory listing — threat T-01-11's mitigation), input resolution 224x224,
batch size 32, Adam optimiser, `sparse_categorical_crossentropy` loss, augmentation
(train split only: random horizontal flip, random brightness ±0.15, random contrast
0.85–1.15). Two-phase recipe: freeze the backbone and train a `Dropout(0.2)` +
`Dense(34, softmax)` head, then unfreeze the trailing backbone layers and fine-tune at a
lower learning rate. Train/val split sizes: 5,066 train images / 1,182 val images across
all 34 classes (Pistacia and Ulmus below the 220-image target per Section 3, everyone
else at the target); 0 images were dropped by the PIL-verify corruption filter in either
split — the corpus decoded cleanly.

**Two training attempts were run; the second is the one exported and evaluated.** The
first (12 head-only epochs + 10 fine-tune epochs unfreezing the last 30 backbone layers,
lr 1e-3 → 1e-5) reached validation top-1/top-3 of 0.335/0.553 and had clearly plateaued
in validation while training accuracy kept climbing (val_top3 moved only 0.548→0.553→
0.555→...→0.553 across the ten fine-tune epochs while train_top3 rose 0.50→0.61). A
second attempt (20 head-only epochs + 15 fine-tune epochs, unfreezing the last 60
backbone layers for more fine-tuning capacity, lr 1e-3 → 3e-5) reached validation
top-1/top-3 of **0.3816 / 0.5897**, still rising slightly at the final epoch, and was
kept as the trained model. Total training wall-clock: 225.5s (attempt 1) + 575.7s
(attempt 2) ≈ 13.4 minutes, all CPU-only (no GPU available in the spike environment).

**Validation figures are a training sanity check, not the reportable result.**
`validation_top1_accuracy = 0.3816`, `validation_top3_accuracy = 0.5897`
(`train/training_report.json`), measured on the val split plan 02 wrote. These numbers
exist to confirm training converged at all; the reportable per-genus figures the ADR
actually cites are the held-out **test**-split numbers in Section 5, measured by a
completely separate script (`eval/evaluate_accuracy.py`) that never touched train or val
data.

**Quantisation scheme: float16, not int8 dynamic-range — chosen after measuring, not
assumed.** `train/export_tflite.py` tried both. Post-training int8 dynamic-range
quantisation (`tf.lite.Optimize.DEFAULT` with no `target_spec.supported_types` override —
weights quantised to int8, activations computed in float32) produced a smaller file
(1,162,304 bytes) but failed this plan's own export-parity requirement: only **79.4%**
top-1 agreement between the trained model and the exported one on a 68-image sample
(2 images/class), with individual class probabilities shifting by as much as 2x on the
same predicted class in a manual spot-check (0.211 → 0.417) and outright top-1 label
flips. That is a real accuracy cost of quantisation, not measurement noise — plausibly
sharper here than it would be for a more confident model, because Section 3a/3b's
composition and seasonal-skew problems already push many of this model's class
probabilities close together, and int8 rounding is exactly what flips a close call.
Float16 quantisation (`target_spec.supported_types = [tf.float16]`) gave **100%** top-1
agreement (68/68) on the same sample. Given the plan's own instruction to verify parity
"before trusting it" rather than assume a conversion is safe, float16 is what
`export_tflite.py` actually ships.

**Exported file: `spike/species-recognition/train/genus_classifier.tflite`, 2,000,768
bytes (≈1.91 MiB / 2.0 MB).** Output layer has exactly 34 classes, in `genus_labels.txt`
order, confirmed both by this plan's own automated verify step and by a direct
interpreter check. For reference, the unquantised (no `Optimize.DEFAULT`) conversion of
the same trained model is 3,843,364 bytes (≈3.7 MiB) — float16 is roughly 52% of that,
int8 dynamic-range would have been roughly 30% of it at the accuracy cost measured above.

**This measured size is a finding that bears directly on D-07/D-08, without re-deciding
either.** D-07 (locked) chose a separate first-launch download specifically to keep the
app binary light on the stores; D-08 (locked) added an explicit "model not present yet"
state as the cost of that choice. RESEARCH.md's own assumption A1 flagged the on-disk
size as unverified and exactly this kind of number to settle. At 2.0 MB, this model is
comfortably in the range that could instead be bundled directly in the app binary — many
mobile app binaries already ship tens of megabytes of assets — which would remove the
download step, the on-device cache-path handling (`Paths.document/models/genus_classifier.tflite`,
Section 8) and the model-unavailable UI state entirely. **This document does not
re-decide D-07 or D-08** — both are locked user decisions and the ADR (plan 01-06) is
where any change to them is proposed to the user, not here. This paragraph exists so the
ADR has the measured number in front of it when that question is raised.

---

## 5. Per-genus accuracy — public held-out test split

**Status: complete (plan 01-04).**

**Source model:** `spike/species-recognition/train/genus_classifier.tflite` (2,000,768 bytes,
Section 4). **Test split:** the held-out test manifests plan 02 wrote
(`spike/species-recognition/data/splits/<class>/test.txt`), 1,183 images across 34 classes,
never touched during training or validation. **Measured:** 2026-09-23, via
`spike/species-recognition/eval/evaluate_accuracy.py`, writing
`eval/results/per_genus_accuracy.csv`.

**Composition-filtering decision (explicit, per Section 3a's hand-off to this plan): NOT
applied. The table below evaluates the raw test split, not a composition-filtered
subset.** Justification: composition-filtering the actual 1,183 test images would require
the same manual, per-image visual classification Section 3a's 30-image-per-class contact-
sheet audit did — at full test-split scale, not a sample — which is exactly the
"hand-classify images at scale" work plan 02's coordinator guidance explicitly ruled out
of scope for this measurement task ("do NOT start building an image classifier to clean
the corpus, and do NOT hand-delete images at scale"). Beyond the scope objection, the
raw results below make the practical case moot: every genus falls well short of the 95%
bar (the closest, Olea, misses by a single image — see "Resolution limit" below), so a
composition-adjusted subset — which by Section 3a's estimates would typically remove
20–30% of a class's images, not more — would need an implausibly large accuracy swing to
change the go/no-go picture for the great majority of genera. Section 3a's adjusted-count
estimates remain the correct **interpretive lens** for reading the table below: a genus
with a lower usable-composition rate (Betula 43%, Phillyrea 30%, Larix 50%, Ceratonia
53%) is being scored partly against images that are not a single-subject field photo at
all, and its number below should be read with that in mind rather than taken as a clean
single-subject figure.

**Per-genus top-1 / top-3 accuracy, all 34 classes (D-03 — no single overall figure is
computed or presented anywhere in this section):**

| genus (label)         | test n | top-1 hits | top-1 acc | top-3 hits | top-3 acc | clears 95% bar | status   |
| ---------------------- | -----: | ---------: | --------: | ---------: | --------: | :-------------: | -------- |
| Abies                  |     35 |         16 |    45.71% |         21 |    60.00% | No               | measured |
| Acer                   |     35 |          5 |    14.29% |          9 |    25.71% | No               | measured |
| Alnus                  |     35 |         11 |    31.43% |         19 |    54.29% | No               | measured |
| Arbutus                |     35 |         19 |    54.29% |         28 |    80.00% | No               | measured |
| Betula                 |     35 |         15 |    42.86% |         18 |    51.43% | No               | measured |
| Carpinus               |     35 |         13 |    37.14% |         18 |    51.43% | No               | measured |
| Castanea                |     35 |         13 |    37.14% |         18 |    51.43% | No               | measured |
| Celtis                  |     35 |         11 |    31.43% |         17 |    48.57% | No               | measured |
| Cupressus               |     35 |         13 |    37.14% |         26 |    74.29% | No               | measured |
| Fagus                   |     35 |         18 |    51.43% |         25 |    71.43% | No               | measured |
| Fraxinus                |     35 |          2 |     5.71% |          8 |    22.86% | No               | measured |
| Juglans                 |     35 |          5 |    14.29% |         15 |    42.86% | No               | measured |
| Juniperus               |     35 |          9 |    25.71% |         21 |    60.00% | No               | measured |
| Larix                   |     35 |         15 |    42.86% |         19 |    54.29% | No               | measured |
| Malus                   |     35 |         19 |    54.29% |         25 |    71.43% | No               | measured |
| Ostrya                  |     35 |          8 |    22.86% |         12 |    34.29% | No               | measured |
| Pinus                   |     35 |         15 |    42.86% |         26 |    74.29% | No               | measured |
| Picea                   |     35 |         12 |    34.29% |         23 |    65.71% | No               | measured |
| Populus                 |     35 |          6 |    17.14% |         14 |    40.00% | No               | measured |
| Prunus                  |     35 |         11 |    31.43% |         17 |    48.57% | No               | measured |
| Pyrus                   |     35 |          7 |    20.00% |         15 |    42.86% | No               | measured |
| Quercus_deciduae        |     35 |         14 |    40.00% |         21 |    60.00% | No               | measured |
| Quercus_sempervirens    |     35 |         13 |    37.14% |         22 |    62.86% | No               | measured |
| Salix                   |     35 |         13 |    37.14% |         21 |    60.00% | No               | measured |
| Sorbus                  |     35 |         13 |    37.14% |         22 |    62.86% | No               | measured |
| Tamarix                 |     35 |         18 |    51.43% |         23 |    65.71% | No               | measured |
| Taxus                   |     35 |         16 |    45.71% |         24 |    68.57% | No               | measured |
| Tilia                   |     35 |          9 |    25.71% |         21 |    60.00% | No               | measured |
| Ulmus                   |     30 |          0 |     0.00% |          5 |    16.67% | No               | measured |
| Ceratonia               |     35 |         23 |    65.71% |         30 |    85.71% | No               | measured |
| Cercis                  |     35 |         15 |    42.86% |         23 |    65.71% | No               | measured |
| Olea                    |     35 |         21 |    60.00% |         33 |    94.29% | No               | measured |
| Phillyrea               |     35 |         21 |    60.00% |         31 |    88.57% | No               | measured |
| Pistacia                |     33 |         16 |    48.48% |         27 |    81.82% | No               | measured |

**0 of 34 genera clear the top-3 95% bar (D-02, D-04). 34 miss it. 0 could not be
assessed** (every class had a raw test count comfortably above the 30-image reporting
threshold — the `insufficient-samples`/`no-samples` statuses this script supports never
triggered on this corpus; see `evaluate_accuracy.py`'s status logic for what would happen
if a future corpus revision produced a thinner class). **The partial-go column (D-04) is
therefore empty in its useful sense: there is no genus for which this document can
recommend enabling suggestions while manual entry stays default for the rest.** Whether
that reads as a full no-go or is qualified further is the ADR's call (plan 01-06), not
this document's — this section records the measurement, not the decision.

**Resolution limit (statistical honesty at ~30–35 samples/class).** At n=35, clearing
95% requires at least 34/35 correct (97.14%) — 95.00% itself is not achievable at exactly
this sample size, so "clears the bar" in practice meant "at most one top-3 miss out of
35." **Olea is the sharpest illustration: 33/35 (94.29%), exactly one image short of
clearing.** A single different test image could have flipped that genus's row. Every
percentage in the table above should be read with its raw hit/sample count alongside it,
not in isolation — a 94% on 35 images and a 94% on 350 images are not the same strength
of evidence, and this corpus only ever offers the former.

**Confidence-band analysis (D-12 — strong/medium/weak bands from measurement, not
invented round numbers).** This paragraph's one pooled-across-all-predictions figure is
context for the confidence-threshold computation below, not a per-genus result and not a
decision input — D-03's per-genus table above is the only accuracy figure this document
treats as a result. Across all 1,183 test predictions (`eval/results/confidence_bands.json`),
pooled top-1 accuracy was 36.77% and top-1 confidence separated correct from incorrect
predictions in a real, usable way: precision (fraction correct) stays at or above 90%
only for predictions with confidence ≥ **0.799**, and stays at or above 50% down to
confidence ≥ **0.280**. Proposed cut points and their cost in each direction:

- confidence ≥ 0.799 ("strong"): n=133 of 1,183, 120 correct, 90.2% accuracy in-band
- confidence 0.280–0.799 ("medium"): n=609 of 1,183, 251 correct, 41.2% accuracy in-band
- confidence < 0.280 ("weak"): n=441 of 1,183, 64 correct, 14.5% accuracy in-band

At these cut points, "strong" is a genuinely reliable label (90.2% correct when shown) but
covers only 133/1,183 (11.2%) of predictions — most predictions this model makes would be
labelled medium or weak, which is consistent with the per-genus table above rather than
contradicting it. The cost of the strong threshold: some correct predictions (of the
251+64=315 correct predictions below it) are shown as medium/weak despite being right —
a conservative failure mode (the ecologist under-trusts a correct suggestion) rather than
the reverse. The cost of the weak threshold: 64 of 441 weak-band predictions (14.5%) are
still correct, so "weak" is not "always wrong," only "usually wrong" — consistent with
showing it as a hedge rather than suppressing it outright. These are proposed cut points
for plan 06 to use, not a claim that they are optimal; they are the first data-derived
candidates rather than round numbers picked without evidence.

**Candidate-ordering observation (D-11 — is candidate 2/3 a plausible neighbour or
noise?).** Of 748 wrong top-1 predictions, the true genus appeared at rank 2 in 155
(20.7%), at rank 3 in 107 (14.3%), and was absent from the top-3 entirely in 486 (65.0%)
— so when the model is wrong, roughly two-thirds of the time the correct answer isn't in
the candidate list at all, and about one time in three it's the second or third
candidate. The most frequent true→predicted confusion pairs
(`eval/results/candidate_ordering_sample.json`) are a mixed signal: some are
botanically coherent near-neighbours that a plausible-candidate-list design would want —
Picea↔Abies (conifers, both 4–5 count each direction), Juniperus↔Tamarix (7 and 6) — while
others look like generic visual confusion with no obvious taxonomic relationship —
Salix→Olea (8), Prunus→Arbutus (6), Ceratonia→Arbutus (6). **This is not a clean "the
candidate list is useful" result nor a clean "it's noise" result — it is a genuinely mixed
one, and the ADR should not claim more consistency here than the data shows.**

**The three corpus caveats from plan 02 apply in full to every number in this section, not
diluted by the measurement step:**

1. **Composition.** See "Composition-filtering decision" above and Section 3a. The raw
   corpus is not reliably single-subject; Betula and Phillyrea were already excluded from
   `CLASSES-USABLE` on this basis, and every other class's effective single-subject rate is
   below its raw count. This section's figures are raw-corpus figures, by explicit choice,
   not composition-filtered ones.
2. **Seasonal skew.** See Section 3b. 23 of 34 classes had zero autumn-dated images in
   their composition-audit sample, while the field-test window starts in October. A model
   trained on this corpus has seen almost no autumn foliage/bark for most genera; nothing
   in this section's measurement corrects for that, because the correction would require
   autumn-dated training data this corpus does not have.
3. **No field photographs.** See Section 6. This section is a public-dataset (lab) figure
   only. The field-validation half of D-16 was not performed — `no-field-photos` was the
   answer at the Task 1 checkpoint (plan 02) and remains true here; no field photo set was
   supplied before this plan ran either.

**No go/no-go recommendation appears in this section.** This document records what was
measured; the go/no-go and its terms belong to the ADR in plan 01-06.

---

## 6. Per-genus accuracy — field photographs

**Status: PROVISIONAL — still no field photos supplied (D-16 gap, confirmed unchanged at plan 04).**

No field photograph set was available at the time of the Task 1 checkpoint (2026-09-22); the
answer was `no-field-photos`. `spike/species-recognition/data/field/` remained empty when plan 04
ran (2026-09-23) — no field photographs were dropped in before this plan's evaluation. This spike
therefore reports the public-dataset figure (Section 5) only. The field-validation half of D-16 —
the step that catches lab figures collapsing under real conditions — was not performed in this
round, and given Section 5's result (0 of 34 genera clear the bar on the lab figure alone), a field
pass would in any case only be able to make the picture worse, not better — there is no lab-passing
genus for field validation to confirm or refute yet.

This section stays empty rather than being marked not-applicable. If field photographs are
supplied and dropped into the gitignored `spike/species-recognition/data/field/` before the ADR is
written, this section can still be filled in without restructuring the document. If it remains
empty when the ADR is written, the ADR must record this gap plainly as a stated limit on how much
weight the go/no-go can carry — not glossed over.

_(Filled by plan 04 if field photographs become available before the ADR is written; none were
supplied as of 2026-09-23.)_

---

## 7. On-device inference latency

**Status: HARNESS READY, MEASUREMENT NOT YET RUN (`GATE-MEASURE: READY`, plan 05 Task B).**

The only latency figures currently on record anywhere in this document (Section 8, iPhone 15 Pro,
preprocess ms median 77.9 / worst 93.2, inference ms median 4.8 / worst 13.7) are from
`device-harness`'s ORIGINAL pipeline-proof pass — a stock ImageNet classifier
(`mobilenet_v1_1.0_224_quant.tflite`, 2.0 MB, uint8 quantised), not the fine-tuned, PROMOTED
genus classifier this phase's go/no-go actually needs timed. **They must not be cited as this
model's latency.** The promoted model (`genus_classifier.tflite`, plan 04's iteration 4,
EfficientNet-B0, float16, 8,238,676 bytes — over 4x the stock model's size, a different backbone
entirely) has never been timed on any device.

**What plan 05 completed this session (Task B, software side):** the harness is re-wired to load
and time the promoted genus model instead of the stock one --
`spike/species-recognition/device-harness/assets/models/genus_classifier.tflite` and
`assets/genus_labels.txt` are byte-identical copies of the canonical `train/` files;
`src/inference.ts` gained a float32-in/float32-out (`runGenusSample`) path matching the genus
model's actual input/output dtypes (the stock model's uint8 path is unchanged, kept only as a
regression check); `App.tsx` now runs a 1-discarded-warm-up-plus-10-timed-run protocol with
separate ONLINE and AIRPLANE MODE buttons (D-06), reports median/p95/worst for preprocess,
inference and their sum, and states a live pass/fail verdict against D-05's 3s budget on the
total; `resultsLog.ts`'s CSV gained `network_state`, `run_index` and `total_ms` columns and
reports top-3 as genus label names, not indices. `npx tsc --noEmit` passes cleanly on the harness.
Full detail: `spike/species-recognition/device-harness/README.md`'s "Run sheet for measurement
day" section.

**What did not happen, and why this section is not filled with numbers.** The measurement itself
requires the phone physically connected, unlocked and Auto-Lock disabled — this is a blocking
human checkpoint (RESEARCH.md Pitfall 4: a simulator or an idle-paired device reports nothing
representative). At the time this section was written, `xcrun devicectl list devices` showed the
only real device on hand (iPhone 15 Pro, UDID `00008130-001829D822F2001C`) in state
`available (paired)`, not `connected` — the exact state the plan's own checkpoint instruction
flags as "the link was idle" and unusable for a build. No benchmark run was attempted against
this state; substituting a Simulator run would measure this laptop's own silicon, not the
observers' hardware, and was explicitly not done (Pitfall 4 applies to the harness author as much
as to a future reader). This section stays a "not yet run" statement rather than a number obtained
under conditions the plan itself rules out.

**Once the device is connected and the run sheet is followed, this section should be filled with:**
per network state (online, airplane), median/p95/worst preprocess/inference/total ms, the device
model and OS version read from the device itself, a per-device D-05 verdict on the total, and the
flagship-vs-D-18-floor caveat Section 1/8 already establish for this same iPhone 15 Pro. Android
remains unmeasured by user decision (Section 1/9); this section should record that plainly if no
Android run happens either, rather than leaving a silent blank.

---

## 8. Native integration notes

**Status: filled by plan 01-03 (device-harness build), ahead of schedule at the coordinator's
direction, since the findings below are exactly what Phase 3's implementation estimate needs.**
Full detail and file-level citations live in
`spike/species-recognition/device-harness/README.md`; `spike/species-recognition/device-harness/GATE`
carries the machine-checkable summary (`GATE-HARNESS: PASS`, `RUNTIME: react-native-fast-tflite@3.0.1`,
`RUNTIME-SUBSTITUTION: no`).

**Runtime result: the primary recommendation builds, links and runs on real hardware.**
`react-native-fast-tflite` + `react-native-vision-camera` (RESEARCH.md's primary pick, no
ONNX-fallback substitution needed) compile against Expo 57.0.24 / RN 0.86.3 and, once the four
findings below were fixed, ran a full 10-pass benchmark on a real iPhone 15 Pro (iOS 27.0):
preprocess ms median 77.9 / worst 93.2, inference ms median 4.8 / worst 13.7 — comfortably inside
the 3s D-05 budget on this device. **This device is a flagship, not the D-18 low-spec floor —
treat these figures as an optimistic ceiling, not a representative reading; plan 05 must repeat
this on lower-spec hardware before the ADR can cite a latency number with confidence.** Android
was not run on real hardware this session (no device connected, by user decision this milestone);
the Android build itself succeeded (`./gradlew assembleDebug`, `BUILD SUCCESSFUL in 9m 1s`) with
the same runtime and no substitution, so the runtime question is answered for Android even without
a device run.

**Finding 1 — `react-native-vision-camera@5.2.3` ships no Expo config plugin.** RESEARCH.md's
Pattern 2 example (a bare `"react-native-vision-camera"` string in `app.json`'s `plugins` array)
fails `expo prebuild` immediately — no `app.plugin.js` exists in the installed package, unlike
earlier v3/v4 releases of this library. **Fix, ~20 min:** a project-local config plugin
(`plugins/with-vision-camera-permissions.js`, `withInfoPlist`/`withAndroidManifest`) injecting the
camera permission strings directly, following the same local-plugin convention
`mobile/plugins/with-scene-delegate.js` already establishes in this repo. Native linking itself is
unaffected (autolinking, not the `plugins` array). **Actionable for Phase 3:** budget for this
plugin, or re-check whether a later `react-native-vision-camera` release restores it.

**Finding 2 — a stale `Podfile.lock` path breaks the build if `pod install` runs between package
installs rather than after all of them.** The first `pod install` (right after installing the
TFLite/camera runtimes) resolved `expo-constants`'s path through a transient nested
`node_modules/expo/node_modules/expo-constants` copy that a later `expo install` call deduped
away, breaking the build with a misleading `PrivacyInfo.xcprivacy couldn't be opened` error (points
at a resource bundle, not the actual cause). **Fix, ~10 min diagnosis + 43s reinstall:** delete
`ios/Pods`/`ios/Podfile.lock` and run `pod install` once, after every package install is done.
**Actionable for Phase 3:** sequence dependency setup so `pod install` is the last step, not
interleaved with `npm install`/`expo install` calls.

**Finding 3 — `JAVA_HOME` unresolved blocks the Android build outright.** Homebrew's `openjdk@17`
was installed but not symlinked into `/Library/Java/JavaVirtualMachines`, so Gradle failed with
"Unable to locate a Java Runtime" until `JAVA_HOME` was exported explicitly. **Fix:** added to
`~/.zshrc`, mirroring plan 01-01's existing `ANDROID_HOME` export (same low-risk precedent,
Threat T-01-03, disposition accept). **Actionable for Phase 3:** document this environment
requirement in the mobile build setup instructions, since it is easy to hit on any machine with a
similarly unlinked JDK.

**Finding 4 — iOS 26+'s scene-lifecycle-adoption crash is invisible on the Simulator and only
appears on a real device.** The harness built and ran cleanly in the iOS Simulator; the very first
real-device install crashed instantly (`EXC_BREAKPOINT`/`SIGTRAP` in
`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) — iOS 26+ kills at launch any app
built against the new SDK that has not adopted the UIKit scene life cycle. `mobile/` already
carries a fix for this exact issue (`mobile/plugins/with-scene-delegate.js`); the harness had never
needed an equivalent until a real device was reachable. **Fix:** copied that plugin verbatim, added
the matching `UIApplicationSceneManifest`/`UISceneDelegateClassName` block to the harness's
`app.json` (identical shape to `mobile/app.json`). Diagnosed with no jailbreak and no Xcode UI via
`xcrun devicectl device info files --domain-type systemCrashLogs` to list crash reports and
`device copy from` to pull the `.ips` file directly off the device (a JSON header line + a JSON
body). **Actionable for Phase 3, the most important finding here:** this plugin is not optional
for any iOS 26+/Xcode 27 native build — it must ship with the species-recognition feature's native
integration from day one, not be discovered on first real-device test as it was here. **This
finding is also the clearest argument for why D-18's real-hardware requirement exists at all:** a
Simulator-only test suite would have reported this harness as fully working while it silently
could not run on a single real handset.

**Non-blocking caveat.** `npx expo-doctor` flags `react-native-fast-tflite` "Untested on New
Architecture" per React Native Directory metadata. The library is Nitro-Modules-based (JSI, not
the legacy bridge) and therefore New-Architecture-native by construction; nothing in either build
surfaced an actual New Architecture failure. Worth one line in the ADR as an unresolved-but-minor
caveat.

**Debug-over-Metro is unreliable when the dev machine's own network is the same device's Personal
Hotspot.** Early real-device attempts (Debug config, Metro-served JS bundle) white-screened and
were killed by iOS; root cause was this development Mac's sole network interface being tethered
through the same iPhone's Personal Hotspot (`172.20.10.0/28`, macOS-flagged `constrained`) — the
dev-server round trip went back to the device it was serving. Not a Phase-3-relevant finding on
its own (Phase 3 ships Release builds, not Metro-served debug builds, to end users), but the
resolution is: the latency figures above are from a **Release** build (JS bundle embedded, no
runtime packager dependency), which is also the more honest basis for a 3-second user-facing
budget than a debug dev-server round trip would have been.

---

## 9. Recorded gaps and confidence caveats

**Corpus gate (plan 01-02).** `spike/species-recognition/data/GATE` reads:

```
GATE-CORPUS: PASS
CLASSES-USABLE: 32
```

32 of 34 classes clear both the raw usable-training threshold and the composition-adjusted
majority-usable bar (Section 3a); Betula and Phillyrea are excluded on composition grounds
(majority landscape/stand and majority herbarium-sheet content respectively), not on licence,
resolution, or network-failure grounds. Plan 01-04 refuses to run without a first line reading
exactly `GATE-CORPUS: PASS` — this token is written verbatim here and into `01-02-SUMMARY.md` so
the committed record and the machine-readable gate file cannot drift apart.

Beyond the gate itself, several further gaps and confidence caveats are recorded below.

**1. The stand-photo case is not measured at all (D-10, amended 2026-09-22).** The original
decision was to measure both a single subject and a stand photo containing several trees. Research
found no licence-clean, ground-level multi-tree detector covering CNPF genera and no suitable
labelled dataset — the nearest candidates are SilvaScenes (Quebec species, licence unconfirmed) and
ForTrunkDet (CC-BY, but only Eucalyptus and Pinus). Building a detector from scratch is a
multi-week effort, not a 2–3 day spike. The ADR records the stand case as out of reach for this
milestone, citing these missing datasets by name. This document carries no stand-case number, valid
or otherwise.

**2. The field-photograph validation half of D-16 was not performed in this round.** See Section 6.
No field photo set was supplied at the Task 1 checkpoint (`no-field-photos`), and none had been
supplied by the time plan 04 ran either; the accuracy figure in Section 5 is a public-dataset
figure only, without the field-condition validation pass D-16 calls for. Given Section 5's result
(0 of 34 genera clear the bar on the lab figure), a field pass would only be able to confirm or
worsen an already-failing picture, not rescue it — there is nothing lab-passing left for field
validation to validate. This is a provisional gap in form; in substance, plan 04's result makes it
largely moot for this milestone.

**3. The benchmark-device pair is unconfirmed.** See Section 1. Latency figures in Section 7 are
measured against a documented floor, not against the observers' real phones. This caps confidence
in the latency evidence until the association confirms a device pair.

**4. The device-harness native-integration proof (Section 8) ran on a flagship, not the documented
floor, and covers iOS only.** The iPhone 15 Pro used was the only real device reachable during plan
01-03's session; no real Android device was connected, by the user's explicit decision for this
milestone. The Android build succeeded (`./gradlew assembleDebug`), so the runtime question is
answered for Android, but no real Android latency number exists anywhere in this document. Plan 05
owes both a lower-spec iOS reading and a first real Android reading.

**5. D-06 (on-device, no network in the inference path) is an architectural guarantee by code
inspection, not an observed airplane-mode result.** `spike/species-recognition/device-harness/src/`
makes no network call anywhere in its load/preprocess/inference path — verifiable by reading the
source — but the harness's real-device session did not repeat the airplane-mode test this plan's
own instructions call for once real hardware finally became reachable (device access was
intermittent and prioritised toward capturing any real benchmark numbers at all). Plan 05 should
close this explicitly with the device physically in airplane mode during a run.

**6. The corpus is not composition-filtered before evaluation — resolved by plan 01-04, not left
open.** See Section 3a and Section 5's "Composition-filtering decision." A 30-image-per-class
visual audit found the raw GBIF corpus is NOT reliably single-subject — two classes (Betula,
Phillyrea) were excluded from the usable-class count entirely on composition grounds, and every
other class's _effective_ single-subject sample is materially smaller than its raw download count
suggests. Section 3a left the filtering decision to plan 04 rather than resolving it; plan 04
decided explicitly **not** to composition-filter the test images (manual per-image classification
at full test-split scale is the same "hand-classify at scale" work plan 02's coordinator guidance
ruled out, and every genus already misses the 95% bar by a wide margin except Olea, which misses
by exactly one image — no plausible composition-filtered subset changes that picture). Section 5's
per-genus figures are raw-corpus figures by this explicit choice; a lower composition-usable rate
(Betula 43%, Phillyrea 30%, Larix 50%, Ceratonia 53%, Section 3a) should be read as a caveat on
that genus's row, not as a hidden filter already applied.

**7. The training corpus is seasonally skewed away from autumn.** See Section 3b. 23 of 34 classes
have zero autumn-dated images in their sample; field tests are scheduled to start in October. This
is a confidence cap on top of gap 2 above (no field-photo validation) — even a full field-photo
pass would not correct a model trained on almost no autumn imagery, so this is recorded as its own
caveat, not folded into gap 2.

**8. A source-document inconsistency was found while transcribing the genus list (plan 01-02, not
a spike-corpus gap but worth carrying forward).** See Section 2. The Factor A genus definition
(IBP FR v3.2 p.2) names Pistacia as one of the 33 genera, but no Pistacia species appears in the
same document's Table 1 (native species list) — its species are listed instead under Table 2
(shrub species not counted in Factor A). `Pistacia` was kept in the 34-class label set per the
genus-level definition on p.2, flagged for a later reader to re-check against CNPF directly.

**9. First-hand confirmation of the v3.0/v3.2 methodology-version drift (plan 01-02, informational
only — out of scope for this phase to resolve).** Retrieving the current IBP FR v3.2 PDF directly
(Section 2) to transcribe the genus list is itself first-hand evidence that CNPF's live, currently
published document is v3.2 while this repository's own reference documents cite v3.0 — the same
drift Phase 1.1 exists to resolve. Noted here for traceability since this plan is where the v3.2
PDF was actually opened and read; no action taken on it beyond what Section 2 already records, per
instruction that resolving the drift is out of scope for this plan.

**10. No genus clears the D-02/D-04 top-3 95% bar on the lab figure (plan 01-04).** See Section 5.
0 of 34 genera cleared it; the closest, Olea, missed by a single test image (33/35, 94.29%, versus
the 34/35 needed). This is the central finding this plan exists to produce — recorded here for
traceability alongside the other caveats, not as a decision (the ADR in plan 01-06 makes the
decision).

**11. The exported model's on-disk size (2.0 MB) materially weakens the premise behind D-07's
separate-download choice (plan 01-04).** See Section 4. D-07 (locked) chose to download the model
on first launch rather than bundle it, specifically to keep the app binary light on the stores;
D-08 (locked) added an explicit model-unavailable UI state as the cost of that choice. At 2.0 MB,
this model is well within the range many app binaries already ship as bundled assets, which would
let a future implementation remove the download flow, the on-device cache-path handling and the
unavailable-state UI entirely. This document does not re-decide D-07 or D-08 — both are locked and
the ADR is where any change to them would be proposed to the user — but the ADR should have this
number in front of it.

**12. Per-genus confidence calibration is fit and reported on the same corpus's val/test splits,
not on field photographs (plan 01-05, Section 15).** Section 15's per-genus thresholds and re-cut
scale generalise from validation to test within this document's own GBIF-sourced corpus, but that
corpus carries the same composition (Section 3a) and seasonal-skew (Section 3b) caveats as every
other figure here. Whether "strong" continues to mean ~90% reliable when the input is a field
photograph rather than a citizen-science image is untested, for the same reason gap 2 above is
untested — this is not a new, independent gap, but the calibration work does not narrow it either.

**13. Even after per-genus calibration, four genera keep "strong" below one third of predictions
(plan 01-05, Section 15.6).** Ulmus (26.83%), Prunus (29.30%), Populus (32.66%) and Fraxinus
(35.18%) will show the ecologist a confident suggestion only on a minority of encounters. This is
not a defect to fix by loosening the threshold — doing so would recreate the exact miscalibration
Section 15.3 measured and corrected — but the ADR should state plainly that these four genera's
"full go" (D-04 amended) mostly means "the model offers a suggestion labelled honestly as
uncertain," not "the model is usually confident."

_(Additional gaps recorded here as plans 03, 04 and 05 execute.)_

---

## 10. Iteration 2 — expanded corpus, larger backbone, side-by-side comparison

**Status: COMPLETE (2026-09-23, after iteration 1's result was reviewed and rejected as
premature).**

**Why this section exists.** Iteration 1 (Sections 4–5 above, git commits `1490ec6`/`ff07741`)
found 0 of 34 genera clearing the D-02 95% top-3 bar. The user reviewed that result and rejected
it as premature rather than accepting it as a finished no-go, on the following basis — the
numbers support the objection:

| | iteration 1 used | actually available/possible |
|---|---|---|
| training images per genus | 150 | >4,200 CC0/CC-BY candidates surveyed on GBIF per class |
| backbone | MobileNetV3-**Small** | the smallest mobile classifier that exists |
| latency budget consumed (Section 8, flagship device) | 83 ms | 3,000 ms (D-05) |
| model on-disk size | 2.0 MB | no real constraint — D-07 assumed a large model |
| test images per genus | 35 | resolution: one image flips a genus's pass/fail |

Iteration 1 picked the smallest backbone specifically to protect a latency budget it then beat by
a factor of ~36, and trained on 3.6% of the licence-clean data actually available. **Iteration 1's
result stands, unmodified, in Sections 4–5 above — this section does not overwrite it.** This is a
second, larger measurement run alongside the first, so the ADR can see whether the no-go is
data-limited (accuracy improves substantially with ~13x the training data and a larger backbone)
or approach-limited (accuracy barely moves despite both). That delta is itself the finding.

**Plan.** Documented as a deviation extending plan 01-04, directed by the coordinator following
the user's explicit rejection of the iteration-1 no-go as premature:

1. Expand the corpus toward ~2,000 images/class (from 220), same CC0-1.0/CC-BY-4.0 licence filter,
   reusing already-downloaded images rather than re-fetching them.
2. Season-stratify the expansion using GBIF `eventDate`, specifically targeting autumn
   representation where Section 3b found none, and reporting achieved-vs-attempted per class.
3. Enlarge the test split to ~200 images/class (from 35) for a coarser, more meaningful resolution
   limit.
4. Train a substantially larger backbone (MobileNetV3-Large or EfficientNet-B0/Lite0), still
   exported to `.tflite` and float16-quantised, keeping the export-parity check that caught
   iteration 1's int8 degradation.
5. Re-measure per-genus top-1/top-3 on the same rules as iteration 1 (D-03, D-04, raw counts).
6. Present iteration 1 and iteration 2 side by side, per genus.
7. Update `eval/GATE` and the plan's SUMMARY with both iterations' numbers intact.

**This subsection will be filled in as each step completes; if interrupted, the corpus-assembly
script (`prepare_dataset.py`) is resumable by design (see 01-02-SUMMARY.md's precedent) and this
section records progress rather than only a final result.**

### 10.1 Corpus expansion — complete

**Steps 1–3 done.** `prepare_dataset.py` was rewritten to (a) reuse every image already on disk
from iteration 1 rather than re-fetching it, backfilling `eventDate` for those via a cheap
JSON-only GBIF lookup, (b) fetch a much larger new-candidate pool per class (up to 5,000,
excluding anything already downloaded) with `eventDate` captured directly from the occurrence
search response, and (c) select the final ~2,000/class from the combined existing+new pool with a
season quota (500/season, attempted) rather than a plain shuffle, falling back to whatever is left
when a season's quota can't be filled. Train/val/test fractions changed to 80%/10%/10% (from
150/35/35 → 1600/200/200 nominal).

**Result: 63,863 images downloaded across 34 classes (up from ~7,432 in iteration 1), 51,089
train / 6,387 val / 6,387 test.** Per-class candidate pools ranged 4,566–5,303 (close to the
5,000-candidate fetch ceiling for nearly every class, confirming the corpus really was
volume-constrained, not availability-constrained, exactly as iteration 1's `prepare_dataset.py`
comment already asserted). A handful of classes (Celtis, Cupressus, Fagus, Fraxinus, Juniperus,
Populus, Salix, Tamarix) landed below the full 2,000 target (1,122–1,798) because their combined
existing+new candidate pool, after licence filtering and download failures, simply ran out —
still 5–8x iteration 1's count for every one of them.

| genus | candidates fetched | downloaded | train | val | test | winter | spring | summer | autumn |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Abies | 5122 | 1982 | 1586 | 198 | 198 | 513 | 597 | 581 | 309 |
| Acer | 5122 | 1915 | 1532 | 192 | 191 | 553 | 1447 | 0 | 0 |
| Alnus | 5122 | 1988 | 1590 | 199 | 199 | 511 | 534 | 548 | 406 |
| Arbutus | 5122 | 1970 | 1576 | 197 | 197 | 500 | 500 | 500 | 500 |
| Betula | 5122 | 1910 | 1528 | 191 | 191 | 502 | 609 | 584 | 305 |
| Carpinus | 5122 | 1990 | 1592 | 199 | 199 | 380 | 570 | 536 | 514 |
| Castanea | 5122 | 1913 | 1530 | 191 | 192 | 280 | 550 | 629 | 541 |
| Celtis | 5122 | 1698 | 1358 | 170 | 170 | 500 | 500 | 500 | 500 |
| Cupressus | 5124 | 1657 | 1326 | 166 | 165 | 500 | 500 | 500 | 500 |
| Fagus | 5122 | 1683 | 1346 | 168 | 169 | 524 | 790 | 629 | 57 |
| Fraxinus | 5122 | 1403 | 1122 | 140 | 141 | 371 | 772 | 824 | 32 |
| Juglans | 5122 | 1790 | 1432 | 179 | 179 | 360 | 536 | 604 | 500 |
| Juniperus | 5122 | 1764 | 1411 | 176 | 177 | 586 | 881 | 512 | 21 |
| Larix | 5122 | 1766 | 1413 | 177 | 176 | 329 | 540 | 617 | 514 |
| Malus | 5124 | 1909 | 1527 | 191 | 191 | 102 | 691 | 655 | 552 |
| Ostrya | 5122 | 1855 | 1484 | 186 | 185 | 483 | 506 | 510 | 500 |
| Pinus | 5122 | 1889 | 1511 | 189 | 189 | 822 | 773 | 405 | 0 |
| Picea | 5122 | 1867 | 1494 | 187 | 186 | 502 | 503 | 501 | 494 |
| Populus | 5122 | 1910 | 1528 | 191 | 191 | 510 | 899 | 573 | 18 |
| Prunus | 5122 | 1970 | 1576 | 197 | 197 | 586 | 1347 | 67 | 0 |
| Pyrus | 5122 | 1882 | 1506 | 188 | 188 | 389 | 573 | 524 | 514 |
| Quercus_deciduae | 5123 | 1966 | 1573 | 197 | 196 | 480 | 513 | 505 | 502 |
| Quercus_sempervirens | 5122 | 1950 | 1560 | 195 | 195 | 500 | 500 | 500 | 500 |
| Salix | 5122 | 1958 | 1566 | 196 | 196 | 340 | 894 | 708 | 58 |
| Sorbus | 5122 | 1934 | 1547 | 193 | 194 | 106 | 719 | 754 | 421 |
| Tamarix | 5234 | 1783 | 1426 | 178 | 179 | 500 | 500 | 500 | 500 |
| Taxus | 5303 | 1965 | 1572 | 196 | 197 | 516 | 547 | 522 | 415 |
| Tilia | 5242 | 1990 | 1592 | 199 | 199 | 223 | 610 | 656 | 511 |
| Ulmus | 5186 | 1975 | 1580 | 198 | 197 | 442 | 591 | 565 | 402 |
| Ceratonia | 4566 | 1928 | 1542 | 193 | 193 | 500 | 500 | 500 | 500 |
| Cercis | 5241 | 1911 | 1529 | 191 | 191 | 334 | 630 | 527 | 509 |
| Olea | 5158 | 1932 | 1546 | 193 | 193 | 500 | 500 | 500 | 500 |
| Phillyrea | 5248 | 1992 | 1594 | 199 | 199 | 500 | 500 | 500 | 500 |
| Pistacia | 5240 | 1868 | 1494 | 187 | 187 | 500 | 500 | 500 | 500 |

**Seasonal balance achieved vs attempted (Step 2).** Quota attempted was 500/season/class
(2,000/4). **9 of 34 classes reached a perfectly even 500/500/500/500 split** (Arbutus, Celtis,
Cupressus, Quercus_sempervirens, Tamarix, Ceratonia, Olea, Phillyrea, Pistacia) — every one of
these is either a Mediterranean supplementary genus (Section 2) or a genus with an unusually deep
candidate pool relative to its download target. For the rest, the shortfall is real and, at this
scale (up to 5,303 candidates fetched per class, close to the fetch ceiling for most), it looks
like a genuine property of what GBIF holds rather than a sampling artefact:

- **Three genera returned ZERO autumn images even from a ~5,000-candidate pool: Acer, Pinus,
  Prunus.** Iteration 1's Section 3b already found 0% autumn in a 30-image sample for all three;
  this is now confirmed at ~170x the sample size (5,122 candidates each) rather than being a small-
  sample artefact. These three genera's CC0/CC-BY GBIF imagery may simply not include autumn
  photographs at all, at least not under the `StillImage` media type this corpus draws from.
- **Five more are thin but not zero: Fagus (57), Fraxinus (32), Juniperus (21), Populus (18),
  Salix (58)** — autumn representation improved from iteration 1's near-total absence but remains
  under 4% of each class's total, nowhere near the 500-quota target.
- **The remaining 17 non-perfect classes landed with meaningfully more autumn representation than
  iteration 1's ~0%** — e.g. Malus 552, Larix 514, Pyrus 514, Carpinus 514, Cercis 509, Tilia 511,
  Castanea 541 — genuinely closing (not just narrowing) the seasonal gap Section 3b identified,
  for those classes specifically. The leftover-fill mechanism (Section 3a of `prepare_dataset.py`'s
  `season_stratified_select`) means some of these exceed the 500 quota (autumn surplus absorbed the
  shortfall from a thinner season elsewhere in the same class, e.g. Tilia's thin winter at 223).

**What this means going in to training.** The corpus is no longer near-zero on autumn for the
great majority of classes — a real, substantial improvement on the seasonal-skew caveat (Section
3b/Section 9 item 7) for 25 of 34 classes. It remains genuinely absent for 3 (Acer, Pinus, Prunus)
and thin for 5 more — this is not a corpus-assembly shortfall to fix with more downloading, it
appears to be what GBIF's CC0/CC-BY `StillImage` collection actually contains for those genera.
Full detail: `spike/species-recognition/data/splits/seasonal_balance_report.json` (gitignored).

`data/GATE` was recomputed automatically at the end of the expansion run and still reads
`GATE-CORPUS: PASS`, `CLASSES-USABLE: 32` — the same composition exclusions (Betula, Phillyrea)
apply; composition was not re-audited at the new scale (out of scope for this iteration, see
"What was not re-done" below).

### 10.2 Training — complete

Backbone: MobileNetV3-Large (`tensorflow.keras.applications.MobileNetV3Large`, same
ImageNet-pretrained, Apache-2.0, Google-hosted-weights pattern as iteration 1's Small variant —
same licence chain, only the architecture size changed). 3,029,026 total params (2,996,352 in the
frozen/partially-frozen backbone) versus iteration 1's smaller MobileNetV3-Small. Same
freeze-then-fine-tune recipe, same `include_preprocessing=True`, same augmentation, same
`UNFREEZE_LAST_N_LAYERS=60` (kept identical to iteration 1's final configuration for a controlled
comparison — only the backbone and data changed). Head epochs 6, fine-tune epochs 8 — fewer total
epochs than iteration 1's 20+15, deliberately: iteration 2 has ~10x the distinct training images,
so a full dataset pass carries far more information per epoch and iteration 1's own validation
curve (Section 4) had already shown diminishing returns past a certain point. A CPU-only
per-epoch timing benchmark (run on the already-downloaded Abies class before committing to the
full 34-class run) measured ~95-120ms/step for the frozen-head phase and ~218ms/step for the
60-layer-unfrozen fine-tune phase, projecting to roughly 3 and 6 minutes/epoch respectively across
the full ~51,000-image train set — this sized the epoch counts above to fit a practical wall-clock
budget rather than being picked arbitrarily.

**First training attempt found a genuine data-pipeline bug, not a genuine model result —
discarded and retrained, not reported as evidence.** The first attempt (6 head epochs, 8
fine-tune epochs, no early stopping) finished with validation top1/top3 of 0.3253/0.5901 —
numerically close to iteration 1's 0.3816/0.5897, which on its face would already have been an
interesting "barely moved" data point. Per-genus test evaluation on that model, however, showed
an implausible pattern: accuracy correlated with a class's position in `genus_labels.txt`
(Pearson r=0.85 between label index and top-3 accuracy) — classes early in the file
(Abies…Cupressus) scored 21–54% top-3, classes late in the file (Tamarix, Taxus, Tilia, Ceratonia)
scored 87–95%, with no botanical reason to expect that split. Root cause: `make_dataset`'s
`tf.data` `.shuffle(buffer_size=2048)` only shuffles within a sliding window, and
`collect_split()` concatenates each class's files in `genus_labels.txt` order before that shuffle
ever runs. Iteration 1's ~150 images/class meant the 2048-window still spanned >10 classes at
once, giving adequate cross-class mixing despite being windowed (iteration 1's own label-index/
accuracy correlation is a much weaker r=0.36, consistent with normal windowed-shuffle imprecision,
not a systematic bug — iteration 1's result is not affected and is not being revisited). Iteration
2's ~1,200–1,600 images/class made the same 2048-window barely span a single class's block, so
early-epoch batches were overwhelmingly whichever class starts the file and late-epoch batches
were overwhelmingly whichever class ends it — a training-order recency bias, not a capability
signal. **Fixed in `finetune.py`'s `collect_split()`: the full (file, label) list is now globally
shuffled in Python before it ever reaches `tf.data`, with the windowed shuffle widened to 8192 as
a secondary per-epoch re-randomisation on top.** Verified directly: post-fix, every class's mean
position in the shuffled 51,089-file training list falls within ~1.3% of the expected midpoint
(stdev of per-class mean positions: 328, versus a maximum possible range of ~51,089). The invalid
first attempt's artefacts are kept on disk (gitignored, suffixed `_INVALID_shuffle_bug`) for
traceability but are not used anywhere in this document's reported numbers.

**Also added for the retrained run: `EarlyStopping(monitor='val_top3', patience=3,
restore_best_weights=True)` on the fine-tune phase.** The first attempt's own validation curve
showed a clear reason to add this regardless of the shuffle bug: val_top3 peaked at
0.6127 partway through the 8 fine-tune epochs, then declined to 0.5901 by the final epoch while
training accuracy kept climbing (0.51→0.92 top3) — textbook overfitting once the corpus is large
enough for the head+partial-backbone to start memorising rather than generalising further. Without
early stopping, the exported model would have been silently the last (already-past-peak) epoch's
weights rather than the best one found during the run — the same category of measurement risk
this plan's parity-check requirement is designed to catch on the export side, applied here on the
training side.

**Retrained result (bug fixed, early stopping added): validation top1=0.5920, top3=0.7951 —
still climbing at the final epoch, no overfitting observed.** Compare iteration 1's
0.3816/0.5897. Full fine-tune-phase curve (8 epochs): val_top3 rose monotonically
0.695→0.729→0.749→0.764→0.775→0.782→0.790→0.795, train_top3 rose 0.610→0.857 over the same
epochs — a healthy, still-converging gap (not the runaway train/val divergence the first,
buggy attempt showed). `EarlyStopping` never triggered (best epoch = the last, epoch 8) —
this run stopped because it reached the epoch budget, not because it plateaued; more epochs
would very likely have improved it further, not investigated here for the same D-19 timebox
reasons iteration 1 stopped when it did. Training wall-clock: 1,699s (head) + 3,337s
(fine-tune) = 5,046s (≈84 min), CPU-only.

**Export: `spike/species-recognition/train/genus_classifier_v2.tflite`, 6,127,976 bytes
(≈5.84 MB), float16-quantised (same scheme as iteration 1, same reasoning — kept, per this
iteration's instructions, rather than re-optimised for size).** Export parity: **100%** top-1
agreement (68/68 sampled test images) between the trained model and the exported `.tflite` —
even cleaner than iteration 1's 100% (iteration 1 also passed cleanly on the retry after
switching from int8 to float16; both iterations ship float16 for the same reason).

### 10.3 Per-genus accuracy — iteration 1 vs iteration 2, side by side

**Source model:** `genus_classifier_v2.tflite` (above). **Test split:** iteration 2's own
held-out test split, 6,387 images across 34 classes (up from iteration 1's 1,183) — roughly
200 images/class instead of ~35. **Measured:** 2026-09-23, same
`eval/evaluate_accuracy.py` script, same D-03/D-04 rules (per genus, raw counts, no headline
average). **Composition-filtering decision unchanged from iteration 1** (Section 5): raw,
unfiltered test split, for the same reasons.

**Bug-fix sanity check, repeated on the corrected run:** label-index/top-3-accuracy correlation
is r=0.36 — statistically indistinguishable from iteration 1's r=0.36, both consistent with
normal windowed-shuffle imprecision rather than the r=0.85 systematic artefact the first,
discarded iteration-2 attempt showed. This result is not affected by that bug.

| genus | it1 n | it1 top1 | it1 top3 | it1 clears | it2 n | it2 top1 | it2 top3 | it2 clears | top3 Δ |
|---|---:|---:|---:|:---:|---:|---:|---:|:---:|---:|
| Abies | 35 | 45.7% | 60.0% | No | 198 | 55.0% | 81.3% | No | +21.3pp |
| Acer | 35 | 14.3% | 25.7% | No | 191 | 58.6% | 79.6% | No | +53.9pp |
| Alnus | 35 | 31.4% | 54.3% | No | 199 | 54.8% | 70.9% | No | +16.6pp |
| Arbutus | 35 | 54.3% | 80.0% | No | 197 | 66.5% | 87.8% | No | +7.8pp |
| Betula | 35 | 42.9% | 51.4% | No | 191 | 50.8% | 68.6% | No | +17.2pp |
| Carpinus | 35 | 37.1% | 51.4% | No | 199 | 61.8% | 79.4% | No | +28.0pp |
| Castanea | 35 | 37.1% | 51.4% | No | 192 | 63.5% | 81.8% | No | +30.3pp |
| Celtis | 35 | 31.4% | 48.6% | No | 170 | 38.8% | 65.9% | No | +17.3pp |
| Cupressus | 35 | 37.1% | 74.3% | No | 165 | 64.2% | 83.6% | No | +9.4pp |
| Fagus | 35 | 51.4% | 71.4% | No | 169 | 56.8% | 78.1% | No | +6.7pp |
| Fraxinus | 35 | 5.7% | 22.9% | No | 141 | 29.8% | 63.1% | No | +40.3pp |
| Juglans | 35 | 14.3% | 42.9% | No | 179 | 52.5% | 73.7% | No | +30.9pp |
| Juniperus | 35 | 25.7% | 60.0% | No | 177 | 53.7% | 76.3% | No | +16.3pp |
| Larix | 35 | 42.9% | 54.3% | No | 176 | 62.5% | 79.5% | No | +25.3pp |
| Malus | 35 | 54.3% | 71.4% | No | 191 | 53.4% | 72.2% | No | +0.8pp |
| Ostrya | 35 | 22.9% | 34.3% | No | 185 | 53.0% | 69.2% | No | +34.9pp |
| Pinus | 35 | 42.9% | 74.3% | No | 189 | 59.3% | 83.1% | No | +8.8pp |
| Picea | 35 | 34.3% | 65.7% | No | 186 | 48.4% | 82.3% | No | +16.5pp |
| Populus | 35 | 17.1% | 40.0% | No | 191 | 47.1% | 69.1% | No | +29.1pp |
| Prunus | 35 | 31.4% | 48.6% | No | 197 | 49.8% | 73.6% | No | +25.0pp |
| Pyrus | 35 | 20.0% | 42.9% | No | 188 | 43.1% | 71.3% | No | +28.4pp |
| Quercus_deciduae | 35 | 40.0% | 60.0% | No | 196 | 69.9% | 84.7% | No | +24.7pp |
| Quercus_sempervirens | 35 | 37.1% | 62.9% | No | 195 | 63.6% | 82.0% | No | +19.2pp |
| Salix | 35 | 37.1% | 60.0% | No | 196 | 56.1% | 81.6% | No | +21.6pp |
| Sorbus | 35 | 37.1% | 62.9% | No | 194 | 69.1% | 82.0% | No | +19.1pp |
| Tamarix | 35 | 51.4% | 65.7% | No | 179 | 81.0% | 88.3% | No | +22.6pp |
| Taxus | 35 | 45.7% | 68.6% | No | 197 | 67.5% | 85.3% | No | +16.7pp |
| Tilia | 35 | 25.7% | 60.0% | No | 199 | 55.3% | 78.9% | No | +18.9pp |
| Ulmus | 30 | 0.0% | 16.7% | No | 197 | 45.2% | 67.5% | No | +50.8pp |
| Ceratonia | 35 | 65.7% | 85.7% | No | 193 | 80.8% | 92.8% | No | +7.0pp |
| Cercis | 35 | 42.9% | 65.7% | No | 191 | 73.3% | 80.6% | No | +14.9pp |
| Olea | 35 | 60.0% | 94.3% | No | 193 | 71.5% | 88.6% | No | **−5.7pp** |
| Phillyrea | 35 | 60.0% | 88.6% | No | 199 | 71.4% | 88.4% | No | −0.1pp |
| Pistacia | 33 | 48.5% | 81.8% | No | 187 | 61.0% | 82.3% | No | +0.5pp |

**0 of 34 genera clear the D-02 95% top-3 bar in iteration 2 either — the same headline
outcome as iteration 1.** But the delta column is the actual finding the user asked for:
**32 of 34 genera improved, by a mean of +19.9 percentage points top-3** (range +0.5pp to
+53.9pp among improved classes); only 2 regressed, both by small margins (Olea −5.7pp,
Phillyrea −0.1pp) and both were already iteration 1's two best-performing genera (94.3% and
88.6%) — consistent with a ceiling/ranking-shuffle effect among already-strong classes rather
than a real capability loss. **This is a data-limited result, not an approach-limited one.**
Accuracy moved substantially and broadly with ~13x more training data and a larger backbone,
which is the opposite of what a fundamentally-broken approach would show (a fundamentally
broken approach would leave most classes near chance regardless of data volume). The most
dramatic individual gains — Acer +53.9pp, Ulmus +50.8pp, Fraxinus +40.3pp — were iteration 1's
worst-performing classes, exactly where a data-starved model would be expected to gain the
most from more examples.

**Confidence-band comparison (D-12).** Iteration 2: strong ≥0.758 (n=2,451/6,387 = 38.4% of
predictions, 90.0% in-band accuracy) — nearly 3.5x the coverage of iteration 1's strong band
(11.2% of predictions) at the same ~90% precision target. The weak band is empty in iteration 2
(no predictions fell below the computed weak threshold of 0.078) — the larger, better-trained
model rarely produces a very low-confidence output at all, unlike iteration 1 where 37% of
predictions fell in the weak band. Pooled accuracy (context only, not a D-03 result — see the
per-genus table above) rose from iteration 1's 36.8% to iteration 2's 58.8%.

**Candidate-ordering comparison (D-11).** Iteration 2's confusion pattern reads as more
botanically coherent than iteration 1's: the top true→predicted confusion pairs are
Phillyrea→Olea (31, both Oleaceae — genuinely closely related), Picea↔Abies (23+22, both
conifers), Pyrus→Prunus (21, both Rosaceae), Prunus→Malus (20, both Rosaceae),
Cupressus→Juniperus (16, both Cupressaceae). Iteration 1's top confusions were a more mixed
bag of plausible and implausible pairs (Section 5). Of 2,632 wrong top-1 predictions, the true
genus was rank 2 in 888 (33.7%) and rank 3 in 390 (14.8%) — the candidate list is doing
meaningfully more work in iteration 2 (near-miss rate 48.5% vs iteration 1's 35.0%).

**Resolution limit, now much coarser.** At n≈200/class, the 95% bar tolerates up to 10 misses
(190/200), rather than iteration 1's single-image knife-edge at n=35. Olea's iteration-2 figure
(171/193, 88.6%) is genuinely 22 images short of the bar, not one-image-flippable — a
qualitatively more solid negative than iteration 1's Olea reading was.

### 10.4 What was not re-done in iteration 2

- **Composition audit (Section 3a) was not re-run at the new scale.** The original 30-image-per-
  class visual audit and its Betula/Phillyrea exclusions are carried forward unchanged. A larger
  corpus does not change what fraction of any one class's images are landscape/herbarium/in-hand
  rather than single-subject — that is a property of the source dataset's composition, not its
  volume, and re-auditing thousands of images per class by eye was judged out of scope for this
  extension (consistent with plan 02's original coordinator guidance against hand-classifying
  images at scale).
- **Test-split evaluation is still NOT composition-filtered**, for the same reason as iteration 1
  (Section 5) — now at a much larger, more informative sample size (200/class instead of 35), which
  is itself part of why iteration 2 was requested.
- **No field photographs were added.** The no-field-photos gap (Section 6, Section 9 item 2)
  is unchanged by this iteration; it is a data-source gap, not a corpus-volume gap.
- **Latency was not re-measured.** Iteration 2's model (5.84 MB float16) is roughly 3x iteration
  1's (2.0 MB) and will run slower on-device, but plan 01-04's own instruction for this extension
  was explicit not to re-optimise for size or speed given the 36x latency headroom iteration 1
  measured (83ms vs the 3,000ms D-05 budget, Section 8) — even a 3x latency increase from a bigger
  model leaves an enormous margin. Plan 05 measures real on-device latency; whichever model is
  promoted to the canonical path (Section 10.5) is what it will time.

### 10.5 Summary and promotion to the canonical model path

**Both iterations' full artefacts remain on disk and in this document — iteration 2 does not
erase iteration 1.** Iteration 1: Sections 4–5 above, `git` commits `1490ec6`/`ff07741`,
model/results archived at `spike/species-recognition/{train,eval}/*iteration1*` (gitignored).
Iteration 2: this Section 10, model/results at `spike/species-recognition/train/genus_classifier_v2.tflite`
and `spike/species-recognition/eval/results_v2/` (gitignored).

**`spike/species-recognition/train/genus_classifier_v2.tflite` (iteration 2, MobileNetV3-Large,
5.84 MB) has been promoted to the canonical path
(`spike/species-recognition/train/genus_classifier.tflite`) that plan 03's on-device cache
convention and plan 05's device harness expect, replacing iteration 1's file at that path.**
Iteration 1's original file is preserved separately
(`spike/species-recognition/train/genus_classifier_iteration1.tflite`) and its numbers are fully
recorded in Sections 4–5 regardless of what sits at the canonical path — nothing about iteration 1's
evidence depends on that file continuing to exist there. Iteration 2 is promoted because it is
the more capable, more current candidate and the one the ADR (plan 01-06) and any further device
measurement (plan 01-05) should reason about going forward; `eval/GATE` reads
`GATE-MODEL: PASS`, referencing this promoted (iteration 2) model. `eval/results/` (canonical,
no suffix) was also updated to iteration 2's per-genus CSV/JSON outputs, matching the promoted
model; iteration 1's own results remain separately archived at `eval/results_iteration1/`
(gitignored) and unmodified in Sections 4–5 above.

**What this means for the ADR.** Iteration 2 answers the question the user's rejection asked:
the no-go was data-limited, not approach-limited — accuracy moved broadly and substantially
(mean +19.9pp top-3, 32/34 genera improved) with more data and a larger backbone. It did **not**,
however, cross the D-02 bar for any genus at the larger, more statistically solid ~200-image
test-split resolution. The honest reading is: on-device genus recognition is not proven infeasible
by this evidence, but it is also not proven to clear the 95% bar within this milestone's 2–3 day
spike timebox with the data and compute available. Whether that supports a no-go, a
conditional/deferred go pending a further data-collection effort, or something else is the ADR's
decision to make with this evidence in hand — not this document's.

---

## 11. Iteration 3 — data alone, backbone held constant

**Status: COMPLETE (started 2026-09-23, corpus expansion and training completed 2026-09-24/25,
export/evaluation/promotion completed 2026-09-25; user approved a further extension after
reviewing iteration 2's data-limited result).**

**Why this iteration changes exactly one variable.** Iteration 2 changed both the corpus (9x more
images) and the backbone (MobileNetV3-Small → Large) at once, so its +19.9pp mean gain cannot be
attributed to either alone. Iteration 3 holds the backbone, hyperparameters, the shuffle fix, and
`EarlyStopping` all identical to iteration 2's `finetune.py` and only expands the data further —
so the iteration-2→3 delta is a clean read of what more data alone still buys with a fixed model.
That is the number that tells the ADR whether this approach is still climbing or has started to
saturate.

**Target: the true per-class ceiling, not a round number.** `TARGET_TOTAL_PER_CLASS` raised to
6,000 — deliberately above the ~4,200–5,300 candidate ceiling iteration 2 actually observed per
class, so classes exhaust their real GBIF CC0/CC-BY `StillImage` candidate pool under the licence
filter rather than hitting an artificial cap. A class that runs out below 6,000 is itself the
finding: that is this approach's real per-class data ceiling under this licence filter, not a
corpus-assembly shortfall.

**Plan, same discipline as iteration 2:**
1. Expand the corpus toward the per-class ceiling, reusing every image already on disk from
   iterations 1–2, season-stratifying new downloads via GBIF `eventDate`.
2. Confirm or refute, at this larger scale, whether Acer/Pinus/Prunus genuinely have zero autumn
   CC0/CC-BY imagery on GBIF (iteration 2's finding) — if a much larger pool still returns zero,
   that is a property of the source data, not of this corpus-assembly effort.
3. Train MobileNetV3-Large with iteration 2's exact hyperparameters, shuffle fix, and
   `EarlyStopping(monitor='val_top3', restore_best_weights=True)` — no other change.
4. Re-measure per-genus top-1/top-3 on the same rules as iterations 1–2 (D-03, D-04, raw counts).
5. **A three-way per-genus comparison table (iterations 1, 2, 3), with the mean delta 1→2 and
   2→3 so the diminishing-returns question is answerable at a glance.** This is iteration 3's
   central deliverable.
6. Update `eval/GATE` and the plan's SUMMARY, preserving all three iterations' numbers separately.
   The iteration-3 model is promoted to the canonical path only if it actually beats iteration 2 —
   stated explicitly either way, not assumed.

**This subsection is filled in as each step completes, same resumability discipline as Section 10.**

**Progress checkpoint (2026-09-24, interim, corpus expansion in progress).** The corpus-expansion
run was interrupted once by a session end after 7 of 34 classes; `prepare_dataset.py`'s
resumability (reuse-existing-files, exclude-already-downloaded-ids) picked back up correctly with
no data lost — restarted rather than resumed from a checkpoint file, but functionally equivalent
since every previously-downloaded image is still on disk and gets reused. Progress so far (7
classes; downloaded counts fell short of the 6,000 target, meaning these classes are approaching
their real GBIF ceiling at the current ~8,000-candidate fetch pool, not stopping early):

| genus | downloaded | candidates seen (this pass) | autumn achieved (quota 1,500) |
|---|---:|---:|---:|
| Abies | 4,712 | 9,982 | 1,519 |
| Acer | 4,547 | 9,915 | 81 |
| Alnus | 5,514 | 9,988 | 1,501 |
| Arbutus | 5,204 | 9,970 | 1,500 |
| Betula | 5,215 | 9,910 | 1,016 |
| Carpinus | 4,793 | 9,990 | 1,536 |
| Castanea | 4,832 | 9,913 | 1,735 |

**Preliminary update to the Acer/Pinus/Prunus zero-autumn finding (iteration 2, Section 10.1):
at this larger scale, Acer is no longer at zero — 81 autumn images were found**, out of 4,547
downloaded (≈1.8%). This revises iteration 2's "genuinely zero" reading for Acer specifically: the
correct reading is "very thin, not literally absent" — GBIF does hold a small number of autumn
Acer photographs under this licence filter, just far short of the quota. Pinus and Prunus are not
yet re-processed in this pass; their status is confirmed or revised below once reached. This
table will be superseded by the complete 34-class results in the final Section 11.1 once the
expansion finishes; recorded here specifically so this finding is not lost to a further
interruption.

**A second interruption (transient network outage, `api.gbif.org` DNS resolution failure) found
and fixed a genuine data-loss-adjacent bug in `prepare_dataset.py` — not a training bug this
time, a corpus-assembly one.** The resumed run above processed 4 classes successfully
(Abies, Acer, Alnus, Arbutus, each topped up close to the 6,000 target) before the network
dropped; the remaining 30 classes each raised a `ConnectionError` inside the per-class `try`
block. The exception handler correctly logged the failure and moved on — but `manifest_rows`
started as an empty list on every invocation and was only ever appended to for classes
processed successfully IN THAT RUN. Since `write_outputs()` checkpoints after every class, the
very next checkpoint after the 4th success persisted a manifest containing only those 4
classes — **silently truncating the other 30 classes' `train.txt`/`val.txt`/`test.txt` files to
empty**, even though every one of those classes' actual downloaded images (5,215 for Betula,
4,793 for Carpinus, and so on — nothing below 1,700) sat completely untouched on disk. Confirmed
directly: `find data/raw -name '*.jpg' | wc -l` still reported 88,473 files immediately after the
failure — no image was lost — but `data/splits/*/  {train,val,test}.txt` for 30 classes now held
zero lines, and the script's own end-of-run report showed `GATE-CORPUS: EARLY-NO-GO` (4/34
usable) purely as a consequence of the empty split files, not any real data loss.

**Fixed:** `build_corpus()` now loads the prior `manifest.csv` (grouped by class) and the prior
`per_class_counts.json`/`seasonal_balance_report.json` at the start of every invocation, and only
*replaces* a class's entries when that class is actually (re)processed successfully in the
current pass. A class not reached, or that raises, keeps whatever the previous run last wrote for
it — the exception handler no longer zeroes a class's counts if better data already exists from
disk. This is the corpus-assembly-time equivalent of iteration 2's training-time shuffle-bug fix:
both were caught because the coordinator's "commit/checkpoint as you go" discipline surfaced the
intermediate state for inspection rather than only the final result. Re-running
`prepare_dataset.py` after the fix regenerates every class's manifest entries correctly from the
intact files already on disk (no re-download needed for what was already there).

**A hard precondition check was added to `finetune.py`, guarding against training starting before
restoration finishes.** Restoration after the truncation happens one class per pass, at download
speed — so for a period after the fix, most classes' split files are still empty even though
nothing is currently broken, only incomplete. `verify_corpus_complete()` now runs immediately
after the corpus-gate check and before any data loading: it asserts every one of the 34 classes
has non-empty `train.txt`/`val.txt`/`test.txt`, and that each split's line count matches
`per_class_counts.json`'s recorded value exactly, failing loudly (`sys.exit(1)`, full problem
list to stderr) rather than letting training silently proceed on a handful of classes and produce
a per-genus table that looks structurally normal but is meaningless. Verified directly against the
still-restoring corpus: the check correctly refused with 87 problems (29 classes still empty at
that point) rather than allowing training to start.

**A third issue, live-diagnosed while the restored run was in progress: the process itself hung
indefinitely (0.1% CPU, no file writes for 5+ minutes) — not the manifest bug, a genuine network
stall.** Live process inspection pointed at the occurrence-search or species-match API path, not
the image-download path (which already had a wall-clock-budget fix from an earlier plan). A plain
`requests.get(url, timeout=N)` does not reliably bound every hang mode — DNS resolution stalls and
some connect-then-nothing states can block past the nominal timeout on certain platforms/resolvers,
because the hang can occur before `requests`' own timeout machinery gets a chance to apply.

**Fixed with a thread-based hard deadline that does not depend on `requests` at all.** Every
network call (search, species/match, per-image metadata backfill, and the image download itself,
consolidated onto one shared implementation) now runs inside a dedicated worker thread and is
bounded by `Future.result(timeout=...)` from the calling thread — a guarantee that holds regardless
of what the worker thread is actually doing; a hung worker is simply abandoned rather than waited
on. Calls retry with exponential backoff (a few seconds, doubling, capped) rather than hammering a
possibly-throttling host — the observed download-rate collapse during this run (roughly
1,000–2,000 images per 10–20 minutes, versus ~14,000/hour during iteration 2's expansion) is
consistent with GBIF or an upstream image host rate-limiting under sustained heavy, concurrent
load across two long sessions, not a code defect on its own. Verified directly against an
intentionally unreachable address: the guard gave up cleanly after 2 retries in 13 seconds rather
than hanging.

**Also added: a dedicated on-disk progress log
(`spike/species-recognition/data/splits/progress.log`, gitignored) with a heartbeat every 30s
during any multi-minute phase (metadata backfill, concurrent downloads), plus a start-of-class
line naming the existing count and target.** This was added specifically because "working slowly"
and "hung" had been indistinguishable from the outside for most of this iteration, costing repeated
live investigation — the log now makes that distinction directly observable without inspecting
process CPU.

**Also reordered class processing: least-progressed classes first, not `genus_labels.txt`
order.** Seven classes had already tripled (reaching 4,793–6,000) from earlier passes while the
other 27 sat untouched at iteration-2 levels (1,403–1,992); a balanced corpus is what the
iteration-2→3 comparison needs, so processing now sorts ascending by current on-disk count each
run — the 27 lagging classes are worked through before any already-advanced class is topped up
further.

**Progress checkpoint (2026-09-24, ~4h40min into the hardened run, no hangs or crashes since the
fixes above).** 20 of 34 classes have real data; 143,677 raw images on disk (up from 89,522 before
this relaunch). Observed rate across this run's first 13 newly-processed classes: ~21 min/class
average — slower than iteration 2's expansion, consistent with the rate-limiting the download-
speed collapse already flagged. Emerging autumn-representation pattern, now confirmed for more
classes at this much larger scale: most classes that were thin or zero in iteration 2 show
substantial autumn gains (Fraxinus 32→1,073, Fagus 57→885, Juniperus 21→655, Malus already-strong
→1,584) — **but Pinus remains thin even now (60 autumn images out of 5,773 downloaded, ≈1%)**,
reinforcing that Pinus's autumn scarcity looks like a genuine property of GBIF's CC0/CC-BY
`StillImage` collection for that genus, not a sampling artefact at any scale tried so far. Acer and
Prunus not yet re-processed in this pass; their status is confirmed once reached. Full final table
in Section 11.1 once the expansion completes.

**Working directory changed mid-run (2026-09-24, no interruption to the running process).** A
separate Claude session operating in the same checkout switched `/Users/florian/Projects/cortege`
to an unrelated branch. This session's work continued from a git worktree
(`/Users/florian/Projects/cortege-phase1`, checked out on
`gsd/phase-1-species-recognition-approach-decision`) with `spike/` symlinked to the original
directory — the running `prepare_dataset.py` process (PID unchanged) kept writing to the same
files throughout via that original path; nothing was interrupted, moved, or re-downloaded because
of this. All commits from this point in the plan are made from the worktree.

### 11.1 Corpus expansion — complete

**Final state: 194,653 images selected into splits across 34 classes (194,661 raw files on disk),
up from iteration 2's 63,863 — roughly 3.05x iteration 2's corpus, and roughly 26.2x iteration 1's
original 7,432.** `data/GATE` reads `GATE-CORPUS: PASS`, `CLASSES-USABLE: 32` (composition
exclusions Betula, Phillyrea unchanged, not re-audited at this scale — Section 10.3/10.4 of the
prior iteration). `verify_corpus_complete()` (Section 11's precondition check) passes cleanly:
all 34 classes have non-empty, count-consistent train/val/test splits.

| genus | downloaded | train | val | test | candidates seen |
|---|---:|---:|---:|---:|---:|
| Abies | 6,000 | 4,800 | 600 | 600 | 6,000 |
| Acer | 6,000 | 4,800 | 600 | 600 | 6,000 |
| Alnus | 6,000 | 4,800 | 600 | 600 | 6,000 |
| Arbutus | 6,000 | 4,800 | 600 | 600 | 6,500 |
| Betula | 6,000 | 4,800 | 600 | 600 | 6,514 |
| Carpinus | 6,000 | 4,800 | 600 | 600 | 6,500 |
| Castanea | 6,000 | 4,800 | 600 | 600 | 6,500 |
| Celtis | 5,998 | 4,798 | 600 | 600 | 6,500 |
| Cupressus | 5,300 | 4,240 | 530 | 530 | 9,913 |
| Fagus | 5,988 | 4,790 | 599 | 599 | 9,683 |
| Fraxinus | 5,946 | 4,757 | 595 | 594 | 9,403 |
| Juglans | 5,891 | 4,713 | 589 | 589 | 9,790 |
| Juniperus | 5,971 | 4,777 | 597 | 597 | 9,764 |
| Larix | 5,988 | 4,790 | 599 | 599 | 9,766 |
| Malus | 5,615 | 4,492 | 562 | 561 | 9,909 |
| Ostrya | 5,401 | 4,321 | 540 | 540 | 9,855 |
| Pinus | 5,773 | 4,618 | 577 | 578 | 9,889 |
| Picea | 5,952 | 4,762 | 595 | 595 | 9,867 |
| Populus | 5,978 | 4,782 | 598 | 598 | 9,910 |
| Prunus | 5,999 | 4,799 | 600 | 600 | 9,970 |
| Pyrus | 5,630 | 4,504 | 563 | 563 | 9,882 |
| Quercus_deciduae | 4,668 | 3,734 | 467 | 467 | 9,966 |
| Quercus_sempervirens | 5,674 | 4,539 | 567 | 568 | 8,861 |
| Salix | 5,986 | 4,789 | 599 | 598 | 9,958 |
| Sorbus | 5,981 | 4,785 | 598 | 598 | 9,934 |
| Tamarix | 5,440 | 4,352 | 544 | 544 | 9,783 |
| Taxus | 5,331 | 4,265 | 533 | 533 | 9,965 |
| Tilia | 5,750 | 4,600 | 575 | 575 | 9,990 |
| Ulmus | 5,979 | 4,783 | 598 | 598 | 9,975 |
| Ceratonia | 3,629 | 2,903 | 363 | 363 | 4,194 |
| Cercis | 5,705 | 4,564 | 570 | 571 | 9,911 |
| Olea | 5,915 | 4,732 | 592 | 591 | 9,932 |
| Phillyrea | 5,460 | 4,368 | 546 | 546 | 8,717 |
| Pistacia | 5,705 | 4,564 | 570 | 571 | 9,868 |

**The per-class ceiling spread is itself a finding, not noise: from Ceratonia's 3,629 to eight
classes flatly capped at the 6,000 target (which they may have exceeded had the target been set
higher — those eight are target-limited, not ceiling-limited, unlike the rest).** RESEARCH.md's
and `prepare_dataset.py`'s own original comment assumed a roughly flat ~4,200 CC0/CC-BY
candidates/class across the whole genus list; the real picture at this scale is materially
uneven. Reading the `candidates seen` column against `downloaded`: most classes' *search* pool
(candidates matching the query) reached 8,700–9,990 once fetched exhaustively (`MAX_CANDIDATES_TO_FETCH=8000`
plus whatever remained in the already-seen pool from iteration 2), but the *downloaded* count is
consistently lower — sometimes by a wide margin (Quercus_deciduae: 9,966 candidates seen, only
4,668 downloaded; Cupressus: 9,913 seen, 5,300 downloaded) — meaning a meaningful fraction of
candidate URLs fail to download even after retries (dead links, host errors, non-image content,
or genuine duplicates dropped by the composition-selection step). **Ceratonia is the clearest
outlier: its candidate pool itself caps at 4,194** (the smallest of any class, well short of the
8,000 fetch ceiling), confirming a class can be **genuinely licence-scarce**, not merely
download-lossy — this is the same class iteration 1/2 already flagged as a Mediterranean
supplementary genus with a thinner literature base. **This spread bounds what any future
iteration could achieve**: eight classes could plausibly grow further with a higher target
(they were still climbing when capped at 6,000), but the majority are already close to their real
ceiling under this licence filter, and Ceratonia specifically cannot grow much more regardless of
target.

**Seasonal stratification, final: 31 of 34 classes reached double-digit autumn percentages
(10.9%–32.4%), a dramatic improvement on iteration 2's already-improved-but-partial picture.**
Three genera remain critically thin even at this scale, now confirmed rather than provisional:

| genus | autumn achieved | autumn % | verdict |
|---|---:|---:|---|
| Prunus | 30 / 5,999 | 0.5% | confirmed near-absent at ~10,000-candidate scale |
| Pinus | 60 / 5,773 | 1.0% | confirmed near-absent at ~9,900-candidate scale |
| Acer | 66 / 6,000 | 1.1% | confirmed near-absent at ~6,000-candidate scale (capped by the download target here, not the candidate pool — see spread discussion above) |

**These three read as a genuine property of GBIF's CC0/CC-BY `StillImage` collection for these
specific genera, not a corpus-assembly limitation.** Every other class, including several that
were at or near zero in iteration 1/2 (Fraxinus, Fagus, Juniperus, Populus, Salix), now carries
substantial autumn representation (12.4%–27.5%). This closes most of Section 3b's original
seasonal-skew finding — but not all of it, and the remaining gap (Prunus, Pinus, Acer) is now
better-evidenced than a "hasn't been tried at scale yet" caveat: it has been tried, repeatedly, at
increasing scale, and the answer did not change.

**Download rate, honestly reported.** The observed rate collapsed over the course of this
corpus-expansion effort: roughly 14,000 images/hour during iteration 2's expansion, dropping to
roughly 1,000–2,000 images per 10–20 minutes (≈3,000–12,000/hour) during the earlier part of
iteration 3, and continuing to vary session-to-session thereafter (one class-processing rate
sampled at ~21 min/class average, others faster once the hang-proofing and priority-reordering
fixes were in place). This is consistent with GBIF or an upstream image host applying rate-limiting
under sustained heavy, concurrent, multi-hour load rather than a fixed per-request cost — the
same download logic ran markedly faster in short bursts than in sustained multi-hour runs across
this plan's several sessions. Recorded here so a future iteration does not assume iteration 2's
throughput is representative of what a much larger, longer-running expansion will sustain.

### 11.2 Training and export — complete

**Backbone and hyperparameters held identical to iteration 2, by design (Section 11's stated
purpose — isolate the data-alone effect).** MobileNetV3-Large
(`tensorflow.keras.applications.MobileNetV3Large`), ImageNet-pretrained weights via the same
Keras-applications API as iterations 1–2 (Apache-2.0 architecture, Google-hosted ImageNet weights —
same licence chain, unchanged; see Section 4 for the full chain including the GBIF CC0/CC-BY-4.0
training-image licence, which now also covers iteration 3's expanded corpus under the identical
filter). 224×224 input, batch size 32, identical augmentation
(`random_flip_left_right`, `random_brightness(0.15)`, `random_contrast(0.85,1.15)`),
`UNFREEZE_LAST_N_LAYERS=60`, 6 head epochs (lr 0.001) + 8 fine-tune epochs (lr 3e-5) — the exact
same epoch budget as iteration 2, not re-tuned, so any change in the fine-tune curve's shape is
attributable to data volume alone.

**Corpus used: 155,721 train images / 19,466 val images, zero corrupt in either split** (up from
iteration 2's 51,089 train / 6,387 val) — consistent with Section 11.1's 3.05x corpus-expansion
figure. `verify_corpus_complete()` (Section 11's hard precondition check, added mid-iteration after
the manifest-truncation incident) passed before training started, confirming all 34 classes had
non-empty, count-consistent splits — the corpus-completeness question raised by that incident is
answered from evidence, not assumed.

**Training wall-clock: head phase 5,105.0s (≈85 min) + fine-tune phase 12,006.6s (≈3h 20min) =
17,138.4s (≈4h 46min), CPU-only** — roughly 3.4x iteration 2's 5,046s total, tracking the
corpus-size increase rather than epoch count (epoch counts are identical between the two
iterations).

**Result: validation top1 = 0.6800, validation top3 = 0.8555 — labelled here as validation, a
training-time sanity figure, not the reportable result** (the reportable per-genus test figures are
Section 11.3). Compare iteration 2's validation top1/top3 of 0.5920/0.7951 — both numbers rose.

**Critical finding: `best_finetune_epoch_1indexed = 8` of 8 fine-tune epochs run.
`EarlyStopping(monitor='val_top3', restore_best_weights=True)` never triggered — the model was
still improving when the run ended, not plateaued.** The full fine-tune-phase `val_top3` curve
climbed every single epoch with no dip: 0.7651 → 0.8002 → 0.8186 → 0.8313 → 0.8407 → 0.8470 →
0.8521 → 0.8555 (epochs 1–8), and `val_top1` likewise climbed monotonically 0.5496 → 0.5978 →
0.6242 → 0.6414 → 0.6559 → 0.6652 → 0.6748 → 0.6800, both still rising at the final epoch with no
sign of flattening. This is not new to iteration 3 — iteration 2's own fine-tune curve also ran to
its last epoch without triggering `EarlyStopping` (Section 10.2) — but it repeats at 3x the corpus
size and the same epoch budget, which means **the measured accuracy at every iteration so far is a
floor on what this training configuration can reach, not a ceiling.** Neither the data volume nor
the fixed 6+8 epoch schedule has saturated. This bears directly on how Section 11.3's diminishing-
returns numbers should be read: some of the shrinking iteration-2→3 gain could be a genuine data-
volume effect, but some of it is confounded by both iterations stopping at the same fixed epoch
count regardless of how much more data iteration 3 had to learn from — a longer schedule at
iteration 3's corpus size was not tried and would very likely have produced a higher figure, not
investigated further here per D-19's timebox discipline.

**Export: `spike/species-recognition/train/genus_classifier_v3.tflite`, 6,127,976 bytes
(≈5.84 MB), float16-quantised — same scheme, same size in bytes as iteration 2's export.** The
identical byte count is expected, not a bug: float16 quantisation preserves the architecture's
weight-tensor shapes regardless of the values learned, so two trainings of the same architecture
under the same quantisation scheme produce identically-sized files. Written under
`--output-suffix _v3` (reads `train/genus_classifier_keras_v3/`, writes
`train/genus_classifier_v3.tflite`), which does **not** touch `eval/GATE` or the canonical
`genus_classifier.tflite` path — promotion is a separate, explicit decision (Section 11.6), not
assumed.

**Export parity: 98.53% top-1 agreement (67/68) between the trained Keras model and the exported
`.tflite`, on the same 68-image (2/class) parity sample iterations 1–2 used** — above the 90%
pass threshold (`export_report_v3.json`), though not the clean 100% both prior iterations achieved.
One sampled image changed its top-1 argmax between the Keras and TFLite versions; the parity gate's
own report records both the Keras-side and TFLite-side accuracy on that same 68-image sample
(55.88% vs 57.35%) — close enough, and on the correct side (TFLite slightly higher), that this
reads as ordinary float16 rounding noise on a near-tied prediction rather than a quantisation
regression of the kind the int8 scheme produced in iteration 1 (Section 4: 79.4% agreement, 2x
probability shifts). Still comfortably inside the plan's own 90% parity threshold.

### 11.3 Per-genus accuracy — three-way comparison (iterations 1, 2, 3)

**Source model:** `genus_classifier_v3.tflite` (Section 11.2, not yet promoted — see Section 11.6).
**Test split:** iteration 3's own held-out test split, 19,466 images across 34 classes (up from
iteration 2's 6,387, iteration 1's 1,183). **Measured:** 2026-09-25, same
`eval/evaluate_accuracy.py` script, same D-03/D-04 rules (per genus, raw counts alongside
percentages, no headline average). Composition-filtering decision unchanged from iterations 1–2:
raw, unfiltered test split (Section 5).

**Raw numbers below, exactly as `eval/results_v3/per_genus_accuracy.csv` reports them — committed
before any interpretation.**

| genus | it1 n | it1 top1 | it1 top3 | it2 n | it2 top1 | it2 top3 | it3 n | it3 top1 | it3 top3 | it3 clears | top3 Δ 1→2 | top3 Δ 2→3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|---:|---:|
| Abies | 35 | 45.7% | 60.00% | 198 | 55.0% | 81.31% | 600 | 70.2% | 89.67% | No | +21.3pp | +8.4pp |
| Acer | 35 | 14.3% | 25.71% | 191 | 58.6% | 79.58% | 600 | 61.5% | 80.83% | No | +53.9pp | +1.3pp |
| Alnus | 35 | 31.4% | 54.29% | 199 | 54.8% | 70.85% | 600 | 59.2% | 77.33% | No | +16.6pp | +6.5pp |
| Arbutus | 35 | 54.3% | 80.00% | 197 | 66.5% | 87.82% | 600 | 80.2% | 91.17% | No | +7.8pp | +3.3pp |
| Betula | 35 | 42.9% | 51.43% | 191 | 50.8% | 68.59% | 600 | 61.8% | 82.33% | No | +17.2pp | +13.7pp |
| Carpinus | 35 | 37.1% | 51.43% | 199 | 61.8% | 79.40% | 600 | 59.7% | 81.00% | No | +28.0pp | +1.6pp |
| Castanea | 35 | 37.1% | 51.43% | 192 | 63.5% | 81.77% | 600 | 74.0% | 83.83% | No | +30.3pp | +2.1pp |
| Celtis | 35 | 31.4% | 48.57% | 170 | 38.8% | 65.88% | 600 | 59.7% | 80.67% | No | +17.3pp | +14.8pp |
| Cupressus | 35 | 37.1% | 74.29% | 165 | 64.2% | 83.64% | 530 | 72.6% | 90.94% | No | +9.4pp | +7.3pp |
| Fagus | 35 | 51.4% | 71.43% | 169 | 56.8% | 78.11% | 599 | 66.9% | 83.47% | No | +6.7pp | +5.4pp |
| Fraxinus | 35 | 5.7% | 22.86% | 141 | 29.8% | 63.12% | 594 | 48.3% | 77.61% | No | +40.3pp | +14.5pp |
| Juglans | 35 | 14.3% | 42.86% | 179 | 52.5% | 73.74% | 589 | 59.4% | 80.81% | No | +30.9pp | +7.1pp |
| Juniperus | 35 | 25.7% | 60.00% | 177 | 53.7% | 76.27% | 597 | 71.5% | 90.79% | No | +16.3pp | +14.5pp |
| Larix | 35 | 42.9% | 54.29% | 176 | 62.5% | 79.55% | 599 | 72.0% | 87.65% | No | +25.3pp | +8.1pp |
| Malus | 35 | 54.3% | 71.43% | 191 | 53.4% | 72.25% | 561 | 60.6% | 80.21% | No | +0.8pp | +8.0pp |
| Ostrya | 35 | 22.9% | 34.29% | 185 | 53.0% | 69.19% | 540 | 65.7% | 84.26% | No | +34.9pp | +15.1pp |
| Pinus | 35 | 42.9% | 74.29% | 189 | 59.3% | 83.07% | 578 | 73.0% | 91.35% | No | +8.8pp | +8.3pp |
| Picea | 35 | 34.3% | 65.71% | 186 | 48.4% | 82.26% | 595 | 63.2% | 88.74% | No | +16.5pp | +6.5pp |
| Populus | 35 | 17.1% | 40.00% | 191 | 47.1% | 69.11% | 598 | 55.7% | 79.60% | No | +29.1pp | +10.5pp |
| Prunus | 35 | 31.4% | 48.57% | 197 | 49.8% | 73.60% | 600 | 56.0% | 80.50% | No | +25.0pp | +6.9pp |
| Pyrus | 35 | 20.0% | 42.86% | 188 | 43.1% | 71.28% | 563 | 62.2% | 82.42% | No | +28.4pp | +11.1pp |
| Quercus_deciduae | 35 | 40.0% | 60.00% | 196 | 69.9% | 84.69% | 467 | 73.0% | 84.15% | No | +24.7pp | -0.5pp |
| Quercus_sempervirens | 35 | 37.1% | 62.86% | 195 | 63.6% | 82.05% | 568 | 70.4% | 85.74% | No | +19.2pp | +3.7pp |
| Salix | 35 | 37.1% | 60.00% | 196 | 56.1% | 81.63% | 598 | 64.5% | 84.95% | No | +21.6pp | +3.3pp |
| Sorbus | 35 | 37.1% | 62.86% | 194 | 69.1% | 81.96% | 598 | 77.6% | 87.96% | No | +19.1pp | +6.0pp |
| Tamarix | 35 | 51.4% | 65.71% | 179 | 81.0% | 88.27% | 544 | 88.6% | 95.04% | **Yes** | +22.6pp | +6.8pp |
| Taxus | 35 | 45.7% | 68.57% | 197 | 67.5% | 85.28% | 533 | 74.7% | 91.93% | No | +16.7pp | +6.7pp |
| Tilia | 35 | 25.7% | 60.00% | 199 | 55.3% | 78.89% | 575 | 59.1% | 77.74% | No | +18.9pp | -1.2pp |
| Ulmus | 30 | 0.0% | 16.67% | 197 | 45.2% | 67.51% | 598 | 48.7% | 74.92% | No | +50.8pp | +7.4pp |
| Ceratonia | 35 | 65.7% | 85.71% | 193 | 80.8% | 92.75% | 363 | 77.1% | 90.63% | No | +7.0pp | -2.1pp |
| Cercis | 35 | 42.9% | 65.71% | 191 | 73.3% | 80.63% | 571 | 82.0% | 89.49% | No | +14.9pp | +8.9pp |
| Olea | 35 | 60.0% | 94.29% | 193 | 71.5% | 88.60% | 591 | 75.1% | 91.20% | No | -5.7pp | +2.6pp |
| Phillyrea | 35 | 60.0% | 88.57% | 199 | 71.4% | 88.44% | 546 | 79.1% | 92.67% | No | -0.1pp | +4.2pp |
| Pistacia | 33 | 48.5% | 81.82% | 187 | 61.0% | 82.35% | 571 | 78.5% | 91.07% | No | +0.5pp | +8.7pp |

**1 of 34 genera clears the D-02 95% top-3 bar for the first time in any iteration: Tamarix,
95.04% (517/544 test images, `clears_bar=True`).** This is a genuine partial-go result in D-04's
sense — the first genus for which this document can point at raw evidence supporting enabling a
suggestion while manual entry stays default for the rest — not a single-image knife-edge either:
at n=544, the 95% bar tolerates up to 27 misses, and Tamarix cleared it with 27 misses exactly
(517/544), the same resolution-limit discipline Section 5 and 10.3 applied. The remaining 33
genera do not clear it.

**Mean top-3 delta 1→2: +19.85 percentage points (34-genus unweighted mean of per-genus top-3
percentages — matches Section 10.3's reported +19.9pp). Mean top-3 delta 2→3: +6.74 percentage
points — roughly a third of the 1→2 gain.** 31 of 34 genera improved 2→3, 0 were flat, and 3
regressed, all by small margins: Quercus_deciduae −0.5pp, Tilia −1.2pp, Ceratonia −2.1pp. Ceratonia
is the one regression with a plausible corpus explanation on record — Section 11.1 flagged it as
the single class whose *candidate* pool itself caps at 4,194 (the smallest of any class, licence-
scarce rather than download-lossy), so its iteration-3 corpus grew the least of any class in
relative terms despite its test split nearly doubling (193→363 images). Quercus_deciduae and Tilia
have no equivalent corpus-ceiling marker in Section 11.1 and read as the same
ceiling/ranking-shuffle effect among already-mid-to-strong classes that iteration 2 noted for Olea
and Phillyrea (Section 10.3) — small regressions among classes that were not the worst performers,
not evidence of a real capability loss.

**The diminishing-returns number (+19.9pp then +6.7pp) answers what iteration 3 was run to
settle, with one explicit caveat carried from Section 11.2: it is confounded by a fixed epoch
budget, not solely a corpus-size effect.** Both iteration 2 and iteration 3 trained for exactly
6 head + 8 fine-tune epochs and both ended still climbing (`EarlyStopping` never triggered in
either). A genuinely saturating approach would show a shrinking per-epoch gain even with unlimited
epochs; what is actually on record here is a shrinking gain from tripling the corpus **while also
holding the epoch budget fixed** — which is consistent with either explanation (data saturation,
or under-training at the larger corpus size) and this measurement alone cannot separate them.
Section 11.2's non-saturation finding means the honest reading is: **the measured 2→3 gain is a
floor on what more data could still buy at a properly-scaled epoch budget, not a ceiling on the
approach.** A fourth iteration that only adds more data without also lengthening the schedule
would likely underestimate its own gain the same way iteration 3 may have.

**The validation top-3 figure (0.8555, Section 11.2) is NOT the same measurement as this
section's test figures, and the two must not be conflated despite being numerically close.**
The unweighted mean of this section's 34 per-genus top-3 percentages is 85.37% — within 0.18
percentage points of the validation figure — but validation top-3 is computed during training,
batch-by-batch, over the *validation* split (19,466 images, used for `EarlyStopping` monitoring
and reported as a training sanity figure only, per Section 11.2's explicit labelling). This
section's figures are computed by `eval/evaluate_accuracy.py` running the exported, quantised
`.tflite` file image-by-image over the *held-out test* split — the only figures this plan treats
as decision-relevant per D-03/D-04. The near-identical numeric value here is coincidental (both
splits are large, similarly composed, and drawn from the same season-stratified corpus), not
evidence that the two measurements are interchangeable — a future reader citing "85.5% top-3"
should cite this section's per-genus test table, not Section 11.2's validation figure, as the
decision input. The like-for-like comparable figure to iteration 2's 78.6% test-set mean (Section
10.3's unweighted per-genus mean, recomputed here for consistency: 78.63%) is this section's own
**85.37% unweighted mean top-3 on the TEST split** — itself context only, not a D-03 result; the
per-genus table above is the actual evidence.

### 11.4 Confidence bands (D-12) and candidate ordering (D-11) — iteration 3

**Confidence bands, computed the same way as iterations 1–2 (`find_cut_points`, strong = lowest
confidence where cumulative precision is still ≥90%, weak = lowest confidence where cumulative
precision is still ≥50%).** Strong band: confidence ≥ 0.7098, n = 10,910/19,466 predictions
(56.0%), 90.0% in-band accuracy. Medium band: 0.0841 ≤ confidence < 0.7098, n = 8,556 (43.9%),
38.6% in-band accuracy. Weak band: empty (0 predictions below 0.0841) — the same pattern iteration
2 showed, now more pronounced: the model essentially never produces a very low-confidence
prediction at all. Strong-band coverage rose again: iteration 1 → 11.2% of predictions,
iteration 2 → 38.4%, iteration 3 → **56.0%** — more than half of all test predictions now fall in
the band the plan's own strong/medium/weak UI language (D-12) would show as "strong," at the same
fixed 90% precision target each time. Pooled top-1 accuracy (context only, not a D-03 result — see
Section 11.3's per-genus table) continued its rise: 36.8% → 58.8% → **67.4%** across the three
iterations.

**Candidate ordering (D-11): the near-miss rate keeps rising.** Of 6,342 wrong top-1 predictions,
the true genus was rank 2 in 2,391 (37.7%) and rank 3 in 1,077 (17.0%) — a combined near-miss rate
of **54.7%**, up from iteration 2's 48.5% and iteration 1's 35.0% (Section 10.3). The remaining
45.3% of wrong top-1 predictions have the true genus entirely absent from the top-3, down from
iteration 2's higher absent-rate — the candidate list underneath the top prediction (D-11's screen
design) keeps doing more real work as training data grows.

**Top confusion pairs are, if anything, more botanically coherent than iteration 2's already-
coherent list (Section 10.3):** Picea↔Abies (75+64, both Pinaceae conifers), Betula→Populus (64,
both fast-growing pioneer trees with visually similar bark/leaf shape though different families),
Cupressus↔Juniperus (63+38, both Cupressaceae), Juglans↔Fraxinus (60+57, both pinnate-compound-leaf
trees, different families), Carpinus→Fagus (52, both smooth-grey-bark Fagales), Malus↔Pyrus (47+37,
both Rosaceae pome fruits), Phillyrea↔Olea (43+39, both Oleaceae — the same pairing iteration 2
flagged), Pyrus→Prunus (40, both Rosaceae), Alnus→Betula (36, both Betulaceae), Populus→Betula
(35). Every one of the top-10 confusion pairs by count has a genuine morphological or taxonomic
basis, which reads as the model continuing to learn real structure rather than noise as the corpus
grows, consistent with iteration 2's own observation (Section 10.3) and with the confidence-band
and near-miss trends above.

**Resolution limit, coarser again.** Most classes now sit at 530–600 test images (up from
iteration 2's ~165–199); at n≈550, the 95% bar tolerates roughly 27 misses rather than iteration
2's ~10, and Tamarix's clearing figure above (517/544) sits comfortably inside that tolerance
rather than on a knife-edge. A handful of classes remain smaller — Ceratonia at 363 (the
licence-scarce class, Section 11.1) and Quercus_deciduae at 467 are the two smallest test splits in
this iteration — their percentages should be read with correspondingly less resolution than the
30-class majority.

### 11.5 Corpus ceiling and seasonal-skew confirmation — cross-references

These two findings were established with full evidence in Section 11.1 as the corpus expansion
completed, ahead of training; restated here in summary form for a reader working through Section
11 top to bottom.

- **Per-class corpus ceilings are real and uneven, not a flat ~4,200/class assumption.** Section
  11.1's table shows a spread from Ceratonia's 3,629-candidate hard ceiling (licence-scarce) to
  eight classes flatly capped at the 6,000 target (Abies, Acer, Alnus, Arbutus, Betula, Carpinus,
  Castanea, Prunus) that were still climbing when the target was reached — target-limited, not
  ceiling-limited. This bounds what a fourth iteration focused on data volume alone could add: the
  eight target-limited classes have headroom, the majority do not.
- **Autumn representation is now confirmed, not merely improved, for 31 of 34 classes** (Section
  11.1: double-digit autumn percentages, 10.9%–32.4%). **Three genera remain critically thin even
  at ~6,000–10,000-candidate scale — Prunus (0.5%), Pinus (1.0%), Acer (1.1%)** — a revision of
  iteration 2's "genuinely zero" reading (which itself already revised iteration 1's "zero" at a
  30-image sample) to "near-absent but not literally zero." At three successive scales (30, then
  ~5,000, then ~6,000–10,000 candidates) the answer for these three genera has stayed the same in
  substance: this reads as a real property of GBIF's CC0/CC-BY `StillImage` holdings for these
  three genera specifically, not a sampling artefact that a larger fetch would eventually correct.

  > **CORRECTED — Section 13.1 (2026-09-25).** This conclusion is wrong. GBIF's own `month` filter,
  > never used by the fetch that produced this reading, returns 40,603 / 23,517 / 34,016 autumn-
  > dated, licence-clean `StillImage` records for Acer / Prunus / Pinus respectively — the near-zero
  > figures above were a `fetch_candidates_for_key` bug (an early-exit heuristic unsound for
  > high-supply genera, combined with a fetch that never queried by season), not a property of
  > GBIF's holdings. See Section 13.1 for the verification query and root cause, and Section 14 for
  > the iteration-4 fix and result. Left here, uncorrected in place, because a later reader must be
  > able to find the wrong claim and its correction together, not have the wrong claim silently
  > replaced.
- **Every one of the 34 classes trained on had complete, non-empty, count-consistent train/val/test
  splits, confirmed by evidence rather than assumed** (Section 11.2: `verify_corpus_complete()`
  passed before training started). This directly answers the concern the manifest-truncation
  incident raised (Section 11.1's progress-checkpoint narrative) — the bug that could have silently
  trained on a truncated 4-class corpus was caught and fixed before it reached training, and the
  precondition check that would have caught it if it hadn't is now a permanent part of
  `finetune.py`.

### 11.6 Promotion to the canonical model path — verdict

**`genus_classifier_v3.tflite` genuinely beats `genus_classifier_v2.tflite` on the test set, by
the same per-genus, non-averaged standard this document holds itself to (D-03) — promoted.**
31 of 34 genera improved 2→3 (mean +6.74pp top-3), 0 were flat, and the 3 that regressed did so by
small margins (largest −2.1pp) with a corpus-scarcity explanation for the largest of the three
(Ceratonia, Section 11.1). Pooled test top-1/top-3 (context only, Section 11.4) rose from
58.8%/78.8% to 67.4%/85.2%. Strong-confidence-band coverage rose from 38.4% to 56.0% at a fixed
90% precision target. This is not a marginal or mixed result that would leave the promotion
decision ambiguous — every measure this document tracks moved the same direction.

**Promotion executed:** `spike/species-recognition/train/genus_classifier_v3.tflite` (verified
byte-identical to the canonical file post-copy, MD5 `de7731077bbc1f81ed3afdc2e874237f`) copied to
the canonical path `spike/species-recognition/train/genus_classifier.tflite`, replacing iteration
2's file there. `genus_classifier_keras_v3/` copied to the canonical `genus_classifier_keras/`.
`export_report_v3.json`/`training_report_v3.json` copied to the canonical (no-suffix)
`export_report.json`/`training_report.json`. `eval/results_v3/` copied to the canonical
`eval/results/`. **Iterations 1 and 2's files are untouched and remain separately archived**
(`*_iteration1*`, `*_v2*` suffixes; `eval/results_iteration1/`, `eval/results_v2/`) — nothing about
either iteration's evidence in Sections 4–5 or Section 10 depends on what currently sits at the
canonical path. `eval/GATE` already read `GATE-MODEL: PASS` from iteration 2's promotion; the token
itself is unchanged by this promotion (it does not encode which iteration), but it now refers to
the iteration-3 model as a matter of fact, per the file it points at.

**Verified against the plan's own automated checks, run directly against the canonical path
post-promotion (not just the `_v3`-suffixed files):** `export_tflite.py --verify-parity` passes
(98.5% agreement); the canonical `.tflite` loads with exactly 34 output classes matching
`genus_labels.txt` order; `eval/results/per_genus_accuracy.csv` has exactly 35 lines (header + 34
data rows). Plan 05 (device latency measurement) should time this model — it is materially the
same size as iteration 2's (6,127,976 bytes either way, Section 11.2), so no new latency-budget
concern is introduced by this promotion beyond what iteration 2 already established (Section 10.4:
even a 3x latency increase from a bigger model leaves an enormous margin against D-05's 3,000ms
budget).

### 11.7 What this iteration means for the ADR

**The central number: 1 of 34 genera now clears the D-02 95% top-3 bar (Tamarix), up from 0 of 34
in both iterations 1 and 2 — the first genus-level evidence in this phase that a partial go
(D-04) is achievable, not merely theoretical.** The other 33 genera still do not clear it, at
progressively better-resolved test splits each iteration (35 → ~35–199 → 530–600 images/class).

**The diminishing-returns question iteration 3 was run to settle: yes, returns are diminishing
(+19.9pp mean top-3 for 1→2, +6.7pp for 2→3, roughly a third), but with the explicit caveat from
Section 11.3 that this is confounded by a fixed epoch budget that neither iteration saturated
(Section 11.2's `EarlyStopping`-never-triggered finding, repeated at 3x the corpus size).** The
honest reading for the ADR: this is evidence of slowing gains from data volume alone under this
training configuration, not proof that the approach itself has hit a hard ceiling — a schedule
change (more epochs, not more data) was not tried and remains an open lever this document does not
resolve.

**Confounds now resolved with direct evidence, not carried forward as open items:**
- Per-class corpus ceilings are measured and uneven (Section 11.5) — bounding, not open-ended,
  headroom for a further data-only iteration.
- The seasonal-skew gap (Section 3b) is substantially closed for 31 of 34 classes and is now
  confirmed, at three successive scales, as a genuine data-source absence for the remaining three
  (Prunus, Pinus, Acer) rather than an unexplored caveat.
- The corpus-completeness question the manifest-truncation incident raised is answered by
  `verify_corpus_complete()`'s pass, not assumed.

**Confounds still open, unchanged from iteration 2 (Section 10.5) and not addressed by this
iteration:** the composition audit (Section 3a) was not re-run at this scale; no field photographs
exist (Section 6); latency was not re-measured (plan 05's job).

**This is neither a clean go nor a clean no-go, now with one genus's worth of partial-go
evidence rather than none.** On-device genus recognition has moved from "0 genera, broad and
uniform miss" (iteration 1) through "0 genera, but improving broadly and substantially"
(iteration 2) to "1 genus clearing the bar, the rest still improving but not yet crossing it, with
a training-schedule confound left unresolved" (iteration 3). Whether one genus out of 34 is enough
partial-go value to justify D-15's Factor A rework (a precondition either way — Section 1 of this
document notes even a perfect model has nowhere to put its output today), whether the trajectory
across three iterations supports proposing a fourth iteration or a longer training schedule instead
of a data-only one, and what threshold of genus coverage would make a partial go worth shipping are
all the ADR's decisions (plan 01-06) — this document's job across all three iterations has been to
put the trajectory in evidence, which it now does.

---

## 12. Per-genus × per-season accuracy — does the promoted model hold up in autumn?

**Status: COMPLETE (measured 2026-09-25, ad-hoc measurement task against the already-promoted
iteration-3 model — no retraining, no re-export).**

**Why this section exists.** Section 11.3's 85.37% unweighted mean top-3 (and every per-genus
figure in this document) is computed across the test split as a whole, mixing all four seasons
together. IBP field surveys happen in **autumn**. Section 3b found 23 of 34 classes with zero
autumn-dated training images before any stratification; Section 11.1/11.5 confirmed that after two
rounds of season-stratified corpus expansion, 31 of 34 classes reached double-digit autumn
percentages, but three — Prunus (0.5%), Pinus (1.0%), Acer (1.1%) — remain near-absent in the
*training* corpus. This section asks the evaluation-side question that follows directly from that:
does that same skew show up as a measurable accuracy gap in the *test* split, and if so, for which
genera specifically? The aggregate figure cannot answer this; only a season-resolved, per-genus
breakdown can.

### 12.1 Method and coverage

**Re-ran inference only — the promoted model and the existing test split are used exactly as
Section 11.3 measured them, unmodified.** A new script,
`spike/species-recognition/eval/evaluate_seasonal_accuracy.py`, loads
`train/genus_classifier.tflite` (the canonical, promoted iteration-3 model — same file, same MD5
as Section 11.6's promotion) and runs it image-by-image over the same 19,466-image held-out test
split (`data/splits/<genus>/test.txt`) that produced Section 11.3's numbers, recording per image:
genus, season, top-1-correct, top-3-correct, top-1 confidence. Each image's season is joined from
`data/splits/manifest.csv`'s own `season` column (derived from GBIF `event_date`) by exact
`local_path` match — no new season inference, no re-derivation, the same column plan 02/iteration 2
already computed and iteration 3's corpus report already used.

**Sanity check against Section 11.3/11.4, exact match.** Pooled over all 19,466 rows regardless of
season: top-1 = 67.42% (13,119/19,466), top-3 = 85.24% (16,596/19,466) — identical to Section
11.4's reported pooled 67.4%/85.2% to rounding, and Abies/Tamarix/Ceratonia's per-genus top-3
recomputed from this file (89.67%, 95.04%, 90.63%) match Section 11.3's table exactly. This
confirms the same model, same test split, no measurement drift — the breakdown below is a
re-slicing of the identical evidence, not a new measurement run that could disagree with Section 11.

**Season coverage: 19,466/19,466 test images (100%) matched a manifest row — none dropped, none
missing.** Of those, 27 (0.14%) carry `season=unknown` in the manifest itself (GBIF `event_date`
missing or unparseable for that specific image, an existing category from Section 3b/11.1, not a
new gap introduced by this join) rather than one of the four calendar seasons; these 27 are spread
thinly across several genera (Castanea 1, Ostrya 2, Pyrus 1, Tamarix 1, Tilia 1, Ceratonia 9,
Phillyrea 10, Pistacia 2) and are excluded from the four-season breakdown below on the same
insufficient-samples logic as every other thin cell (Section 12.4) — reported here for
transparency, not silently folded into any season.

**Minimum sample threshold: n ≥ 30 per genus×season cell**, the same `TEST_REPORTING_THRESHOLD`
constant Section 0/`evaluate_accuracy.py` already uses for the whole-year per-genus table. A cell
below 30 images is reported as `insufficient-samples` with its raw count, never as a percentage,
and never folded into any mean — the same D-03 discipline this document holds itself to throughout,
applied at the season level.

**Raw per-image results: `spike/species-recognition/eval/results/per_genus_per_season.csv`
(19,466 rows, one per test image) — generated but not committed to git, and this is a deliberate,
forced adaptation of the task's original instruction, not an oversight.** The `spike/` tree is
gitignored project-wide by explicit design (`.gitignore`: "Species-recognition spike (Phase 1) is
throwaway by design"; `spike/species-recognition/README.md`: "This tree is throwaway... Its only
durable output is `docs/technical/species-recognition-spike-measurements-v1.md`"), consistent with
every prior iteration's `eval/results*/` CSVs, none of which were ever committed either. In this
specific worktree the constraint is doubly enforced: `spike/` is a symlink to the checkout at
`/Users/florian/Projects/cortege` (another session's working tree, per this plan's own setup), and
git refuses any operation on a path traversing a symlink component (`git add
spike/species-recognition/eval/results/per_genus_per_season.csv` fails with `fatal: pathspec ...
is beyond a symbolic link`, verified directly). **The durable, committed artefact is this section's
cross-tabulation below**, built from that raw file — the same "commit the raw numbers before
interpretation" discipline Section 11.3 established (commit `094def3`) is applied here to the raw
*table*, the actual committable output, immediately below, before any of this section's
interpretation (12.3 onward, a separate commit).

### 12.2 The 34 × 4 cross-tabulation — raw numbers, committed before interpretation

**Exactly as computed from `per_genus_per_season.csv`, one row per genus, one column-triple
(n, top-1, top-3) per season.** Cells below the n≥30 threshold read `insufficient` for both
accuracy figures — their raw count is still shown in the `n` column, never dropped, never averaged
in. Interpretation of this table (season margins, thin-cell discussion, autumn-vs-overall
comparison, verdict) follows in 12.3–12.6.

| genus | spring n | spring top1 | spring top3 | summer n | summer top1 | summer top3 | autumn n | autumn top1 | autumn top3 | winter n | winter top1 | winter top3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Abies | 142 | 71.8% (102/142) | 90.8% (129/142) | 150 | 70.0% (105/150) | 86.0% (129/150) | 178 | 68.5% (122/178) | 89.9% (160/178) | 130 | 70.8% (92/130) | 92.3% (120/130) |
| Acer | 373 | 65.7% (245/373) | 83.6% (312/373) | 153 | 64.7% (99/153) | 80.4% (123/153) | 4 | insufficient | insufficient | 70 | 34.3% (24/70) | 67.1% (47/70) |
| Alnus | 162 | 66.0% (107/162) | 78.4% (127/162) | 171 | 59.6% (102/171) | 81.3% (139/171) | 171 | 53.2% (91/171) | 73.1% (125/171) | 96 | 57.3% (55/96) | 76.0% (73/96) |
| Arbutus | 144 | 75.7% (109/144) | 87.5% (126/144) | 141 | 87.2% (123/141) | 94.3% (133/141) | 174 | 79.9% (139/174) | 93.1% (162/174) | 141 | 78.0% (110/141) | 89.4% (126/141) |
| Betula | 203 | 66.0% (134/203) | 83.7% (170/203) | 191 | 53.9% (103/191) | 78.5% (150/191) | 99 | 59.6% (59/99) | 83.8% (83/99) | 107 | 70.1% (75/107) | 85.0% (91/107) |
| Carpinus | 201 | 64.2% (129/201) | 83.6% (168/201) | 168 | 58.3% (98/168) | 79.8% (134/168) | 152 | 59.9% (91/152) | 80.9% (123/152) | 79 | 50.6% (40/79) | 77.2% (61/79) |
| Castanea | 146 | 67.1% (98/146) | 78.1% (114/146) | 260 | 80.8% (210/260) | 89.2% (232/260) | 158 | 75.3% (119/158) | 85.4% (135/158) | 35 | 45.7% (16/35) | 60.0% (21/35) |
| Celtis | 174 | 60.3% (105/174) | 80.5% (140/174) | 151 | 62.9% (95/151) | 82.1% (124/151) | 176 | 58.5% (103/176) | 82.4% (145/176) | 99 | 55.6% (55/99) | 75.8% (75/99) |
| Cupressus | 131 | 74.0% (97/131) | 90.8% (119/131) | 132 | 73.5% (97/132) | 90.9% (120/132) | 136 | 74.3% (101/136) | 91.2% (124/136) | 131 | 68.7% (90/131) | 90.8% (119/131) |
| Fagus | 216 | 64.8% (140/216) | 81.9% (177/216) | 177 | 68.4% (121/177) | 84.7% (150/177) | 99 | 63.6% (63/99) | 78.8% (78/99) | 107 | 72.0% (77/107) | 88.8% (95/107) |
| Fraxinus | 199 | 45.2% (90/199) | 74.4% (148/199) | 227 | 58.1% (132/227) | 84.6% (192/227) | 97 | 41.2% (40/97) | 75.3% (73/97) | 71 | 35.2% (25/71) | 67.6% (48/71) |
| Juglans | 143 | 51.7% (74/143) | 70.6% (101/143) | 207 | 62.8% (130/207) | 86.0% (178/207) | 161 | 63.4% (102/161) | 87.0% (140/161) | 78 | 56.4% (44/78) | 73.1% (57/78) |
| Juniperus | 188 | 71.8% (135/188) | 90.4% (170/188) | 171 | 74.9% (128/171) | 91.2% (156/171) | 79 | 68.4% (54/79) | 88.6% (70/79) | 159 | 69.2% (110/159) | 91.8% (146/159) |
| Larix | 153 | 69.3% (106/153) | 86.9% (133/153) | 207 | 70.0% (145/207) | 87.4% (181/207) | 167 | 77.8% (130/167) | 89.2% (149/167) | 72 | 69.4% (50/72) | 86.1% (62/72) |
| Malus | 208 | 62.0% (129/208) | 82.2% (171/208) | 200 | 59.5% (119/200) | 78.5% (157/200) | 140 | 60.7% (85/140) | 80.7% (113/140) | 13 | insufficient | insufficient |
| Ostrya | 145 | 61.4% (89/145) | 78.6% (114/145) | 185 | 75.7% (140/185) | 89.7% (166/185) | 132 | 64.4% (85/132) | 82.6% (109/132) | 76 | 51.3% (39/76) | 84.2% (64/76) |
| Pinus | 283 | 70.3% (199/283) | 91.9% (260/283) | 108 | 75.9% (82/108) | 88.0% (95/108) | 3 | insufficient | insufficient | 184 | 75.0% (138/184) | 92.4% (170/184) |
| Picea | 140 | 60.7% (85/140) | 90.7% (127/140) | 149 | 69.8% (104/149) | 91.9% (137/149) | 180 | 56.7% (102/180) | 83.3% (150/180) | 126 | 67.5% (85/126) | 90.5% (114/126) |
| Populus | 212 | 46.7% (99/212) | 76.9% (163/212) | 190 | 63.7% (121/190) | 82.6% (157/190) | 89 | 60.7% (54/89) | 82.0% (73/89) | 107 | 55.1% (59/107) | 77.6% (83/107) |
| Prunus | 337 | 61.4% (207/337) | 82.5% (278/337) | 159 | 43.4% (69/159) | 78.0% (124/159) | 1 | insufficient | insufficient | 103 | 58.3% (60/103) | 77.7% (80/103) |
| Pyrus | 193 | 65.3% (126/193) | 87.0% (168/193) | 154 | 63.0% (97/154) | 83.8% (129/154) | 144 | 61.1% (88/144) | 81.9% (118/144) | 71 | 53.5% (38/71) | 67.6% (48/71) |
| Quercus_deciduae | 157 | 66.2% (104/157) | 81.5% (128/157) | 166 | 74.7% (124/166) | 81.9% (136/166) | 65 | 80.0% (52/65) | 90.8% (59/65) | 79 | 77.2% (61/79) | 88.6% (70/79) |
| Quercus_sempervirens | 131 | 62.6% (82/131) | 77.9% (102/131) | 131 | 71.0% (93/131) | 82.4% (108/131) | 168 | 76.8% (129/168) | 93.5% (157/168) | 138 | 69.6% (96/138) | 87.0% (120/138) |
| Salix | 187 | 73.8% (138/187) | 91.4% (171/187) | 285 | 66.7% (190/285) | 87.7% (250/285) | 60 | 51.7% (31/60) | 73.3% (44/60) | 66 | 40.9% (27/66) | 65.2% (43/66) |
| Sorbus | 205 | 81.0% (166/205) | 86.8% (178/205) | 233 | 80.3% (187/233) | 90.1% (210/233) | 144 | 70.1% (101/144) | 87.5% (126/144) | 16 | insufficient | insufficient |
| Tamarix | 150 | 87.3% (131/150) | 94.0% (141/150) | 160 | 88.8% (142/160) | 95.0% (152/160) | 136 | 94.1% (128/136) | 96.3% (131/136) | 97 | 82.5% (80/97) | 94.8% (92/97) |
| Taxus | 87 | 72.4% (63/87) | 86.2% (75/87) | 156 | 71.8% (112/156) | 90.4% (141/156) | 149 | 87.2% (130/149) | 96.0% (143/149) | 141 | 66.0% (93/141) | 92.9% (131/141) |
| Tilia | 178 | 56.2% (100/178) | 74.7% (133/178) | 216 | 67.6% (146/216) | 82.4% (178/216) | 143 | 58.7% (84/143) | 80.4% (115/143) | 37 | 24.3% (9/37) | 54.1% (20/37) |
| Ulmus | 181 | 44.2% (80/181) | 71.3% (129/181) | 196 | 55.1% (108/196) | 75.5% (148/196) | 154 | 54.5% (84/154) | 79.2% (122/154) | 67 | 28.4% (19/67) | 73.1% (49/67) |
| Ceratonia | 93 | 73.1% (68/93) | 91.4% (85/93) | 70 | 77.1% (54/70) | 90.0% (63/70) | 139 | 80.6% (112/139) | 91.4% (127/139) | 52 | 76.9% (40/52) | 86.5% (45/52) |
| Cercis | 229 | 87.8% (201/229) | 92.6% (212/229) | 156 | 82.7% (129/156) | 90.4% (141/156) | 133 | 78.2% (104/133) | 88.7% (118/133) | 53 | 64.2% (34/53) | 75.5% (40/53) |
| Olea | 138 | 71.0% (98/138) | 92.0% (127/138) | 142 | 73.2% (104/142) | 90.1% (128/142) | 171 | 75.4% (129/171) | 92.4% (158/171) | 140 | 80.7% (113/140) | 90.0% (126/140) |
| Phillyrea | 140 | 82.1% (115/140) | 94.3% (132/140) | 135 | 77.8% (105/135) | 89.6% (121/135) | 154 | 81.2% (125/154) | 92.9% (143/154) | 107 | 74.8% (80/107) | 93.5% (100/107) |
| Pistacia | 137 | 77.4% (106/137) | 92.0% (126/137) | 142 | 76.1% (108/142) | 86.6% (123/142) | 168 | 80.4% (135/168) | 94.6% (159/168) | 122 | 79.5% (97/122) | 90.2% (110/122) |

**5 of 136 cells (34 genera × 4 seasons) fall below the n≥30 threshold: Acer autumn (n=4), Pinus
autumn (n=3), Prunus autumn (n=1), Malus winter (n=13), Sorbus winter (n=16).** No cell has zero
images. Discussed in 12.4.

### 12.3 Season margins — does accuracy degrade in autumn, in aggregate?

**Two readings, reported side by side per D-03's own discipline: neither is a substitute for the
per-genus table above, both are context only, and the pooled one is the one that answers "with
counts" literally.**

**Pooled (image-weighted) top-1/top-3 by season, all 34 genera combined:**

| season | n | top-1 | top-3 |
|---|---:|---:|---:|
| spring | 6,106 | 66.44% (4,057/6,106) | 84.41% (5,154/6,106) |
| summer | 5,839 | 68.88% (4,022/5,839) | 85.72% (5,005/5,839) |
| **autumn** | **4,324** | **68.83% (2,976/4,324)** | **86.47% (3,739/4,324)** |
| winter | 3,170 | 64.61% (2,048/3,170) | 84.13% (2,667/3,170) |
| unknown | 27 | 77.78% (21/27) | 100.00% (27/27) |

**Autumn is the highest-scoring season of the four on the pooled figure, not the lowest** — 86.47%
top-3, ahead of summer (85.72%), spring (84.41%) and winter (84.13%, the actual low point).
`unknown`'s 100% top-3 on 27 images is not a real finding — 27 images is far below any reporting
threshold and is shown only for completeness, per 12.1's coverage note.

**Unweighted per-genus mean, same ranking, computed only over genera clearing n≥30 for that season
(the genera below threshold are excluded, never averaged in at a percentage computed on a handful
of images):**

| season | genera included | mean top-1 | mean top-3 | genera excluded (n<30) |
|---|---:|---:|---:|---|
| spring | 34/34 | 66.97% | 84.63% | none |
| summer | 34/34 | 69.38% | 85.92% | none |
| **autumn** | **31/34** | **68.26%** | **86.01%** | **Acer (4), Pinus (3), Prunus (1)** |
| winter | 32/34 | 61.21% | 81.32% | Malus (13), Sorbus (16) |

**Read plainly: for the 31 (pooled) or up-to-34 (per-genus mean) genera this table can actually
speak to, the model does not degrade in autumn — autumn accuracy is comparable to, and on both
measures here slightly better than, spring and summer, and clearly better than winter.** Winter is
the season that reads weakest on both the pooled and unweighted figures, an unplanned secondary
finding (12.6).

**This aggregate reading is not the whole answer, and must not be read as covering the three
genera whose autumn representation this document has flagged since Section 3b.** Acer, Pinus and
Prunus contribute a combined 8 images to autumn's 4,324-image pool (Acer 4, Pinus 3, Prunus 1) —
under 0.2% of the autumn test set. Removing them from the pooled or unweighted figures above moves
neither number meaningfully, precisely *because* they are barely present in it — which is the
finding, not an artefact of the aggregation. The season-margin table answers "does the model
degrade in autumn, on average, for the genera this test split can measure in autumn" — it does not
and cannot answer that question for these three specifically. 12.4 and 12.6 address them directly.

### 12.4 Insufficient-sample cells — what the thinness itself says

**Three of the five thin cells are the same three genera Section 11.1/11.5 already named as
near-absent in the autumn *training* corpus, now confirmed as equally near-absent in the autumn
*test* split — the same corpus-composition constraint propagates through both halves of the
pipeline, as expected, since train/val/test are all drawn from the same season-stratified
`prepare_dataset.py` output at a fixed 80/10/10 split.**

| genus | season | n | raw top1/top3 hits | verdict |
|---|---|---:|---|---|
| Acer | autumn | 4 | 1/3 | insufficient — cannot assess; matches Section 11.5's 1.1% autumn training share |
| Pinus | autumn | 3 | 3/3 | insufficient — cannot assess; matches Section 11.5's 1.0% autumn training share |
| Prunus | autumn | 1 | 0/1 | insufficient — cannot assess; matches Section 11.5's 0.5% autumn training share |
| Malus | winter | 13 | 7/9 | insufficient — cannot assess; a new finding, not previously flagged at the corpus level |
| Sorbus | winter | 16 | 10/12 | insufficient — cannot assess; a new finding, not previously flagged at the corpus level |

**Reporting the raw hit counts above is explicitly not a percentage claim** — 3/3 for Pinus autumn
looks like "100%" but is not reported as such anywhere in 12.2/12.3's tables, per this document's
own D-03 rule (Section 0: "never silently dropped and never folded into an average"): at n=3, one
different test image would swing the figure by 33 points, which is not a resolution this document
treats as evidence of anything.

**Malus and Sorbus's winter thinness is a genuinely new observation this section surfaces — it was
not visible in any prior section, because Sections 3b/11.1/11.5's seasonal-skew analysis was scoped
to autumn specifically (the field-survey season), not to every season.** Both classes' training
corpora evidently skew away from winter GBIF observations specifically (consistent with these being
predominantly spring/summer-flowering Rosaceae fruit trees, less commonly photographed in winter
dormancy) — worth a note for any future corpus-expansion effort, though outside this section's
autumn-focused remit to pursue further.

### 12.5 Autumn vs. overall, per genus — who holds up, who doesn't

**For the 31 genera with a measurable autumn cell, autumn top-3 compared directly against that same
genus's whole-year top-3 from Section 11.3** (both computed from the identical underlying test
predictions — the "overall" figure here is the same number Section 11.3 already reports, recomputed
from this section's raw file as a cross-check, and it matches exactly).

| genus | overall top3 (n) | autumn top3 (n) | delta |
|---|---:|---:|---:|
| Abies | 89.7% (538/600) | 89.9% (160/178) | +0.2pp |
| Acer | 80.8% (485/600) | insufficient (3/4) | n/a |
| Alnus | 77.3% (464/600) | 73.1% (125/171) | -4.2pp |
| Arbutus | 91.2% (547/600) | 93.1% (162/174) | +1.9pp |
| Betula | 82.3% (494/600) | 83.8% (83/99) | +1.5pp |
| Carpinus | 81.0% (486/600) | 80.9% (123/152) | -0.1pp |
| Castanea | 83.8% (503/600) | 85.4% (135/158) | +1.6pp |
| Celtis | 80.7% (484/600) | 82.4% (145/176) | +1.7pp |
| Cupressus | 90.9% (482/530) | 91.2% (124/136) | +0.2pp |
| Fagus | 83.5% (500/599) | 78.8% (78/99) | -4.7pp |
| Fraxinus | 77.6% (461/594) | 75.3% (73/97) | -2.4pp |
| Juglans | 80.8% (476/589) | 87.0% (140/161) | +6.1pp |
| Juniperus | 90.8% (542/597) | 88.6% (70/79) | -2.2pp |
| Larix | 87.6% (525/599) | 89.2% (149/167) | +1.6pp |
| Malus | 80.2% (450/561) | 80.7% (113/140) | +0.5pp |
| Ostrya | 84.3% (455/540) | 82.6% (109/132) | -1.7pp |
| Pinus | 91.3% (528/578) | insufficient (3/3) | n/a |
| Picea | 88.7% (528/595) | 83.3% (150/180) | -5.4pp |
| Populus | 79.6% (476/598) | 82.0% (73/89) | +2.4pp |
| Prunus | 80.5% (483/600) | insufficient (1/1) | n/a |
| Pyrus | 82.4% (464/563) | 81.9% (118/144) | -0.5pp |
| Quercus_deciduae | 84.2% (393/467) | 90.8% (59/65) | +6.6pp |
| Quercus_sempervirens | 85.7% (487/568) | 93.5% (157/168) | +7.7pp |
| Salix | 84.9% (508/598) | 73.3% (44/60) | -11.6pp |
| Sorbus | 88.0% (526/598) | 87.5% (126/144) | -0.5pp |
| Tamarix | 95.0% (517/544) | 96.3% (131/136) | +1.3pp |
| Taxus | 91.9% (490/533) | 96.0% (143/149) | +4.0pp |
| Tilia | 77.7% (447/575) | 80.4% (115/143) | +2.7pp |
| Ulmus | 74.9% (448/598) | 79.2% (122/154) | +4.3pp |
| Ceratonia | 90.6% (329/363) | 91.4% (127/139) | +0.7pp |
| Cercis | 89.5% (511/571) | 88.7% (118/133) | -0.8pp |
| Olea | 91.2% (539/591) | 92.4% (158/171) | +1.2pp |
| Phillyrea | 92.7% (506/546) | 92.9% (143/154) | +0.2pp |
| Pistacia | 91.1% (520/571) | 94.6% (159/168) | +3.6pp |

**21 of the 31 measurable genera fall within ±3 percentage points of their whole-year figure** —
the majority read as noise-level ranking shuffle, not a real season effect, at this test split's
resolution (n≈60–280 per autumn cell for the measured genera).

**4 genera show a real autumn-specific weakness beyond ±3pp, all at adequate sample sizes (n≥60,
not thin cells): Salix (-11.6pp, 73.3% on n=60), Picea (-5.4pp, 83.3% on n=180), Fagus (-4.7pp,
78.8% on n=99), Alnus (-4.2pp, 73.1% on n=171).** Salix's drop is the largest single finding in this
section by margin — nearly 12 points below its own whole-year figure, on a sample size (60) well
above the insufficient-samples threshold, so this is not a resolution-limit artefact the way the
three near-zero-autumn genera are. This genus-specific autumn weakness was invisible in every prior
section of this document, since Section 11.3's whole-year Salix figure (84.9%) reads as an
unremarkable mid-table result.

**6 genera improve by more than 3pp in autumn: Quercus_sempervirens (+7.7pp), Quercus_deciduae
(+6.6pp), Juglans (+6.1pp), Ulmus (+4.3pp), Taxus (+4.0pp), Pistacia (+3.6pp).** No obvious common
cause across these six (different families: Fagaceae, Juglandaceae, Ulmaceae, Taxaceae,
Anacardiaceae) — reads as genuine per-genus variation rather than a shared seasonal-feature
explanation, consistent with 12.3's finding that autumn is not a systematically weaker season.

**Tamarix — the one genus that already clears the D-02 95% top-3 bar overall (Section 11.3,
95.04%) — holds up, and slightly strengthens, in autumn specifically: 96.3% (131/136), +1.3pp.**
This is the single most decision-relevant number in this section for D-04's partial-go question:
the one genus this document can currently recommend enabling a suggestion for does not lose its
evidentiary basis in the season that matters.

### 12.6 Verdict — holds up, degrades, or cannot tell?

**All three answers apply, to different, explicitly-named parts of the genus list — a single
one-line verdict across all 34 genera would misstate the evidence.**

**For 27 of the 34 genera (the 31 with a measurable autumn cell, minus the 4 flagged in 12.5): the
model holds up in autumn.** Both the pooled and unweighted season margins (12.3) place autumn at or
above spring/summer/winter, and 21 of 31 measurable genera sit within ±3pp of their whole-year
figure. This includes Tamarix, the genus with the strongest current evidentiary claim to a partial
go — its autumn figure is, if anything, the strongest point in favour of shipping a suggestion for
that genus specifically.

**For 4 genera — Salix, Picea, Fagus, Alnus — it degrades, at a sample size large enough to trust
the finding (n=60–180, all well above the insufficient-samples threshold).** Salix's -11.6pp drop
in particular is a genuine, adequately-evidenced autumn-specific weakness that the whole-year
figure in Section 11.3 does not surface at all. None of these four clear the D-02 bar even at their
whole-year figure, so this does not change any go/no-go call already on record, but it is relevant
if a future iteration considers a narrower per-genus enablement list, since it shows the whole-year
figure alone is not always a safe proxy for autumn-specific performance even for genera with ample
autumn test data.

**For 3 genera — Acer, Pinus, Prunus — we cannot tell from this data, and this is not a
resolvable gap within this measurement task.** These are exactly the three genera Section 3b first
flagged at a 30-image composition sample, Section 10.1 confirmed at ~5,000-candidate scale, and
Section 11.1/11.5 confirmed a third time at ~6,000–10,000-candidate scale as having near-zero
autumn representation in GBIF's CC0/CC-BY `StillImage` collection specifically. That absence
propagates directly into the test split (12.4: 1–4 autumn images each) and therefore into this
evaluation — there is no way to measure autumn accuracy for these three genera without autumn test
images to measure it on, regardless of how the rest of the corpus or model changes. **What would be
needed: real autumn-season photographs of Acer, Pinus and Prunus from a source other than GBIF's
CC0/CC-BY `StillImage` collection**, which three successive corpus-expansion passes have now
confirmed does not hold a usable quantity of autumn imagery for these genera at any scale tried so
far (Section 11.5). The two live options already on record elsewhere in this document: a dedicated
field-photo collection run in autumn (D-16's still-open field-validation gap, Section 6 — currently
empty, no field photographs exist at all for any genus), or a differently-licensed image source not
yet surveyed. Neither is this measurement task's to resolve; both are noted here so the ADR has the
concrete next step in front of it rather than an open-ended "more data" caveat.

> **CORRECTED — Section 13.1 (2026-09-25).** "Not a resolvable gap within this measurement task" and
> "a real property of GBIF's CC0/CC-BY `StillImage` holdings... not a sampling artefact" are both
> wrong. GBIF's `month` filter — never used by the corpus-building fetch — returns tens of thousands
> of autumn-dated, licence-clean records for all three genera (40,603 Acer, 23,517 Prunus, 34,016
> Pinus); the gap was a fetch-pipeline bug, not a data ceiling. See Section 13.1 for the root cause
> and Section 14 for the fix and the resulting autumn measurement. Left here, uncorrected in place,
> so the wrong claim and its correction are both visible to a later reader.

**Unplanned secondary finding: winter, not autumn, is the season with the weakest aggregate
accuracy (12.3: 84.13% pooled, 81.32% unweighted mean, both the lowest of the four) and the season
with its own two thin cells (Malus, Sorbus — 12.4).** IBP surveys are scoped to autumn, so this does
not bear on the current go/no-go question, but is recorded for completeness in case survey timing
is ever reconsidered.

**Bears directly on the US-C9 / D-04 decision this document was commissioned to inform:** the
central Section 11.3 finding — 1 of 34 genera (Tamarix) currently clears the D-02 bar — is not
weakened by a season-specific gap; if anything Tamarix's autumn figure is marginally stronger than
its whole-year one. The genuine, unresolved gap this section adds to the evidence base is genus-
specific, not model-wide: Acer, Pinus and Prunus each have a respectable whole-year top-3 figure
(80.8%, 91.3%, 80.5% — Section 11.3, none clearing D-02 but none alarming either) that carries zero
autumn-specific evidence behind it. Whether that gap is acceptable to ship against, given the
survey season, or must be closed first, is the ADR's call (plan 01-06) — this section's job is to
put that specific, previously-invisible gap in evidence, which it now does.

## 13. Iteration 4 — targeted temperate-genus rebalance: source reconnaissance (report-back-early checkpoint)

**Status: reconnaissance only. No corpus expansion, no retrain, has happened yet as of this
section.** The corpus-expansion instructions this iteration works under explicitly required
reporting alternative-source findings back before committing to a long download; this section is
that report. Levers 3 (longer training schedule) and 4 (stronger backbone) are deferred until the
corpus question below is settled, since both depend on what corpus they would train against.

Trigger: the user reviewed Section 12's per-genus × per-season table and observed that the model is
strong on genera he will not survey (Mediterranean/evergreen: Olea, Ceratonia, Arbutus, Pistacia,
Phillyrea, Tamarix, Cupressus, Juniperus, Taxus, 91–96%) and weaker on the genera that dominate
Île-de-France forests (temperate deciduous: Fraxinus 78%, Ulmus 75%, Tilia 78%, Carpinus 81%,
Acer 81%, Alnus 77%, Populus 80%, Prunus 80%, Betula 82%, Fagus 83%, Quercus deciduous 84%), and
was specifically disappointed with spring (the weakest pooled season at 84.4%, with Fraxinus 74%,
Ulmus 71%, Juglans 71%, Tilia 75% at their worst in that season).

### 13.1 Primary finding: Section 11.5's "real property of GBIF's holdings, not a sampling
artefact" claim for Acer/Pinus/Prunus autumn scarcity does not hold up

Section 11.5 concluded, after three successive corpus-expansion passes each showing near-zero
autumn representation for Acer, Pinus and Prunus, that "this reads as a real property of GBIF's
CC0/CC-BY `StillImage` holdings for these three genera specifically, not a sampling artefact that a
larger fetch would eventually correct." Re-querying GBIF's occurrence-search API directly with a
`month` filter (a parameter `fetch_candidates_for_key` in `prepare_dataset.py` has never used)
contradicts this:

| Genus | GBIF CC0+CC-BY `StillImage`, autumn (month=9,10,11) | Our corpus's actual autumn count (Section 11.1/seasonal_balance_report.json) |
|---|---|---|
| Acer | 40,603 | 66 |
| Prunus | 23,517 | 30 |
| Pinus | 34,016 | 60 |

The true autumn-dated, licence-clean, still-image pool for these three genera is four to five orders
of magnitude larger than what three iterations of this pipeline ever captured. **This was a
pipeline bug, not a GBIF scarcity.** Reading `fetch_candidates_for_key` (`prepare_dataset.py:277`)
identifies two concrete causes:

1. **The fetch is not season-aware.** It walks GBIF search results in whatever order the API
   returns them (sequential `offset` pages, no `month` filter, no date sort), then hands whatever
   it collected to `season_stratified_select` afterward. If autumn-dated records are not
   well-distributed across the *early* pages the fetch actually reaches, the season-stratified
   *selection* step has nothing autumn-dated to select from, no matter how much autumn data exists
   deeper in GBIF's index.
2. **The early-exit is unsound for high-supply genera.** `if not got_any and offset > page_size * 2:
   break` (line 346) stops paginating once one full pass across both accepted licences at a given
   offset adds zero new candidates. This is a reasonable heuristic for a genus actually near its
   ceiling (e.g. Ceratonia, true pool ~4,200), but for a genus with a 200,000+ true pool a single
   thin page — one page's worth of already-seen URLs, transient fetch failures folded into `data is
   None: continue`, or a same-page run of NC/ND-licensed media — trips the same early-exit and
   silently truncates the walk far short of the genus's real ceiling, well before `MAX_SEARCH_OFFSET
   = 30000` is ever reached.

Verified directly: `curl "https://api.gbif.org/v1/occurrence/search?genusKey=3189834&mediaType=
StillImage&license=CC0_1_0&license=CC_BY_4_0&month=9&month=10&month=11&limit=2"` returns
`"count": 40603` with real Acer records (`Acer platanoides`, `eventDate: 2026-09-04`, licence
`CC-BY-4.0`) on the first page. The fix is a scoped change to the existing, already-trusted GBIF
pipeline — not a new source: fetch per season using GBIF's `month` parameter directly (at minimum
for Acer, Pinus, Prunus; ideally for every weak temperate genus, so spring-weak genera get the same
targeted treatment), and either remove or tighten the early-exit heuristic so a single thin page
cannot terminate the walk for a genus with a confirmed large true pool. This reopens Section 12.6's
"cannot tell... not a resolvable gap within this measurement task" conclusion for Acer/Pinus/Prunus
autumn accuracy — it was not unresolvable, it was unattempted with the right query shape.

### 13.2 Secondary finding: the weak temperate genera generally, not just those three, are far
below GBIF's real ceiling — the corpus caps were self-imposed, not GBIF-imposed

`TARGET_TOTAL_PER_CLASS = 6000` / `MAX_CANDIDATES_TO_FETCH = 8000` were sized against iteration 2's
finding that "most classes' real ceiling sits at 4,566–5,303" (prepare_dataset.py comment, line
~189) — true for the Mediterranean/evergreen genera the corpus was originally built to cover
uniformly, but not for the temperate broadleaves this iteration is targeting:

| Genus | Our corpus (downloaded, iteration 3) | GBIF true CC0+CC-BY `StillImage` pool | Headroom |
|---|---|---|---|
| Fraxinus | 5,946 | 72,521 | 12.2x |
| Ulmus | 5,979 | 65,671 | 11.0x |
| Tilia | 5,750 | 40,566 | 7.1x |
| Carpinus | 6,000 | 30,253 | 5.0x |
| Acer | 6,000 | 235,139 | 39.2x |
| Alnus | 6,000 | 76,096 | 12.7x |
| Salix | 5,986 | 499,799 | 83.5x |
| Prunus | 5,999 | 228,832 | 38.1x |
| Populus | 5,978 | 100,817 | 16.9x |
| Pyrus | 5,630 | 20,649 | 3.7x |
| Malus | 5,615 | 30,692 | 5.5x |
| Betula | 6,000 | 106,052 | 17.7x |
| Fagus | 5,988 | 54,888 | 9.2x |
| Castanea | 6,000 | 22,811 | 3.8x |
| Ostrya | 5,401 | 12,541 | 2.3x |
| Celtis | 5,998 | 46,615 | 7.8x |
| Juglans | 5,891 | 28,029 | 4.8x |
| Sorbus | 5,981 | 46,009 | 7.7x |
| Pinus | (not a target genus in this pass) | 186,314 | — |

For contrast, the Mediterranean/evergreen genera the user found already-strong are close to their
true, much smaller ceilings — e.g. Ceratonia's true pool is ~4,200 (confirmed against Section
11.5's 3,629-candidate figure, same order of magnitude), Olea ~13,900, Phillyrea ~8,400,
Cupressus ~12,700 — consistent with why a flat 6,000-per-class target under-serves the temperate
genera specifically without over-serving the Mediterranean ones. **Raising the per-class cap
non-uniformly — targeted at the weak temperate list, left alone for the genera already near their
true ceiling — is available on the existing pipeline today, with no new source and no licence risk,
and has an order of magnitude more headroom than iteration 3 used.**

Spring-specific note (the season the user is most disappointed with): unlike the Acer/Pinus/Prunus
autumn case, the current corpus's spring shortfall for Fraxinus/Ulmus/Tilia/Juglans is not an
absolute-scarcity problem in the same way — `seasonal_balance_report.json` shows Fraxinus already
achieved 2,116 spring images against a 1,500 quota (i.e. spring was not starved in the fetched
pool). The spring weakness is more likely a genuine difficulty signal — spring foliage emergence
across these genera looks more similar to each other than summer/autumn foliage does — that more
volume (13.2) plus a longer training schedule (lever 3, deferred) is the more relevant lever for,
rather than a fetch-pipeline fix the way autumn was for Acer/Pinus/Prunus.

### 13.3 Source-by-source report

**Tela Botanica — checked, access-blocked (not licence-blocked); needs a human decision to pursue
further.**
The upload-consent text in the CEL (Carnet en Ligne) web app states contributed photos are
published "sous licence CC-BY-SA 2.0 FR" — that clears this iteration's licence gate (CC0/CC-BY/
CC-BY-SA minimum). Tela Botanica's CEL is independently confirmed as a GBIF publisher (dataset key
`baa86fb2-7346-4507-a34f-44e4c1bd0d57`, 331,820 occurrence records) but **zero of those records
carry `StillImage` media in GBIF's index** (`occurrence/search?datasetKey=baa86fb2...&mediaType=
StillImage&limit=0` → `"count": 0`) — meaning Tela Botanica's photos are not reaching our existing
GBIF-sourced corpus at all today; it is a genuinely distinct, untapped pool if it can be reached
directly. It cannot be reached directly without a login: Tela Botanica's modern photo API
(`api-cel.tela-botanica.org/api/photos`, and every other `/api/*` path tried, including its own
Hydra API-docs endpoint) returned `403 "You must be logged into tela-botanica SSO system to access
this part of the app."` on every unauthenticated request. The older `api.tela-botanica.org/
service:cel/*` endpoints exist and respond `200`, but returned empty bodies for the query shapes
tried and no public bulk photo-search surfaced within the time spent. **Verdict: checked and
rejected on access, not licence — flagging as a blocker requiring an explicit human decision (create
a Tela Botanica account, confirm the SSO-gated API's terms of use actually permit automated/bulk
access under that account) rather than something to route around by scripting a login.** This
mirrors the plan's Rule 3 package-legitimacy exclusion in spirit: an access gate that requires a
human credential/ToS judgement call, not an auto-fixable blocker.

**Pl@ntNet-300K — checked, rejected on content coverage, not licence.**
Confirmed CC-BY-4.0 (Zenodo record 5645731, `access_right: open`). Rather than download the
31.6 GB image archive, pulled the 46 KB `plantnet300K_species_id_2_name.json` metadata file (via
`api-cel`'s sibling Seafile share API, `seafile.plantnet.org/api/v2.1/share-links/.../dirents/`) and
checked all 1,081 species names against the full weak-genus list (Fraxinus, Ulmus, Tilia, Carpinus,
Acer, Alnus, Salix, Prunus, Populus, Pyrus, Malus, Betula, Fagus, Castanea, Quercus, Ostrya, Celtis,
Juglans, Sorbus) plus a broader tree-genus sanity list (Abies, Picea, Larix, Cedrus, Platanus,
Robinia, Aesculus, Cercis, Morus, Ailanthus, Sambucus, Cornus, Corylus, Ilex, Taxus, Juniperus,
Cupressus, Olea, Ficus, etc.). **Zero matches for every genus on both lists except Liriodendron (2
species — an ornamental, not a CNPF Factor A class).** The dataset's actual composition, sampled
directly from the metadata, is herbaceous/weed/garden-plant/fern-weighted (`Lactuca virosa`,
`Pelargonium capitatum`, `Cirsium arvense`, `Tradescantia fluminensis`, `Mercurialis annua`,
`Dryopteris affinis`, ...). **Verdict: reject. Do not download the 31.6 GB archive — it would yield
nothing usable for any of the 34 CNPF genera.**

**iNaturalist direct API — usable, licence-clean, but low marginal value over fixing the existing
GBIF pipeline.**
`api.inaturalist.org/v1/observations` supports a licence filter
(`photo_license=cc0,cc-by,cc-by-sa`) and quality-grade/month filters directly. Acer:
103,988 research-grade, permissively-licensed observations total, 22,849 in autumn — same order of
magnitude as GBIF's own "iNaturalist Research-grade Observations" dataset
(`50c9509d-22c7-4a22-a47d-8c48425ef4a7`), which is almost certainly the dominant contributor to the
235,139-record GBIF total found in 13.2, i.e. largely the same underlying photos our existing
pipeline can already reach once 13.1's fix is applied. The one genuine addition iNaturalist-direct
offers is CC-BY-SA licensed photos, which GBIF's `license` facet for these genera showed essentially
none of (Fraxinus's facet: 44,181 CC-BY, 28,340 CC0, 93,556 CC-BY-NC — rejected — 0 CC-BY-SA).
**Verdict: usable if needed later, but de-prioritised — the existing GBIF pipeline, once fixed
(13.1) and scaled (13.2), already reaches most of the same pool with less new integration risk.**

**Wikimedia Commons — usable, licence-clean, moderate scale, best suited to closing residual
seasonal gaps after 13.1/13.2.**
Per-file licence is directly machine-readable (`imageinfo.extmetadata.LicenseShortName`, e.g.
confirmed `CC0` on sampled `Acer platanoides` files) — cleaner to verify per-image than GBIF's
occasionally-stale `license` field. Flat species-level categories are modest on their own
(`Category:Acer platanoides`: 68 files; `Category:Fraxinus excelsior`: 170; `Category:Quercus
robur`: 199; `Category:Ulmus minor`: 234) but each nests 18–30 subcategories (bark, leaves, flowers,
cultivars, seasonal) not counted in that flat figure — full yield needs a recursive category-tree
crawl, not attempted here. Notably, **genus-level season-specific categories exist** —
`Category:Acer in autumn` (36 files, 38 further subcats) and `Category:Fraxinus in autumn`
(6 files, 3 subcats) were confirmed to exist and be licence-tagged — small in absolute count but
exactly on-target for the seasonal gap. **Verdict: usable as a scoped supplement (with a recursive
category crawl + per-file licence check) once 13.1/13.2 are applied and a residual gap is measured
to still exist; not the first lever to pull.**

**PlantCLEF — not pursued for raw images; one side-lead on the backbone question (lever 4).**
PlantCLEF's published training corpora are themselves aggregated from GBIF, Pl@ntNet and herbaria
under mixed per-record licences requiring the same filtering our pipeline already does, with
substantial expected overlap against sources already queried — given the time budget for this
reconnaissance and 13.1/13.2's much larger and lower-risk headroom on the existing pipeline, this
was not investigated further for raw images. One find worth flagging for later, not now: a
CC-BY-4.0 "PlantCLEF 2024 pretrained models on the flora of south western Europe" artifact on
Zenodo — a DINOv2 ViT backbone fine-tuned on Pl@ntNet-derived European-flora imagery. Potentially
relevant to lever 4 (stronger backbone, domain-pretrained rather than generic ImageNet) in
principle, but a ViT/DINOv2 backbone does not obviously fit this plan's `.tflite`-export-with-
parity-check constraint the way MobileNetV3/EfficientNet do, and would need a dedicated export/size
feasibility check before being taken seriously as a lever-4 candidate. Flagged, not pursued.

### 13.4 Recommendation and priority order

1. **Fix `fetch_candidates_for_key`'s early-exit and add season-scoped (`month=`) fetching**, at
   minimum for Acer, Pinus, Prunus (autumn) and ideally for the full weak-genus list keyed to
   whichever season each is weakest in (13.1). This is a surgical change to the existing, trusted,
   already-licence-gated pipeline — no new source, no new licence risk — and directly reopens a gap
   (12.6) previously recorded as unresolvable.
2. **Raise the per-class fetch/target cap for the weak temperate genera specifically**, leaving the
   Mediterranean/evergreen genera's caps alone since they are already near their true, much smaller
   ceilings (13.2). Order-of-magnitude headroom exists for essentially every genus on the weak list.
3. **Wikimedia Commons** as a scoped supplementary source (recursive category crawl, per-file
   licence verification) only if a measured gap remains after 1–2.
4. **Tela Botanica**: blocked on SSO-gated access. Needs an explicit human decision (create an
   account, confirm the platform's ToS actually permit automated/bulk access) before further work —
   raising this as a checkpoint rather than proceeding unilaterally.
5. **Pl@ntNet-300K**: reject outright. Confirmed zero coverage of any of the 34 CNPF genera; do not
   spend the 31.6 GB download.
6. **iNaturalist direct**: not worth a separate integration; superseded by 1–2 on the existing
   pipeline.
7. **PlantCLEF**: images not pursued (redundant, mixed licence, low expected marginal yield vs.
   effort). Its CC-BY-4.0 pretrained European-flora backbone is flagged as a possible lever-4 lead
   for a later pass, pending an export-feasibility check against the `.tflite` constraint.

**What this changes about the corpus-expansion plan:** the highest-leverage, lowest-risk next step
is a targeted bug fix plus a non-uniform scale-up of the *existing* GBIF pipeline for the specific
weak genera — not new-source integration. This is faster, carries no new licence/ToS risk, and
(13.1) has a specific, already-confirmed supply of exactly the missing autumn imagery sitting in
GBIF today. Recommend running that fix-and-rescale pass first, measuring the result, and only then
deciding whether Wikimedia Commons or Tela Botanica are still needed to close any residual gap —
rather than committing hours of new-source integration work before the cheaper, lower-risk lever has
even been tried. Levers 3 (longer training schedule, EarlyStopping-driven) and 4 (stronger backbone)
remain open and are unaffected by this recommendation; they apply to whichever corpus results from
this decision.

**Coordinator decision (2026-09-25), relayed after independent verification of Section 13.1's
headline query against the live GBIF API: proceed with the pipeline-fix-first plan (Section 13.4
points 1–2); do not pursue Tela Botanica for now.** Tela Botanica remains parked, not closed: its
CC-BY-SA 2.0 FR licence is confirmed compatible with this iteration's gate, and its GBIF-published
CEL dataset carries zero `StillImage`-tagged records today (Section 13.3), so it stays the most
relevant candidate source if the temperate genera still fall short after this pass. Pl@ntNet-300K
and iNaturalist-direct are closed, as recommended.

## 14. Iteration 4 — execution

### 14.1 Corpus collection — complete

**Pipeline fix applied to `prepare_dataset.py` (gitignored, effects recorded here per the project's
established `spike/`-is-throwaway convention — see `01-04-SUMMARY.md` key-decisions for prior
iterations' identical treatment of `finetune.py`/`evaluate_accuracy.py`):**

- **Early-exit heuristic widened, not removed.** `fetch_candidates_for_key`'s loop used to stop
  paginating GBIF after a single page-round (2 pages' worth of offset, ~600) produced zero new
  candidates. Section 13.1 showed this is unsound for high-supply genera — a single thin page (a
  run of NC/ND-licensed media, a transient fetch failure, or a cluster of duplicate URLs) is not
  evidence a genus's true ceiling was reached. Threshold raised to 8 pages' worth of offset (2,400)
  before concluding a genus is exhausted. Genuinely licence-scarce genera (e.g. Ceratonia, true pool
  ~4,200) still stop promptly; they were never the problem.
- **Season-scoped fetching added.** A new `fetch_candidates_seasonal()` queries GBIF directly with
  its `month=` filter per season (winter/spring/summer/autumn), so season balance is achieved by
  asking for it directly rather than hoping a season-agnostic sequential walk happens to surface
  season-diverse records before the (still-present) ceiling/ceiling-adjacent early exit fires.
  Applied to the 20 weak temperate genera plus Pinus (see below).
- **Per-class target raised non-uniformly.** `WEAK_TEMPERATE_TARGET_TOTAL_PER_CLASS = 10,000` (up
  from the flat `TARGET_TOTAL_PER_CLASS = 6,000`), applied only to the 20 genera Section 13.2 found
  had the most headroom against GBIF's true ceiling and are the genera the user actually surveys:
  Fraxinus, Ulmus, Tilia, Carpinus, Acer, Alnus, Salix, Prunus, Populus, Pyrus, Malus, Betula,
  Fagus, Castanea, both Quercus classes, Ostrya, Celtis, Juglans, Sorbus. Cap chosen at 10,000, not
  each genus's full true ceiling (up to 499,799 for Salix) — bounded by disk, download wall-clock
  (empirically ~8–13 img/s sustained against GBIF once season-scoped, well above the ~0.1–0.2 img/s
  a first attempt hit while still trying to top up already-near-ceiling genera outside this list —
  see the `--only-classes`/`--only-weak-temperate` note below) and training wall-clock on this
  fanless MacBook Air, and comfortably below the smallest true ceiling in the list (Ostrya,
  ~12,541), so no class in it was expected to exhaust its real GBIF pool at this cap. The
  Mediterranean/evergreen genera were left at the unchanged 6,000 target and were not touched by
  this pass at all (see below) — Section 13.2 found they are already near their true, much smaller
  ceilings, so raising or even re-attempting their cap would have bought nothing.
- **Pinus: season-scoped fetch at its unchanged 6,000 target.** Pinus was not on the coordinator's
  cap-raise list, but the same instruction separately named it (with Acer and Prunus) for the
  autumn-specific fix. Pinus was already below its own 6,000 target (5,773 downloaded) when this
  iteration started, so it was routed through the same season-scoped fetch machinery
  (`SEASON_SCOPED_FETCH_GENERA = WEAK_TEMPERATE_GENERA | {"Pinus"}`) without raising its target —
  the fix asks for exactly the season shortfall (autumn 1,440 needed, summer 299 needed) rather
  than growing the total.
- **`--only-classes`/`--only-weak-temperate` CLI restriction added, and used.** A first run without
  it processed classes least-progressed-first across all 34 labels, which meant genera *outside*
  this iteration's target list but still below the unchanged 6,000 (Ceratonia, Cupressus, Taxus,
  Tamarix, Phillyrea, Cercis, Pistacia, Pinus, Olea, Picea, Juniperus) were attempted first —
  wasted effort, since their target did not change and most are already near their true, scarce
  ceiling: Ceratonia's attempted top-up ran at ~0.1–0.2 img/s (slow/scarce remaining candidates from
  its near-exhausted true pool) before being killed and restarted scoped to only the 20 weak
  temperate genera via `--only-weak-temperate`, followed by a separate `--only-classes=Pinus` pass.
  No corruption resulted — `write_outputs()`'s per-class checkpointing (Section 11, manifest-
  truncation-bug fix) meant the killed run's in-progress class (Ceratonia, not yet checkpointed)
  reverted cleanly to its prior state on restart, confirmed directly
  (`per_class_counts.json`'s `Ceratonia` entry unchanged after the restart).
- **Every existing safeguard kept, unmodified:** the CC0/CC-BY licence gate (`ACCEPTED_LICENSES`),
  homonym-safe `kingdom=Plantae` resolution, the per-species Quercus split
  (`QUERCUS_DECIDUOUS_SPECIES`/`QUERCUS_EVERGREEN_SPECIES`), the manifest-truncation-bug fix
  (`load_prior_manifest_by_class()`), the global shuffle (Section 10.2's fix, `collect_split()`),
  the hardened network deadlines with exponential backoff (`robust_fetch_bytes`), progress logging,
  and `verify_corpus_complete()`.

**Per-class counts reached (raw files retained on disk vs. the current corpus's selected/manifest
count — these differ because `data/raw/<genus>/` accumulates every image ever downloaded across all
iterations, while `season_stratified_select()` picks up to the *current* target from that pool; the
extra raw files are not lost, they are simply not part of this iteration's selected corpus and
remain available for a future top-up):**

| genus | raw files on disk | selected (manifest) | winter | spring | summer | **autumn** |
|---|---:|---:|---:|---:|---:|---:|
| Fraxinus | 9,919 | 9,919 | 2,500 | 2,500 | 2,500 | 2,500 |
| Ulmus | 9,840 | 9,840 | 2,500 | 2,500 | 2,500 | 2,500 |
| Tilia | 9,059 | 9,059 | 988 | 2,776 | 2,652 | 2,859 |
| Carpinus | 9,334 | 9,334 | 1,417 | 2,676 | 2,789 | 2,862 |
| **Acer** | 11,245 | 9,998 | 2,500 | 2,500 | 2,500 | **2,500** |
| Alnus | 9,828 | 9,828 | 2,500 | 2,500 | 2,500 | 2,500 |
| Salix | 9,860 | 9,661 | 2,500 | 2,500 | 2,500 | 2,500 |
| **Prunus** | 10,773 | 9,999 | 2,500 | 2,500 | 2,500 | **2,500** |
| Populus | 9,897 | 9,897 | 2,500 | 2,500 | 2,500 | 2,500 |
| Pyrus | 9,043 | 9,043 | 1,026 | 2,740 | 2,820 | 2,862 |
| Malus | 8,350 | 8,350 | 593 | 2,700 | 2,711 | 2,850 |
| Betula | 9,976 | 9,976 | 2,500 | 2,500 | 2,500 | 2,500 |
| Fagus | 9,987 | 9,987 | 2,500 | 2,500 | 2,500 | 2,500 |
| Castanea | 8,645 | 8,645 | 704 | 2,842 | 2,556 | 2,808 |
| Quercus_deciduae | 9,511 | 9,511 | 1,821 | 2,709 | 2,752 | 2,705 |
| Quercus_sempervirens | 8,554 | 8,554 | 2,064 | 2,792 | 2,260 | 2,287 |
| Ostrya | 7,631 | 7,631 | 787 | 2,845 | 2,755 | 1,735 |
| Celtis | 9,585 | 9,585 | 2,500 | 2,500 | 2,500 | 2,500 |
| Juglans | 9,450 | 9,450 | 1,577 | 2,812 | 2,707 | 2,835 |
| Sorbus | 8,883 | 8,883 | 854 | 2,684 | 2,624 | 2,850 |
| **Pinus** | 7,553 | 6,000 | 1,500 | 1,500 | 1,500 | **1,500** |

**Total corpus: 269,341 raw files on disk, 265,546 images selected into the current train/val/test
split (up from iteration 3's 194,653 — a 1.36x increase, deliberately moderate next to iteration
3's 3.05x jump given the coordinator's memory/wall-clock caution).**

**Autumn counts, before and after the fix — the number that reopens Section 12.6's "cannot tell"
verdict:**

| genus | autumn images, iteration 3 (Section 11.1/12.4) | autumn images, iteration 4 |
|---|---:|---:|
| Acer | 66 | **2,500** (+2,434, 37.9x) |
| Prunus | 30 | **2,500** (+2,470, 83.3x) |
| Pinus | 60 | **1,500** (+1,440, 25.0x) |

All three genera that iteration 3 (and iteration 2, and iteration 1's 30-image sample) found to have
near-zero, apparently-irreducible autumn representation now clear the D-02/Section 12.4 n≥30
insufficient-samples threshold by two orders of magnitude. Section 12.6's "cannot tell... not a
resolvable gap within this measurement task" verdict is directly reopened by this number — whether
the model's autumn accuracy for these three genera holds up is now measurable, for the first time
across four iterations. That measurement itself happens in Section 14.3, after training.

**`verify_corpus_complete()`: PASSED before training started** (confirmed in
`/tmp/iter4_training.log`: `"Corpus precondition check PASSED: all 34 classes have non-empty,
count-consistent train/val/test splits."`) — every one of the 34 classes has non-empty,
count-consistent train/val/test splits, run immediately after the `GATE-CORPUS: PASS` check and
before any data loading, per the precondition this check exists to enforce (Section 11).
`GATE-CORPUS: PASS`, `CLASSES-USABLE: 32/34` (Betula and Phillyrea remain composition-excluded,
unchanged from iterations 1–3 — Section 3a's finding, not re-audited this iteration).

### 14.2 Training — complete

**Launched** 2026-09-25 13:29 CEST as a background process (PID 19098):
`finetune.py --backbone efficientnet_b0 --output-suffix _v4 --head-epochs 8 --finetune-epochs 20
--unfreeze-last-n-layers 76`.

**Backbone: EfficientNetB0** (lever 4), chosen over EfficientNetB3 given this is a fanless MacBook
Air that already showed memory/load pressure training the lighter MobileNetV3Large in iteration 3 —
B3 would be substantially heavier compute-wise (native 300x300 input, roughly 2x the parameter
count) for a machine this iteration's own evidence says is already under strain. B0's backbone is
4,049,571 params (4,093,125 total with the 34-way head) — the same order of magnitude as
MobileNetV3Large's 3,029,026, so the exported `.tflite` size is expected to stay in the same
single-digit-MB range (verified in Section 14.4 once exported). `include_preprocessing=True` is not
a valid kwarg for `keras.applications.EfficientNetB0` in this TensorFlow version (verified directly,
`TypeError` on the old MobileNetV3-style call) — EfficientNet's Keras implementation bakes its own
`Rescaling`+`Normalization` layers in as the model's first two layers instead, expecting the same
raw `[0,255]` float input `make_dataset()`'s `_load()` already produces, so no pipeline change was
needed there. `unfreeze_last_n_layers=76` scales MobileNetV3Large's tuned 60/188 layers (32%) to
EfficientNetB0's 239 total layers proportionally (76/239 ≈ 32%).

**Epoch budget raised substantially, `EarlyStopping` left to decide (lever 3).** Iteration 3 ran a
fixed `--finetune-epochs 8` and `best_finetune_epoch_1indexed` was 8 of 8 — `val_top3` was still
climbing every epoch with no plateau, meaning the fixed epoch budget, not the model or data, was the
binding constraint (Section 11.7). This run raises `--finetune-epochs` to 20 (2.5x), letting
`EarlyStopping(monitor="val_top3", mode="max", patience=3, restore_best_weights=True)` — confirmed
present and unchanged from iteration 2/3's own finetune.py, verified directly against the running
process's source (`train/finetune.py:414-416`, file last modified 10:13 CEST, process launched
13:29 CEST, so the running process is confirmed to be executing this exact configuration) — decide
when training has genuinely plateaued rather than being cut off mid-climb a second time.
`restore_best_weights=True` means the exported model comes from the best-`val_top3` epoch specifically,
not whichever epoch the loop happens to stop on — with a 20-epoch budget this matters more than
iteration 3's 8-epoch one, where the last epoch and the best epoch were the same by construction.
Head-phase epochs raised to 8 (from iteration 3's 6) for the same reason, though the head phase's
own history (Section 11.2) already showed a plateau by epoch 3–4, so this is a smaller, lower-stakes
change.

**Memory/load check, before launch and during (coordinator flagged: iteration 3 hit 5/6GB swap,
load average 11.5 under similar pressure).** Before any download or training in this iteration
started, the machine was already at 15/16GB physical memory used with 6GB in the compressor
(`vm_stat`, captured before launching corpus expansion) — a pre-existing condition from other
concurrent processes (a `com.apple.VirtualMachine` process alone accounted for ~2.6GB compressed;
various editor/agent helper processes for the rest), not something this iteration's pipeline
introduced. A genuine, fixable memory issue in `finetune.py`'s own pipeline was found and fixed
before launch regardless: `make_dataset()`'s per-epoch `.shuffle(8192)` call ran *after*
`.map(_load, ...)`, i.e. on fully decoded 224x224x3 float32 image tensors (~602KB each) rather than
on the lightweight `(path, label)` pairs `collect_split()` already globally shuffles at the Python
level before `tf.data` ever sees them. A shuffle buffer of 8,192 decoded images holds ~4.9GB in
memory simultaneously, regardless of corpus size (the cost is set by buffer element count, not
dataset size) — a large, fixed, and entirely avoidable cost, and a direct, plausible contributor to
iteration 3's observed swap pressure. Fixed by moving the `.shuffle()` call to run on `path_ds`
*before* `.map(_load, ...)` — same statistical shuffle behaviour (each element is now a short string
+ an int, negligible memory) at a small fraction of the cost; standard `tf.data` ordering
(shuffle-before-expensive-map) that the original code did not follow. **With the fix applied and
training running (PID 19098), the process's own RSS is 1.04GB** — not itself memory-heavy. The
machine-wide load average (13.69/22.91/25.23 one/five/fifteen-minute) and swap (2.79/4GB used)
observed during this run are consistent with the same shared-machine contention present before this
iteration's work began, not a new leak in the training pipeline; the per-image footprint through the
fixed pipeline (decode of an already-≤384px-on-disk JPEG, batch of 32, `AUTOTUNE` prefetch) is small
and bounded regardless of corpus size. This is reported as observed, not as a claim that the
shared-machine contention is fully resolved — a later reader retiming this on a quieter machine
should expect a materially lower load average for the same job.

**Expected duration.** Head phase: ~16.7 min/epoch observed directly (6,639 steps/epoch at ~152ms/
step, backbone frozen) x 8 epochs ≈ 2.2 hours. Fine-tune phase (backbone partially unfrozen, more
compute per step): expected slower per epoch than the head phase; if `EarlyStopping` does not fire
before the 20-epoch cap, total fine-tune time could run into the 7–10 hour range on this hardware,
for a total iteration-4 training wall-clock in the range of iteration 3's 4h46min to as much as
10–12 hours end-to-end, depending on where `EarlyStopping` actually triggers. Reported here as a
planning number, not a promise — the actual duration and the epoch `EarlyStopping` stops at are
recorded in Section 14.3 once training completes.

**Actual result (`train/training_report_v4.json`).** Total wall-clock 84,477.7s (23.47h): head
phase 20,872.8s (5.80h, 8 epochs), fine-tune phase 63,570.9s (17.66h, 20 epochs run) — longer than
the planning estimate above, consistent with EfficientNetB0's heavier per-step compute on this
hardware. `train_images_used=212,436`, `val_images_used=26,553`, 0 skipped-corrupt in either split.

**`best_finetune_epoch_1indexed: 20` of 20 run — `EarlyStopping` did NOT fire.** Unlike a genuine
plateau, `val_top3` set a new (marginal) high every single epoch through the full 20-epoch budget,
so `patience=3`'s "no improvement for 3 consecutive epochs" condition was never met, and
`restore_best_weights=True` restored epoch 20's weights because they were, by that literal
criterion, the best ones seen. The full fine-tune history:

| epoch | train loss | train top1 | train top3 | val_loss | val_top1 | val_top3 |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1.9643 | 0.4325 | 0.6612 | 1.4606 | 0.5672 | 0.7787 |
| 2 | 1.5390 | 0.5409 | 0.7620 | 1.2853 | 0.6155 | 0.8146 |
| 3 | 1.3642 | 0.5895 | 0.7994 | 1.1897 | 0.6426 | 0.8329 |
| 4 | 1.2507 | 0.6216 | 0.8228 | 1.1272 | 0.6600 | 0.8429 |
| 5 | 1.1634 | 0.6470 | 0.8395 | 1.0844 | 0.6715 | 0.8532 |
| 6 | 1.0960 | 0.6657 | 0.8531 | 1.0473 | 0.6831 | 0.8599 |
| 7 | 1.0276 | 0.6858 | 0.8661 | 1.0216 | 0.6931 | 0.8642 |
| 8 | 0.9775 | 0.7014 | 0.8754 | 1.0026 | 0.6990 | 0.8681 |
| 9 | 0.9274 | 0.7144 | 0.8841 | 0.9867 | 0.7039 | 0.8720 |
| 10 | 0.8851 | 0.7263 | 0.8919 | 0.9803 | 0.7080 | 0.8731 |
| 11 | 0.8424 | 0.7391 | 0.9000 | 0.9646 | 0.7139 | 0.8751 |
| 12 | 0.8078 | 0.7497 | 0.9064 | 0.9587 | 0.7153 | 0.8775 |
| 13 | 0.7742 | 0.7594 | 0.9114 | 0.9587 | 0.7180 | 0.8790 |
| 14 | 0.7389 | 0.7691 | 0.9168 | 0.9558 | 0.7192 | 0.8791 |
| 15 | 0.7068 | 0.7790 | 0.9230 | **0.9549** | 0.7205 | 0.8788 |
| 16 | 0.6777 | 0.7877 | 0.9275 | 0.9558 | 0.7224 | 0.8813 |
| 17 | 0.6495 | 0.7954 | 0.9322 | 0.9620 | 0.7258 | 0.8817 |
| 18 | 0.6246 | 0.8026 | 0.9362 | 0.9580 | 0.7251 | 0.8827 |
| 19 | 0.6027 | 0.8103 | 0.9396 | 0.9660 | 0.7267 | 0.8833 |
| 20 | 0.5772 | 0.8176 | 0.9435 | 0.9738 | 0.7259 | **0.8837** |

**This answers, plainly, the schedule- vs. data/approach-limited question lever 3 was raised to
settle — and the answer flips from iteration 3's.** Iteration 3's fine-tune run showed `val_top3`
climbing at a healthy, undecayed clip through its full (8-epoch) budget with no sign of a plateau —
schedule-limited, not data- or approach-limited (Section 11.7). This run, on a 1.36x larger corpus
with a stronger backbone and 2.5x the epoch budget, shows the opposite: **per-epoch `val_top3` gains
decayed from +3.59pp (epoch 1→2) to +0.42pp, +0.04pp, +0.10pp, +0.06pp, +0.04pp across epochs 16–20
— roughly two orders of magnitude smaller than the early-training rate.** More directly, `val_loss`
**bottomed at epoch 15 (0.9549) and rose in 4 of the next 5 epochs** (0.9558, 0.9620, 0.9580, 0.9660,
0.9738) while training loss kept falling sharply (0.7068→0.5772) and training top1/top3 kept
climbing fast (+3.86pp/+2.05pp over the same 5 epochs) — the textbook signature of overfitting: the
model is increasingly fitting training-set-specific detail that does not generalise, even while the
coarser, ceiling-bounded `val_top3` metric continues to inch upward. **This backbone and corpus
combination is no longer schedule-limited — it has reached saturation and the onset of
overfitting.** Given this, the epoch budget is not the lever to pull further for another rebalance
pass; the next lever (if the temperate genera still fall short after Section 14.5's comparison)
would be more data specifically for the genera that need it, not more epochs.

**A genuine limitation of monitoring `val_top3` for `EarlyStopping`, not previously visible at
iteration 3's shorter, still-climbing budget: a coarse, upper-bounded metric can keep posting tiny
new highs for several epochs after the more sensitive `val_loss` has already turned, so
`patience=3` on `val_top3` alone did not catch the overfitting onset this run's own data shows
starting around epoch 15.** The practical cost of this was small here — epoch 15's `val_top3`
(0.8788) is 0.49pp below epoch 20's (0.8837) — but it means the exported model (epoch 20's weights)
is trained slightly past the point where validation loss stopped improving. Recorded as a finding
for a later iteration's `EarlyStopping` configuration (e.g. monitoring `val_loss` with `mode="min"`,
or a stricter patience), not re-run here — D-19 timebox discipline applies, and the practical
difference is small enough (well under 1pp) not to justify a second training run to test it.

### 14.3 Export — complete

`train/genus_classifier_v4.tflite`: **8,238,676 bytes (8.24 MB)** — larger than iteration 2/3's
6,127,976 bytes (6.13 MB), as expected: EfficientNetB0's 4,093,125 total params (float16-quantised)
against MobileNetV3Large's 3,029,026. Both are float16 post-training quantisation (Section 4's
finding — int8 dynamic-range measurably degrades this corpus's predictions — applies identically
here; not re-tested, since nothing about the quantisation scheme's own tradeoff changed with the
backbone). **Plan 01-05 will need to re-time this larger model on device — its latency and memory
figures cannot be assumed to carry over from iteration 3's 6.13 MB MobileNetV3Large measurement.**

**Export parity: 100% top-1 agreement (68/68)** between the trained Keras model and the exported
`.tflite`, on the same 68-image (2/class) parity sample every prior iteration used
(`export_report_v4.json`: `keras_tflite_top1_agreement: 1.0`, `keras_top1_accuracy_on_sample: 0.765`,
`tflite_top1_accuracy_on_sample: 0.765`) — comfortably above the 90% pass threshold, and a clean
match with no float16-rounding-induced argmax flips at all on this sample (iteration 3 had one).

### 14.4 Per-genus accuracy — four-way comparison (iterations 1, 2, 3, 4)

**Source model:** `genus_classifier_v4.tflite` (Section 14.3, not yet promoted — see Section 14.6).
**Test split:** iteration 4's own held-out test split, 26,557 images across 34 classes (up from
iteration 3's 19,466). **Measured:** 2026-09-26, same `eval/evaluate_accuracy.py` script, same
D-03/D-04 rules (per genus, raw counts alongside percentages, no headline average).

**Raw numbers below, exactly as `eval/results_v4/per_genus_accuracy.csv` reports them — committed
before this interpretation (commit `0b785cf` and this section).** `group` marks the 21
Île-de-France-targeted genera this iteration's cap-raise and season-fix applied to (`IdF`) against
the 13 Mediterranean/evergreen/other genera left untouched (`Med`) — the split the user's own
question turns on.

| genus | group | it1 n | it1 top1 | it1 top3 | it2 n | it2 top1 | it2 top3 | it3 n | it3 top1 | it3 top3 | it4 n | it4 top1 | it4 top3 | it4 clears | top3 Δ 3→4 |
|---|:---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|---:|
| Abies | Med | 35 | 45.7% | 60.00% | 198 | 55.0% | 81.31% | 600 | 70.2% | 89.67% | 600 | 73.8% | 92.33% | False | +2.66pp |
| Acer | **IdF** | 35 | 14.3% | 25.71% | 191 | 58.6% | 79.58% | 600 | 61.5% | 80.83% | 1000 | 63.2% | 80.90% | False | +0.07pp |
| Alnus | **IdF** | 35 | 31.4% | 54.29% | 199 | 54.8% | 70.85% | 600 | 59.2% | 77.33% | 983 | 71.5% | 84.94% | False | +7.61pp |
| Arbutus | Med | 35 | 54.3% | 80.00% | 197 | 66.5% | 87.82% | 600 | 80.2% | 91.17% | 600 | 82.2% | 93.67% | False | +2.50pp |
| Betula | **IdF** | 35 | 42.9% | 51.43% | 191 | 50.8% | 68.59% | 600 | 61.8% | 82.33% | 997 | 67.0% | 85.96% | False | +3.63pp |
| Carpinus | **IdF** | 35 | 37.1% | 51.43% | 199 | 61.8% | 79.40% | 600 | 59.7% | 81.00% | 934 | 70.1% | 88.12% | False | +7.12pp |
| Castanea | **IdF** | 35 | 37.1% | 51.43% | 192 | 63.5% | 81.77% | 600 | 74.0% | 83.83% | 865 | 74.5% | 88.90% | False | +5.07pp |
| Celtis | **IdF** | 35 | 31.4% | 48.57% | 170 | 38.8% | 65.88% | 600 | 59.7% | 80.67% | 959 | 68.4% | 85.82% | False | +5.15pp |
| Cupressus | Med | 35 | 37.1% | 74.29% | 165 | 64.2% | 83.64% | 530 | 72.6% | 90.94% | 530 | 76.4% | 92.64% | False | +1.70pp |
| Fagus | **IdF** | 35 | 51.4% | 71.43% | 169 | 56.8% | 78.11% | 599 | 66.9% | 83.47% | 998 | 75.0% | 88.28% | False | +4.81pp |
| Fraxinus | **IdF** | 35 | 5.7% | 22.86% | 141 | 29.8% | 63.12% | 594 | 48.3% | 77.61% | 992 | 58.4% | 83.17% | False | +5.56pp |
| Juglans | **IdF** | 35 | 14.3% | 42.86% | 179 | 52.5% | 73.74% | 589 | 59.4% | 80.81% | 945 | 73.8% | 89.63% | False | +8.82pp |
| Juniperus | Med | 35 | 25.7% | 60.00% | 177 | 53.7% | 76.27% | 597 | 71.5% | 90.79% | 597 | 78.9% | 92.13% | False | +1.34pp |
| Larix | Med | 35 | 42.9% | 54.29% | 176 | 62.5% | 79.55% | 599 | 72.0% | 87.65% | 599 | 78.0% | 90.32% | False | +2.67pp |
| Malus | **IdF** | 35 | 54.3% | 71.43% | 191 | 53.4% | 72.25% | 561 | 60.6% | 80.21% | 835 | 68.6% | 87.54% | False | +7.33pp |
| Ostrya | **IdF** | 35 | 22.9% | 34.29% | 185 | 53.0% | 69.19% | 540 | 65.7% | 84.26% | 763 | 72.4% | 88.60% | False | +4.34pp |
| Pinus | **IdF** | 35 | 42.9% | 74.29% | 189 | 59.3% | 83.07% | 578 | 73.0% | 91.35% | 600 | 78.2% | 92.83% | False | +1.48pp |
| Picea | Med | 35 | 34.3% | 65.71% | 186 | 48.4% | 82.26% | 595 | 63.2% | 88.74% | 595 | 71.9% | 91.26% | False | +2.52pp |
| Populus | **IdF** | 35 | 17.1% | 40.00% | 191 | 47.1% | 69.11% | 598 | 55.7% | 79.60% | 989 | 57.1% | 80.79% | False | +1.19pp |
| Prunus | **IdF** | 35 | 31.4% | 48.57% | 197 | 49.8% | 73.60% | 600 | 56.0% | 80.50% | 1000 | 60.8% | 84.40% | False | +3.90pp |
| Pyrus | **IdF** | 35 | 20.0% | 42.86% | 188 | 43.1% | 71.28% | 563 | 62.2% | 82.42% | 905 | 65.3% | 87.18% | False | +4.76pp |
| Quercus_deciduae | **IdF** | 35 | 40.0% | 60.00% | 196 | 69.9% | 84.69% | 467 | 73.0% | 84.15% | 951 | 84.0% | 93.69% | False | +9.54pp |
| Quercus_sempervirens | **IdF** | 35 | 37.1% | 62.86% | 195 | 63.6% | 82.05% | 568 | 70.4% | 85.74% | 856 | 77.3% | 91.59% | False | +5.85pp |
| Salix | **IdF** | 35 | 37.1% | 60.00% | 196 | 56.1% | 81.63% | 598 | 64.5% | 84.95% | 966 | 69.5% | 85.30% | False | +0.35pp |
| Sorbus | **IdF** | 35 | 37.1% | 62.86% | 194 | 69.1% | 81.96% | 598 | 77.6% | 87.96% | 889 | 81.5% | 90.21% | False | +2.25pp |
| Tamarix | Med | 35 | 51.4% | 65.71% | 179 | 81.0% | 88.27% | 544 | 88.6% | 95.04% | 544 | 88.8% | 96.88% | True | +1.84pp |
| Taxus | Med | 35 | 45.7% | 68.57% | 197 | 67.5% | 85.28% | 533 | 74.7% | 91.93% | 533 | 80.7% | 92.68% | False | +0.75pp |
| Tilia | **IdF** | 35 | 25.7% | 60.00% | 199 | 55.3% | 78.89% | 575 | 59.1% | 77.74% | 906 | 69.8% | 88.19% | False | +10.45pp |
| Ulmus | **IdF** | 30 | 0.0% | 16.67% | 197 | 45.2% | 67.51% | 598 | 48.7% | 74.92% | 984 | 53.3% | 79.07% | False | +4.15pp |
| Ceratonia | Med | 35 | 65.7% | 85.71% | 193 | 80.8% | 92.75% | 363 | 77.1% | 90.63% | 363 | 83.5% | 92.56% | False | +1.93pp |
| Cercis | Med | 35 | 42.9% | 65.71% | 191 | 73.3% | 80.63% | 571 | 82.0% | 89.49% | 571 | 86.2% | 92.29% | False | +2.80pp |
| Olea | Med | 35 | 60.0% | 94.29% | 193 | 71.5% | 88.60% | 591 | 75.1% | 91.20% | 591 | 77.7% | 90.69% | False | -0.51pp |
| Phillyrea | Med | 35 | 60.0% | 88.57% | 199 | 71.4% | 88.44% | 546 | 79.1% | 92.67% | 546 | 82.8% | 94.14% | False | +1.47pp |
| Pistacia | Med | 33 | 48.5% | 81.82% | 187 | 61.0% | 82.35% | 571 | 78.5% | 91.07% | 571 | 80.9% | 90.89% | False | -0.18pp |

**Pooled (all test images): top1 67.42%→72.08%, top3 85.24%→88.25% (+3.02pp).** Unweighted per-genus
mean top3 delta across all 34 classes: **+3.67pp, 32/34 improved** (only Olea -0.51pp and Pistacia
-0.18pp regressed, both Mediterranean genera with small, plausibly-noise-level drops on samples that
did not grow between iterations — their test split was already at its true ceiling and unchanged in
size, unlike every genus this iteration touched).

**1 of 34 genera still clears the D-02 95% top-3 bar: Tamarix, now 96.88% (527/544 top-3, 483/544
top-1), up from 95.04% in iteration 3.** No new genus crosses the bar this iteration — consistent
with Section 14.2's saturation finding: the gains this iteration bought are broad and real, but not
enough to push a second genus over a 95%-of-a-hard-multiclass-problem bar in one pass.

**The split the user's actual question turns on — and it is not subtle:**

| group | n genera | mean top3 Δ (3→4) | n improved / n total |
|---|---:|---:|---:|
| **Île-de-France temperate (targeted this iteration)** | 21 | **+4.93pp** | **21/21** |
| Mediterranean/evergreen/other (untouched this iteration) | 13 | +1.65pp | 11/13 |

**Every one of the 21 Île-de-France-targeted genera improved, by a mean nearly 3x the untouched
group's.** The untouched Mediterranean group still improved on average (a stronger backbone and a
longer, better-converged training schedule benefit every class, not just the ones with more data),
but by materially less, and with 2 of 13 genera essentially flat-to-slightly-down (both within noise
of a test split whose size did not change between iterations). This is the evidence that the
targeted rebalance (raise the cap for exactly the weak genera, leave the already-adequate genera
alone) worked as intended, not just that "a bigger model trained longer helps everything a bit."

**Largest individual gains, all Île-de-France genera:** Tilia +10.45pp (77.74%→88.19%), Quercus
deciduous +9.54pp (84.15%→93.69%), Juglans +8.82pp (80.81%→89.63%), Malus +7.33pp, Alnus +7.61pp,
Carpinus +7.12pp. **Smallest gains among Île-de-France genera:** Acer +0.07pp and Salix +0.35pp —
both already had large corpora at iteration 3 (600 and 598 test images) and both grew their test
split by a similar proportion to the others, so this reads as those two genera being closer to
whatever ceiling this backbone/corpus combination can reach for them specifically, not as the
rebalance failing them.

### 14.5 Per-genus × per-season accuracy — does the fix hold up, in the format Section 12 established

**Method:** identical to Section 12 — `eval/evaluate_seasonal_accuracy.py` re-run against
`genus_classifier_v4.tflite`, joined against `manifest.csv`'s `season` column, one row per test
image. **Coverage: 26,557/26,557 test images have a manifest season value (100.00%); 0 missing.**

**The headline result: every one of the 34×4 = 136 genus×season cells now clears the n≥30
insufficient-samples threshold, including the 5 that were thin in iteration 3
(Acer/Pinus/Prunus autumn, Malus/Sorbus winter).** This is Section 13.1's fix showing up exactly
where it was aimed — the autumn-specific gap for Acer, Pinus and Prunus is no longer just larger,
it is **measurable for the first time across four iterations**:

| genus | winter n | autumn n (it3) | autumn n (it4) | autumn top3 (it4) |
|---|---:|---:|---:|---:|
| Acer | 238 | 4 (insufficient) | **250** | 82.40% |
| Prunus | 238 | 1 (insufficient) | **250** | 81.60% |
| Pinus | 141 | 3 (insufficient) | **172** | **95.35%** |

**Pinus's autumn figure (95.35%, 164/172) clears the D-02 95% bar in isolation** — the first time
any genus×season cell for these three has cleared it, though Section 0/D-03's rule against
substituting a cell for the whole-year figure applies here exactly as it does everywhere else in
this document: Pinus's whole-year top-3 is 92.83% (Section 14.4), which does not clear the bar, so
Pinus itself is not a partial-go candidate on this evidence — its autumn cell is a genuinely strong,
specific data point for exactly the season IBP surveys happen in, not a headline result.

**Full 34×4 cross-tabulation, raw numbers, committed before interpretation:**

| genus | winter n | winter top3 | spring n | spring top3 | summer n | summer top3 | autumn n | autumn top3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Abies | 130 | 91.54% | 142 | 96.48% | 150 | 89.33% | 178 | 92.13% |
| Acer | 238 | 73.95% | 247 | 81.38% | 265 | 85.28% | 250 | 82.40% |
| Alnus | 219 | 85.39% | 250 | 86.00% | 265 | 84.15% | 249 | 84.34% |
| Arbutus | 141 | 93.62% | 144 | 92.36% | 141 | 95.04% | 174 | 93.68% |
| Betula | 237 | 87.34% | 247 | 90.28% | 264 | 81.06% | 249 | 85.54% |
| Carpinus | 135 | 83.70% | 267 | 88.39% | 277 | 90.61% | 255 | 87.45% |
| Castanea | 60 | 78.33% | 272 | 87.50% | 254 | 89.76% | 279 | 91.76% |
| Celtis | 229 | 85.59% | 245 | 82.45% | 253 | 89.72% | 232 | 85.34% |
| Cupressus | 131 | 93.13% | 131 | 90.08% | 132 | 95.45% | 136 | 91.91% |
| Fagus | 237 | 89.45% | 246 | 85.37% | 264 | 88.26% | 251 | 90.04% |
| Fraxinus | 232 | 76.29% | 247 | 84.62% | 265 | 86.79% | 248 | 84.27% |
| Juglans | 150 | 82.67% | 258 | 90.70% | 277 | 93.50% | 260 | 88.46% |
| Juniperus | 159 | 90.57% | 188 | 93.09% | 171 | 92.98% | 79 | 91.14% |
| Larix | 72 | 83.33% | 153 | 92.16% | 207 | 89.86% | 167 | 92.22% |
| Malus | 58 | 77.59% | 253 | 90.51% | 271 | 87.82% | 253 | 86.56% |
| Ostrya | 79 | 88.61% | 230 | 93.04% | 286 | 87.76% | 167 | 83.83% |
| Pinus | 141 | 92.91% | 145 | 90.34% | 142 | 92.25% | 172 | **95.35%** |
| Picea | 126 | 88.10% | 140 | 92.86% | 149 | 94.63% | 180 | 89.44% |
| Populus | 229 | 74.67% | 245 | 77.96% | 266 | 85.71% | 249 | 83.94% |
| Prunus | 238 | 86.55% | 247 | 88.26% | 265 | 81.51% | 250 | 81.60% |
| Pyrus | 100 | 80.00% | 253 | 87.35% | 279 | 89.25% | 270 | 87.41% |
| Quercus_deciduae | 172 | 92.44% | 259 | 91.51% | 270 | 92.59% | 250 | 98.00% |
| Quercus_sempervirens | 190 | 92.63% | 236 | 92.80% | 222 | 88.74% | 208 | 92.31% |
| Salix | 207 | 80.19% | 253 | 86.96% | 260 | 88.46% | 246 | 84.55% |
| Sorbus | 83 | 83.13% | 259 | 86.49% | 265 | 92.08% | 282 | 93.97% |
| Tamarix | 97 | 95.88% | 150 | 97.33% | 160 | 96.25% | 136 | 97.79% |
| Taxus | 141 | 90.78% | 87 | 88.51% | 156 | 92.95% | 149 | 96.64% |
| Tilia | 98 | 78.57% | 261 | 89.66% | 276 | 90.94% | 270 | 87.41% |
| Ulmus | 225 | 79.56% | 247 | 76.11% | 262 | 81.68% | 250 | 78.80% |
| Ceratonia | 52 | 88.46% | 93 | 91.40% | 70 | 95.71% | 139 | 94.24% |
| Cercis | 53 | 77.36% | 229 | 97.82% | 156 | 92.31% | 133 | 88.72% |
| Olea | 140 | 92.14% | 138 | 89.86% | 142 | 88.73% | 171 | 91.81% |
| Phillyrea | 107 | 96.26% | 140 | 95.00% | 135 | 91.85% | 154 | 93.51% |
| Pistacia | 122 | 89.34% | 137 | 93.43% | 142 | 85.92% | 168 | 94.05% |

**Season margins (pooled and unweighted per-genus mean, all 34 genera now measurable at n≥30 in
every season — no thin-cell asterisks needed this time):**

| season | pooled n | pooled top3 | unweighted per-genus mean top3 |
|---|---:|---:|---:|
| winter | 5,028 | 85.62% | 85.88% |
| spring | 7,039 | 88.72% | 89.35% |
| summer | 7,359 | 89.03% | 89.68% |
| autumn | 7,104 | 88.82% | 89.43% |

**Winter remains the weakest season (as in iteration 3, Section 12.3), not autumn or spring.**
Spring — the season the user was most disappointed with — is now within 0.3–1.0pp of summer and
autumn, both pooled and unweighted, essentially closing the gap Section 12 originally surfaced
(iteration 3: spring pooled 84.4%, the weakest of the four).

**Spring, specifically, for the four genera the user named as spring's worst performers:**

| genus | spring top3, iteration 3 | spring top3, iteration 4 | Δ |
|---|---:|---:|---:|
| Fraxinus | 74% (Section 12.2) | 84.62% | +10.6pp |
| Ulmus | 71% | 76.11% | +5.1pp |
| Juglans | 71% | 90.70% | **+19.7pp** |
| Tilia | 75% | 89.66% | +14.7pp |

**All four improved, three of them substantially.** Juglans's spring cell in particular went from
one of the weakest whole-corpus figures anywhere in Section 12 to one of the strongest in this
iteration's table.

**Acer/Prunus/Pinus autumn "holds up" verdict (Section 12.6's question, now answerable for the first
time):** Pinus's autumn figure (95.35%) is its *strongest* season and the only cell of the three that
clears D-02 in isolation — holds up, emphatically. Acer's autumn (82.40%) sits within 1.5pp of its
own whole-year figure (80.90%) — holds up. Prunus's autumn (81.60%) sits 2.8pp below its whole-year
figure (84.40%) and is in fact its second-weakest season after summer (81.51%) — a real, now
adequately-measured (n=250) genus-specific weakness in autumn specifically, the opposite of "holds
up," though not one that changes any go/no-go call since Prunus does not clear D-02 at any
resolution. All three verdicts are now backed by n≥250 (Acer, Prunus) or n=172 (Pinus) autumn test
images, not the 1–4-image cells that made this question unanswerable in Section 12.6.

### 14.6 Promotion to the canonical model path — verdict

**Promoted.** `genus_classifier_v4.tflite` (8,238,676 bytes, EfficientNetB0, float16) is copied to
the canonical `spike/species-recognition/train/genus_classifier.tflite` path that plan 03's
device-harness cache convention and plan 05 read from, along with `genus_classifier_keras_v4` →
`genus_classifier_keras/`, `training_report_v4.json` → `training_report.json`,
`export_report_v4.json` → `export_report.json`, and `eval/results_v4/*` → `eval/results/*`.
`eval/GATE` still reads `GATE-MODEL: PASS`. Iterations 1–3's models, keras exports, training/export
reports and eval results are all preserved separately under their `*_iteration1*`/`*_v2*`/`*_v3*`
suffixes, untouched and unmodified regardless of what sits at the canonical path — the same
promotion discipline iterations 2 and 3 followed (Sections 10.5, 11.6).

**Promotion criterion, applied explicitly rather than assumed (mirroring iteration 3's own
instruction to check, not assume): does iteration 4 genuinely beat iteration 3 on the temperate
genera specifically, not just on the pooled mean?** Yes, unambiguously:

- **21 of 21 Île-de-France-targeted genera improved** (Section 14.4), mean +4.93pp top-3 — no
  exceptions, no regressions, in the exact genus group this iteration's corpus work targeted.
- The untouched Mediterranean/evergreen/other group also improved on average (+1.65pp, a stronger
  backbone and longer schedule help everyone somewhat) but by roughly a third as much, with 2 of 13
  essentially flat (Olea -0.51pp, Pistacia -0.18pp) — confirming the improvement is concentrated
  where the corpus work was concentrated, not an artefact of a generally better model that would
  have shown the same pattern regardless of which genera were targeted.
- Pooled and unweighted-mean figures across all 34 genera also improved (+3.02pp pooled, +3.67pp
  unweighted), so promotion is not bought at the expense of the untouched genera either.
- The specific gap this iteration was launched to close — Acer/Pinus/Prunus autumn measurability —
  is closed: all three now have adequately-sampled (n≥172) autumn cells, one of which (Pinus,
  95.35%) clears D-02 in isolation.

**No genus regressed on the temperate/targeted list.** The two genera anywhere in the corpus that
did regress (Olea, Pistacia) are both Mediterranean/untouched, both within noise (well under 1pp,
on a test split that did not change size between iterations 3 and 4), and neither is a genus this
iteration's cap-raise or season-fix touched. **Verdict: promote, unreservedly, on the evidence this
section presents.**

**What did not change, and is not claimed to have changed:** only 1 of 34 genera (Tamarix) clears
the D-02 95% top-3 bar — the same one as iteration 3, at a higher figure (96.88% vs 95.04%). This
iteration moved the temperate genera meaningfully closer to a usable partial-go (several gained
5–10pp) without pushing any of them, or a new Mediterranean genus, over the bar itself. Section
14.2's saturation finding (this backbone/corpus combination has stopped being schedule-limited) means
a fifth iteration repeating the same three levers (more epochs, a still-larger corpus at the same
per-class cap, the same backbone) should not be expected to produce another leap of this size — the
next real lever, if the ADR calls for one, is more data specifically for the genera still short of
the bar, or the still-parked Tela Botanica/Wikimedia Commons sources from Section 13.3, not a repeat
of this iteration's recipe.

---

## 15. Per-genus confidence calibration (plan 01-05, Task A — D-04/D-12 amended 2026-09-26)

**Status: raw table below, committed first; analysis follows in 15.3 onward.**

**Why this section exists.** D-04 was amended: instead of a partial-go that enables suggestions
only for genera clearing the D-02 95% top-3 bar (which iteration 4 leaves at 1 of 34, Tamarix —
Section 14.4/14.6), the user chose a full go — all 34 genera are suggested, each carrying an
honest confidence indicator, and the ecologist judges. D-12 was amended alongside it: that only
works if "strong" means roughly the same thing everywhere. It did not. At the single global
threshold iteration 4's `confidence_bands.json` computed (0.7763, fit and reported on the same
test split), "strong" predictions were right 96% of the time on Quercus deciduous and Cercis but
only 79% on Ulmus, 80% on Populus, 82% on Prunus, 83% on Fraxinus — the model partly
self-regulates (it calls "strong" on only 44% of Ulmus predictions versus 78% of Quercus
deciduous), but not enough to make one confidence label mean one reliability figure across all 34
genera. D-12 also flagged a second defect: the three-level scale's "weak" band received zero of
26,557 predictions outright, because a 34-way softmax's top-1 probability floor (0.1045 in that
same file) never falls low enough to trigger it.

### 15.1 Method — fit on validation, report on test

Every other accuracy figure in this document (Sections 5, 11.3, 14.4) is measured on the TEST
split. Fitting a per-genus threshold on that same split and then reporting how well it performs
would measure the threshold against the exact noise it was tuned to fit — the split's own image
selection, not a genuine held-out check. This section instead:

1. Ran the promoted iteration-4 model (`train/genus_classifier.tflite`, unchanged, no retraining)
   over the **validation** split — 26,553 images across 34 classes, the same split
   `training_report.json`'s `val_top1`/`val_top3` figures come from, never previously used for any
   per-image or per-genus accuracy claim in this document. New script:
   `eval/calibrate_confidence.py`, structurally identical to `eval/evaluate_seasonal_accuracy.py`
   (same model load, same preprocessing, same top-3 extraction) with `val.txt` substituted for
   `test.txt` as the image-path source. Output: `eval/results_v4/val_per_genus_confidence.csv`
   (26,553 rows: class, image, top1_correct, top3_correct, top1_confidence).
2. For each genus, swept validation predictions sorted by confidence descending, and found the
   **largest** prefix (i.e. the **lowest** confidence value) whose cumulative top-1 accuracy is
   still ≥ 90% (`TARGET_STRONG_ACCURACY`, chosen because it matches D-12's own prior text — "top-1
   correct 90.0% in the 'strong' band ... pooled" — rather than introducing an unstated new
   target). That confidence value is the genus's calibrated "strong" threshold.
3. Applied that val-fit threshold to the **test** split (`eval/results_v4/per_genus_per_season.csv`,
   the same 26,557-image test file Sections 12/14.5 already use) and reports the resulting share
   of test predictions labelled strong and the accuracy actually achieved within that band —
   the held-out check this document's other confidence-band claims did not have.

New script: `eval/analyze_calibration.py` (reads both CSVs, writes
`eval/results_v4/per_genus_calibration.csv` and `eval/results_v4/confidence_scale_recut.json`,
neither retrains nor re-exports).

**Reporting threshold.** Genera with fewer than 30 validation images would get an unstably-fit
threshold; none of the 34 fell below this (minimum: Ceratonia at 363 validation images) — the
`insufficient-val-samples` status this script supports never fires for this model's actual val
split sizes, but is left in place as a guard for a future, smaller iteration.

### 15.2 Per-genus calibrated thresholds — raw table

Fit on validation (`val_n`, `val_n_strong`, `val_share_strong`, `val_accuracy_strong`), reported on
test (`test_n`, `test_n_strong`, `test_correct_strong`, `test_share_strong`, `test_accuracy_strong`).
All 34 genera reached a threshold (none hit `no-achievable-90pct-threshold`). Raw counts sit
alongside every percentage, per D-03.

| genus | val n | threshold | val n strong | val share strong | val acc strong | test n | test n strong | test correct strong | test share strong | test acc strong |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Abies | 600 | 0.8463 | 351 | 58.50% | 90.03% | 600 | 352 | 321 | 58.67% | 91.19% |
| Acer | 1000 | 0.8456 | 522 | 52.20% | 90.04% | 1000 | 519 | 465 | 51.90% | 89.60% |
| Alnus | 983 | 0.714 | 680 | 69.18% | 90.00% | 983 | 650 | 579 | 66.12% | 89.08% |
| Arbutus | 600 | 0.5422 | 512 | 85.33% | 90.04% | 600 | 530 | 475 | 88.33% | 89.62% |
| Betula | 998 | 0.7933 | 541 | 54.21% | 90.02% | 997 | 561 | 492 | 56.27% | 87.70% |
| Carpinus | 933 | 0.9063 | 502 | 53.80% | 90.04% | 934 | 495 | 455 | 53.00% | 91.92% |
| Castanea | 864 | 0.6043 | 691 | 79.98% | 90.01% | 865 | 700 | 615 | 80.92% | 87.86% |
| Celtis | 958 | 0.7863 | 544 | 56.78% | 90.07% | 959 | 554 | 496 | 57.77% | 89.53% |
| Cupressus | 530 | 0.7739 | 396 | 74.72% | 90.15% | 530 | 375 | 330 | 70.75% | 88.00% |
| Fagus | 999 | 0.5766 | 817 | 81.78% | 90.09% | 998 | 809 | 695 | 81.06% | 85.91% |
| Fraxinus | 992 | 0.9265 | 358 | 36.09% | 90.22% | 992 | 349 | 317 | 35.18% | 90.83% |
| Juglans | 945 | 0.7324 | 632 | 66.88% | 90.03% | 945 | 634 | 581 | 67.09% | 91.64% |
| Juniperus | 597 | 0.7253 | 400 | 67.00% | 90.00% | 597 | 411 | 376 | 68.84% | 91.48% |
| Larix | 599 | 0.6946 | 464 | 77.46% | 90.09% | 599 | 456 | 410 | 76.13% | 89.91% |
| Malus | 835 | 0.8138 | 485 | 58.08% | 90.10% | 835 | 478 | 413 | 57.25% | 86.40% |
| Ostrya | 763 | 0.7507 | 533 | 69.86% | 90.06% | 763 | 528 | 468 | 69.20% | 88.64% |
| Pinus | 600 | 0.7214 | 444 | 74.00% | 90.09% | 600 | 438 | 396 | 73.00% | 90.41% |
| Picea | 595 | 0.8905 | 256 | 43.03% | 90.23% | 595 | 241 | 221 | 40.50% | 91.70% |
| Populus | 990 | 0.9152 | 361 | 36.46% | 90.03% | 989 | 323 | 291 | 32.66% | 90.09% |
| Prunus | 1000 | 0.9519 | 300 | 30.00% | 90.00% | 1000 | 293 | 267 | 29.30% | 91.13% |
| Pyrus | 904 | 0.8806 | 435 | 48.12% | 90.11% | 905 | 425 | 373 | 46.96% | 87.76% |
| Quercus_deciduae | 951 | 0.5064 | 850 | 89.38% | 90.00% | 951 | 859 | 773 | 90.33% | 89.99% |
| Quercus_sempervirens | 855 | 0.7345 | 615 | 71.93% | 90.08% | 856 | 624 | 566 | 72.90% | 90.71% |
| Salix | 966 | 0.8292 | 495 | 51.24% | 90.10% | 966 | 494 | 447 | 51.14% | 90.49% |
| Sorbus | 888 | 0.5467 | 772 | 86.94% | 90.03% | 889 | 772 | 699 | 86.84% | 90.54% |
| Tamarix | 544 | 0.2027 | 543 | 99.82% | 90.06% | 544 | 544 | 483 | 100.00% | 88.79% |
| Taxus | 533 | 0.5876 | 465 | 87.24% | 90.11% | 533 | 447 | 405 | 83.86% | 90.60% |
| Tilia | 906 | 0.7965 | 515 | 56.84% | 90.10% | 906 | 545 | 484 | 60.15% | 88.81% |
| Ulmus | 984 | 0.9453 | 255 | 25.91% | 90.20% | 984 | 264 | 239 | 26.83% | 90.53% |
| Ceratonia | 363 | 0.5058 | 326 | 89.81% | 90.18% | 363 | 331 | 295 | 91.18% | 89.12% |
| Cercis | 570 | 0.4221 | 538 | 94.39% | 90.15% | 571 | 531 | 484 | 92.99% | 91.15% |
| Olea | 592 | 0.6315 | 464 | 78.38% | 90.09% | 591 | 462 | 406 | 78.17% | 87.88% |
| Phillyrea | 546 | 0.7094 | 450 | 82.42% | 90.00% | 546 | 442 | 400 | 80.95% | 90.50% |
| Pistacia | 570 | 0.6373 | 467 | 81.93% | 90.15% | 571 | 480 | 437 | 84.06% | 91.04% |

### 15.3 What the single global threshold cost, per genus — before/after

The table below applies the OLD single global threshold (`confidence_bands.json`'s
`strong_threshold: 0.7763`, fit and reported on the same test split — the exact overfitting risk
this section's own method avoids) to each genus's test predictions individually, alongside the
NEW per-genus calibrated threshold from Section 15.2. "Acc delta (vs 90% target)" is how far each
approach's achieved accuracy sits from the 90% reliability the label is supposed to promise.

| genus | old global share | old global acc | new calibrated threshold | new share | new acc | share delta | acc delta (vs 90% target) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Abies | 64.83% | 88.69% | 0.8463 | 58.67% | 91.19% | -6.16pp | +1.19pp |
| Acer | 56.80% | 87.50% | 0.8456 | 51.90% | 89.60% | -4.90pp | -0.40pp |
| Alnus | 62.56% | 90.89% | 0.714 | 66.12% | 89.08% | +3.56pp | -0.92pp |
| Arbutus | 76.00% | 94.74% | 0.5422 | 88.33% | 89.62% | +12.33pp | -0.38pp |
| Betula | 57.17% | 87.37% | 0.7933 | 56.27% | 87.70% | -0.90pp | -2.30pp |
| Carpinus | 64.03% | 88.29% | 0.9063 | 53.00% | 91.92% | -11.03pp | +1.92pp |
| Castanea | 72.37% | 91.69% | 0.6043 | 80.92% | 87.86% | +8.55pp | -2.14pp |
| Celtis | 58.60% | 89.32% | 0.7863 | 57.77% | 89.53% | -0.83pp | -0.47pp |
| Ceratonia | 76.31% | 94.58% | 0.5058 | 91.18% | 89.12% | +14.87pp | -0.88pp |
| Cercis | 82.14% | 97.23% | 0.4221 | 92.99% | 91.15% | +10.85pp | +1.15pp |
| Cupressus | 70.75% | 88.00% | 0.7739 | 70.75% | 88.00% | -0.00pp | -2.00pp |
| Fagus | 68.24% | 91.19% | 0.5766 | 81.06% | 85.91% | +12.82pp | -4.09pp |
| Fraxinus | 49.19% | 82.79% | 0.9265 | 35.18% | 90.83% | -14.01pp | +0.83pp |
| Juglans | 63.92% | 93.05% | 0.7324 | 67.09% | 91.64% | +3.17pp | +1.64pp |
| Juniperus | 63.82% | 92.91% | 0.7253 | 68.84% | 91.48% | +5.02pp | +1.48pp |
| Larix | 69.78% | 92.34% | 0.6946 | 76.13% | 89.91% | +6.35pp | -0.09pp |
| Malus | 59.88% | 85.00% | 0.8138 | 57.25% | 86.40% | -2.63pp | -3.60pp |
| Olea | 69.20% | 91.44% | 0.6315 | 78.17% | 87.88% | +8.97pp | -2.12pp |
| Ostrya | 67.50% | 89.51% | 0.7507 | 69.20% | 88.64% | +1.70pp | -1.36pp |
| Phillyrea | 77.29% | 92.18% | 0.7094 | 80.95% | 90.50% | +3.66pp | +0.50pp |
| Picea | 58.66% | 87.68% | 0.8905 | 40.50% | 91.70% | -18.16pp | +1.70pp |
| Pinus | 69.17% | 91.81% | 0.7214 | 73.00% | 90.41% | +3.83pp | +0.41pp |
| Pistacia | 76.53% | 94.28% | 0.6373 | 84.06% | 91.04% | +7.53pp | +1.04pp |
| Populus | 48.23% | 79.87% | 0.9152 | 32.66% | 90.09% | -15.57pp | +0.09pp |
| Prunus | 51.00% | 81.96% | 0.9519 | 29.30% | 91.13% | -21.70pp | +1.13pp |
| Pyrus | 58.56% | 83.58% | 0.8806 | 46.96% | 87.76% | -11.60pp | -2.24pp |
| Quercus_deciduae | 78.23% | 95.70% | 0.5064 | 90.33% | 89.99% | +12.10pp | -0.01pp |
| Quercus_sempervirens | 68.69% | 93.20% | 0.7345 | 72.90% | 90.71% | +4.21pp | +0.71pp |
| Salix | 57.14% | 88.77% | 0.8292 | 51.14% | 90.49% | -6.00pp | +0.49pp |
| Sorbus | 78.40% | 94.69% | 0.5467 | 86.84% | 90.54% | +8.44pp | +0.54pp |
| Tamarix | 86.40% | 95.32% | 0.2027 | 100.00% | 88.79% | +13.60pp | -1.21pp |
| Taxus | 73.17% | 95.64% | 0.5876 | 83.86% | 90.60% | +10.69pp | +0.60pp |
| Tilia | 62.03% | 87.72% | 0.7965 | 60.15% | 88.81% | -1.88pp | -1.19pp |
| Ulmus | 43.60% | 79.49% | 0.9453 | 26.83% | 90.53% | -16.77pp | +0.53pp |

**The spread is the finding.** Under the single global threshold, per-genus accuracy inside the
"strong" band ranges from **79.49% (Ulmus) to 97.23% (Cercis)** — a spread of 17.74 percentage
points, standard deviation 4.56pp around a mean of 89.95%. Under per-genus calibration, the same
34 genera range from **85.91% (Fagus) to 91.92% (Carpinus)** — a spread of 6.01 percentage points,
standard deviation 1.50pp around a mean of 89.72%. The mean barely moves (as expected — both
methods target 90% on average); what changes is that **no single genus is left promising a
reliability it does not deliver by double digits.** Ulmus, Populus, Prunus and Fraxinus — the four
genera D-04's amendment specifically named — move from 20+pp below the promised 90% (79.49%,
79.87%, 81.96%, 82.79%) to within 1pp of it (90.53%, 90.09%, 91.13%, 90.83%). Quercus deciduous and
Cercis, which were quietly over-delivering (95.70%, 97.23% — not a problem for the user, but a
sign the old threshold had room to admit more predictions at those two genera specifically),
settle to right at 90% too (89.99%, 91.15%).

**Coverage cost is real but not large in aggregate.** Pooled across all 34 genera, per-genus
calibration labels 63.70% of test predictions "strong" (16,916/26,557), against 64.29% under the
old global threshold (17,073/26,557) — a 0.59 percentage-point difference, not a meaningful
coverage loss. The cost is redistributed, not created: genera that were already under-covered
relative to their (over-optimistic) old label — Ulmus's old share was 43.60%, the lowest of all 34
genera even before calibration — lose a little more coverage to buy honesty, while a few genera the
old threshold under-served gain a little.

### 15.4 Re-cut confidence scale — four levels, fit on validation, reported on test

D-12's amendment names two problems with the original three-level scale: the "weak" band never
fired (0 of 26,557 predictions), and the "medium" band conflated cases right ~30% of the time with
cases right ~50% of the time. Both are fixed by re-cutting on **local** band accuracy rather than
cumulative-from-the-top precision for every band: the top ("strong") band is still defined by
cumulative precision from the most confident prediction downward (that is the correct method for
an unbounded-above band), but each band below it is fit only against the data **already excluded**
from the band(s) above — fitting "medium" or "weak" against the full pooled set is a dead end,
because pooled accuracy (72.08%, Section 14.4) sits above both the 50% and 30% targets, so a naive
full-set sweep never finds a threshold below the entire dataset's minimum confidence value. This
was checked directly (a first attempt did exactly that and produced a degenerate result) before
switching to the nested/excluded-remainder method reported here.

Thresholds and bands, fit on the 26,553-image validation split, reported on the 26,557-image test
split:

| band | threshold (fit on val) | val n | val accuracy | test n | test accuracy |
|---|---:|---:|---:|---:|---:|
| strong (conf ≥ t1) | 0.7775 | 17,074 | 90.00% | 17,056 | 90.06% |
| medium (t2 ≤ conf < t1) | 0.4866 | 5,446 | 50.00% | 5,518 | 49.73% |
| weak (t3 ≤ conf < t2) | 0.3461 | 2,393 | 30.00% | 2,359 | 30.27% |
| very weak (conf < t3) | — | 1,640 | 18.96% | 1,624 | 19.95% |

**Four levels, not three, is what the data supports.** A local-accuracy sweep across 20 equal-rank
confidence bins on the validation split (raw diagnostic, not itself a reported figure) shows local
accuracy stepping cleanly and near-monotonically from 99.9% at the very top to 18.0% at the very
bottom, with no plateau wide enough to justify collapsing any two of these four bands into one.
Val-to-test agreement is close at every cut (90.00%→90.06%, 50.00%→49.73%, 30.00%→30.27%,
18.96%→19.95%) — this scale is not an artefact of the validation split's own noise. The bottom
band now actually fires (1,624–1,640 predictions, ~6% of all predictions) — the collapsed-to-two-
levels defect D-12 named is fixed. Naming and exact wording for these four levels in the UI is
explicitly left to Phase 3 (per D-12's own text); this section's job is only to hand over
data-backed cut points and their achieved accuracy.

### 15.5 Overfitting guard — what was done, and the honest limit on how far to trust it

**What was done.** Every threshold in Sections 15.2 and 15.4 was fit exclusively on the
26,553-image validation split and reported exclusively on the 26,557-image test split — the two
never overlap (`data/splits/<class>/{val,test}.txt` are disjoint by construction, plan 02). This is
a genuine held-out check, not a repeat of the same-split fit-and-report pattern
`confidence_bands.json` (Section 14, iteration 4) used. The close val→test agreement in Section
15.4's four-level table, and the narrow 85.91%–91.92% per-genus spread in Section 15.2 (against a
90% target, at n ranging from 300 to 1,000 test images per genus), are direct evidence the fit
generalises rather than memorising validation-split noise.

**What this does not prove.** Both splits are drawn from the same GBIF corpus, with the same
composition problems (Section 3a: not reliably single-subject) and the same seasonal skew profile
that Section 14.5 already found closes somewhat but does not fully resolve. A threshold that
generalises from validation to test within this corpus says nothing about whether it generalises
to field photographs (Section 6/9's still-open D-16 gap) or to the observers' actual camera
hardware. This calibration is exactly as trustworthy as Section 14.4's underlying accuracy figures
are, and no more.

**Resolution limit.** Per-genus test sample sizes here range from 363 (Ceratonia) to 1,000 (Acer,
Prunus) images. At n≈300–600, a genus's achieved "strong"-band accuracy has real sampling noise
around the 90% target — the 85.91%–91.92% spread in Section 15.2 should be read as consistent with
a well-calibrated model at this sample size, not as evidence that six genera are subtly
miscalibrated by a few points. This is the same resolution-limit caveat Section 5 and Section 12
already apply to whole-year and per-season accuracy figures, extended here to calibration.

### 15.6 Genera where "strong" will rarely fire — the honest message for the ADR

Even after calibration, four genera keep a "strong" share below one third of their test
predictions: **Ulmus (26.83%), Prunus (29.30%), Populus (32.66%), Fraxinus (35.18%)** — plus Picea
just above that band at 40.50%. For these genera, calibration does not create false confidence,
but it also cannot manufacture confidence the model does not have: on somewhere between two-thirds
and three-quarters of encounters with these genera, the model will show a lower-tier confidence
label (medium, weak or very-weak per Section 15.4), not "strong." This is the direct, evidenced
answer to Task A's fourth question — for these genera, the honest UI/ADR message is **"the model
rarely knows confidently,"** not a design defect to fix by lowering the bar, since lowering it
would exactly recreate the miscalibration Section 15.3 just measured and fixed. Notably, three of
these four (Ulmus, Prunus, Populus) are also named in `01-CONTEXT.md`'s amended D-04 as the
genera the miscalibrated single threshold most overstated — the same genera the model is
genuinely least certain about are the ones a naive global threshold most flattered.

_(Section 15 status: complete. All figures above are val-fit / test-reported per Section 15.1;
none are fit and reported on the same split.)_
