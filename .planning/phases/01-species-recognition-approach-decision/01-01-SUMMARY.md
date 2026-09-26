---
phase: 01-species-recognition-approach-decision
plan: 01
subsystem: infra
tags: [spike-scaffolding, gitignore, prettier, python-venv, android-sdk, documentation]

requires: []
provides:
  - "Gitignored `spike/species-recognition/` working tree, invisible to git and to `format:check`"
  - "Python 3.12 venv at `spike/species-recognition/.venv` (no ML packages yet)"
  - "`ANDROID_HOME` resolved and exported for the developer's shell"
  - "`docs/technical/species-recognition-spike-measurements-v1.md` skeleton (10 sections) that plans 02-05 write into"
  - "Provisional answers on record for the benchmark-device (D-18) and field-photo (D-16) checkpoint questions"
affects: [01-02, 01-03, 01-04, 01-05, 01-06]

tech-stack:
  added: []
  patterns:
    - "Throwaway spike code lives under spike/ and is dual-ignored (.gitignore + .prettierignore) so it never reaches a commit or a CI quality gate"

key-files:
  created:
    - docs/technical/species-recognition-spike-measurements-v1.md
    - spike/species-recognition/README.md (gitignored, not committed)
    - .planning/phases/01-species-recognition-approach-decision/deferred-items.md
  modified:
    - .gitignore
    - .prettierignore
    - ~/.zshrc (outside repo — exports ANDROID_HOME and adds platform-tools to PATH)

key-decisions:
  - "Task 1 checkpoint answered with both documented fallbacks: benchmark devices = `fallback` (iPhone SE/11-class + mid-range 2022-2023 Android floor), field photos = `no-field-photos`. Both recorded as PROVISIONAL — sections 1 and 6 of the measurement document are written so a later real answer slots in without restructuring."
  - "Python venv created on Python 3.12 (not the machine default 3.14) via `uv venv --python /opt/homebrew/bin/python3.12`, since torch has no published wheels for 3.14 yet."
  - "No ML package installed in this plan — deferred to plan 02 behind its own package-legitimacy checkpoint, per the plan's explicit instruction."

patterns-established:
  - "Dual-ignore pattern for throwaway trees: an entry in both .gitignore and .prettierignore is required because format:check reads .prettierignore only, not .gitignore."

requirements-completed: [REQ-ML-adr]

coverage:
  - id: D1
    description: "Spike working tree is gitignored and prettier-ignored; git status --porcelain spike/ returns nothing"
    verification:
      - kind: other
        ref: "grep -qE '^spike/' .gitignore && grep -qE '^spike/' .prettierignore && test -z \"$(git status --porcelain spike/)\""
        status: pass
    human_judgment: false
  - id: D2
    description: "Python 3.12 venv exists at spike/species-recognition/.venv with no ML packages installed"
    verification:
      - kind: other
        ref: "spike/species-recognition/.venv/bin/python --version (reports 3.12.14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ANDROID_HOME resolves and adb is reachable"
    verification:
      - kind: other
        ref: "adb version (Android Debug Bridge 1.0.41)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Measurement document skeleton exists with all 10 numbered sections; 0, 1, 9 filled, 2-8 placeholdered"
    verification:
      - kind: other
        ref: "grep -cE '^## [0-9]\\. ' docs/technical/species-recognition-spike-measurements-v1.md (== 10)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Benchmark-device (D-18) and field-photo (D-16) checkpoint answers are recorded correctly as provisional in the measurement document"
    verification: []
    human_judgment: true
    rationale: "Correctly capturing the provisional/fallback nuance and its downstream implications for the ADR is a judgment call best confirmed by a human reader, not a grep check."

duration: 25min
completed: 2026-09-22
status: complete
---

# Phase 1 Plan 01: Spike Scaffolding and Measurement Document Summary

**Gitignored spike working tree, Python 3.12 toolchain, resolved ANDROID_HOME, and a 10-section measurement-document skeleton for the species-recognition spike — with both Task 1 checkpoint questions answered by documented fallback and recorded as provisional.**

## Performance

- **Duration:** ~25 min (across two sessions: initial checkpoint pause, then resumed execution)
- **Started:** 2026-09-22 (checkpoint reached immediately on Task 1)
- **Completed:** 2026-09-22T15:09:36Z
- **Tasks:** 3 (1 checkpoint, 2 auto)
- **Files modified:** 5 (2 in repo commits: `.gitignore`, `.prettierignore`; 1 new doc:
  `docs/technical/species-recognition-spike-measurements-v1.md`; 1 deferred-items log; plus
  gitignored spike README and venv, and an out-of-repo `~/.zshrc` edit)

## Accomplishments

- Task 1 (checkpoint) resolved: benchmark devices (D-18) and field photographs (D-16) both took
  their documented fallback, recorded as **provisional** — not final — so later real answers from
  the association can still be folded in before wave 4.
- Task 2: created the gitignored `spike/species-recognition/` tree (`data/raw`, `data/splits`,
  `data/field`, `train`, `eval/results`, `device-harness`), dual-ignored in both `.gitignore` and
  `.prettierignore`, with a Python 3.12 venv (no ML packages yet) and `ANDROID_HOME` resolved and
  exported in the developer's shell profile.
- Task 3: created `docs/technical/species-recognition-spike-measurements-v1.md` with all 10
  numbered sections. Section 0 states the per-genus reporting rule (D-03), the top-3/95% bar and
  its separation from screen design (D-02, D-11), the genus-not-species target (D-01), and the
  insufficient-samples rule. Section 1 records the device fallback as a confidence cap on Section
  7. Section 9 records the unmeasured stand case (D-10) and the missing field-photo validation
  (D-16), both explicitly kept open for later plans rather than closed off.

## Task Commits

Each task was committed atomically:

1. **Task 1: Name the benchmark phones and the field-photo source** — checkpoint, no commit (human-action gate, answered by coordinator resume message, recorded in Task 2/3 commits)
2. **Task 2: Create the gitignored spike working tree and prepare the toolchain** - `f831774` (chore)
3. **Task 3: Create the measurement document skeleton** - `3eab9fa` (docs)

_No plan-metadata commit yet — STATE.md/ROADMAP.md/REQUIREMENTS.md updates and the final `docs` commit follow this SUMMARY._

## Files Created/Modified

- `.gitignore` - added `spike/` entry with explanatory comment
- `.prettierignore` - added `spike/` entry (required separately: `format:check` reads this file, not `.gitignore`)
- `docs/technical/species-recognition-spike-measurements-v1.md` - the 10-section measurement document skeleton; the durable output every later plan in this phase writes into
- `.planning/phases/01-species-recognition-approach-decision/deferred-items.md` - logs a pre-existing, out-of-scope `format:check` failure found while verifying (unrelated `.planning/intel/classifications/*.json` files from an earlier ingest commit)
- `spike/species-recognition/README.md` (gitignored, not committed) - states the tree is throwaway and records the Task 1 answers verbatim
- `spike/species-recognition/.venv/` (gitignored, not committed) - Python 3.12 venv, no packages installed
- `~/.zshrc` (outside repo, not tracked by this project's git) - exports `ANDROID_HOME=$HOME/Library/Android/sdk` and prepends `$ANDROID_HOME/platform-tools` to `PATH`

## Decisions Made

- Benchmark devices (D-18): took the `fallback` path — measure on the lowest-spec real iOS
  (iPhone SE 2nd/3rd gen or iPhone 11 class) and lowest-spec real Android (2022-2023 mid-range,
  Galaxy A-series class) obtainable, per RESEARCH.md Pitfall 4's warning against flagship test
  devices. Recorded as a confidence cap on every latency figure, not a phase failure.
- Field photographs (D-16): took the `no-field-photos` path — the spike will report the
  public-dataset accuracy figure only; field validation is deferred, with the gap stated plainly
  in Section 6/9 rather than silently dropped.
- Both fallback answers are explicitly PROVISIONAL per the coordinator's resume instructions: the
  user may still supply real device models or field photos before wave 4 (device latency run and
  field validation), and the document is structured so that happens without rewriting sections.
- Python venv pinned to 3.12 (not the machine default 3.14) since torch has no published wheels
  for 3.14 yet — matches the plan's explicit instruction and RESEARCH.md's Environment Availability
  table.

## Deviations from Plan

None — plan executed exactly as written. The one out-of-scope discovery (pre-existing
`format:check` failures in `.planning/intel/classifications/*.json`, unrelated to this plan's
changes) was logged to `deferred-items.md` per the scope-boundary rule rather than fixed, since it
predates this phase and was not caused by these changes.

## Issues Encountered

None.

## User Setup Required

None — the `~/.zshrc` change (exporting `ANDROID_HOME`) was applied directly since it is a
one-line, low-risk PATH export for an already-installed SDK, as instructed by the plan
(Threat T-01-03, disposition: accept). No other external service configuration required.

## Next Phase Readiness

- The spike toolchain (Python 3.12 venv, resolved `ANDROID_HOME`/`adb`) is ready for plan 02 to
  install ML dependencies behind its own package-legitimacy checkpoint.
- The measurement document skeleton is in place with sections 0, 1 and 9 filled; plans 02-05 each
  own specific placeholder sections (2-8) to fill as they execute.
- Both checkpoint answers (device fallback, no-field-photos) are on record as provisional — plan
  05 (device latency run) and plan 04 (accuracy/field validation) should re-check whether the
  association has supplied real answers before treating the fallback as final.
- No blockers for plan 01-02.

---
*Phase: 01-species-recognition-approach-decision*
*Completed: 2026-09-22*

## Self-Check: PASSED

All claimed files found on disk (`.gitignore`, `.prettierignore`,
`docs/technical/species-recognition-spike-measurements-v1.md`, `deferred-items.md`, the gitignored
`spike/species-recognition/README.md` and `.venv/bin/python`, and this SUMMARY.md). Both task
commits (`f831774`, `3eab9fa`) verified present in `git log`.
