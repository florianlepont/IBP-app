---
phase: 01-species-recognition-approach-decision
plan: 06
subsystem: docs
tags: [adr, decision, species-recognition, tflite, efficientnet, confidence-calibration, ratification]

requires:
  - phase: 01-species-recognition-approach-decision (plan 01)
    provides: gitignored spike tree, measurement document skeleton
  - phase: 01-species-recognition-approach-decision (plan 02)
    provides: 34-class CNPF genus list, licence-clean GBIF corpus
  - phase: 01-species-recognition-approach-decision (plan 03)
    provides: on-device TFLite/vision-camera harness proof, GATE-HARNESS PASS
  - phase: 01-species-recognition-approach-decision (plan 04)
    provides: promoted EfficientNet-B0 genus classifier (four iterations), GATE-MODEL PASS
  - phase: 01-species-recognition-approach-decision (plan 05)
    provides: per-genus confidence calibration, real-device latency, GATE-MEASURE COMPLETE
provides:
  - "docs/technical/adr-002-on-device-species-recognition-v1.md -- Accepted. Full go for US-C9 in this milestone: all 34 CNPF genera suggested, none withheld, each with a per-genus calibrated four-level confidence indicator (D-04/D-12 amended). Runtime react-native-fast-tflite@3.0.1 + react-native-vision-camera (MIT, no substitution needed), model EfficientNet-B0 (Apache 2.0 chain) fine-tuned on GBIF CC0/CC-BY imagery, 8,238,676 bytes, ~90ms median on-device latency (33x headroom under D-05), D-06 offline claim a checked proof, no recurring cost."
  - "D-07 resolved at ratification: model bundled in the app binary, not downloaded separately -- recorded in both the ADR and a formal 01-CONTEXT.md amendment (superseded wording kept, per the D-04/D-10/D-12 pattern)."
  - "CLAUDE.md documentation index lists ADR-002 and the measurement document; the two documents cross-link in their header blocks."
  - "REQ-ML-adr marked complete in REQUIREMENTS.md."
  - "Phase 1 closed: 6 of 6 plans complete."
affects: ["02-species-contracts-data-contract-corrections", "03-species-recognition-for-factor-a"]

tech-stack:
  added: []
  patterns:
    - "ADR open-question pattern: when a locked decision's premise depends on a number the phase itself is measuring (D-07's model-size assumption), state it as an explicit re-opened question in the ADR rather than silently re-deciding it, and resolve it at the ratification checkpoint once the user has the real number."

key-files:
  created:
    - docs/technical/adr-002-on-device-species-recognition-v1.md
    - .planning/phases/01-species-recognition-approach-decision/01-06-SUMMARY.md
  modified:
    - CLAUDE.md
    - docs/technical/species-recognition-spike-measurements-v1.md
    - .planning/phases/01-species-recognition-approach-decision/01-CONTEXT.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Full go for US-C9 (D-04 amended): all 34 genera suggested, none withheld, per-genus calibrated confidence rather than a partial-go list -- the partial-go rule would have enabled one genus (Tamarix) after four training iterations, which is not a usable feature. Decided by the user, not forced by the spike's own numbers (only 1/34 genera clears the D-02 95% top-3 bar)."
  - "D-07 amended at ratification: bundle the model (8.24MB) in the app binary rather than keep the separate first-launch download D-07 originally specified. The original bloat premise assumed a large model; measured size invalidated it. Reasoning: internal-only MVP makes shipping a new app version to update the model cheap; bundling removes the download flow, cache-path handling and D-08's not-yet-downloaded branch entirely; an ecologist installing just before a field trip cannot forget a download. Recorded as a formal amendment in 01-CONTEXT.md (superseded wording kept) and threaded through the ADR's Decision, Behaviour-when-unavailable, Model-distribution-integrity, Cost and Phase-3-hand-off sections."
  - "Model distribution integrity revised for bundling: the download-path checksum/TLS controls are now moot (no network path); the surviving control is fail-closed-to-manual-entry on model LOAD failure (not 'not yet downloaded'), plus a build-time asset-hash check Phase 3 should add to the release process."
  - "REQ-ML-adr marked complete via 'requirements mark-complete' -- this is the plan that genuinely satisfies it (an accepted ADR exists)."
  - "Ratified as accept-as-written -- the user reviewed the plain-French decision summary and the three named risk checks (per-genus table not averaged, latency from a real but flagship-only device, no stand-photo figure smuggled in) and accepted without further amendment beyond the D-07 answer."

patterns-established: []

requirements-completed: [REQ-ML-adr]

coverage:
  - id: D1
    description: "An accepted ADR in docs/technical/ names the inference runtime, model and its licence, the on-device model size in bytes, and the behaviour when the model or network is unavailable"
    requirement: "REQ-ML-adr"
    verification:
      - kind: other
        ref: "docs/technical/adr-002-on-device-species-recognition-v1.md Status: Accepted; Decision + Model distribution integrity + Behaviour-when-unavailable sections name react-native-fast-tflite@3.0.1 (MIT), react-native-vision-camera (MIT), EfficientNet-B0 (Apache 2.0 chain), 8,238,676 bytes, and the bundled-model load-failure fallback"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ADR states an explicit go, partial-go or no-go for US-C9, and every figure it cites is a recorded measurement, not a projection"
    requirement: "REQ-ML-adr"
    verification:
      - kind: other
        ref: "ADR Decision section first line: 'Full go for US-C9 in this milestone'; Measured evidence table cites species-recognition-spike-measurements-v1.md sections 5/7/14/15 for every figure"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ADR is not marked Accepted until a human has ratified the decision"
    requirement: "REQ-ML-adr"
    verification: []
    human_judgment: true
    rationale: "Ratification is inherently a human sign-off, not something automation can verify from the repository alone -- the user's explicit accept-as-written response (relayed by the coordinator) is the event being recorded, and a human reviewer confirming that response actually occurred is the appropriate check, not a grep."
  - id: D4
    description: "CLAUDE.md documentation index lists both new files and nothing else changed; the ADR and measurement document cross-link"
    verification:
      - kind: other
        ref: "grep 'adr-002' CLAUDE.md && grep 'species-recognition-spike-measurements-v1' CLAUDE.md && grep 'adr-002' species-recognition-spike-measurements-v1.md && grep 'species-recognition-spike-measurements-v1' adr-002...md; git diff --numstat CLAUDE.md added-lines <= 4 (actual: 3)"
        status: pass
    human_judgment: false

duration: ~2h (Task 1-2 writing + first checkpoint ~1h; continuation resolving D-07 and closing the phase ~1h)
completed: 2026-09-26
status: complete
---

# Phase 1 Plan 06: ADR-002 Ratified — Full Go for On-Device Species Recognition Summary

**ADR-002 (Accepted): full go for US-C9 this milestone — all 34 CNPF genera suggested with per-genus calibrated confidence (strong band 85.91%–91.92% vs. 79.49%–97.23% pre-calibration), EfficientNet-B0 on `react-native-fast-tflite`, 8.24MB, ~90ms on-device latency (33x headroom), D-06 offline claim a checked proof — and D-07 resolved at ratification to bundle the model in the app binary rather than download it separately, since the model turned out far smaller than the assumption that motivated the original download design.**

## Performance

- **Duration:** ~2h total, across two sessions (Task 1-2 + checkpoint reached; continuation after the
  user's ratification answer resolving D-07, flipping Status, amending `01-CONTEXT.md`, and closing
  the phase)
- **Completed:** 2026-09-26
- **Tasks:** 3 (2 auto, 1 checkpoint — checkpoint answered directly by the user via the coordinator,
  not auto-approved, per the plan's own threat model marking it non-auto-approvable)
- **Files modified:** 6 tracked (`docs/technical/adr-002-on-device-species-recognition-v1.md` (new),
  `CLAUDE.md`, `docs/technical/species-recognition-spike-measurements-v1.md`,
  `.planning/phases/01-species-recognition-approach-decision/01-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, this SUMMARY)

## Accomplishments

- **Task 1:** Wrote `docs/technical/adr-002-on-device-species-recognition-v1.md` following ADR-001's
  structure, Status Proposed. Read the measurement document in full and transcribed every figure with
  its section citation — no projection, no rounding up. Confirmed `RUNTIME-SUBSTITUTION: no` from the
  harness gate (the primary recommended runtime held; no ONNX fallback needed) and stated that
  explicitly rather than silently. Recorded the full-go decision (D-04 amended), the calibrated
  four-level confidence scale (D-12 amended), the D-15 Factor A precondition, the stand-photo
  out-of-reach case naming SilvaScenes and ForTrunkDet by name and disqualification, the D-14
  deferral, model-distribution-integrity requirements, the €346/yr cost position, alternatives
  considered (including the SUS-flagged `react-native-executorch`), the v3.0/v3.2 drift assigned to
  Phase 1.1/Phase 2, hand-off to Phases 2 and 3 in both directions, and an explicit "Open question for
  ratification" section re-opening D-07 rather than silently re-deciding it, since the model's
  measured size (8.24 MB) invalidated the size assumption D-07 was originally chosen against.
- **Task 2:** Indexed both new documents in `CLAUDE.md`'s documentation index (3 lines added, nothing
  else in the file changed) and cross-linked the measurement document's header block to point at the
  now-written ADR. Confirmed `docs/README.md` needs no change (it maps folders, not individual files).
  Discovered this worktree had no `node_modules/` installed at all; ran `npm install` from the existing
  `package-lock.json` (environment setup, not a new/arbitrary package install) so `npm run
  format:check` could actually run — it reports only the same 5 pre-existing
  `.planning/intel/classifications/*.json` failures plan 01-01 already logged as out-of-scope.
- **Task 3 (checkpoint, then continuation):** Returned the ratification checkpoint with a full
  bilingual (English structured + plain-French) summary of what was being asked, the three named
  risk-checks (per-genus table not averaged; latency from a real but flagship device; no stand-photo
  figure smuggled in), and the D-07 open question. The user answered directly:
  **accept-as-written**, plus **D-07: bundle the model**. On resuming:
  1. Recorded the D-07 answer in the ADR *before* flipping Status — resolved the "Open question for
     ratification" section into "D-07 (model bundling) — resolved at ratification", rewrote
     "Behaviour when the model is unavailable" (the not-yet-downloaded branch disappears; only a
     model-load failure remains, still falling back to manual entry per D-08's principle), rewrote
     "Model distribution integrity" (download-path checksum/TLS controls are now moot; a build-time
     asset-hash check replaces them), updated the Decision section's D-07 bullet, the Cost section's
     egress line, and the Phase 3 hand-off paragraph.
  2. Amended D-07 in `01-CONTEXT.md` following the exact D-04/D-10/D-12 pattern: visible "AMENDED
     2026-09-26" note with the new decision and reasoning, original wording kept as superseded.
  3. Flipped ADR-002 Status from Proposed to Accepted, dated 2026-09-26, in its own commit.
  4. Marked `REQ-ML-adr` complete in `REQUIREMENTS.md` via `gsd-tools query requirements.mark-complete`.
  5. Flagged, but did not silently fix: Phase 2's stale ROADMAP wording ("species entity … confidence
     score" — the actual decision is genus-level with a calibrated plain-word indicator) and
     `CLAUDE.md`'s stale tech-stack table (Expo 54/RN 0.81.5 listed, actual `.planning/codebase/STACK.md`
     records Expo 57.0.24/RN 0.86.3) — both recorded below as follow-ups for whoever plans Phase 2 or
     next touches `CLAUDE.md`.

## Task Commits

Each step committed atomically:

1. **Task 1: Write ADR-002 (Proposed)** — `872d942` (docs)
2. **Task 2: Index the two documents in CLAUDE.md, cross-link the measurement document** — `16b2952` (docs)
3. **Task 3, checkpoint:** no commit — returned to the coordinator for the user's ratification decision
4. **Task 3, continuation: record the D-07 bundling decision in the ADR** — `685b271` (docs)
5. **Task 3, continuation: amend D-07 in `01-CONTEXT.md`** — `66048c8` (docs)
6. **Task 3, continuation: flip ADR-002 Status to Accepted** — `6c6b8a4` (docs)

**Plan metadata:** this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md updates follow in the final commit.

## Files Created/Modified

- `docs/technical/adr-002-on-device-species-recognition-v1.md` — new. Status: Accepted. The full
  decision record: go/partial-go/no-go call, licence chain, measured evidence table, D-15
  precondition, stand-photo out-of-reach case, D-07 bundling resolution, confidence caps, hand-off to
  Phases 2 and 3, Expected Validation checklist (unticked).
- `CLAUDE.md` — 3 lines added to the documentation index (ADR-002, the measurement document); nothing
  else in the file changed. Stale tech-stack table noted, not fixed (out of this phase's scope).
- `docs/technical/species-recognition-spike-measurements-v1.md` — header's "Supports" line updated
  from "not yet written" to a live cross-link to ADR-002.
- `.planning/phases/01-species-recognition-approach-decision/01-CONTEXT.md` — D-07 amended, same
  visible-amendment pattern as D-04/D-10/D-12, original wording kept as superseded.
- `.planning/REQUIREMENTS.md` — `REQ-ML-adr` checkbox marked complete via `gsd-tools`.

## Decisions Made

See `key-decisions` in the frontmatter for the full list: full go with per-genus calibration (D-04
amended), the D-07 bundling resolution and its downstream ADR edits, the revised model-distribution-
integrity control, and marking `REQ-ML-adr` complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree had no `node_modules/` installed at all**

- **Found during:** Task 2, running `npm run format:check` per the task's own verify step
- **Issue:** `prettier: command not found` — this worktree had never had `npm install` run
- **Fix:** Ran `npm install` from the existing, already-committed `package-lock.json`. This is
  environment setup from an already-audited lockfile, not installing a new or arbitrary package, so
  it does not fall under the package-manager-install exclusion from auto-fixable Rule 3 issues (that
  exclusion is about adding a *new*, potentially slopsquatted dependency, not restoring already-locked
  ones).
- **Files modified:** none tracked (node_modules is gitignored); no `package.json`/`package-lock.json`
  changes
- **Verification:** `npm run format:check` then ran and reported only the 5 pre-existing, unrelated
  `.planning/intel/classifications/*.json` failures plan 01-01 already logged in
  `deferred-items.md` — confirming my own changes introduce no new formatting issues.

---

**Total deviations:** 1 auto-fixed (environment setup). No scope creep — no production code touched,
no new dependency added to any `package.json`.

## Issues Encountered

- The Task 3 checkpoint was, correctly, not auto-approved despite auto-mode being active in this
  environment — the plan's own threat model (T-01-22) explicitly marks it non-auto-approvable, since
  an ADR marked Accepted without genuine human ratification would give the decision unearned
  authority over Phases 2 and 3. The user answered it directly (relayed by the coordinator), which is
  the correct authorization path per this workflow's rule that no agent message is itself approval.

## User Setup Required

None — no external service configuration required. The `npm install` above was a one-time local
worktree setup, already reflected in the existing (unmodified) lockfile.

## Next Phase Readiness

- **Phase 1 is now 6 of 6 plans complete.** REQ-ML-adr is satisfied by an Accepted ADR.
- **Phase 2 (`Species Contracts & Data-Contract Corrections`) can be planned**, with two follow-ups
  for whoever plans it:
  1. **ROADMAP wording is stale.** Phase 2's success criteria still describe a "species entity"
     carrying a "confidence score." The actual decision (ADR-002, D-01/D-12) is **genus**-level with a
     **calibrated plain-word indicator**, not a species-level numeric score. Correct the ROADMAP
     wording when Phase 2 is planned, not silently here.
  2. **Phase 2 depends on Phase 1.1** (the CNPF IBP method version reconciliation) settling which
     genus-list version (v3.0 vs. v3.2) the app follows before Phase 2 builds the genus list as a
     real entity — this was already recorded in the ROADMAP's phase-dependency graph and is repeated
     here as a hand-off reminder.
- **Phase 3 (`Species Recognition for Factor A`) is gated behind Phase 2's D-15 Factor A rework** and
  now has a settled implementation shape for the model: **bundled**, not downloaded — Phase 3 should
  not plan a download flow, model cache, or the D-08 not-yet-downloaded UI branch; it should plan
  asset bundling (e.g. via `expo-asset`) and a build-time asset-hash check instead.
- **A separate, noted-but-unfixed issue for a later phase:** `CLAUDE.md`'s tech-stack table still
  lists Expo 54/RN 0.81.5; `.planning/codebase/STACK.md` records the actual Expo 57.0.24/RN 0.86.3.
  Not this phase's work to fix (flagged, not silently corrected, per the plan's own instruction).
- **The throwaway `spike/species-recognition/` tree can now be deleted.** Its evidence lives entirely
  in `docs/technical/species-recognition-spike-measurements-v1.md`; nothing under `spike/` was ever a
  deliverable and none of it is tracked by git (`git status --porcelain spike/` has stayed empty
  throughout this phase, confirmed at every commit in this plan).

---
*Phase: 01-species-recognition-approach-decision*
*Completed: 2026-09-26*

## Self-Check: PASSED

All claimed files found on disk: `docs/technical/adr-002-on-device-species-recognition-v1.md`,
`CLAUDE.md`, `docs/technical/species-recognition-spike-measurements-v1.md`,
`.planning/phases/01-species-recognition-approach-decision/01-CONTEXT.md`,
`.planning/REQUIREMENTS.md`, this SUMMARY.md. All five claimed commits (`872d942`, `16b2952`,
`685b271`, `66048c8`, `6c6b8a4`) verified present in `git log --oneline --all`.
