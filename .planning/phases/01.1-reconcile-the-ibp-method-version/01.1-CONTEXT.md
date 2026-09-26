# Phase 01.1: Reconcile the IBP method version - Context

**Gathered:** 2026-09-26
**Status:** Ready for research and planning
**Source:** The owner asked for this phase to run autonomously, from research through planning, execution and the final verification. The decisions below are Claude's, taken without asking questions. Each one says why. The owner reviews them at the end of the phase and can overrule any of them.

<domain>
## Phase Boundary

This phase answers one question: does the app still implement the current CNPF IBP method, and what exactly changes if it does not?

**Deliverables** (all documentation; see ROADMAP criteria 1–5):

1. A written comparison, factor by factor, of IBP Fr v3.0 (the version the repo cites) against IBP FR v3.2 (the version CNPF currently publishes, dated 2026-02-02). It covers all ten factors: field definitions, class thresholds, and the Factor A native-genus list.
2. For each difference: its concrete impact on these three places:
   - `api/src/surveys/ibp-rules.service.ts`
   - `mobile/src/app/ibp-scoring.ts` (and any other mobile IBP rule files)
   - the 17 reference cases in `docs/technical/ibp-validation-matrix-v1.md`
3. An explicit decision in `docs/technical/`: migrate to v3.2 in this milestone, or stay on v3.0, with the reasoning.
4. If the decision is to migrate: what happens to surveys already recorded under v3.0 (do their scores change, and what happens to them).
5. `docs/references/README.md` and `docs/specs/ibp-form-spec.md` cite the version the app actually implements after this phase.

**Out of scope:** rewriting the scoring code.
- If migration is chosen, the code change belongs to phase 01.8, which extracts the IBP rules into one shared package. This phase must hand 01.8 an exact, testable change list.
- Exception: a change is allowed here if it is purely a citation or comment, or a bug found in the current v3.0 implementation. A real v3.0 bug gets a short fix only if it is small and clearly isolated. Otherwise it is recorded for 01.8.
</domain>

<decisions>
## Implementation Decisions (Claude, autonomous)

### Sources
- **D-01, v3.2 source.** The official PDF `https://www.cnpf.fr/sites/socle/files/2026-04/IBP_FR_v3_2_260202.pdf` (28 pages, 1,264,005 bytes).
  - It was downloaded on 2026-09-26 to the session scratchpad: `/tmp/claude-0/-home-user-cortege/2b3789f4-1097-5c7e-920c-66fb05f3a881/scratchpad/ibp/IBP_FR_v3_2_260202.pdf`.
  - Read it with the Read tool and its `pages` parameter. Python PDF libraries are broken in this container.
  - Do not commit the PDF: `docs/references/README.md` forbids redistribution, and `*.pdf` is gitignored there.
  - Record the SHA-256 of the file, the date it was retrieved and the page numbers cited, so the comparison can be reproduced.
- **D-02, v3.0 source.** The two v3.0 PDFs linked from `docs/references/README.md` now return HTTP 404 on cnpf.fr. The CNPF IBP page no longer links any v3.0 document. The Wayback Machine was unreachable from this container on 2026-09-26.
  - The v3.0 baseline is therefore what the repository actually implements and documents, which was transcribed from v3.0:
    - `docs/specs/ibp-form-spec.md`
    - `docs/technical/ibp-validation-matrix-v1.md`
    - `api/src/surveys/ibp-rules.service.ts`
    - the mobile IBP rules (`mobile/src/app/`)
  - The researcher may try to find an official v3.0 copy once more (archive.org, other CNPF paths). If one is found, check the repo transcription against it too.
  - The comparison states which baseline it used. The question that matters is "does the app match v3.2?", and the app's own rules answer the v3.0 side of that.
- **D-03, copyright.** Transcribe facts only: thresholds, class limits, genus names, field definitions in our own words. Short quotes are allowed where a wording difference matters, with page references. Never paste whole pages or tables verbatim.

### Deliverable locations
- **D-04, comparison document.** Goes in `docs/technical/ibp-version-comparison-v3.0-v3.2.md`, with one section per factor A–J plus the global score and categories.
  - Each difference is a row: what v3.0/the app does, what v3.2 says (with page), severity (changes a score / changes a field / wording only), and the impact on the API rules, mobile rules and validation-matrix cases.
- **D-05, decision.** Recorded as an ADR: `docs/technical/adr-003-ibp-method-version-v1.md` (ADR-002 exists from phase 1). It is indexed in CLAUDE.md's documentation tree and in `docs/README.md`.

### Decision rule (D-06)
- **D-06, how Claude decides.**
  - **If v3.2 changes nothing that affects scoring** (only wording or presentation), the app is declared "v3.2-conformant". The citations move to v3.2 and no migration is needed.
  - **If v3.2 changes scoring rules or the Factor A genus list,** the default decision is to **migrate to v3.2 in this milestone**, for three reasons:
    - v3.2 is the method CNPF publishes today, and new observers are trained on it.
    - The app's value to ecologists depends on computing the current official index.
    - Phase 2 builds the Factor A genus list from the v3.2 PDF (ADR-002), so staying on v3.0 would put two versions in the app.
  - **Where migration happens:** the migration is executed in phase 01.8. 01.8 already extracts the IBP rules into a shared package, so the rules change once, in one place, against the change list from this phase.
  - **When staying on v3.0 is chosen instead:** only if migrating would break comparability with already-recorded surveys in a way that cannot be handled (see D-07). The ADR must then explain why.
- **D-07, surveys already recorded.** If migrating, the ADR states the effect on them plainly:
  - whether their stored scores would change if recomputed;
  - the proposed treatment. The default: a submitted survey keeps the score it was submitted with and records the method version it used. Drafts are recomputed under v3.2.
  - This implies storing a method-version field. Only the need is recorded here; the schema change belongs to 01.8 or phase 2.
  - The researcher checks what the data model already stores (the `region_version` field on surveys, IBP result fields) before proposing anything.

### Verification
- **D-08, checking the phase.** The final verification is Claude-only; no device check is needed, since this phase changes documentation. It checks:
  - every one of the ten factors, plus the Factor A genus list, has a section in the comparison;
  - every difference has an impact line for the API, the mobile app and the matrix;
  - the ADR exists with a clear "Decision:" line, and the D-07 statement if the decision is to migrate;
  - both citation files name the implemented version;
  - lint, typecheck, unit tests and format still pass (no code regressions).
</decisions>

<canonical_refs>
## Canonical References
- `.planning/ROADMAP.md` phase 01.1 (goal, criteria 1–5)
- `.planning/phases/01-species-recognition-approach-decision/01-RESEARCH.md` (lines ~97, 370–373, 461): how the version drift was found
- `docs/technical/adr-002-on-device-species-recognition-v1.md`: its Factor A genus list comes from v3.2
- `docs/references/README.md`, `docs/specs/ibp-form-spec.md`, `docs/technical/ibp-validation-matrix-v1.md`
- `api/src/surveys/ibp-rules.service.ts`, `mobile/src/app/ibp-scoring.ts` and related mobile rule files
- Phase 01.8 in ROADMAP (shared IBP domain package): the consumer of this phase's change list
</canonical_refs>

<deferred>
## Deferred
- Implementing v3.2 scoring rules in code: phase 01.8
- The Factor A genus-list data model: phase 2
- A method-version column on surveys: phase 01.8 or phase 2, decided by 01.8's planner
</deferred>
</content>
</invoke>
