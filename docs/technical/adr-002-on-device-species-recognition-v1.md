# ADR-002 — On-Device Species Recognition for Factor A (US-C9)

## Status

Proposed

## Date

2026-09-26

## Context

US-C9 (`docs/specs/epic-c-ibp-survey-data-entry.md`) asks the app to suggest a tree species from a
photograph the ecologist takes in the field, so Factor A can be filled faster than by naming a
genus from memory. `.planning/INGEST-CONFLICTS.md` warning 5 records that this story entered the
MVP with zero stack, architecture or contract coverage — no runtime chosen, no model, no measured
latency or accuracy, no data-contract entry. This phase exists to close that gap with numbers from
real devices before any production code is written.

A throwaway spike (`spike/species-recognition/`, gitignored, never a deliverable) measured a
candidate runtime and model over five plans and four training iterations, against a nominal 2–3
working-day timebox (D-19). Recorded actual duration: **~56–57 hours wall-clock**
(`species-recognition-spike-measurements-v1.md` Status block), 2–3x the timebox on a naive hour
count. The great majority of that time — iteration 3's ~9–10h and iteration 4's 23.47h in
particular — was unattended background corpus-download and model-training time, not active working
hours, and the extension past the original timebox was the user's own decision at each step,
made after reviewing an intermediate no-go as premature (see "Confidence caps" below). This ADR is
the decision the measurement was run to produce; every figure it cites traces to a section of
`docs/technical/species-recognition-spike-measurements-v1.md` ("the measurement document"), which
is the evidence log, not the decision. The two documents are meant to be read together and link to
each other in their header blocks.

## Decision

**Full go for US-C9 in this milestone: on-device tree-genus recognition ships, suggesting all 34
CNPF genera with a per-genus calibrated confidence indicator, ecologist confirmation always
required.**

This is a decision made by the user on reviewing the evidence below, not a conclusion the spike's
own numbers alone would have forced — only 1 of 34 genera clears the accuracy bar the phase set out
to measure against (D-02). The user chose to ship anyway, on the condition that every suggestion
states its own reliability honestly rather than implying a confidence the model does not have. The
terms of that go are recorded as decisions below, each tracing to a measurement-document section.

- **Recognition targets the genus, never the species (D-01).** Factor A counts native genera from
  the closed CNPF regional list — 34 classes (33 genera, with Quercus mandatorily split into
  deciduous and evergreen groups), sourced from the official CNPF IBP FR v3.2 PDF and recorded in
  measurement document Section 2. No species-level figure from any published benchmark is quoted
  anywhere in that document as if it were genus-level (D-01's own discipline).
- **The evaluation bar is the correct genus within the top 3 candidates, 95% of the time, reported
  per genus and never as a single average (D-02, D-03).** A mean would let rare genera hide behind
  frequent ones and would make D-04's per-genus judgement impossible. Measured across all four
  training iterations (Section 5, 10, 11, 14.4): pooled top-3 accuracy moved 58.8% → 78.6% → 85.2%
  → **88.25%**; per-genus, **1 of 34 genera (Tamarix, 96.88%) clears the 95% bar** on the final
  (iteration 4, promoted) model. 17 of 34 genera sit at or above 90% top-3; the rest range down to
  the mid-70s. Iteration 4 reached genuine training saturation — `val_loss` bottomed at fine-tune
  epoch 15 and rose in 4 of the next 5 epochs while train loss kept falling (Section 14.2) — so more
  epochs on this backbone and corpus are not expected to move this further.
- **Full go, not partial go, with per-genus calibrated confidence (D-04, amended 2026-09-26).** The
  original partial-go rule — enable suggestions only for genera clearing the D-02 bar — would have
  enabled **one genus, Tamarix**, after four iterations of measurement; that is not a usable
  feature. The user chose instead to suggest **all 34 genera, none withheld**, each carrying an
  honest, **per-genus calibrated** confidence indicator, and to let the ecologist judge. Calibration
  is not cosmetic: at the single global threshold iteration 4 first computed, a "strong" label meant
  96% reliable on Quercus deciduous but only 79% on Ulmus, 80% on Populus, 82% on Prunus, 83% on
  Fraxinus — a spread of 17.74 percentage points (stdev 4.56pp) around the intended 90% target.
  Fitting the "strong" threshold **per genus**, on the validation split, and reporting the result on
  the held-out test split (measurement document Section 15.1–15.3, a genuine held-out check, not a
  same-split fit-and-report), collapses that spread to **85.91%–91.92% (stdev 1.50pp)**, at a
  pooled coverage cost of 0.59 percentage points (63.70% of predictions labelled "strong" versus
  64.29% before). The four genera D-04's amendment specifically named — Ulmus, Populus, Prunus,
  Fraxinus — move from 20+ points below the promised 90% reliability to within 1 point of it.
- **Confidence is shown as a four-level plain-word scale, not a percentage, with thresholds derived
  from measurement, not chosen (D-12, amended).** The original three-level scale's "weak" band never
  fired — 0 of 26,557 test predictions, because a 34-way softmax's top-1 probability floor never
  fell low enough to trigger it. Re-cut on a nested/remainder sweep (Section 15.4): **strong**
  (confidence ≥ 0.7775, val-fit accuracy 90.00%, test-reported 90.06%), **medium** (0.4866–0.7775,
  50.00% / 49.73%), **weak** (0.3461–0.4866, 30.00% / 30.27%), **very weak** (< 0.3461, — / 19.95%).
  The bottom band now captures ~6% of predictions. The exact wording and number of levels shown on
  screen is explicitly a Phase 3 UI decision (D-12's own text); the calibrated thresholds are this
  phase's deliverable, handed to Phase 3 as data, not UI copy.
- **Four genera keep "strong" below one third of predictions even after calibration, and this is
  stated plainly rather than smoothed over: Ulmus (26.83%), Prunus (29.30%), Populus (32.66%),
  Fraxinus (35.18%)** (Section 15.6). For these genera the honest message is "the model rarely knows
  confidently," not a defect to fix by loosening the threshold — loosening it would recreate exactly
  the miscalibration just measured and corrected.
- **Inference runs on-device only; no server inference, no network fallback (D-06).** This follows
  from ADR-001's LOCKED offline-first decision (DEC-006) and from the recognition photograph being
  taken in a forest with no signal. This is now a **checked proof**, not a code-inspection argument:
  the promoted model completed 30 timed runs online and 30 timed runs with the device physically in
  airplane mode; median total latency differed by 0.08ms (90.41ms online vs 90.49ms airplane,
  Section 7) — statistically indistinguishable, with no crash, stall or behavioural difference in
  either pass.
- **Inference runtime: `react-native-fast-tflite@3.0.1` (MIT licence) paired with
  `react-native-vision-camera` (MIT licence), wired through project-local Expo config plugins under
  `expo prebuild`.** This is RESEARCH.md's primary recommendation, and **no substitution to the ONNX
  fallback was needed** (`spike/species-recognition/device-harness/GATE`:
  `RUNTIME-SUBSTITUTION: no`) — worth recording as itself a finding, since the primary recommendation
  holding is not guaranteed in advance. The runtime built, linked and ran a full benchmark on real
  iOS hardware (measurement document Section 8); the Android build succeeded
  (`./gradlew assembleDebug`, `BUILD SUCCESSFUL`) with the same runtime and no substitution, though no
  Android device was run (see "Confidence caps" below).
- **The model: EfficientNet-B0, ImageNet-pretrained, fine-tuned on a licence-clean GBIF corpus,
  float16-quantised, 8,238,676 bytes (8.24 MB) on disk (Section 14.3).** Licence chain, traced end
  to end (Section 4, extended to the promoted EfficientNet-B0 backbone in Section 14.2, which loads
  through the same `tensorflow.keras.applications` path as the architecture Section 4 already
  licence-traces): architecture and ImageNet-pretrained weights via `tensorflow.keras.applications`
  — **Apache License 2.0** (TensorFlow's own licence; the architecture itself is published research,
  not separately licensed); training images — **GBIF occurrence media, CC0-1.0 or CC-BY-4.0 only**,
  licence-filtered at the query level (Section 3), ~265,546 images across 34 classes at final
  iteration. All three links are permissive and redistributable; no restrictive licence enters the
  chain at any point (D-09 satisfied by construction). Export parity: 100% top-1 agreement (68/68)
  between the trained Keras model and the exported `.tflite` (Section 14.3). **CC-BY-4.0 carries an
  attribution obligation**: if this model ships, the app or its accompanying documentation must
  credit the GBIF-sourced CC-BY images and photographers per GBIF's own attribution mechanism —
  this is a real, low-cost obligation, not zero, and Phase 3 must implement it before shipping.
  `01-RESEARCH.md` assumption A4 flagged this licence reading as a documented reading, not legal
  advice; it must be re-verified before the model ships, not re-derived from this ADR alone.
- **The model is downloaded separately on first launch and not bundled in the binary (D-07),
  served from the existing S3/MinIO object storage over TLS** — the locked default. **This is
  explicitly re-opened as a question for the user at ratification, not silently re-decided here.**
  D-07 chose a separate download specifically because the association assumed a large model would
  otherwise bloat the app binary; at 8.24 MB, the model is well within the range many app binaries
  already ship as bundled assets. Bundling would remove the download flow, the on-device cache-path
  handling and the D-08 unavailable-state UI entirely; keeping the download preserves D-07/D-08 as
  already designed and specified. See "Open question for ratification" below — this ADR does not
  choose an answer, and Phase 3 should not start on either path until the user has.
- **Suggestions are presented most-likely-genus-first, with the remaining candidates listed
  underneath (D-11)** — this is a screen-design decision distinct from the D-02 top-3 evaluation
  metric; the two must not be conflated. The suggestion never applies itself; the ecologist always
  confirms, edits or rejects (mirrors ADR-001's DEC-* pattern of explicit user action over silent
  automation).
- **The recognition photograph is transient and is not kept (D-13):** it does not consume the
  ten-photo survey-attachment quota (`REQ-C-photos`), costs no storage or sync, and requires no
  data-contract extension of its own. (The **result** of recognition — a confirmed genus — does
  require a data-contract extension; see "Preconditions" below, which is a different thing.)

### Measured evidence

Full detail lives in the measurement document; this table is the summary the decision above rests
on. Every figure below cites its source section — none is reproduced from a different iteration
than stated, and none is a projection.

| What | Figure | Source |
|---|---|---|
| Pooled top-3 accuracy, across four iterations | 58.8% → 78.6% → 85.2% → **88.25%** | Sections 5, 10.3, 11.3, 14.4 |
| Genera clearing D-02's 95% top-3 bar | 0 → 0 → 1 (Tamarix, 95.04%) → 1 (Tamarix, 96.88%) | Sections 5, 10.3, 11.3, 14.4 |
| Genera ≥90% top-3 (final model) | 17 of 34 | Section 14.4 |
| Île-de-France temperate genera (21, targeted iteration 4) vs Mediterranean/evergreen (13, untouched) | mean +4.93pp top-3, 21/21 improved, vs +1.65pp, 11/13 improved | Section 14.4 |
| Per-genus "strong"-band accuracy, single global threshold | 79.49%–97.23% (stdev 4.56pp) | Section 15.3 |
| Per-genus "strong"-band accuracy, calibrated | **85.91%–91.92%** (stdev 1.50pp) | Section 15.2–15.3 |
| Model size on disk | **8,238,676 bytes (8.24 MB)**, float16, 100% export parity | Section 14.3 |
| Latency, iPhone 15 Pro (iOS 27.0), Release build, online | median **90.41ms**, p95 115.30, worst 142.94, n=30 | Section 7 |
| Latency, same device, airplane mode | median **90.49ms**, p95 93.61, worst 108.34, n=30 | Section 7 |
| D-05 budget (3,000ms) verdict | MET, ~33x headroom, both network states | Section 7 |
| D-06 offline claim | CHECKED PROOF (0.08ms median difference online vs airplane) | Section 7 |
| Seasonal accuracy (iteration 4, all 136 genus×season cells now n≥30) | winter 85.62% (weakest), spring 88.72%, summer 89.03%, autumn 88.82% | Section 14.5 |
| Android | build succeeds, **no device run performed** | Sections 7, 8, 9 |
| Field photographs | **none supplied**; lab (GBIF) figure only | Sections 6, 9 |

Device named: **iPhone 15 Pro (iPhone16,1), iOS 27.0** — the only real device reachable during the
spike, explicitly flagged in the measurement document as a **flagship**, not the D-18 low-spec
floor (iPhone SE 2nd/3rd gen or iPhone 11 class). See "Confidence caps."

## Behaviour when the model is unavailable

**When the model has not yet been downloaded, or fails to load, the app shows an explicit message
and falls back to normal manual entry (D-08).** Silent fallback is rejected — the ecologist would
conclude the feature is simply broken, not that it is temporarily unavailable. This behaviour was
exercised and confirmed working on the real iPhone 15 Pro during both the plan 03 harness proof and
the plan 05 measurement pass (measurement document Sections 7, 8): the explicit "Recognition
unavailable" message rendered correctly before the model was seeded into the on-device cache, and
the app stayed fully usable throughout. It was not separately exercised on Android or on a
low-spec device.

## Model distribution integrity

The downloaded model file is untrusted input to a native inference runtime, and must be treated as
such by Phase 3. This ADR requires, as a precondition of shipping the download path:

- **Checksum verification** of the downloaded `.tflite` file against a manifest value, performed
  before the file is ever passed to the native inference runtime.
- **TLS delivery** from the existing object-storage endpoint (S3-compatible, MinIO locally,
  configurable for AWS S3 in production per ADR-001), the same endpoint attachments already use.
- **Fail closed to the D-08 explicit-message path** on checksum mismatch or load failure — never a
  crash, never a silent retry loop that leaves the ecologist guessing.

This is RESEARCH.md's security-domain control for this feature, and belongs here because Phase 3
implements it directly from this ADR, not from a separate security review.

## Cost

**On-device inference adds no recurring inference cost to the ~€346/yr running budget
(`.planning/PROJECT.md`), by construction** — no inference call ever crosses the network (D-06),
evidenced by the airplane-mode pass in Section 7 above. This satisfies ROADMAP Phase 1 success
criterion 4 directly.

Costs that are **not zero**, stated plainly rather than rounded away:

- **Hosting the model file.** 8.24 MB stored on the object storage already paid for under the
  existing budget — negligible against the existing bucket's cost profile.
- **Egress on first launch, per install.** At 8.24 MB per download, even a generous 200-install
  internal-only milestone (well above the association's actual observer count) is ~1.65 GB of total
  egress — a trivial, one-off addition against an already-provisioned object-storage endpoint, not
  a recurring per-survey cost.
- **One-off training/retraining effort.** ~56–57 hours of spike time were spent to reach the
  promoted model (measurement document Status block), the great majority unattended background
  compute. A future retraining pass (e.g. adding Tela Botanica or Wikimedia Commons imagery per
  Section 13.3) would cost developer time, not infrastructure spend, and is not committed to by this
  ADR.

No figure above is rounded to zero where a real, if small, cost exists.

## Preconditions

**D-15: the Factor A data-model gap is a hard precondition of US-C9, and blocks Phase 3 until
Phase 2 closes it.** The shipped app stores Factor A as a single number, `native_genus_count`
(`mobile/src/app/constants.ts`, `mobile/src/storage/db.ts`, `api/src/surveys/ibp-rules.service.ts`),
while `docs/specs/ibp-form-spec.md` §Factor A specifies a multi-select list of observed native
genera with a derived counter. Recognition produces a genus **name**; the current form has nowhere
to put one — even a perfect model delivers nothing until the form matches its own specification.
The work belongs to Phase 2 in full: the data contract, the API surface, IBP scoring on both client
(`mobile/src/app/ibp-scoring.ts`) and server (`api/src/surveys/ibp-rules.service.ts`), the mobile
screen (`mobile/src/screens/FactorDetailScreen.tsx`), and a migration for surveys already recorded
as a bare count — which cannot be decomposed back into named genera, so the migration is one-way by
construction. The 17 reference cases in `docs/technical/ibp-validation-matrix-v1.md` must keep
passing through that change.

**Phase 1.1 bears on Phase 2 before Phase 2 can start.** The 34-class genus list this ADR cites was
transcribed from CNPF IBP FR v3.2 (Section 2), while the repository's own reference documents
(`docs/references/README.md`, `docs/specs/ibp-form-spec.md`) cite IBP Fr v3.0 — a version drift
first surfaced by this phase's research and now confirmed first-hand by retrieving the live v3.2
PDF (Section 9, gap 9). Phase 1.1 exists specifically to resolve which version the app follows; the
genus list Phase 2 builds on must come from whichever version Phase 1.1 settles on, not silently
from this spike's working choice of v3.2.

**Phase 2's current ROADMAP wording is stale and should be corrected when Phase 2 is planned.** It
still describes a "species entity" carrying a "confidence score." The decision this ADR records is
**genus**-level, not species-level (D-01), and confidence is a **calibrated plain-word indicator**
(D-12), not a numeric score. This is flagged here for correction at Phase 2 planning time, not
silently fixed in this ADR, since ROADMAP wording is that document's own to correct.

## What is out of reach for this milestone

**The stand-photo case — recognising several trees in one photograph of a stand — is out of reach
for this milestone, settled with evidence rather than dropped (D-10, amended 2026-09-22).** It
requires object detection before classification, and no licence-clean, CNPF-genus detector or
dataset exists today. The two nearest candidates were investigated by name and both disqualified:
**SilvaScenes** (covers Quebec species, not the CNPF regional list, and its licence could not be
confirmed from the repository itself — RESEARCH.md assumption A3) and **ForTrunkDet** (CC-BY
licensed, but covers only **Eucalyptus and Pinus** — two of the CNPF's 34 genera, not the whole
list). Building a detector from scratch is a multi-week effort with its own data-acquisition
problem, not a 2–3 day spike. No stand-case figure exists anywhere in the measurement document, and
this is deliberate: a whole-image classifier pointed at a stand photograph would return a confident
answer about whichever trunk dominates the frame, which looks like evidence and is not
(RESEARCH.md Pitfall 3).

**Capturing the ecologist's corrections of wrong suggestions, to build an improvement dataset
(D-14), is deferred.** It needs storage, a GDPR position and a retraining story — a capability of
its own, belonging to a later milestone.

## Out of Scope for This Decision (later)

Following ADR-001's own section of the same name:

- **Species-level identification beyond genus.** D-01 scopes this phase to genus because that is
  what Factor A counts; species could serve a future use (rare-species gamification in US-F5, for
  one) but that is next-milestone, deferred-Epic-F territory.
- **Server-side recognition over already-synced photographs.** Rejected here for field use,
  categorically, by D-06 (offline-first, LOCKED). A server pass over already-synced photos is a
  different capability with a different cost profile and could be revisited once the app is no
  longer internal-only.
- **The choice of which CNPF methodology version the app follows.** This spike's genus list is
  sourced from v3.2 because that is the currently published document; whether the app adopts v3.2
  or stays on v3.0 is Phase 1.1's decision (`REQ-QA-ibp-version`), not this ADR's.

## Alternatives considered

- **`onnxruntime-react-native` (MIT, Microsoft).** RESEARCH.md's documented second-choice runtime,
  for a PyTorch-trained model that would be easier to export to ONNX than to TFLite. Not needed:
  the primary recommendation (`react-native-fast-tflite`) built and ran cleanly on real hardware
  with no substitution (`RUNTIME-SUBSTITUTION: no`).
- **`react-native-executorch` (MIT, Software Mansion).** A real, credible, well-built library —
  but flagged `SUS` by RESEARCH.md's package-legitimacy gate on publish-recency grounds alone
  (version 0.10.2, published 2026-09-11, days before the research that would have used it).
  Deliberately avoided so the phase needed no legitimacy-verification exception; not a judgement
  that the package is actually untrustworthy, only that the mechanical gate's rule was respected
  rather than argued around.
- **Writing directly against Core ML (iOS) and NNAPI (Android).** Would double the native
  integration surface for no accuracy or licence benefit over a cross-platform TFLite runtime;
  rejected on that basis alone.
- **Server-hosted inference.** Ruled out categorically by D-06 (offline-first, LOCKED ADR-001
  DEC-006), not evaluated on its technical merits — the field-connectivity constraint makes it moot
  regardless of any accuracy or latency advantage it might otherwise offer.

## Hand-off to Phases 2 and 3

**Phase 2 receives:** the 34-class genus list with its CNPF source and version (Section 2 — subject
to correction once Phase 1.1 settles the v3.0/v3.2 question); the confirmed model and runtime
(EfficientNet-B0 / `react-native-fast-tflite`); the calibrated confidence bands (Section 15) as data
for the data contract to carry; and the D-15 Factor A data-model work — data contract, API, IBP
scoring on both sides, mobile screen, migration — which must complete before Phase 3 can use any of
this. Phase 2 should also correct the stale ROADMAP wording noted above.

**Phase 3 receives:** the model distribution and integrity requirements (checksum, TLS, fail-closed
D-08 behaviour); the D-08 unavailable-state UI as already specified and confirmed working on real
hardware; the D-11/D-12 presentation rules (most-likely-first, four-level plain-word confidence,
exact wording left to Phase 3); the D-13 transient-photo rule; the CC-BY attribution obligation
this ADR names above; and the integration cost already measured in Section 8 — four native-
integration findings, all fixed once, that Phase 3 should budget as known, not rediscover: a missing
Expo config plugin for `react-native-vision-camera`, a `Podfile.lock` sequencing hazard, an
environment variable (`JAVA_HOME`) needed for Android builds, and the iOS 26+ scene-lifecycle-
adoption crash fix (`with-scene-delegate.js`) that is invisible on the Simulator and must ship from
day one, not be discovered on first real-device test. Phase 3 must also re-time the promoted model
on a low-spec device before trusting the ~90ms figure as representative (see "Confidence caps").

**Genera below one-third "strong" coverage (Ulmus, Prunus, Populus, Fraxinus) are not enforced
differently from the rest** — all 34 genera are suggested identically; only their confidence label
will more often read medium, weak or very-weak. Phase 3 must not special-case these genera by
withholding them; the calibrated label is the mechanism that already handles this honestly.

## Open question for ratification

**D-07 (separate model download vs bundling in the binary) is re-opened here for the user's
decision, not re-decided by this ADR.** D-07 was chosen when the model's size was unknown; it is
now measured at 8.24 MB (Section 14.3) — small enough that many apps ship this as a bundled asset.
Two paths, either legitimate:

1. **Keep D-07/D-08 as designed:** download on first launch, over Wi-Fi, from the object-storage
   endpoint; app stays lighter on the stores; the D-08 unavailable-state UI stays necessary.
2. **Bundle the model in the binary:** removes the download flow, the on-device cache-path handling
   and the D-08 unavailable-state UI entirely; the app binary grows by ~8.24 MB permanently.

This ADR does not choose between them. The ratification checkpoint below asks the user to pick one
before Phase 3 is planned, since Phase 3's implementation shape differs materially between the two.

## Confidence caps

Stated plainly, as caps on how far this decision's evidence reaches, not buried in a caveats
appendix:

1. **Every latency figure is from an iOS flagship (iPhone 15 Pro), not the D-18 low-spec floor**
   (iPhone SE 2nd/3rd gen or iPhone 11 class). The ~90ms median figure is optimistic; the ~33x
   headroom against the 3,000ms budget gives real margin, but a genuinely low-spec device was never
   measured, by the association's own unavailability rather than by choice.
2. **Android was never measured on real hardware, by the user's explicit decision this milestone.**
   The build succeeds and the same runtime is confirmed with no substitution, so the runtime
   question is answered — but no Android latency or accuracy figure exists anywhere in the
   measurement document. This is a measurement gap, not a feasibility failure.
3. **No field photographs were supplied at any point in this phase (`no-field-photos`, D-16's
   field-validation half not performed).** Every accuracy figure in this ADR — the pooled 88.25%
   top-3, the per-genus calibration, all of it — is a **lab figure measured on citizen-science GBIF
   imagery**, not field photographs taken by an ecologist's phone in a forest. Field accuracy is
   expected to be lower than these figures, for the same reasons any lab-to-field transition
   typically degrades: different camera hardware, framing, lighting, focus discipline. This must be
   validated before or during Phase 7's field tests, not assumed to hold.
4. **Model load time was not captured** by this harness version — an honest, recorded gap, not a
   number estimated from indirect evidence.
5. **The spike took ~56–57 hours against D-19's 2–3 day timebox.** Mostly unattended training time,
   and the extension past the original timebox was the user's own decision at each of three points
   — rejecting iteration 1's no-go as premature, then approving iterations 3 and 4 — not scope creep
   introduced without review. Recorded honestly because the ADR's evidence would be materially
   thinner (a single MobileNetV3-Small pass, 0 of 34 genera clearing the bar, iteration 1 only) had
   the timebox been enforced strictly.

## Expected Validation

- [ ] Per-genus "strong"-band accuracy (85.91%–91.92% per Section 15.2) holds up on real field
      photographs during Phase 7's field tests, not only on GBIF lab imagery.
- [ ] Latency holds under 3 seconds on the observers' actual handsets, including any low-spec
      device confirmed after this milestone.
- [ ] The D-08 unavailable-state path behaves as described on a genuine first launch with no
      Wi-Fi, on both iOS and Android.
- [ ] Android latency and accuracy are measured at least once before Phase 3 ships, closing the gap
      this ADR records rather than carrying it forward indefinitely.
- [ ] The CC-BY attribution obligation for GBIF-sourced training images is implemented before the
      model ships to end users.
