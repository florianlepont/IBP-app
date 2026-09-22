---
phase: 01-species-recognition-approach-decision
plan: 03
subsystem: ml-infra
tags: [tflite, react-native-fast-tflite, react-native-vision-camera, expo-prebuild, expo-file-system, device-harness, spike]

requires:
  - phase: 01-01
    provides: "Gitignored spike/species-recognition/ tree, resolved ANDROID_HOME, measurement document skeleton"
provides:
  - "A standalone, gitignored Expo 57.0.24/RN 0.86.3 device harness (spike/species-recognition/device-harness/) proving react-native-fast-tflite + react-native-vision-camera build and link against this stack's native toolchain, on both iOS (xcodebuild, simulator) and Android (gradle assembleDebug)"
  - "spike/species-recognition/device-harness/GATE: GATE-HARNESS: BUILD-FAILED, RUNTIME: react-native-fast-tflite@3.0.1, RUNTIME-SUBSTITUTION: no -- native build succeeds but no real iOS or Android device was reachable from this machine to complete the required real-hardware run"
  - "A fixed on-device model cache path (Paths.document/models/genus_classifier.tflite) plan 05 reuses unmodified"
  - "A results CSV column order (results/results.csv) plan 05 reuses unmodified"
  - "Two documented native-integration pitfalls (react-native-vision-camera@5.2.3 ships no Expo config plugin; a stale Podfile.lock path after interleaved expo install calls) plus their fixes"
affects: [01-05, 01-06]

tech-stack:
  added: []
  patterns:
    - "Spike-only native deps (react-native-fast-tflite, react-native-vision-camera, expo-image-manipulator, expo-device, expo-asset, jpeg-js, base64-js) live entirely inside the gitignored spike/ tree via a standalone Expo app with its own package.json/package-lock.json -- never touch the root workspace or mobile/"
    - "Project-local Expo config plugins (plugins/with-vision-camera-permissions.js) fill gaps left by a third-party package's missing/removed app.plugin.js, following the same pattern mobile/plugins/with-scene-delegate.js already establishes for this repo"

key-files:
  created:
    - "spike/species-recognition/device-harness/App.tsx (gitignored, not committed)"
    - "spike/species-recognition/device-harness/src/{modelCache,inference,resultsLog,imagenetLabels}.ts (gitignored, not committed)"
    - "spike/species-recognition/device-harness/plugins/with-vision-camera-permissions.js (gitignored, not committed)"
    - "spike/species-recognition/device-harness/GATE (gitignored, not committed) -- the machine-checkable result plan 05 reads"
    - "spike/species-recognition/device-harness/README.md (gitignored, not committed) -- integration narrative for section 8"
    - ".planning/phases/01-species-recognition-approach-decision/01-03-SUMMARY.md (this file)"
  modified:
    - "~/.zshrc (outside repo, not tracked by this project's git) -- adds JAVA_HOME export for Android Gradle builds"

key-decisions:
  - "GATE-HARNESS: BUILD-FAILED, not PASS. Native compilation genuinely succeeded on both platforms (expo prebuild, pod install, xcodebuild -destination generic/platform=iOS Simulator, and ./gradlew assembleDebug all completed cleanly with react-native-fast-tflite -- no substitution needed), but D-18 requires a real-hardware run and no real iOS or Android device is reachable from this machine (xcrun xctrace list devices shows the one paired iPhone Offline; adb devices returns empty). Per the plan's own instruction (\"a harness that runs on only one platform cannot satisfy ROADMAP criterion 2\"), zero reachable platforms downgrades the gate to BUILD-FAILED rather than reporting a simulator result as if it met the real-device bar."
  - "react-native-vision-camera@5.2.3 (the version expo install resolves for Expo 57/RN 0.86) ships no app.plugin.js at all, unlike RESEARCH.md's Pattern 2 example which assumes a bare-string plugin entry works. Fixed with a project-local config plugin (plugins/with-vision-camera-permissions.js) that injects NSCameraUsageDescription (iOS) and the CAMERA permission (Android) directly, following the same local-plugin convention mobile/plugins/with-scene-delegate.js already establishes. This is more aligned with the repo's own precedent than depending on an upstream plugin that no longer exists."
  - "pod install must run once, after all package installs finish -- not immediately after each expo install. Interleaving it left a stale Podfile.lock pointing at a transient node_modules/expo/node_modules/expo-constants path that a later install deduped away, breaking the iOS build with an unrelated-looking 'PrivacyInfo.xcprivacy couldn't be opened' error. Documented as an actionable note for Phase 3's real dependency setup."
  - "JAVA_HOME added to ~/.zshrc (Homebrew's openjdk@17 was installed but not symlinked into /Library/Java), mirroring plan 01-01's precedent of a low-risk, one-line PATH/env export for an already-installed tool (Threat T-01-03, disposition: accept)."
  - "The stock-model test image is the canonical TensorFlow example photo (grace_hopper.jpg, renamed pipeline-test.jpg), not a tree photo -- arbitrary by design, since the plan states the stock model's accuracy is meaningless for this phase regardless of subject."

patterns-established:
  - "When a third-party RN library's Expo config plugin is missing or broken, write a minimal project-local plugin using expo/config-plugins' withInfoPlist/withAndroidManifest rather than hand-editing generated ios/android projects."

requirements-completed: []

coverage:
  - id: D1
    description: "expo prebuild generates working ios/ and android/ projects for the harness from app.json plugin declarations only (no hand-edited generated files), with react-native-fast-tflite and react-native-vision-camera correctly declared and linked"
    verification:
      - kind: other
        ref: "expo prebuild --platform ios && expo prebuild --platform android (both succeeded); ios/Podfile.lock and android manifest show both native modules linked"
        status: pass
    human_judgment: false
  - id: D2
    description: "The native TFLite + VisionCamera integration actually compiles against Expo 57.0.24/RN 0.86.3 on both platforms (the core risk this plan exists to retire)"
    verification:
      - kind: other
        ref: "xcodebuild -workspace ios/deviceharness.xcworkspace -scheme deviceharness -destination 'generic/platform=iOS Simulator' build -> BUILD SUCCEEDED; ./gradlew assembleDebug -> BUILD SUCCESSFUL in 9m 1s, app-debug.apk produced"
        status: pass
    human_judgment: false
  - id: D3
    description: "Model cache path fixed to Paths.document/models/genus_classifier.tflite (D-07) -- loads from an on-device cache path, never require()/bundle"
    verification:
      - kind: other
        ref: "src/modelCache.ts getModelCacheFile(); confirmed on-screen via iOS Simulator smoke test showing the exact resolved file:// path"
        status: pass
    human_judgment: false
  - id: D4
    description: "With no model file present, the harness shows an explicit unavailable message and stays usable (D-08), not a silent failure or crash"
    verification:
      - kind: automated_ui
        ref: "iOS Simulator screenshot (iPhone 17e, iOS 26.5): 'Recognition unavailable -- no model file present...' message rendered with working 'Seed stock model into cache' button"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-hardware proof: a stock TFLite classifier runs on a real iOS device and a real Android device, offline, with latency recorded to a device-attributed CSV (D-05, D-06, D-18)"
    verification: []
    human_judgment: true
    rationale: "No real iOS or Android device was reachable from this machine (paired iPhone shows Offline in xctrace; adb devices returns empty). The code path (src/inference.ts, src/resultsLog.ts) is written and was exercised without crashing in the iOS Simulator smoke test, but simulator timings are explicitly not real-hardware evidence per this plan's own instructions -- a human with physical device access must complete this measurement before the ADR can cite real latency/offline numbers."
  - id: D6
    description: "Nothing under mobile/, api/, or the root package.json/package-lock.json was touched by this plan"
    verification:
      - kind: other
        ref: "git diff --stat -- mobile/ api/ package.json package-lock.json (empty); git status --porcelain spike/ (empty, fully gitignored)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-22
status: complete
---

# Phase 1 Plan 03: Device Harness (TFLite Native Integration Proof) Summary

**Standalone Expo 57/RN 0.86 harness proves `react-native-fast-tflite` + `react-native-vision-camera` compile and link successfully on both iOS (xcodebuild, simulator) and Android (Gradle) -- but the gate reads BUILD-FAILED because no real iOS or Android device was reachable from this machine to complete plan 01-03's required real-hardware run.**

## Performance

- **Duration:** ~50 min (scaffold + native builds + two real integration bugs found and fixed + iOS Simulator smoke test)
- **Completed:** 2026-09-22
- **Tasks:** 2 (both auto, both executed to completion)
- **Files modified:** 0 tracked repo files under `mobile/`/`api/`/root; ~15 files created inside the gitignored `spike/species-recognition/device-harness/` tree; 1 file outside the repo (`~/.zshrc`)

## Accomplishments

- Task 1: Scaffolded a standalone Expo 57.0.24/RN 0.86.3/React 19.2.3 app at `spike/species-recognition/device-harness/` (versions pinned exactly to `.planning/codebase/STACK.md`), installed `react-native-fast-tflite@3.0.1` and `react-native-vision-camera@5.2.3` (both MIT, both OK/Approved per RESEARCH.md's Package Legitimacy Audit, re-verified live against npm at install time), declared them through `app.json`'s `plugins` array, and ran `expo prebuild` + `pod install` for both platforms successfully. `react-native-executorch` was not installed. Discovered mid-task that `react-native-vision-camera@5.2.3` ships no Expo config plugin at all (unlike RESEARCH.md's example), and wrote a project-local plugin (`plugins/with-vision-camera-permissions.js`) to inject the camera permission strings instead -- the same local-plugin pattern this repo already uses for `mobile/plugins/with-scene-delegate.js`.
- Task 2: Wired a minimal inference screen (`App.tsx` + `src/{modelCache,inference,resultsLog,imagenetLabels}.ts`) implementing D-07 (loads from `Paths.document/models/genus_classifier.tflite`, never `require()`), D-08 (explicit "Recognition unavailable" message + stays usable, "Seed stock model" button to simulate a completed first-launch download), D-13 (test image is bundled, never written to disk; no captured frame exists in this harness build since it benchmarks a fixed bundled image rather than live capture), and a device-attributed CSV writer (D-18) with the column order `timestamp,device_model,os_version,model_file_name,model_file_bytes,preprocess_ms,inference_ms,top3_label_indices,top3_scores`. Fetched a stock quantized MobileNetV1 ImageNet classifier (4.28 MB, official `download.tensorflow.org`, SHA-256 recorded in README) as the pipeline-proof model.
- **Real native build proof, both platforms.** `xcodebuild -destination 'generic/platform=iOS Simulator' build` -> `BUILD SUCCEEDED`. `./gradlew assembleDebug` -> `BUILD SUCCESSFUL in 9m 1s`, producing a real debug APK. This directly answers the plan's central risk question -- RESEARCH.md's primary recommendation (`react-native-fast-tflite` + `react-native-vision-camera`) does build against Expo 57.0.24 / RN 0.86.3, without needing the documented ONNX fallback.
- **iOS Simulator smoke test (not real-device evidence, but real due diligence).** Installed the built `.app` on a booted iPhone 17e simulator, started Metro, confirmed the JS bundle built cleanly (760 modules, no bundling errors) and the app rendered correctly: the D-08 unavailable-message screen displayed with the exact expected cache path (`.../Documents/models/genus_classifier.tflite`), confirming `src/modelCache.ts`'s path logic resolves correctly at runtime. Screenshot evidence exists but is not attached to this summary (throwaway artifact).
- Two real native-integration bugs found and fixed along the way (see Deviations) -- exactly the kind of finding this plan exists to surface before measurement day.
- **Final gate: `GATE-HARNESS: BUILD-FAILED`**, `RUNTIME: react-native-fast-tflite@3.0.1`, `RUNTIME-SUBSTITUTION: no`. Per the plan's explicit instruction, real-hardware unreachability on both platforms means the gate cannot read PASS, regardless of build success. This is recorded as a decisive, honest finding, not a failure of this plan's execution -- see `spike/species-recognition/device-harness/GATE` for the full reason text and `README.md` for the complete integration narrative plan 05 reuses for section 8.

## Task Commits

Both tasks modify only files under the gitignored `spike/species-recognition/device-harness/` tree (and one out-of-repo `~/.zshrc` edit) -- per the plan's design (`git status --porcelain spike/` stays empty throughout), **there is nothing to git-commit for either task**. This mirrors plan 01-01's Task 2, which also produced no per-task commit for its gitignored spike-tree work.

1. **Task 1: Build a standalone dev-client harness with the TFLite runtime wired through a config plugin** -- no commit (all changes under gitignored `spike/`)
2. **Task 2: Wire the inference screen and prove the pipeline offline with a stock model** -- no commit (all changes under gitignored `spike/`)

**Plan metadata:** commit follows this SUMMARY (this file + STATE.md/ROADMAP.md/REQUIREMENTS.md updates).

## Files Created/Modified

- `spike/species-recognition/device-harness/app.json` - declares `react-native-fast-tflite` and the local `with-vision-camera-permissions.js` plugin
- `spike/species-recognition/device-harness/metro.config.js` - registers `tflite` as a Metro asset extension (required by `react-native-fast-tflite`'s `require()` loading path)
- `spike/species-recognition/device-harness/plugins/with-vision-camera-permissions.js` - project-local config plugin filling the gap left by vision-camera's missing plugin
- `spike/species-recognition/device-harness/App.tsx` - harness UI: model status, seed/clear buttons, benchmark runner, results display
- `spike/species-recognition/device-harness/src/modelCache.ts` - fixes and owns the D-07 cache path
- `spike/species-recognition/device-harness/src/inference.ts` - decode/resize/normalize + timed inference + top-3 extraction
- `spike/species-recognition/device-harness/src/resultsLog.ts` - device-attributed CSV writer (D-18)
- `spike/species-recognition/device-harness/src/imagenetLabels.ts` - 1001-label stock ImageNet label set (generated from the bundled labels file)
- `spike/species-recognition/device-harness/assets/models/mobilenet_v1_1.0_224_quant.tflite` - stock pipeline-proof model
- `spike/species-recognition/device-harness/assets/test-images/pipeline-test.jpg` - bundled fixed test image
- `spike/species-recognition/device-harness/GATE` - machine-checkable result for plan 05
- `spike/species-recognition/device-harness/README.md` - cache path, CSV shape, and full integration narrative
- `~/.zshrc` (outside repo) - adds `JAVA_HOME` export, same precedent as plan 01-01's `ANDROID_HOME` export

## Decisions Made

See `key-decisions` in the frontmatter for the full list. Summary: the gate reads BUILD-FAILED specifically because of device unreachability, not build failure; a project-local plugin replaced vision-camera's missing one; `pod install` timing relative to package installs matters and is now documented; `JAVA_HOME` was added to the shell profile as a low-risk fix mirroring existing precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-native-vision-camera@5.2.3` has no Expo config plugin**
- **Found during:** Task 1 (`expo prebuild --platform ios` failed immediately)
- **Issue:** RESEARCH.md's Pattern 2 example puts the bare string `"react-native-vision-camera"` in `app.json`'s `plugins` array. `expo prebuild` failed: `No "app.plugin.{js,...}" file was found in "react-native-vision-camera"`. Inspecting the installed package (`node_modules/react-native-vision-camera/package.json`) confirmed no `app.plugin.js`, no plugin export, and its bundled `AndroidManifest.xml` declares only `<uses-feature>` hardware flags, not the runtime `CAMERA` permission.
- **Fix:** Wrote `plugins/with-vision-camera-permissions.js`, a project-local Expo config plugin (using `withInfoPlist`/`withAndroidManifest` from `expo/config-plugins`) that injects `NSCameraUsageDescription` on iOS and the `CAMERA` permission on Android, following the exact pattern `mobile/plugins/with-scene-delegate.js` already establishes for this repo. Native module linking itself (the pod/gradle dependency) is unaffected since that's autolinking, driven by `package.json`, not the `plugins` array.
- **Files modified:** `spike/species-recognition/device-harness/plugins/with-vision-camera-permissions.js`, `app.json` (both gitignored)
- **Verification:** `expo prebuild --platform ios` and `--platform android` both succeeded afterward; `ios/deviceharness/Info.plist` and `android/app/src/main/AndroidManifest.xml` both carry the injected permissions.

**2. [Rule 3 - Blocking] Stale `Podfile.lock` path after interleaved `expo install` calls broke the iOS build**
- **Found during:** Task 2, first `xcodebuild` attempt (after installing `expo-image-manipulator`, `expo-device`, `expo-asset`)
- **Issue:** The first `pod install` (run right after installing the TFLite/camera runtimes) resolved `expo-constants`'s podspec path as `../node_modules/expo/node_modules/expo-constants/ios` -- a nested copy that existed transiently during that specific `npm install` but was gone once later `expo install` calls finished deduping `node_modules`. The build then failed with `The file "PrivacyInfo.xcprivacy" couldn't be opened because there is no such file` -- an error message that points at a resource bundle, not the actual stale-path cause.
- **Fix:** Deleted `ios/Pods` and `ios/Podfile.lock`, re-ran `pod install` once with all package installs already finished. The regenerated lockfile correctly points at `../node_modules/expo-constants/ios`.
- **Files modified:** `spike/species-recognition/device-harness/ios/Podfile.lock`, `ios/Pods/` (regenerated, gitignored)
- **Verification:** `xcodebuild -destination 'generic/platform=iOS Simulator' build` -> `BUILD SUCCEEDED`.

**3. [Rule 3 - Blocking] `JAVA_HOME` unresolved in this shell, blocking the Android build entirely**
- **Found during:** Task 2, first `./gradlew assembleDebug` attempt
- **Issue:** Gradle failed outright ("Unable to locate a Java Runtime") even though Homebrew's `openjdk@17` was already installed -- just not symlinked into `/Library/Java/JavaVirtualMachines`, so macOS's `java_home` lookup found nothing.
- **Fix:** Exported `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` (and prepended its `bin` to `PATH`) in `~/.zshrc`, alongside the `ANDROID_HOME` export plan 01-01 already added there -- same low-risk, one-line PATH/env precedent (Threat T-01-03, disposition: accept).
- **Files modified:** `~/.zshrc` (outside repo)
- **Verification:** `./gradlew assembleDebug` -> `BUILD SUCCESSFUL in 9m 1s`.

---

**Total deviations:** 3 auto-fixed (3 blocking). All three were required to get either build to compile at all; none touched production workspaces or expanded scope beyond making the primary recommended runtime build successfully.
**Impact on plan:** No scope creep. All three fixes are exactly the class of finding this plan exists to surface before measurement day, and all three are written up in `README.md`'s integration narrative for plan 05/section 8 and the eventual ADR.

## Issues Encountered

- **No real device reachable.** `xcrun xctrace list devices` shows the one paired iPhone as `Offline` (not currently connected/trusted); `adb devices` returns an empty list even with `ANDROID_HOME`/`adb` correctly resolved. This is the one blocker this plan's own critical guidance anticipated explicitly ("If no real device is reachable from this machine, say so plainly in the gate"). Both native builds compile and produce real installable artifacts (`android/app/build/outputs/apk/debug/app-debug.apk`, `/tmp/dh-build-ios/Build/Products/Debug-iphonesimulator/deviceharness.app`), and the app was smoke-tested on the iOS Simulator to confirm it doesn't crash and the D-08 unavailable-state logic is correct -- but neither of those substitutes for the real-hardware run D-18 requires. **This blocks plan 05's real-latency measurement day** until a real iOS device is connected/trusted and a real Android device is connected via USB debugging.

## User Setup Required

**A physical device connection is required before plan 05 can proceed.** Specifically:
- **iOS:** Connect and trust an iPhone (or iPad) via USB/Wi-Fi so `xcrun xctrace list devices` shows it under `== Devices ==` rather than `== Devices Offline ==`, and install the harness with `npx expo run:ios --device`.
- **Android:** Connect an Android phone with USB debugging enabled so `adb devices` lists it, and install with `npx expo run:android --device` (or `adb install android/app/build/outputs/apk/debug/app-debug.apk`).
- Per plan 01-01's provisional D-18 answer, prefer the lowest-spec real device available on each platform (iPhone SE 2nd/3rd gen or iPhone 11 class; a 2022-2023 mid-range Android) over whatever is most convenient, per RESEARCH.md Pitfall 4.
- No external service configuration required -- this is a local hardware-availability gap, not a credentials/environment gap.

## Next Phase Readiness

- **Blocked for plan 05 (device latency measurement day)** until a real iOS device and a real Android device are reachable from a development machine. The harness code, model cache path, CSV format, and both native build artifacts are ready and require no further engineering work -- only a device connection.
- The two integration pitfalls found here (vision-camera's missing config plugin; `pod install` ordering relative to `expo install`) are exactly the class of Phase-3-relevant finding RESEARCH.md's Package Legitimacy Audit and Common Pitfalls section anticipated; both are written up in `README.md` for plan 05/section 8 and should be cited directly in the ADR's implementation-cost estimate for Phase 3.
- `GATE-HARNESS: BUILD-FAILED` (device-unreachable, not build-failure) is the authoritative signal for plan 05: per the plan's own instruction, plan 05 must not schedule a measurement day on the assumption of a working harness until a device becomes available and this gate is re-run to `PASS`.
- The `react-native-fast-tflite` New Architecture compatibility caveat from `npx expo-doctor` (package listed "Untested on New Architecture" in React Native Directory metadata, despite being Nitro-Modules/JSI-based and therefore New-Architecture-native by construction) is a minor, non-blocking note worth one line in the eventual ADR.

---
*Phase: 01-species-recognition-approach-decision*
*Completed: 2026-09-22*

## Self-Check: PASSED

All claimed files found on disk: `app.json`, `metro.config.js`, `plugins/with-vision-camera-permissions.js`,
`App.tsx`, `src/{modelCache,inference,resultsLog,imagenetLabels}.ts`, the bundled stock model and
test image, `GATE`, `README.md`, `ios/Podfile.lock`, and the built
`android/app/build/outputs/apk/debug/app-debug.apk` (all under the gitignored
`spike/species-recognition/device-harness/` tree), this SUMMARY.md, and the `JAVA_HOME` export in
`~/.zshrc`. No task commits to verify -- both tasks modified only gitignored files, as documented
in Task Commits above.
