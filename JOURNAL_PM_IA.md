# PM x AI Build Journal - IBP App

## Why this journal exists
I am building an app from scratch with AI as my execution partner.
I have product intuition and basic technical foundations, but I am not an app developer.
This journal captures the real story of the build: decisions, tradeoffs, misunderstandings, and momentum.

The goal is to convert daily execution into reusable PM judgment.

---

## Narrative daily template

### Date
`YYYY-MM-DD`

### Today in one sentence
What this day was really about.

### What happened
A short narrative of what I decided, changed, and observed.

### PM lens
What I prioritized and why.

### AI lens
Where AI accelerated execution and where I had to correct direction.

### Changes made
- Product/spec changes:
- Implementation changes:

### Friction or risk
What still feels fragile.

### Lesson learned
One thing I want to remember.

### Next move
What I should do first tomorrow.

---

## Backfilled entries (editable)

### 2026-03-02
#### Today in one sentence
I started the challenge by creating the EPIC structure before any feature implementation.

#### What happened
This was the real first product day. Instead of jumping into UI or code, I focused on shaping the backbone of the project through EPICs. With AI, I translated initial ideas into a structured backlog and iterated until each EPIC represented a real outcome, not a vague feature bucket.

#### PM lens
I prioritized roadmap architecture first: weak EPICs create noisy execution later.

#### AI lens
AI accelerated the drafting and reframing of EPICs, but I had to enforce clarity and remove ambiguous wording.

#### Changes made
- Product/spec changes: Created initial EPIC set and first pass of user stories/acceptance criteria.
- Implementation changes: None by design.

#### Friction or risk
Risk of producing generic EPICs that are not actionable.

#### Lesson learned
A strong EPIC map is the first accelerator when building with AI.

#### Next move
Turn EPICs into strong functional and technical specs.

### 2026-03-03
#### Today in one sentence
I used a spec-first strategy to lock requirements and technical direction before building.

#### What happened
After defining EPICs, I worked with AI to formalize product and technical specs. This also led to a clearer data contract and API contract, which made scope and implementation boundaries much more explicit. Once needs were clear, AI proposed a technical architecture. I challenged that architecture using my own technical baseline and environment constraints, then refined it into something implementation-ready.

#### PM lens
I chose clarity over speed: contracts first, execution second.

#### AI lens
AI was highly effective at structuring documentation and proposing architecture quickly. The value came from challenging outputs, not accepting them blindly.

#### Changes made
- Product/spec changes: Strengthened requirement specs, aligned EPIC scope, and clarified data/API contracts.
- Implementation changes: Architecture framing and planning, no heavy coding yet.

#### Friction or risk
False acceleration if implementation starts before contract quality is high enough.

#### Lesson learned
Spec quality determines build quality.

#### Next move
Start implementation loops with strict validation against specs.

### 2026-03-04
#### Today in one sentence
I moved from isolated fixes to clearer product intent across survey views.

#### What happened
The day surfaced concrete friction in Explore and My Surveys: DB visibility, filter behavior, and confusion about where surveys should appear. Iterative fixes exposed deeper ambiguities around ownership, visibility, and state semantics.

#### PM lens
I used fast feedback loops to validate assumptions in the real flow.

#### AI lens
AI executed fast fixes well, but implicit requirements still caused interpretation drift.

#### Changes made
- Product/spec changes: Clarified boundaries between Explore and My Surveys behavior.
- Implementation changes: Display/filter adjustments across mobile survey views.

#### Friction or risk
Terminology drift can quickly degrade UX clarity.

#### Lesson learned
If naming is ambiguous, implementation quality drops.

#### Next move
Stabilize state vocabulary before further UI expansion.

### 2026-03-05
#### Today in one sentence
I reduced cognitive load in detail and editing workflows.

#### What happened
I challenged unnecessary sections, duplicated progress blocks, and weak score visibility. I pushed direct interactions: tap factor to edit, tap map to update location, tap name to rename.

#### PM lens
I prioritized usability of core actions over extra interface elements.

#### AI lens
AI handled simplification well, with occasional regressions due to speed.

#### Changes made
- Product/spec changes: Reordered create survey hierarchy and removed low-value blocks.
- Implementation changes: More direct-edit behaviors and clearer progress/score visibility.

#### Friction or risk
Rapid UI iteration can reintroduce hidden regressions.

#### Lesson learned
Every simplification needs a full-flow regression check.

#### Next move
Harden state/sync comprehension in UI.

### 2026-03-06
#### Today in one sentence
I focused on trust and readability of survey state.

#### What happened
Users were confused by separate "status" and "sync" signals. I pushed for clearer representation and tighter alignment with submission gating rules.

#### PM lens
State clarity is a core product capability, not a cosmetic detail.

#### AI lens
AI adapted quickly to wording/display adjustments, but required strict alignment checks with backend truth.

#### Changes made
- Product/spec changes: Confirmed all factors are mandatory before submit.
- Implementation changes: Improved lifecycle/sync display and consistency.

#### Friction or risk
Any mismatch between backend semantics and UI labels hurts trust.

#### Lesson learned
State models must be treated as business logic.

#### Next move
Verify score consistency across edit/detail/submit flows.

### 2026-03-07
#### Today in one sentence
I shifted from screens to end-to-end workflow coherence.

#### What happened
I reorganized create/detail screens around user intent and action sequence, not component inventory. The app felt more guided and less fragmented.

#### PM lens
I optimized for narrative flow: what users see, do, and confirm.

#### AI lens
AI implemented structural UI changes effectively once the hierarchy was explicit.

#### Changes made
- Product/spec changes: Locked stronger information hierarchy for create survey.
- Implementation changes: Streamlined actions and reduced redundant UI.

#### Friction or risk
Business-rule inconsistencies can hide behind good-looking screens.

#### Lesson learned
Good UX is a confident sequence of decisions.

#### Next move
Reconcile remaining EPIC gaps with implemented behavior.

### 2026-03-08
#### Today in one sentence
I consolidated EPIC scope with a function-first approach.

#### What happened
I reviewed what remained in EPIC B/C/D and cleaned requirements that were unclear or low-value. I moved from reactive requests to explicit backlog governance.

#### PM lens
I treated specs as living contracts that must reflect reality.

#### AI lens
AI executed many corrections fast; I had to guard against over-implementation.

#### Changes made
- Product/spec changes: Updated acceptance criteria and removed ambiguous requirements.
- Implementation changes: Continued hardening of submit and data-entry behavior.

#### Friction or risk
Spec edits without rationale create future confusion.

#### Lesson learned
Always document why a requirement changes.

#### Next move
Close hardening items and validate mobile behavior end-to-end.

### 2026-03-09
#### Today in one sentence
I reframed the product around parcels and longitudinal IBP tracking.

#### What happened
A strategic pivot became clear: surveys must be linked to cadastral parcels and comparable across years. Explore became parcel analysis, not just map markers. This implied new data model and API requirements.

#### PM lens
I chose strategic coherence over local UI optimization.

#### AI lens
AI helped translate a high-level pivot into concrete epics and technical documentation quickly.

#### Changes made
- Product/spec changes: Added parcel linkage, history, versioning, and future analytics direction.
- Implementation changes: Prepared backend/API work items aligned with new contracts.

#### Friction or risk
UI could overfit temporary assumptions before backend foundations exist.

#### Lesson learned
Major pivots require immediate contract updates.

#### Next move
Implement backend parcel/version foundations first.

### 2026-03-10
#### Today in one sentence
I converted the parcel/version strategy into backend delivery.

#### What happened
I launched implementation of data/backend foundations plus parcel endpoints. Delivery included migration updates, parcel table, survey versioning fields, submit checks, and new APIs for resolve/status/history. Build and targeted e2e tests passed.

#### PM lens
I sequenced work as contracts first, mobile integration second. I also realized that regularly returning to EPICs with AI creates necessary strategic distance: otherwise, rapid functional iteration tends to lock us into improving the current feature while slowly drifting away from initial product goals.

#### AI lens
AI executed end-to-end implementation effectively; main limit remains real cadastre integration.

#### Changes made
- Product/spec changes: Parcel-centric direction confirmed in EPIC and technical contracts.
- Implementation changes:
  - Added `parcels` model and survey fields (`parcel_id`, `observation_year`, `version_number`, `previous_survey_id`).
  - Added APIs: `/parcels/resolve`, `/public/parcels/status`, `/parcels/:parcelId/surveys/history`.
  - Added submit checks for parcel requirements and version conflicts.

#### Friction or risk
Parcel resolution still needs real French cadastre provider integration. More broadly, high-speed iteration creates context drift if EPIC-level goals are not revisited frequently.

#### Lesson learned
PM clarity plus AI execution works best when I combine testable daily outcomes with regular EPIC-level recaps.

#### Next move
Integrate parcel endpoints in mobile create/detail/explore and design conflict UX for `parcel_version_conflict`.
