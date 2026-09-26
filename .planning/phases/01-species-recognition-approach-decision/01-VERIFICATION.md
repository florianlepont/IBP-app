---
phase: 01-species-recognition-approach-decision
verified: 2026-09-26T16:30:00Z
status: passed
score: 11/12 must-haves verified
behavior_unverified: 0
overrides_applied: 1
gaps:
  - truth: "A throwaway spike on a real iOS device and a real Android device produces recorded figures for inference latency, model size on disk, and top-1/top-3 accuracy on a handful of French tree species (ROADMAP Phase 1 success criterion 2; REQ-ML-adr's own wording: 'measured latency and accuracy on real iOS and Android devices')"
    status: overridden
    reason: >
      No real Android device was ever connected during this phase, by the user's own explicit
      decision (device-harness/GATE, eval/GATE-MEASURE, ADR-002 "Confidence caps" item 2 all say
      so plainly). The Android build succeeds (./gradlew assembleDebug, BUILD SUCCESSFUL) with the
      same react-native-fast-tflite runtime and no substitution, which answers the *runtime*
      question for Android, but there is no Android latency figure and no Android accuracy figure
      anywhere in the measurement document or the ADR. Every latency and accuracy figure that
      exists is iOS-only (iPhone 15 Pro). The letter of ROADMAP criterion 2 and of REQ-ML-adr's own
      wording is not met — REQUIREMENTS.md nonetheless marks REQ-ML-adr `[x]` complete.
    artifacts:
      - path: "docs/technical/adr-002-on-device-species-recognition-v1.md"
        issue: "Table row 'Android | build succeeds, no device run performed' and Confidence caps item 2 both concede the gap honestly — the ADR does not hide it, but conceding a gap in prose does not close it."
      - path: "spike/species-recognition/device-harness/GATE"
        issue: "Records 'Android was not measured -- no Android device was reachable or connected this session, by the user's own decision'"
    missing:
      - "A real Android device latency run (median/p95/worst total-ms, online + airplane) using the promoted genus_classifier.tflite, in the same format as Section 7's iOS table."
      - "A real Android device accuracy spot-check (even a handful of labelled photos) to confirm the exported .tflite behaves the same off the iOS-only export-parity check."
      - "Either: (a) this Android gap is closed with an actual device run before Phase 1 is considered to satisfy REQ-ML-adr/criterion 2 in full, or (b) the user formally accepts the gap as a deliberate, documented deviation via the override mechanism below, and REQUIREMENTS.md's `[x]` on REQ-ML-adr is understood to mean 'ADR accepted, Android measurement explicitly deferred' rather than 'requirement fully met as written'."
overrides:
  - must_have: "A throwaway spike on a real iOS device and a real Android device produces recorded figures for inference latency, model size on disk, and top-1/top-3 accuracy"
    reason: "No Android device was used this phase, by explicit user decision. The Android build succeeds with the same runtime and no substitution, which answers the feasibility question. Accuracy is platform-independent in principle (identical .tflite model and preprocessing), and iOS latency has ~33x headroom against the 3 s budget. A real Android latency run and an accuracy spot-check are deferred, tracked as a Phase 3 success criterion and in ADR-002's Expected Validation checklist, and must close before Phase 3 ships."
    accepted_by: "Florian Lepont"
    accepted_at: "2026-09-26T13:18:45Z"
---

# Phase 1: Species Recognition — Approach Decision Verification Report

**Phase Goal:** We know, with numbers from real devices, how on-device tree species recognition will work — or that it cannot ship in this milestone.
**Verified:** 2026-09-26
**Status:** passed — 11/12 must-haves verified, 1 gap (Android measurement) accepted by explicit user override on 2026-09-26, deferred to before Phase 3 ships
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An accepted ADR in `docs/technical/` names the inference runtime, the model and its licence, the on-device model size, and how suggestions behave when the model or the network is unavailable (ROADMAP SC1) | ✓ VERIFIED | `docs/technical/adr-002-on-device-species-recognition-v1.md`, `Status: Accepted`. Names `react-native-fast-tflite@3.0.1` (MIT) + `react-native-vision-camera` (MIT); EfficientNet-B0, Apache-2.0 architecture/weights chain, GBIF CC0/CC-BY-4.0 training images; 8,238,676 bytes on disk; "Behaviour when the model is unavailable" section states the load-failure-only fallback (D-08). |
| 2 | A throwaway spike on a real iOS **and** a real Android device produces recorded figures for inference latency, model size on disk, and top-1/top-3 accuracy (ROADMAP SC2; REQ-ML-adr) | ✗ **FAILED (Android half)** | iOS (iPhone 15 Pro, iOS 27.0): latency, size and per-genus accuracy all recorded and verified against raw artefacts (see Data Verification below). **Android: build succeeds only — no real Android device was ever connected; no Android latency or accuracy figure exists anywhere.** See `gaps` above. |
| 3 | The ADR states an explicit go/partial-go/no-go for US-C9 in this milestone, with fallback if no-go (ROADMAP SC3) | ✓ VERIFIED | ADR Decision section, first line: "Full go for US-C9 in this milestone... per-genus calibrated confidence indicator, ecologist confirmation always required." D-04 amendment recorded in `01-CONTEXT.md` with original (partial-go) wording kept as superseded. |
| 4 | The ADR adds no recurring inference cost to the ~€346/yr budget, or states plainly what it would cost (ROADMAP SC4) | ✓ VERIFIED | ADR "Cost" section: "adds no recurring inference cost... by construction" — evidenced by the airplane-mode latency pass showing no network dependency; non-zero one-off costs (model binary size increase, retraining time, CC-BY attribution) stated plainly rather than rounded to zero. |
| 5 | Every quoted figure in the ADR traces to, and matches, the raw measurement artefacts (not a projection, not a rounding error) | ✓ VERIFIED | Independently recomputed from raw CSV/JSON and matched ADR text exactly: pooled top-3 88.25% (26,557 test rows, `eval/results_v4/per_genus_accuracy.csv`); 1/34 genera clear D-02 bar (Tamarix); 17/34 ≥90% top-3; model size 8,238,676 bytes (`ls -la genus_classifier.tflite`); calibration thresholds 0.7775/0.4866/0.3461 and per-band accuracies (90.06/49.73/30.27/19.95%) exact match to `confidence_scale_recut.json`; per-genus calibrated range 85.91%–91.92%, stdev ≈1.50pp, and the four named low-coverage genera's exact percentages (Ulmus 26.83%, Prunus 29.30%, Populus 32.66%, Fraxinus 35.18%) exact match to `per_genus_calibration.csv`; latency median online 90.41ms / worst 142.94ms and median airplane 90.485≈90.49ms / worst 108.34ms recomputed from `device-harness/results/results.csv` (n=30 each) and match exactly. |
| 6 | The iPhone-15-Pro latency figures are presented as a flagship-hardware cap, not as representative of the D-18 low-spec floor | ✓ VERIFIED | ADR "Measured evidence" table and "Confidence caps" item 1 state this explicitly: "Every latency figure is from an iOS flagship (iPhone 15 Pro), not the D-18 low-spec floor... The ~90ms median figure is optimistic." Phase 3 hand-off explicitly requires re-timing on a low-spec device. |
| 7 | Every accuracy figure is flagged as a lab (GBIF) figure, with field accuracy expected to be lower and requiring later validation | ✓ VERIFIED | ADR "Confidence caps" item 3: "No field photographs were supplied... Every accuracy figure in this ADR... is a lab figure measured on citizen-science GBIF imagery... Field accuracy is expected to be lower... This must be validated before or during Phase 7's field tests, not assumed to hold." Also in "Expected Validation" checklist. |
| 8 | The stand-photo (multi-tree) case is recorded as out of reach for this milestone, naming the disqualified datasets | ✓ VERIFIED | ADR "What is out of reach for this milestone" names **SilvaScenes** (Quebec species, unconfirmed licence) and **ForTrunkDet** (CC-BY but only Eucalyptus/Pinus) by name, with reasons for disqualification, matching `01-CONTEXT.md` D-10 and `01-RESEARCH.md`. |
| 9 | D-07's amendment (bundle, not download) is threaded consistently through the ADR — no stale "not yet downloaded" path remains, a load-failure fallback is retained | ✓ VERIFIED | ADR "Behaviour when the model is unavailable" and "Model distribution integrity" sections are explicitly rewritten: the not-yet-downloaded branch is removed, "a model load can still fail... the app must show an explicit message and fall back to normal manual entry" is retained. Consistent with `01-CONTEXT.md`'s D-07 amendment (original wording kept as superseded). |
| 10 | The ADR was ratified by a human, not self-approved by the executing agent | ✓ VERIFIED (circumstantial, not machine-provable) | `01-06-SUMMARY.md` records the checkpoint was returned unanswered (no commit) and a separate later commit sequence (`685b271`, `66048c8`, `6c6b8a4`) records the D-07 answer and Status flip — consistent with a genuine pause-for-human-input rather than a single uninterrupted agent pass. The plan's own coverage table marks this item `human_judgment: true` — this verifier cannot cryptographically prove the human step occurred, only that the artefacts are consistent with it. Recommend a quick human confirmation, not a blocking gap. |
| 11 | The promoted model and calibration table are preserved outside the repo for Phase 3, matching the spike's working copy | ✓ VERIFIED | `~/Projects/cortege-ml-artifacts/genus-classifier-iteration4/genus_classifier.tflite` MD5 `87195ef8...` matches `spike/species-recognition/train/genus_classifier.tflite` exactly (byte-for-byte, 8,238,676 bytes); `genus_labels.txt` and `per_genus_calibration.csv` also MD5-identical between the two locations. |
| 12 | `STATE.md`'s `progress.completed_plans: 6` reflects genuine completion of 6 plans, not the reported GSD defect of counting a partial SUMMARY.md as complete | ✓ VERIFIED | Walked `.planning/STATE.md`'s git history: at the plan-05 **partial** checkpoint commit (`8e05dbc`, "calibration complete, device measurement pending"), `completed_plans` correctly stayed at **4** (not 5). It only advanced to 5 at plan 05's actual completion commit (`5ef225b`), and to 6 at plan 06's completion (`81f559f`). The defect did not fire in this run. |

**Score:** 11/12 truths verified (1 failed — Android device measurement never performed).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docs/technical/adr-002-on-device-species-recognition-v1.md` | Accepted ADR, full decision record | ✓ VERIFIED | 401 lines, Status: Accepted, dated 2026-09-26; every cited figure traces to a measurement-document section |
| `docs/technical/species-recognition-spike-measurements-v1.md` | Evidence log, Status Complete | ✓ VERIFIED | 3,380 lines, Status: Complete, cross-links to ADR-002 in its header |
| `CLAUDE.md` documentation index | Lists both new docs | ✓ VERIFIED | Lines 346–347: both files indexed with one-line descriptions |
| `spike/species-recognition/` | Gitignored, throwaway, never committed | ✓ VERIFIED | `git status --porcelain spike/` is empty; `spike/` present in both `.gitignore` (line 37) and `.prettierignore` (line 11) |
| `~/Projects/cortege-ml-artifacts/genus-classifier-iteration4/` | Preserved model + calibration for Phase 3 | ✓ VERIFIED | Present, MD5-identical to spike working copy for `genus_classifier.tflite`, `genus_labels.txt`, `per_genus_calibration.csv` |
| `eval/GATE`, `eval/GATE-MEASURE`, `device-harness/GATE` | Machine-checkable stage gates | ✓ VERIFIED | `GATE-MODEL: PASS`, `GATE-MEASURE: COMPLETE`, `GATE-HARNESS: PASS` all present and consistent with the ADR's narrative, including the same honestly-recorded gaps (Android, field photos, model load time) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| ADR "Measured evidence" table figures | `eval/results_v4/per_genus_accuracy.csv`, `train/training_report_v4.json` | Direct recomputation | ✓ WIRED | Pooled top-3 88.25%, 1/34 clears bar, 17/34 ≥90% — exact match |
| ADR calibration figures | `~/…/confidence_scale_recut.json`, `~/…/per_genus_calibration.csv` | Direct recomputation | ✓ WIRED | Thresholds, band accuracies, per-genus min/max/stdev, four named low-coverage genera — exact match |
| ADR latency figures | `device-harness/results/results.csv` | Direct recomputation (n=30 online, n=30 airplane) | ✓ WIRED | Median, worst-case both match to reported precision |
| ADR model-size figure | `train/genus_classifier.tflite` on disk | `ls -la` | ✓ WIRED | 8,238,676 bytes exact |
| REQ-ML-adr → REQUIREMENTS.md | `.planning/REQUIREMENTS.md` line 76 | Requirement marked `[x]` | ⚠️ PARTIAL | Requirement text itself demands "measured latency and accuracy on real iOS **and Android** devices" — the Android half is unmet (see gap above), yet the checkbox reads complete |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-ML-adr | 01-01 through 01-06 (all six plans) | Accepted ADR records runtime, model+licence, size, measured latency/accuracy on real iOS **and Android** devices, offline behaviour, explicit go/no-go | ⚠️ **PARTIALLY SATISFIED** | ADR exists and is Accepted; every element is present **except** real-Android measured latency/accuracy, which the requirement's own text names explicitly. REQUIREMENTS.md marks it `[x]` regardless. |

No orphaned requirements found for Phase 1 — `REQ-QA-ibp-version` (the only other requirement touching Phase 1's research) is correctly mapped to Phase 1.1 in both ROADMAP.md and REQUIREMENTS.md, not Phase 1.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in either `adr-002-on-device-species-recognition-v1.md` or `species-recognition-spike-measurements-v1.md`. No stub patterns — every figure is a real, cross-checked measurement.

### Behavioral Spot-Checks / Probe Execution

Not applicable in the usual sense — this phase ships no production code and no test suite (confirmed by `01-RESEARCH.md`'s own Validation Architecture section: "no `pytest`/Jest suite to write for throwaway spike code"). In its place, this verification performed the equivalent: direct recomputation of every headline figure from the raw CSV/JSON artefacts the spike produced, reported under "Data Verification" in the Observable Truths table above (truth #5) rather than as a separate spot-check table.

## Gaps Summary

**One material gap, already substantially disclosed by the phase's own artefacts, but not closed by disclosure alone:**

ROADMAP Phase 1 success criterion 2 and REQ-ML-adr's own wording both require measured figures from **a real iOS device and a real Android device**. Only the iOS half was delivered. The Android build succeeds with the same runtime (`react-native-fast-tflite`, no substitution) — so the *feasibility* question for Android is answered — but there is no Android latency number and no Android accuracy number anywhere in the measurement document or the ADR. This was an explicit, user-made decision at each point in the phase (recorded plainly in `device-harness/GATE`, `eval/GATE-MEASURE`, and the ADR's own "Confidence caps" section), not an oversight the executor tried to hide. That honesty is real and should count in the user's favor — but it does not, on its own, make the letter of the roadmap's success criterion or the requirement's own text true.

**This is presented as an escalation, not a verdict already made for you:**

- If the user wants to treat this as an acceptable, deliberate deviation for this milestone (the ADR already frames it that way, and commits to closing it "before Phase 3 ships" in its own Expected Validation checklist), the appropriate action is to add an `overrides:` entry to this file's frontmatter recording that acceptance explicitly, so the gap is traceable rather than silently waved through by a future reader of a green report.
- If the user wants the letter of the requirement actually met before Phases 2/3 proceed, the gap requires a real Android device latency + accuracy pass, in the same format as Section 7/Section 5 of the measurement document.

Everything else in this phase — the ADR's content, its precise traceability to raw data, the D-04/D-07/D-10/D-12 amendment discipline, the stand-photo disqualification, the flagship/lab-data caveats, the artefact-preservation handoff to Phase 3, and the STATE.md progress-tracking correctness — is solid and independently verified against the codebase, not merely asserted by the SUMMARYs.

**Suggested override (if the user chooses to accept the gap as-is):**

```yaml
overrides:
  - must_have: "A throwaway spike on a real iOS device and a real Android device produces recorded figures for inference latency, model size on disk, and top-1/top-3 accuracy"
    reason: "Android hardware was unavailable this milestone by explicit user decision; the Android build succeeds with the same runtime and no substitution, answering the feasibility question. Real Android latency/accuracy measurement is deferred and tracked as an open item in ADR-002's Expected Validation checklist, to close before Phase 3 ships."
    accepted_by: "<user name>"
    accepted_at: "<ISO timestamp>"
```

---

*Verified: 2026-09-26*
*Verifier: Claude (gsd-verifier)*
