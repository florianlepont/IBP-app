---
phase: 01-species-recognition-approach-decision
plan: 03
subsystem: ml-infra
tags: [tflite, react-native-fast-tflite, react-native-vision-camera, expo-prebuild, expo-file-system, device-harness, spike, real-device]

requires:
  - phase: 01-01
    provides: "Gitignored spike/species-recognition/ tree, resolved ANDROID_HOME, measurement document skeleton"
provides:
  - "A standalone, gitignored Expo 57.0.24/RN 0.86.3 device harness (spike/species-recognition/device-harness/) proving react-native-fast-tflite + react-native-vision-camera build, link AND RUN on a real iPhone 15 Pro (iOS 27.0), plus a successful Android build (react-native-fast-tflite, no substitution)"
  - "spike/species-recognition/device-harness/GATE: GATE-HARNESS: PASS, RUNTIME: react-native-fast-tflite@3.0.1, RUNTIME-SUBSTITUTION: no -- real-hardware iOS run completed; Android recorded as a measurement gap (no device connected, by user decision), not a runtime failure"
  - "Real on-device latency: preprocess ms median 77.9 / worst 93.2, inference ms median 4.8 / worst 13.7, on a FLAGSHIP iPhone 15 Pro -- must carry the flagship-optimism caveat against the D-18 low-spec floor"
  - "A fixed on-device model cache path (Paths.document/models/genus_classifier.tflite) plan 05 reuses unmodified, confirmed resolving correctly on real hardware"
  - "A results CSV column order (results/results.csv) plan 05 reuses unmodified, with a real 10-row sample pulled off real hardware via `devicectl device copy from`"
  - "Four documented native-integration pitfalls, all fixed: react-native-vision-camera's missing Expo config plugin; a stale Podfile.lock path after interleaved expo install calls; an unset JAVA_HOME; and iOS 26+'s scene-lifecycle-adoption crash, which only appears on a real device, never in Simulator -- exactly the pitfall class D-18's real-hardware requirement exists to catch"
affects: [01-05, 01-06]

tech-stack:
  added: []
  patterns:
    - "Spike-only native deps (react-native-fast-tflite, react-native-vision-camera, expo-image-manipulator, expo-device, expo-asset, jpeg-js, base64-js) live entirely inside the gitignored spike/ tree via a standalone Expo app with its own package.json/package-lock.json -- never touch the root workspace or mobile/"
    - "Project-local Expo config plugins (plugins/with-vision-camera-permissions.js, plugins/with-ios-deployment-target-floor.js, plugins/with-scene-delegate.js) fill gaps left by missing/removed upstream plugins or by real-device-only build requirements, following the same pattern mobile/plugins/with-scene-delegate.js already establishes for this repo"
    - "xcrun devicectl (device info files --domain-type systemCrashLogs, device copy to/from --domain-type appDataContainer, device process launch --payload-url) reads a real device's crash logs and app sandbox directly with no jailbreak and no Xcode UI -- useful whenever a real-device run needs diagnosis or file exchange without USB Finder/iTunes access"

key-files:
  created:
    - "spike/species-recognition/device-harness/App.tsx (gitignored, not committed)"
    - "spike/species-recognition/device-harness/src/{modelCache,inference,resultsLog,imagenetLabels}.ts (gitignored, not committed)"
    - "spike/species-recognition/device-harness/plugins/with-vision-camera-permissions.js (gitignored, not committed)"
    - "spike/species-recognition/device-harness/plugins/with-ios-deployment-target-floor.js (gitignored, not committed)"
    - "spike/species-recognition/device-harness/plugins/with-scene-delegate.js (gitignored, not committed, copied from mobile/plugins/)"
    - "spike/species-recognition/device-harness/GATE (gitignored, not committed) -- the machine-checkable result plan 05 reads"
    - "spike/species-recognition/device-harness/README.md (gitignored, not committed) -- integration narrative for section 8"
    - "spike/species-recognition/device-harness/results/results.csv (gitignored, not committed) -- real 10-row sample pulled off the real iPhone 15 Pro"
    - ".planning/phases/01-species-recognition-approach-decision/01-03-SUMMARY.md (this file)"
  modified:
    - "~/.zshrc (outside repo, not tracked by this project's git) -- adds JAVA_HOME export for Android Gradle builds"

key-decisions:
  - "GATE-HARNESS: PASS, corrected from an earlier, WRONG BUILD-FAILED. The first pass of this plan wrote GATE-HARNESS: BUILD-FAILED to mean 'no real device was reachable at that moment' -- but BUILD-FAILED is supposed to mean the build failed, and it never did (xcodebuild and gradlew both succeeded on the first pass too). A real iPhone became reachable mid-session; once it was, the app was launched, seeded and benchmarked on it for real, and the gate now correctly reads PASS with the real evidence. Lesson recorded for future plans: when a gate's fixed vocabulary has no value that fits what was actually found, that is a signal to say so and ask, not to pick the nearest-sounding token -- a wrong label on a machine-read gate propagates silently into every downstream document (plan 05, the ADR)."
  - "iPhone 15 Pro is explicitly flagged as a FLAGSHIP in the GATE and README, not the D-18 low-spec floor (iPhone SE 2nd/3rd gen or iPhone 11 class). Every latency figure this plan produced is optimistic relative to what the association's observers likely carry -- RESEARCH.md Pitfall 4's warning applies directly to this plan's own numbers, not just hypothetically."
  - "Android recorded as NOT MEASURED -- a gap, not a runtime failure. No Android device was connected this session, by the user's explicit decision. The Android build itself succeeded earlier (./gradlew assembleDebug, BUILD SUCCESSFUL in 9m 1s) with the same react-native-fast-tflite runtime and no substitution, so the runtime question is answered for Android even without a device run; only the real-hardware latency number is missing."
  - "D-06 (offline) is NOT empirically re-verified in airplane mode on the real device -- an open item, not a silent gap. The architectural guarantee holds by code inspection (no network call anywhere in the load/preprocess/inference path), but this plan's own instructions distinguish code-inspection confidence from an observed airplane-mode test, and only the latter was performed earlier (never on real hardware, since the device only became available very late in this plan). Flagged explicitly for plan 05 to close."
  - "iOS 26+ scene-lifecycle-adoption crash (EXC_BREAKPOINT/SIGTRAP in UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) is the fourth native-integration finding, and the most important one: it is invisible on the iOS Simulator (tasks 1-2's Simulator smoke test showed no problem at all) and only appears on a real device -- which is exactly why this plan's D-18 real-hardware requirement exists. Fixed by copying mobile/plugins/with-scene-delegate.js verbatim into the harness and adding the matching ios.infoPlist scene manifest block, mirroring mobile/app.json exactly."
  - "Debug-config Metro-served builds are unreliable on this real device because the development Mac's only outbound network interface was itself tethered through the same iPhone's Personal Hotspot (172.20.10.0/28, macOS-flagged 'constrained') -- the dev-server round trip went back to the device it was trying to serve. Fixed, per explicit coordinator direction, by switching to a Release build (JS bundle embedded, no packager dependency at runtime), which is also the more honest D-05 measurement since a debug dev-server round trip is not what the ecologist experiences. All latency figures in this plan are from the Release build; there is no earlier Debug-build figure to reconcile against."
  - "A results CSV column was renamed model_file_bytes -> model_bytes (both in src/resultsLog.ts for future runs and, header-line only, in the already-captured results/results.csv) to match the plan's own automated verify grep pattern (device|os|model_bytes|inference_ms|preprocess_ms). Only the column label changed; every captured byte value is untouched, real data from the device."
  - "react-native-vision-camera@5.2.3 ships no app.plugin.js at all, unlike RESEARCH.md's Pattern 2 example which assumes a bare-string plugin entry works. Fixed with a project-local config plugin (plugins/with-vision-camera-permissions.js) that injects NSCameraUsageDescription (iOS) and the CAMERA permission (Android) directly, following the same local-plugin convention mobile/plugins/with-scene-delegate.js already establishes."
  - "TensorFlowLiteC and RCTDeprecation pods ship IPHONEOS_DEPLOYMENT_TARGET values (12.0, 4.3) below Xcode 27's supported floor (15.0) -- invisible on a Simulator build, but blocking on a real-device xcodebuild destination. Fixed with a project-local Podfile post_install hook (plugins/with-ios-deployment-target-floor.js, using withPodfile) that raises every pod's deployment target to the Podfile's own 16.4 floor."
  - "pod install must run once, after all package installs finish -- not immediately after each expo install. Interleaving it left a stale Podfile.lock pointing at a transient node_modules/expo/node_modules/expo-constants path that a later install deduped away, breaking the iOS build with an unrelated-looking 'PrivacyInfo.xcprivacy couldn't be opened' error."
  - "JAVA_HOME added to ~/.zshrc (Homebrew's openjdk@17 was installed but not symlinked into /Library/Java), mirroring plan 01-01's precedent of a low-risk, one-line PATH/env export for an already-installed tool (Threat T-01-03, disposition: accept)."
  - "The stock-model test image is the canonical TensorFlow example photo (grace_hopper.jpg, renamed pipeline-test.jpg), not a tree photo -- arbitrary by design. Confirmed on real hardware: the top-3 result was 'military uniform / Windsor tie / bulletproof vest', a sensible ImageNet answer and, as the plan anticipated, meaningless for genus recognition."
  - "Without a touch-injection path for a physical device, the model was seeded directly onto the device via `xcrun devicectl device copy to --domain-type appDataContainer` (bypassing the harness's own 'Seed stock model' button, which just does the same file copy from JS) and the benchmark was triggered via a `?autorun=1` deep-link parameter added to App.tsx for this purpose, launched with `devicectl device process launch --payload-url`. Neither bypass is part of the measured pipeline -- both are harness-only conveniences documented in README.md, added because no simulator-style UI-automation tool exists for a physical iOS device via devicectl."

patterns-established:
  - "When a third-party RN library's Expo config plugin is missing or broken, write a minimal project-local plugin using expo/config-plugins' withInfoPlist/withAndroidManifest/withPodfile rather than hand-editing generated ios/android projects."
  - "Real-device-only failures (deployment-target floors, scene-lifecycle adoption) do not surface on the iOS Simulator -- a Simulator-only smoke test is due diligence, never a substitute for the real-hardware run a plan's success criteria actually require."

requirements-completed: []

coverage:
  - id: D1
    description: "expo prebuild generates working ios/ and android/ projects for the harness from app.json plugin declarations only (no hand-edited generated files), with react-native-fast-tflite and react-native-vision-camera correctly declared and linked"
    verification:
      - kind: other
        ref: "expo prebuild --platform ios && expo prebuild --platform android (both succeeded, re-run three times across this plan as plugins were added); ios/Podfile.lock and android manifest show both native modules linked"
        status: pass
    human_judgment: false
  - id: D2
    description: "The native TFLite + VisionCamera integration actually compiles AND RUNS against Expo 57.0.24/RN 0.86.3 on real iOS hardware (the core risk this plan exists to retire), and compiles on Android"
    verification:
      - kind: other
        ref: "npx expo run:ios --device 00008130-001829D822F2001C --configuration Release -> Build Succeeded, installed, launched, ran to completion on a real iPhone 15 Pro (iOS 27.0); ./gradlew assembleDebug -> BUILD SUCCESSFUL in 9m 1s, app-debug.apk produced (Android real-hardware run not performed, no device connected)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Model cache path fixed to Paths.document/models/genus_classifier.tflite (D-07) -- loads from an on-device cache path, never require()/bundle -- confirmed on real hardware"
    verification:
      - kind: other
        ref: "Real-device screenshot (iPhone 15 Pro) resolving file:///var/mobile/Containers/Data/Application/<container>/Documents/models/genus_classifier.tflite"
        status: pass
    human_judgment: false
  - id: D4
    description: "With no model file present, the harness shows an explicit unavailable message and stays usable (D-08), not a silent failure or crash -- confirmed on real hardware"
    verification:
      - kind: automated_ui
        ref: "Real-device screenshot (iPhone 15 Pro, iOS 27.0): 'Recognition unavailable -- no model file present...' message rendered with working 'Seed stock model into cache' button"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-hardware proof: a stock TFLite classifier runs on a real iOS device with latency recorded to a device-attributed CSV (D-05, D-18)"
    verification:
      - kind: other
        ref: "results/results.csv, 10 real rows, device_model=iPhone 15 Pro, os_version=27.0, preprocess_ms median 77.9/worst 93.2, inference_ms median 4.8/worst 13.7 -- pulled off the device via devicectl device copy from"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-06 (offline, no network in the inference path) -- architectural guarantee by code inspection, NOT empirically confirmed with the real device in airplane mode"
    verification: []
    human_judgment: true
    rationale: "src/inference.ts and src/modelCache.ts make no network call anywhere in the load/preprocess/inference path (verifiable by reading the source), but this plan's own instructions distinguish that from an observed airplane-mode test on the real device, which was not performed once real-device access finally arrived (device access was intermittent and prioritised toward getting any real benchmark numbers at all). Plan 05 should close this with an explicit airplane-mode run."
  - id: D7
    description: "Android real-hardware latency measurement (D-05, D-18 for the Android platform)"
    verification: []
    human_judgment: true
    rationale: "No Android device was connected this session, by the user's explicit decision (measure on iPhone only this milestone). The Android build succeeded (react-native-fast-tflite, no substitution), so the runtime question is answered, but no real Android latency number exists. Recorded as a gap for the ADR to state plainly, not something a human needs to judge -- flagged human_judgment true only because there is nothing here for automation to check."
  - id: D8
    description: "Nothing under mobile/, api/, or the root package.json/package-lock.json was touched by this plan"
    verification:
      - kind: other
        ref: "git diff --stat -- mobile/ api/ package.json package-lock.json (empty); git status --porcelain spike/ (empty, fully gitignored)"
        status: pass
    human_judgment: false

duration: ~3h (including two coordinator-directed corrections and real-device access that was intermittent throughout)
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 03: Device Harness (TFLite Native Integration Proof) Summary

**Standalone Expo 57/RN 0.86 harness proves `react-native-fast-tflite` + `react-native-vision-camera` build, link AND RUN on a real iPhone 15 Pro (iOS 27.0) -- 10 real benchmark passes, median inference 4.8ms / preprocess 77.9ms, well inside the 3s budget, but on FLAGSHIP hardware, with Android build-only (no device connected) and D-06 unverified in airplane mode.**

## Performance

- **Duration:** ~3h total across the full plan, including a real-device session that required two coordinator-directed corrections (an initial mislabeled gate, then a Metro-over-constrained-tether dead end resolved by switching to a Release build) and several rounds of the device locking mid-session
- **Completed:** 2026-09-23
- **Tasks:** 2 (both auto, both executed to completion, then extended live once real-device access arrived)
- **Files modified:** 0 tracked repo files under `mobile/`/`api/`/root; ~18 files created inside the gitignored `spike/species-recognition/device-harness/` tree; 1 file outside the repo (`~/.zshrc`)

## Accomplishments

- Task 1: Scaffolded a standalone Expo 57.0.24/RN 0.86.3/React 19.2.3 app, installed `react-native-fast-tflite@3.0.1` and `react-native-vision-camera@5.2.3` (both MIT, OK/Approved per RESEARCH.md), declared them through `app.json`'s `plugins` array, and got `expo prebuild` + `pod install` working for both platforms. `react-native-executorch` was not installed.
- Task 2: Wired the inference screen (`App.tsx` + `src/{modelCache,inference,resultsLog,imagenetLabels}.ts`) implementing D-07, D-08, D-13 and a device-attributed CSV writer (D-18).
- **Real native build proof on real hardware, iOS.** `npx expo run:ios --device <UDID> --configuration Release` -> Build Succeeded, installed, and (after fixing the scene-lifecycle crash below) launched and ran to completion on Florian's real iPhone 15 Pro. Android: `./gradlew assembleDebug` -> `BUILD SUCCESSFUL in 9m 1s`, real APK produced, but no device was connected to run it on.
- **Real on-device benchmark: 10/10 runs, real numbers.** `results/results.csv` (pulled off the device with `xcrun devicectl device copy from`): `device_model=iPhone 15 Pro`, `os_version=27.0`, preprocess ms median **77.9** / worst **93.2**, inference ms median **4.8** / worst **13.7** -- comfortably inside the 3s D-05 budget on this device. Top-3 result on the bundled test image: "military uniform / Windsor tie / bulletproof vest" -- a sensible ImageNet answer, correctly meaningless for genus recognition, exactly as the plan anticipated.
- **D-07 and D-08 both confirmed on real hardware** via device screenshots: the app resolves the correct on-device cache path and shows the correct explicit-unavailable state before the model is seeded.
- **Four real native-integration findings, all fixed** -- vision-camera's missing config plugin, a stale Podfile.lock path, an unset `JAVA_HOME`, and (found only once a real device was reachable) an iOS 26+ scene-lifecycle-adoption crash invisible on Simulator. Full detail in Deviations and in `README.md`'s integration narrative for section 8.
- **Two corrections during this plan, both driven by the coordinator catching real errors:**
  1. The first pass of this plan wrote `GATE-HARNESS: BUILD-FAILED` to mean "no device was reachable," which is not what that token means -- the build never failed. Corrected to `PASS` once a real device became reachable and was actually used.
  2. Early real-device attempts (Debug config, Metro-served bundle) white-screened because this Mac's network was itself tethered through the same iPhone's Personal Hotspot -- a fragile, constrained loop. Switched to a Release build (embedded JS bundle, no runtime packager dependency) on the coordinator's direction, which is also the more honest D-05 measurement.
- **Final gate: `GATE-HARNESS: PASS`**, `RUNTIME: react-native-fast-tflite@3.0.1`, `RUNTIME-SUBSTITUTION: no`, iPhone 15 Pro named and flagged **FLAGSHIP**, Android recorded as a not-measured gap.

## Task Commits

Both tasks modify only files under the gitignored `spike/species-recognition/device-harness/` tree (and one out-of-repo `~/.zshrc` edit) -- per the plan's design (`git status --porcelain spike/` stays empty throughout), **there is nothing to git-commit for either task**. This mirrors plan 01-01's Task 2.

1. **Task 1: Build a standalone dev-client harness with the TFLite runtime wired through a config plugin** -- no commit (all changes under gitignored `spike/`)
2. **Task 2: Wire the inference screen and prove the pipeline offline with a stock model** -- no commit (all changes under gitignored `spike/`)

**Plan metadata:** commit follows this SUMMARY (this file + STATE.md/ROADMAP.md updates).

## Files Created/Modified

- `spike/species-recognition/device-harness/app.json` - declares all four config plugins and the iOS scene manifest
- `spike/species-recognition/device-harness/metro.config.js` - registers `tflite` as a Metro asset extension
- `spike/species-recognition/device-harness/plugins/with-vision-camera-permissions.js` - fills vision-camera's missing plugin
- `spike/species-recognition/device-harness/plugins/with-ios-deployment-target-floor.js` - fixes TensorFlowLiteC/RCTDeprecation deployment targets for real-device builds
- `spike/species-recognition/device-harness/plugins/with-scene-delegate.js` - copied from `mobile/plugins/`, fixes the iOS 26+ scene-lifecycle crash
- `spike/species-recognition/device-harness/App.tsx` - harness UI, plus a `?autorun=1` deep-link fallback for triggering the benchmark without a touch-injection path
- `spike/species-recognition/device-harness/src/modelCache.ts` - fixes and owns the D-07 cache path
- `spike/species-recognition/device-harness/src/inference.ts` - decode/resize/normalize + timed inference + top-3 extraction
- `spike/species-recognition/device-harness/src/resultsLog.ts` - device-attributed CSV writer (D-18), `model_bytes` column
- `spike/species-recognition/device-harness/src/imagenetLabels.ts` - 1001-label stock ImageNet label set
- `spike/species-recognition/device-harness/assets/models/mobilenet_v1_1.0_224_quant.tflite` - stock pipeline-proof model
- `spike/species-recognition/device-harness/assets/test-images/pipeline-test.jpg` - bundled fixed test image
- `spike/species-recognition/device-harness/results/results.csv` - real 10-row sample from the iPhone 15 Pro
- `spike/species-recognition/device-harness/GATE` - `GATE-HARNESS: PASS`, corrected
- `spike/species-recognition/device-harness/README.md` - full corrected integration narrative
- `~/.zshrc` (outside repo) - adds `JAVA_HOME` export

## Decisions Made

See `key-decisions` in the frontmatter for the full list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-native-vision-camera@5.2.3` has no Expo config plugin**
- **Found during:** Task 1 (`expo prebuild --platform ios` failed immediately)
- **Fix:** Wrote `plugins/with-vision-camera-permissions.js` (`withInfoPlist`/`withAndroidManifest`).
- **Verification:** `expo prebuild` succeeded for both platforms afterward; Info.plist/AndroidManifest.xml both carry the injected permissions.

**2. [Rule 3 - Blocking] Stale `Podfile.lock` path after interleaved `expo install` calls broke the iOS build**
- **Found during:** Task 2, first `xcodebuild` attempt
- **Fix:** Deleted `ios/Pods`/`ios/Podfile.lock`, re-ran `pod install` once, after all installs finished.
- **Verification:** iOS Simulator build succeeded.

**3. [Rule 3 - Blocking] `JAVA_HOME` unresolved, blocking the Android build entirely**
- **Found during:** Task 2, first `./gradlew assembleDebug` attempt
- **Fix:** Exported `JAVA_HOME` in `~/.zshrc`, alongside plan 01-01's existing `ANDROID_HOME` export.
- **Verification:** `./gradlew assembleDebug` -> `BUILD SUCCESSFUL in 9m 1s`.

**4. [Rule 3 - Blocking] `TensorFlowLiteC`/`RCTDeprecation` deployment targets below Xcode 27's real-device floor**
- **Found during:** First real-device `xcodebuild -destination "id=<UDID>"` attempt -- did NOT surface on the Simulator build in tasks 1-2
- **Issue:** `TensorFlowLiteC` (12.0) and `RCTDeprecation` (4.3) ship deployment targets below Xcode 27's supported floor (15.0); `react_native_post_install` does not correct every pod.
- **Fix:** `plugins/with-ios-deployment-target-floor.js` (`withPodfile`, `post_install` hook raising every pod to the Podfile's 16.4 floor).
- **Verification:** Real-device `xcodebuild` build succeeded (0 errors).

**5. [Rule 1 - Bug] iOS 26+ scene-lifecycle-adoption crash on real device**
- **Found during:** First successful real-device install + launch -- app installed and the OS accepted the launch call, but the process crashed instantly (`EXC_BREAKPOINT`/`SIGTRAP`), invisible on Simulator
- **Issue:** iOS 26+ kills at launch any app built against the new SDK that has not adopted the UIKit scene life cycle. `mobile/` already has a fix for this (`mobile/plugins/with-scene-delegate.js`); the harness never got an equivalent.
- **Fix:** Copied `mobile/plugins/with-scene-delegate.js` verbatim, added the matching `UIApplicationSceneManifest` block to `app.json`'s `ios.infoPlist`.
- **Verification:** Diagnosed via `xcrun devicectl device info files --domain-type systemCrashLogs` + `device copy from` to pull the actual `.ips` crash report (parsed as JSON) -- confirmed the exact frame (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). After the fix: app launched, stayed running, and completed a full 10-run benchmark.

**6. [Rule 1 - Bug] Gate mislabeled BUILD-FAILED when the actual finding was device-unreachability**
- **Found during:** Coordinator review, after the plan's first completion pass
- **Issue:** Wrote `GATE-HARNESS: BUILD-FAILED` intending "no device was reachable," but that token specifically means the build failed, which it never did (both `xcodebuild` and `gradlew` succeeded on the very first pass, before any device was even checked).
- **Fix:** Once a real iPhone became reachable and was actually used for a full benchmark run, rewrote `GATE-HARNESS: PASS` with the real evidence, the FLAGSHIP caveat, and the Android gap stated plainly.
- **Verification:** Plan's own automated verify script (Task 2's `<verify>` block) now passes on the `PASS` branch with the real `results.csv`.

**7. [Rule 3 - Blocking] Debug-over-Metro white-screened on the real device**
- **Found during:** First attempts to run the Debug config on the real iPhone once it became reachable
- **Issue:** This Mac's only outbound network interface was tethered through the same iPhone's Personal Hotspot (`172.20.10.0/28`, macOS-flagged `constrained`) -- the Metro dev-server round trip went back to the device it was serving, and was unreliable.
- **Fix:** Switched to a Release build (`--configuration Release`), embedding the JS bundle at build time, removing the runtime packager dependency entirely -- per the coordinator's explicit direction, also the more honest D-05 measurement.
- **Verification:** Release build launched and ran a full benchmark without any network dependency.

**8. [Rule 1 - Bug] CSV column name didn't match the plan's own verify grep pattern**
- **Found during:** Re-running the plan's Task 2 verify script after the real benchmark completed
- **Issue:** Column was `model_file_bytes`; the verify script's grep pattern looks for the substring `model_bytes`, which is not contained in `model_file_bytes`.
- **Fix:** Renamed the column to `model_bytes` in `src/resultsLog.ts` (future runs) and in the header line only of the already-captured `results.csv` (all real data values unchanged).
- **Verification:** Task 2 verify script now passes.

---

**Total deviations:** 8 auto-fixed (6 blocking, 2 bug-fix corrections). None touched production workspaces or expanded scope beyond making the primary recommended runtime build and run successfully on real hardware.
**Impact on plan:** No scope creep. All eight are exactly the class of finding this plan exists to surface before measurement day, and all are written up in `README.md`'s integration narrative for plan 05/section 8 and the eventual ADR.

## Issues Encountered

- **Real device access was intermittent throughout this session** -- the phone locked mid-run multiple times (once genuinely due to inactivity before Auto-Lock was set to Never, at least once more afterward despite that setting, suggesting the setting either wasn't applied or was overridden by the user physically pressing the side button). Each lock required stopping and waiting for the phone to be unlocked again before progress could continue; `xcrun devicectl` has no way to unlock a device, by design.
- **D-06 (offline) was not empirically re-verified with the device in airplane mode on real hardware.** Recorded as coverage item D6 with `human_judgment: true` -- plan 05 should close this explicitly.
- **Android was never connected this session**, by the user's explicit decision (measure on iPhone only this milestone). Recorded as coverage item D7.

## User Setup Required

**For plan 05 to get a low-spec-floor iOS reading and any Android reading at all:**
- Connect a lower-spec real iOS device (iPhone SE 2nd/3rd gen or iPhone 11 class) if the association's actual observer hardware is still unknown -- the iPhone 15 Pro figures in this plan are a flagship ceiling, not representative of the D-18 floor.
- Connect a real Android device with USB debugging enabled (`adb devices` must list it) -- none was available this session by user decision.
- Confirm D-06 with the device physically in airplane mode during a benchmark run -- not done this session.
- No external service configuration required -- these are all local hardware-availability gaps.

## Next Phase Readiness

- **`GATE-HARNESS: PASS`** is now the authoritative, correctly-labeled signal for plan 05: the primary recommended runtime (`react-native-fast-tflite`, no substitution) builds, links and runs on real Expo 57.0.24/RN 0.86.3 iOS hardware, with real latency numbers already in `results/results.csv`.
- Plan 05 should read the FLAGSHIP caveat and the Android/D-06 gaps in `GATE` and `README.md` before citing any number in the ADR without qualification, and should prioritise a low-spec iOS device and any Android device for its own measurement day rather than assuming the iPhone 15 Pro figures are representative.
- All four integration findings (vision-camera plugin, Podfile.lock staleness, JAVA_HOME, and especially the iOS 26+ scene-lifecycle crash that is invisible on Simulator) are written up in `README.md` for direct citation in the ADR's Phase 3 implementation-cost estimate.
- The `react-native-fast-tflite` New Architecture compatibility caveat from `npx expo-doctor` (listed "Untested on New Architecture" in React Native Directory metadata, despite being Nitro-Modules/JSI-based and therefore New-Architecture-native by construction) is still a minor, non-blocking note worth one line in the eventual ADR.

---
*Phase: 01-species-recognition-approach-decision*
*Completed: 2026-09-23*

## Self-Check: PASSED

All claimed files found on disk: `app.json`, `metro.config.js`, all four `plugins/*.js` files, `App.tsx`,
`src/{modelCache,inference,resultsLog,imagenetLabels}.ts`, the bundled stock model and test image,
`results/results.csv` (real 10-row data from the iPhone 15 Pro), `GATE` (reads `GATE-HARNESS: PASS`),
`README.md` (all four findings documented), and the `JAVA_HOME` export in `~/.zshrc` (all under the
gitignored `spike/species-recognition/device-harness/` tree except the last). No task commits to
verify -- both tasks modified only gitignored files, as documented in Task Commits above. Plan's own
Task 1 and Task 2 automated verify scripts both re-run and both pass on the `GATE-HARNESS: PASS` branch.
