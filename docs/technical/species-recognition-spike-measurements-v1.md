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

**Status as of this commit: IN PROGRESS.** 28 of 34 classes have downloaded images; 3 failed on a
transient network error and are being retried; 3 had not yet been attempted at the time of this
commit. This section is committed now, incomplete, on explicit instruction: the corpus-assembly
work already done (script, partial corpus, per-class counts, the cause of every gap) must survive
an interruption rather than exist only in an agent's context. It will be completed in a following
commit once the remaining classes are fetched and the composition audit (Section 3a) is run.

### Source

GBIF occurrence media (`api.gbif.org/v1/occurrence/search`), filtered server-side to
`license=CC0_1_0` and `license=CC_BY_4_0` only, `mediaType=StillImage`. This is RESEARCH.md's
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

### Per-class corpus status (interim — 28 of 34 classes downloaded)

| class                | downloaded                         | train | val | test | status                                                                                                        |
| -------------------- | ---------------------------------- | ----- | --- | ---- | ------------------------------------------------------------------------------------------------------------- |
| Abies                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Acer                 | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Alnus                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Arbutus              | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Betula               | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Carpinus             | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Castanea             | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Celtis               | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Ceratonia            | 165                                | 112   | 26  | 27   | complete (below-220 target; test count 27, just under the 30-image reporting threshold)                       |
| Cupressus            | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Fagus                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Fraxinus             | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Juglans              | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Juniperus            | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Larix                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Malus                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Olea                 | 0 (421 raw files on disk, unsplit) | —     | —   | —    | **interrupted mid-download** (hung network read, killed and being resumed; not a licence or taxonomy failure) |
| Ostrya               | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Phillyrea            | 0                                  | 0     | 0   | 0    | **not yet attempted** at time of this commit                                                                  |
| Picea                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Pinus                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Pistacia             | 0                                  | 0     | 0   | 0    | **not yet attempted** at time of this commit                                                                  |
| Populus              | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Prunus               | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Pyrus                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Quercus_deciduae     | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Quercus_sempervirens | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Salix                | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Sorbus               | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Tamarix              | 220                                | 150   | 35  | 35   | complete                                                                                                      |
| Taxus                | 203                                | 138   | 32  | 33   | complete (below-220 target)                                                                                   |
| Tilia                | 0                                  | 0     | 0   | 0    | **network-failure, being retried** — see below                                                                |
| Ulmus                | 0                                  | 0     | 0   | 0    | **network-failure, being retried** — see below                                                                |
| Cercis               | 0                                  | 0     | 0   | 0    | **network-failure, being retried** — see below                                                                |

### The five absent classes, cause by cause (not merged into one bucket)

Three distinct causes were considered for every absent class, per the coordinator's explicit
instruction that they carry different meaning for the phase and must not be conflated:

1. **Licence scarcity** (too few CC0/CC-BY images on GBIF) — ruled out for all five. The coverage
   survey above found 4,200+ candidates for every one of the 34 classes, including all five
   currently absent ones, before any download was attempted.
2. **Taxon-key resolution bug** (a homonym or lookup failure specific to this script) — ruled out
   for all five. `species/match?name=<genus>&kingdom=Plantae` resolves correctly for all of them
   when the network call succeeds (confirmed manually during the coverage survey).
3. **Transient network failure** — confirmed as the cause for **Tilia, Ulmus, and Cercis**: each
   failed with `requests.exceptions.SSLError` / `SSLEOFError: EOF occurred in violation of
protocol` against `api.gbif.org`, immediately following a successful request for the
   alphabetically-preceding class (Ceratonia succeeded immediately before Cercis failed), which
   rules out a sustained outage. **Olea** was interrupted separately: its connection to an
   S3-hosted image host (`s3-1-w.amazonaws.com`) stalled with the socket `ESTABLISHED` but 0% CPU
   and no progress for several minutes — a slow trickle of bytes that reset `requests`' per-read
   timeout on every partial read without ever completing, which the process-level `timeout=`
   parameter does not bound (a known `requests`/`urllib3` limitation). This was fixed in
   `prepare_dataset.py::download_and_resize` by streaming with an explicit wall-clock deadline
   instead of relying on the per-read socket timeout. **Phillyrea and Pistacia** were never
   reached in this run (they are last in `genus_labels.txt`'s iteration order) and carry no
   failure of any kind yet — they are simply retried in the next pass along with the other four.

None of the five is licence-scarce and none is a resolution bug. All five are infrastructure
gaps, not corpus-coverage findings, and none should reduce the classes-usable count without a
second confirmed failure (`network-failure-after-retry`).

_(Composition audit, seasonal-skew estimate, and the final complete per-class table with all 34
classes: added in a following commit once the retry completes.)_

---

## 4. Model candidates and on-disk size

_Filled by plan 02._

---

## 5. Per-genus accuracy — public held-out test split

_Filled by plan 04._

---

## 6. Per-genus accuracy — field photographs

**Status: PROVISIONAL — no field photos supplied yet (D-16 gap).**

No field photograph set was available at the time of the Task 1 checkpoint (2026-09-22); the
answer was `no-field-photos`. This spike therefore reports the public-dataset figure (Section 5)
only. The field-validation half of D-16 — the step that catches lab figures collapsing under real
conditions — was not performed in this round.

This section stays empty rather than being marked not-applicable. If field photographs are
supplied and dropped into the gitignored `spike/species-recognition/data/field/` before wave 4,
this section is filled in without restructuring the document. If it remains empty when the ADR is
written, the ADR must record this gap plainly as a stated limit on how much weight the go/no-go can
carry — not glossed over.

_(Filled by plan 04, if field photographs become available before wave 4.)_

---

## 7. On-device inference latency

_Filled by plan 05. Subject to the device-confidence cap recorded in Section 1._

---

## 8. Native integration notes

_Filled by plan 05._

---

## 9. Recorded gaps and confidence caveats

Two gaps are already known before any measurement takes place.

**1. The stand-photo case is not measured at all (D-10, amended 2026-09-22).** The original
decision was to measure both a single subject and a stand photo containing several trees. Research
found no licence-clean, ground-level multi-tree detector covering CNPF genera and no suitable
labelled dataset — the nearest candidates are SilvaScenes (Quebec species, licence unconfirmed) and
ForTrunkDet (CC-BY, but only Eucalyptus and Pinus). Building a detector from scratch is a
multi-week effort, not a 2–3 day spike. The ADR records the stand case as out of reach for this
milestone, citing these missing datasets by name. This document carries no stand-case number, valid
or otherwise.

**2. The field-photograph validation half of D-16 was not performed in this round.** See Section 6.
No field photo set was supplied at the Task 1 checkpoint (`no-field-photos`); the accuracy figure
in Section 5 is a public-dataset figure only, without the field-condition validation pass D-16
calls for. This is a provisional gap, not a closed one — see Section 6 for how it could still be
filled before the ADR is written.

**3. The benchmark-device pair is unconfirmed.** See Section 1. Latency figures in Section 7 are
measured against a documented floor, not against the observers' real phones. This caps confidence
in the latency evidence until the association confirms a device pair.

_(Additional gaps recorded here as plans 02, 03, 04 and 05 execute.)_
