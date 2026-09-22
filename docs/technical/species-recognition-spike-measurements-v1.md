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

*(Exact device models and OS versions used for measurement: filled by plan 05.)*

---

## 2. Genus label set (CNPF IBP FR v3.2, Factor A)

*Filled by plan 02.*

---

## 3. Image corpus and licence provenance

*Filled by plan 02.*

---

## 4. Model candidates and on-disk size

*Filled by plan 02.*

---

## 5. Per-genus accuracy — public held-out test split

*Filled by plan 04.*

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

*(Filled by plan 04, if field photographs become available before wave 4.)*

---

## 7. On-device inference latency

*Filled by plan 05. Subject to the device-confidence cap recorded in Section 1.*

---

## 8. Native integration notes

*Filled by plan 05.*

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

*(Additional gaps recorded here as plans 02, 03, 04 and 05 execute.)*
