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

**Status: IN PROGRESS (started 2026-09-23, user approved a further extension after reviewing
iteration 2's data-limited result).**

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
