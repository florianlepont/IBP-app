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

_Filled by plan 05. Subject to the device-confidence cap recorded in Section 1._

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

_(Additional gaps recorded here as plans 03, 04 and 05 execute.)_

---

## 10. Iteration 2 — expanded corpus, larger backbone, side-by-side comparison

**Status: IN PROGRESS (started 2026-09-23, after iteration 1's result was reviewed).**

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

### 10.2 Training — in progress

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

_(Training results, export, and the side-by-side per-genus comparison table are filled in next.)_

### 10.3 What was not re-done in iteration 2

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
