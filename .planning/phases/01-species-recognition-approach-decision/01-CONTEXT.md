# Phase 1: Species Recognition — Approach Decision - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase produces a **decision backed by measurement**, not a feature.

It delivers an accepted ADR in `docs/technical/` plus a throwaway spike whose recorded numbers
justify that ADR. The ADR states whether on-device tree-genus recognition (US-C9,
`REQ-C-species-recognition`) can ship in this internal-only MVP milestone, and on what terms.

**In scope:** candidate model and runtime survey; a throwaway spike run on real iOS and Android
devices; recorded per-genus accuracy, inference latency and on-disk model size; the ADR itself
including an explicit go/no-go and its fallback.

**Out of scope:** any production code. No UI, no data-contract change, no model shipped in the app.
Those are Phase 2 (contracts) and Phase 3 (implementation), and both fall away if this phase
returns a no-go. Spike code is throwaway by design and is not a deliverable.

</domain>

<decisions>
## Implementation Decisions

### Recognition target and success bar

- **D-01:** Recognition targets the **genus only**, never the species. Factor A counts native
  genera from the closed CNPF regional list (`docs/specs/ibp-form-spec.md` §Factor A), so genus is
  both what the score needs and a far more tractable classification problem.
- **D-02:** The bar for "it works" is **the correct genus among the top 3 most likely, 95% of the
  time**. This is an *evaluation* metric, not a screen design — see D-11.
- **D-03:** Accuracy must be reported **per genus, never as a single average**. The user chose to
  measure across the whole CNPF regional list (D-17); without a per-genus breakdown, rare genera
  drag the average down and hide the fact that frequent genera work. The partial-go rule (D-04)
  is unusable without this breakdown.
- **D-04 (AMENDED 2026-09-26, after iteration 4):** **Full go with per-genus calibrated
  confidence.** All 34 genera are suggested; none is withheld. The original rule — enable only the
  genera that clear the D-02 bar — would have enabled a single genus (Tamarix) after four
  iterations, which is unusable. The user chose instead to show every suggestion with an honest
  confidence indicator and let the ecologist judge.
  *Why calibration is mandatory, not optional:* iteration 4's confidence bands show the model's
  own confidence is informative (top-1 correct 90.0% in the "strong" band vs 39.8% in "medium",
  pooled) but **not uniform across genera**: a "strong" prediction is right 96% of the time on
  Quercus deciduous but only 79% on Ulmus, 80% on Populus, 82% on Prunus, 83% on Fraxinus. A single
  global threshold would therefore promise a reliability the model does not deliver on exactly the
  hardest genera. The "strong" threshold must be calibrated **per genus** so that "strong" carries
  the same meaning — roughly 90% correct — whichever genus is shown. See D-12.
  *Original wording (superseded):* partial go — enable suggestions only for genera that clear the
  bar, keep manual entry for the rest.
- **D-05:** Inference must complete in **under 3 seconds** on the measured devices. The ecologist
  is standing at the tree waiting for the answer; 3 s leaves headroom for older phones.

### Where inference runs

- **D-06:** **On-device only.** No server inference, no network fallback. Offline-first is a LOCKED
  ADR-001 decision (DEC-006) and the photo is taken in a forest with no signal — a recognition
  path requiring connectivity would almost never be usable. This also satisfies the phase's
  no-recurring-cost criterion by construction.
- **D-07 (AMENDED 2026-09-26, at ADR-002's ratification):** **The model is bundled in the app
  binary, not downloaded separately.** The original premise — that a separate download was needed
  to keep the app light on the stores — assumed a large model; the spike measured the actual
  trained model at 8.24 MB (`docs/technical/species-recognition-spike-measurements-v1.md` Section
  14.3), well within the range many app binaries already ship as bundled assets. Re-opened as an
  explicit question at ADR-002's ratification checkpoint rather than silently re-decided, the user
  chose to bundle: this MVP is internal-only, so shipping a new app version to update the model is
  cheap under internal distribution (no store-review-volume pressure); bundling removes the
  first-launch download, the on-device model cache, and the D-08 unavailable-state UI's
  not-yet-downloaded branch entirely; and an ecologist who installs the app just before going into
  the field cannot forget a download the way they could with a separate-download flow. D-08's
  behaviour is narrowed accordingly in `docs/technical/adr-002-on-device-species-recognition-v1.md`
  ("Behaviour when the model is unavailable") — only a model *load* failure remains, not a
  "not yet downloaded" state; D-08's own wording below is left as originally written since the
  underlying principle (never fail silently) is unchanged, only which failure modes exist.
  *Original wording (superseded):* The model is downloaded separately on first launch, not bundled
  in the binary. The app stays light on the stores and the download happens over Wi-Fi before going
  into the field. Cost: the app must handle a "model not present yet" state (D-08).
- **D-08:** When the model is unavailable — not yet downloaded, or a load failure — the app shows
  an **explicit message and falls back to normal manual entry**. The ADR must state this
  behaviour; silent fallback was rejected because the ecologist would think the feature is broken.
- **D-09:** The model licence must be **permissive and redistributable**. The association is a
  non-profit with a near-zero budget and the app ships on public stores; a restrictive licence
  discovered at publication time would be expensive.

### What the ecologist sees

- **D-10:** **Single subject only** — one tree, a leaf or a bark close-up.
  *Amended 2026-09-22 after research (`01-RESEARCH.md`).* The original decision was to measure both
  a single subject and a stand photo containing several trees. Research found no licence-clean,
  ground-level multi-tree detector covering CNPF genera, and no suitable labelled dataset: the
  nearest candidates are SilvaScenes (Quebec species, licence unconfirmed) and ForTrunkDet (CC-BY
  but only Eucalyptus and Pinus). Building a detector from scratch is a multi-week effort, not a
  2–3 day spike. The user chose to measure the single-subject case properly rather than produce two
  weak results. **The stand case is therefore not measured, and the ADR must record it as out of
  reach for this milestone, citing the missing datasets by name** — the question is settled with
  evidence, not dropped. See Deferred Ideas.
- **D-11:** The screen shows the **most likely genus first with its confidence**, with the
  remaining candidates listed underneath. *User correction during discussion:* an earlier option
  proposed displaying three genera; that conflated the top-3 evaluation bar (D-02) with the screen
  design. Showing the most likely first is what makes the feature worth having — otherwise the
  ecologist is asked to choose between three options, which is what the plain list already does.
- **D-12:** Confidence is shown **in plain words**, not as a percentage. Readable without knowing
  how a model works. US-C9 asks for a "confidence score" literally, but a percentage reads poorly
  and implies false exactness.
  *Amended 2026-09-26:* two corrections from iteration 4's measured confidence bands. (1) The
  three-level scale as first thresholded does not work: the "weak" band received **zero** of 26,557
  test predictions, because with 34 classes the top-1 probability never falls below the weak
  threshold. The scale collapsed to two levels in practice. The bands must be re-cut — the current
  "medium" band spans cases right ~30% of the time and cases right ~50%, which the ecologist should
  be able to tell apart. (2) Thresholds are **per genus** (D-04), so a given label means the same
  reliability across all 34 genera. The exact wording and number of levels is a Phase 3 UI decision;
  the calibrated per-genus thresholds are a Phase 1 deliverable feeding it.
- **D-13:** The recognition photo is **transient and not kept**. It does not consume the 10-photo
  survey attachment quota (`REQ-C-photos`), costs no storage or sync, and requires no
  data-contract extension.
- **D-14:** The ecologist's corrections of wrong suggestions are **not captured** in this
  milestone. See Deferred Ideas.

### Factor A data model — discovered gap

- **D-15:** **The genus list must be introduced.** The shipped app stores Factor A as a single
  number (`native_genus_count`), while `docs/specs/ibp-form-spec.md` specifies a multi-select list
  of observed native genera with a derived counter. Neither document contradicts the other — the
  code silently diverged from the spec, which is why the doc ingest did not flag it. The
  consequence for this phase is direct: **recognition produces a genus name and the form has
  nowhere to put it**, so even a perfect model would deliver nothing as things stand.
  The user chose to bring the form in line with the spec: multi-select of genera with a derived
  count. This is the bulk of Phase 2's work and touches the data contract, the API, the IBP
  scoring path, the mobile screen, and a migration for surveys already recorded as a bare count.
  The ADR must record this as a precondition of US-C9.

### Measurement protocol

- **D-16:** Accuracy is measured on **public labelled tree-image datasets first, then validated on
  field photographs**. Lab figures routinely collapse under real conditions; the second step is
  what makes the go/no-go honest.
- **D-17:** Measurement covers the **whole CNPF regional genus list**, reported per genus (D-03).
- **D-18:** Latency is measured on the **observers' real phones**. The phase's success criteria
  require a real iOS device and a real Android device; measuring on hardware faster than what goes
  into the forest would invalidate the result. *Open item for the spike: establish which phones
  the association's observers actually use.*
- **D-19:** The spike is **timeboxed to two or three days**. Enough for two or three candidate
  models on the single-subject case (D-10) across two phones. The published schedule is already at its
  September 2026 deadline with field tests due to start in October.

### Claude's Discretion

- Choice of inference runtime (Core ML, TensorFlow Lite, ONNX Runtime, ExecuTorch or another) and
  of the candidate models to measure — constrained by D-06, D-07 and D-09.
- How the throwaway spike is structured, and whether it runs inside the Expo app via a dev client
  or as a standalone harness. Native modules are available: `ios/` and `android/` are generated by
  `expo prebuild` (see `mobile/README-native.md`).
- The exact ADR file name and numbering, following the ADR-001 precedent.
- Which public datasets to use, subject to D-09's licence constraint applying to data as well.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement and its scoring rules

- `docs/specs/epic-c-ibp-survey-data-entry.md` — US-C9, the source requirement for species
  recognition, and US-C1 for the guided-entry form it plugs into
- `docs/specs/ibp-form-spec.md` §Factor A (line 71) — defines Factor A as a multi-select list of
  observed native genera plus a derived counter, drawn from the CNPF regional list, with the
  0/1/2/5 score thresholds. This is the document the shipped code diverges from (D-15)
- `docs/technical/ibp-validation-matrix-v1.md` — the 17 reference cases the rule engine is tested
  against; any Factor A change must keep these passing

### Locked decisions and contracts this phase must respect

- `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md` — 14 LOCKED decisions.
  DEC-006 (offline-first) is what forces D-06. The ADR contains no ML component, which is why this
  phase exists. Also the format precedent for the ADR this phase produces
- `docs/technical/data-contract-v1.md` — the entity and state model a genus list would extend in
  Phase 2
- `docs/technical/api-contract-v1.md` — the `/v1` surface a genus list would extend in Phase 2

### Current implementation state

- `.planning/codebase/STACK.md` — Expo 57.0.24, React Native 0.86.3, React 19.2.3. Native modules
  are viable: the native projects are generated by `expo prebuild`
- `mobile/src/app/constants.ts:111` — `factorA: { native_genus_count: "" }`, the single-number
  shape that D-15 replaces
- `mobile/src/app/ibp-scoring.ts:63` — client-side Factor A scoring reading that count
- `mobile/src/hooks/useSurveyForm.ts:146` — form validation of the count
- `mobile/src/storage/db.ts:27` — local SQLite survey shape carrying the count
- `mobile/src/screens/FactorDetailScreen.tsx:119` — the screen that would become a genus
  multi-select
- `api/src/surveys/ibp-rules.service.ts` — server-side IBP rules, the authority on scoring
- `mobile/README-native.md` — how native changes are made in this repo (`app.json` or a plugin
  under `mobile/plugins/`; `ios/` and `android/` are generated, not committed)

### Milestone framing

- `.planning/PROJECT.md` — milestone scope and the LOCKED decisions table
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria; Phases 2 and 3 depend on this
  phase's go/no-go
- `.planning/INGEST-CONFLICTS.md` warning 5 — records that US-C9 was labelled MVP with zero stack,
  architecture or contract coverage. This phase is the response to that finding

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`FactorDetailScreen.tsx`** — the existing per-factor detail screen is where a genus
  multi-select and any suggestion UI would live. It already handles `native_genus_count` as a
  numeric field, so the change is localised rather than a new screen.
- **Expo photo capture** — the survey form already captures photos for attachments
  (`REQ-C-photos`, up to 10 per survey). The capture path exists; D-13 keeps the recognition photo
  out of that pipeline rather than extending it.
- **`ibp-scoring.ts` / `ibp-rules.service.ts`** — Factor A scoring exists on both client and
  server and is covered by the 17-case validation matrix. A genus list changes the input shape but
  not the thresholds.

### Established Patterns

- **Offline-first is structural, not optional** — SQLite plus a sync queue, with the server as
  source of truth. Any recognition design that assumes connectivity contradicts the architecture,
  not merely a preference.
- **No ORM, raw SQL via `pg`** — a genus list in Phase 2 means an explicit migration in
  `api/migrations/`, following the numbered convention through `012`.
- **Native code is generated** — `ios/` and `android/` come from `expo prebuild` and are not
  committed. A native inference module must be configured through `app.json` or a plugin under
  `mobile/plugins/`, never by editing generated projects.
- **Client and server both enforce IBP rules** — the client for immediate feedback, the server as
  authority. A Factor A shape change must land on both sides together.

### Integration Points

- Factor A entry in `FactorDetailScreen.tsx` — where a suggestion would surface.
- `native_genus_count` in the local SQLite payload and in the sync payload — the field whose shape
  D-15 changes.
- `api/src/surveys/ibp-rules.service.ts` — server-side validation of the new shape.
- Surveys already recorded with a bare count — they need a migration path, since the count cannot
  be decomposed back into named genera.

</code_context>

<specifics>
## Specific Ideas

- The ecologist photographs a subject, gets the most likely genus with a strong/medium/weak
  confidence, and the next candidates sit just underneath in case the first is wrong. The
  suggestion never applies itself.
- Recognition is framed as an aid to a form that already works without it. Manual entry must stay
  fully usable at every point, including when the model is missing or the genus is below the bar.
- The spike is explicitly throwaway. Its output is numbers in an ADR, not code to be carried
  forward.

</specifics>

<deferred>
## Deferred Ideas

- **Capturing the ecologist's corrections of wrong suggestions** to build an improvement dataset.
  It needs storage, a GDPR position and a retraining story — a capability of its own, belonging to
  a later milestone rather than this phase.
- **Stand-photo recognition** — identifying several trees in one photograph of a stand. Requires
  object detection before classification, and no licence-clean model or dataset covering CNPF
  genera exists today (see D-10). A multi-week effort with its own data-acquisition problem; it
  belongs to a later milestone, if at all.
- **Species-level identification** (beyond genus). D-01 scopes this phase to genus because that is
  what Factor A counts. Species could serve future uses — rare-species gamification in US-F5, for
  one — but that is next-milestone territory and the deferred Epic F.
- **Server-side recognition for archived photos.** Rejected here by D-06 for field use, but a
  server pass over already-synced photos is a different capability with a different cost profile,
  and could be revisited once the app is no longer internal-only.

</deferred>

---

*Phase: 1-species-recognition-approach-decision*
*Context gathered: 2026-09-22*
