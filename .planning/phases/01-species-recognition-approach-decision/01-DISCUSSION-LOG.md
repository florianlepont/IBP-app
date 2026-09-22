# Phase 1: Species Recognition — Approach Decision - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 1-species-recognition-approach-decision
**Areas discussed:** Success bar, On-device vs server, What the ecologist sees, Test photos and devices, Factor A data model (emergent)

---

## Success bar

### Recognition target: genus or species?

| Option | Description | Selected |
|--------|-------------|----------|
| Genus is enough | Factor A counts native genera from a closed CNPF list; far more tractable than species ID | ✓ |
| Species, rolled up to genus | Richer for future uses, much harder and heavier | |
| Undecided | Settle during the spike | |

**User's choice:** Genus is enough.

### What accuracy counts as a go?

| Option | Description | Selected |
|--------|-------------|----------|
| Correct genus in the top 3, 95% of the time | Matches the existing Factor A multi-select where the ecologist ticks the right entry | ✓ |
| Correct first time, 90% of the time | Suggestion as authority rather than aid; few on-device models hold this in forest conditions | |
| No number yet | Measure first, set the bar afterwards | |

**User's choice:** Top-3 at 95%.
**Notes:** Later in the discussion the user pushed back on treating this as a screen design. The bar is an evaluation metric; the screen shows the most likely first. See "What the ecologist sees".

### Acceptable wait after the photo?

| Option | Description | Selected |
|--------|-------------|----------|
| Under 3 seconds | Ecologist waits at the tree; headroom for older phones | ✓ |
| Under 1 second | Immediate, but constrains model size and excludes modest phones | |
| Deferred analysis acceptable | More flexible technically; loses the ability to correct at the tree | |

**User's choice:** Under 3 seconds.

### Decision rule if results are mixed?

| Option | Description | Selected |
|--------|-------------|----------|
| Partial go | Enable only for genera above the bar, manual entry elsewhere | ✓ |
| Full go, non-binding suggestion | Always shown with confidence, never auto-applied | |
| Clean no-go | Defer to next milestone; Phases 2 and 3 fall away | |

**User's choice:** Partial go.

---

## On-device vs server

### Where does inference run?

| Option | Description | Selected |
|--------|-------------|----------|
| On-device only | Offline-first is LOCKED in ADR-001; the photo is taken where there is no signal | ✓ |
| On-device with server fallback | More accurate sometimes; two systems, an endpoint and a recurring cost | |
| Server only | Most accurate and easiest to update; unusable at the moment of need | |

**User's choice:** On-device only.

### Acceptable app size increase?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate download on first launch | App stays light on the stores; model fetched once over Wi-Fi | ✓ |
| Up to ~25 MB bundled | Works from install, no extra step; constrains model choice | |
| Up to ~100 MB bundled | Wide model choice; downloads badly over mobile data | |

**User's choice:** Separate download on first launch.

### Behaviour when the model is unavailable?

| Option | Description | Selected |
|--------|-------------|----------|
| Clear message, then manual entry | Ecologist understands why no suggestion appears | ✓ |
| Silent fallback to manual | No interruption, but looks like a broken feature | |
| Block the photo | Avoids unusable photos; blocks entry that works fine today | |

**User's choice:** Clear message, then manual entry.

### Model licence constraint?

| Option | Description | Selected |
|--------|-------------|----------|
| Permissive and redistributable | Non-profit, near-zero budget, public store release | ✓ |
| Any licence if free to use | Opens stronger vendor models at the cost of a dependency | |
| Undecided | Survey licences during the spike | |

**User's choice:** Permissive and redistributable.

---

## What the ecologist sees

### How does the suggestion appear? (first pass)

| Option | Description | Selected |
|--------|-------------|----------|
| Three genera offered to tick | Matches the existing multi-select | rejected |
| Most likely pre-ticked | Fast when right; an unnoticed error changes the IBP score | |
| Separate suggestion banner | Clear separation; adds a zone to a dense form | |

**User's choice:** Free-text pushback — *"pourquoi proposer 3 genres ? tout dépend si c'est une photo avec plusieurs arbres ou si c'est une photo sur un seul arbre (voire feuille). Mais en tout cas si c'est un seul arbre, l'appli doit proposer le plus probable... sinon ça perd de son intérêt"*
**Notes:** The pushback was correct on both counts. The three-genera framing came from the evaluation bar, not from any screen requirement, and it conflated the two. It also surfaced a question that had not been asked — what the photo is actually of — which determines whether this is single-subject classification or detection plus classification. Both questions were re-asked below.

### What does the ecologist photograph?

| Option | Description | Selected |
|--------|-------------|----------|
| A single subject | One tree, a leaf or bark; simple classification, where on-device models are strong | |
| A stand photo, several trees | Closer to Factor A's intent; needs detection first, most likely to drive a no-go | |
| Both, to be tested | Spike measures both, the ADR decides on figures | ✓ |

**User's choice:** Both, to be tested.
**Notes:** Doubles the spike's measurement work. Accepted deliberately rather than excluding a use case on intuition.

### How is the result presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Most likely first, others below | Confidence shown; remaining candidates recoverable if the first is wrong | ✓ |
| Most likely only | Simplest screen; loses the case where the right genus was second | |
| Most likely, pre-ticked | Fastest when right; an unnoticed error changes the score with no validation | |

**User's choice:** Most likely first, others below.

### Is model confidence shown?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain words: strong / medium / weak | Readable without knowing how a model works | ✓ |
| Percentage | What US-C9 asks for literally; reads poorly, implies false exactness | |
| Not shown | Cleaner screen; defeats the partial-go rule | |

**User's choice:** Plain words.

### What happens to the recognition photo?

| Option | Description | Selected |
|--------|-------------|----------|
| Transient, not kept | No quota impact, no storage, no data-contract extension | ✓ |
| Kept, counts in the 10 | Full traceability; five scans eat half the survey's photo quota | |
| Kept separately, outside the quota | Traceability without the penalty; a new attachment category to define | |

**User's choice:** Transient, not kept.

### Are the ecologist's corrections captured?

| Option | Description | Selected |
|--------|-------------|----------|
| No, not in this milestone | Storage, consent and retraining make it a capability of its own | ✓ |
| Yes, stored locally | No server round trip; retention and purpose still undefined | |
| Yes, sent to the server | Builds an improvement dataset; needs contract, GDPR position and storage | |

**User's choice:** No, not in this milestone.

---

## Test photos and devices

### Where do the labelled photos come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Public datasets, then field validation | Lab figures collapse under real conditions; the second step keeps the go/no-go honest | ✓ |
| Public datasets only | Fastest; a good score on herbarium shots says nothing about bark in the rain | |
| Field photographs only | Most representative; they must be taken and identified first, delaying the spike | |

**User's choice:** Public datasets, then field validation.

### Which genera to measure?

| Option | Description | Selected |
|--------|-------------|----------|
| A dozen, chosen with an ecologist | Enough to decide, aligned with the partial-go rule | |
| The whole CNPF regional list | Full coverage; rare genera drag the average down | ✓ |
| Undecided | Build the list at the start of the spike | |

**User's choice:** The whole CNPF regional list.
**Notes:** Flagged as consistent with the partial-go rule **only if** results are reported per genus rather than as one average. Recorded as D-03 in CONTEXT.md.

### Which phones for latency?

| Option | Description | Selected |
|--------|-------------|----------|
| The observers' real phones | Success criteria require real iOS and Android devices | ✓ |
| A recent iPhone and a mid-range Android | Representative and available now | |
| Whatever is at hand | Fastest to arrange; one high-end device proves nothing | |

**User's choice:** The observers' real phones.
**Notes:** Open item — which phones the association's observers actually use is not yet known.

### How long before deciding?

| Option | Description | Selected |
|--------|-------------|----------|
| Two to three days | Two or three models, both photo subjects, two phones | ✓ |
| One day | A rough first verdict on one model; risks a no-go from lack of time | |
| As long as it takes | Solid answer; the schedule is already at its deadline | |

**User's choice:** Two to three days.

---

## Factor A data model (emergent — surfaced by a code check, not planned as an area)

A check for the CNPF genus list in the codebase found none. `native_genus_count` is a single number
in `constants.ts:111`, `ibp-scoring.ts:63`, `useSurveyForm.ts:146` and `db.ts:27`, while
`ibp-form-spec.md` §Factor A specifies a multi-select of genera with a derived counter. The code
diverged from the spec silently; neither document contradicts the other, which is why the doc
ingest did not flag it. Consequence: recognition produces a genus name and the form has nowhere to
put it.

| Option | Description | Selected |
|--------|-------------|----------|
| Introduce the genus list | Form becomes a multi-select with derived count, as the spec always said; the bulk of Phase 2 | ✓ |
| Keep the counter, help count | Recognition announces the genus and holds a temporary list to avoid double counting; genus is not stored | |
| Align the spec with the code | Accept Factor A as a counter; recognition loses most of its point for this factor | |

**User's choice:** Introduce the genus list.
**Notes:** Touches the data contract, the API, IBP scoring on both sides, the mobile screen, and a
migration for surveys already stored as a bare count. Recorded as D-15 and as a precondition of
US-C9 in the ADR.

---

## Claude's Discretion

- Inference runtime and candidate models to measure, within the on-device, separate-download and
  permissive-licence constraints.
- Spike structure — inside the Expo app via a dev client, or as a standalone harness.
- ADR file name and numbering, following the ADR-001 precedent.
- Choice of public datasets, subject to the same licence constraint.

## Deferred Ideas

- Capturing ecologist corrections to build an improvement dataset — storage, GDPR position and
  retraining make it its own capability, for a later milestone.
- Species-level identification beyond genus — relevant to US-F5 rare-species gamification, which
  is in the deferred Epic F.
- Server-side recognition over already-synced photos — a different capability with a different
  cost profile, revisitable once the app is no longer internal-only.
