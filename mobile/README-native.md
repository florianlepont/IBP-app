# Native projects

`ios/` and `android/` are **not committed**. They are generated from
`app.json`, the config plugins and the installed Expo packages.

## Why

Committing them froze the project on the template of the SDK it was created
with. Expo's platform fixes never arrived, so each iOS and Android release
had to be absorbed by hand. Three local patches existed for that reason alone,
and the SDK 57 upgrade deleted all three in one go:

- a patch rewriting `react-native-bottom-tabs`' Swift source for the iOS 26
  tab bar — now upstream
- a Podfile hook raising pod deployment targets above Xcode 27's floor — now
  unnecessary, the template targets iOS 16.4
- a duplicate `expo-font`, from `@expo/vector-icons` no longer being implicit

Worse, editing the generated files does not work: `expo prebuild` overwrites
them without warning. That is how the scene-delegate wiring was lost once
before becoming a plugin.

## Generating them

```bash
cd mobile
npx expo prebuild            # both platforms
npx expo prebuild --clean    # discard and regenerate from scratch
```

`npx expo run:ios` and `npx expo run:android` do it on their own when the
directories are missing.

For iOS, install the pods afterwards:

```bash
cd ios && pod install
```

## Changing something native

Express it in `app.json`, or write a config plugin under `mobile/plugins/`.
Never edit `ios/` or `android/` directly — the change works until the next
prebuild, then vanishes.

`plugins/with-scene-delegate.js` is the worked example: it adopts the UIKit
scene life cycle, and throws if the Expo template it patches changes shape, so
a stale plugin fails the build instead of shipping a broken app.

## What is no longer pinned

`Podfile.lock` is not committed, so pod versions follow the Podfile rather
than a lockfile. That is the accepted trade-off of generated native projects:
the versions are determined by the Expo SDK, which *is* pinned in
`package.json`.

## Native builds in CI

Because nothing native is committed, two CI jobs regenerate and compile the
projects on every relevant change (`.github/workflows/ci.yml`):

- **Native build — Android** (`native-android`, Ubuntu): `npx expo prebuild -p
  android --clean`, then `./gradlew assembleRelease` with Java 17. The Expo
  template signs the release variant with the debug keystore, so the APK is not
  publishable, but the whole release pipeline (JS bundle, R8 settings, native
  modules) is compiled.
- **Native build — iOS** (`native-ios`, macOS 26): `npx expo prebuild -p ios
  --clean`, which also runs `pod install`, then `xcodebuild` of the Release
  configuration for the iOS Simulator with `CODE_SIGNING_ALLOWED=NO`.

No signing key, certificate or secret is used. The `EXPO_PUBLIC_*` variables are
dummy values (`https://ci.invalid/...`); the resulting apps are never run.

The jobs run when a pull request or a push to `main` touches `mobile/**`, the
root `package.json` or `package-lock.json`, or `.github/workflows/ci.yml`.
They are part of **CI OK**, which accepts them as passed or skipped. To start
them by hand, open Actions → CI → Run workflow and pick the branch.

CI proves that the native projects build. It does not prove how the app looks
or behaves: the tab bar after login (native liquid-glass bar on iPhone, 4 tabs)
still needs a Release build on a device.

## Native tabs

The app has four root tabs: **Accueil**, **Mes Relevés**, **Explorer** and
**Compte**. There is no separate search tab. On iPhone, search is the native
search bar in the header of Mes Relevés. Elsewhere, Mes Relevés shows an inline
search field.

Two tab bars exist:

- **Native** (`react-native-bottom-tabs`): the iOS liquid-glass bar.
- **JS** (`@react-navigation/bottom-tabs`): Android, Expo Go, and the dev
  opt-out.

### Which bar, and why

`getNativeTabsAvailability()` in
`src/navigation/native-tabs-availability.ts` decides once per app start and
returns a reason code. The checks run in this order:

| Code | When | Bar |
|---|---|---|
| `platform` | Not iOS (Android keeps the JS bar) | JS |
| `expo-go` | Running in Expo Go (`executionEnvironment` is `StoreClient` or `appOwnership` is `"expo"`), which has no `RNCTabView` native view | JS |
| `env-opt-out` | `EXPO_PUBLIC_ENABLE_NATIVE_TABS=false` **and** a dev build (`__DEV__`) | JS |
| `ok` | Any other iOS native build | Native |

### Where the log appears

`AppNavigation` logs the decision once. For a dev build it appears in the Metro
terminal. For a Release build it appears in the Xcode console, or in
Console.app filtered on the device.

- On a fallback: `[tabs] native=false reason=<code>` (`console.warn`).
- When a Release build ignored the opt-out:
  `[tabs] native=true reason=ok (EXPO_PUBLIC_ENABLE_NATIVE_TABS=false ignored in Release)`
  (`console.info`).

### The dev-only opt-out

`EXPO_PUBLIC_ENABLE_NATIVE_TABS=false` now only applies to dev builds, where it
helps to compare both bars while debugging. A Release build on iPhone always
uses the native bar.

This rule comes from the old Release fallback. The Release build showed the JS
bar, and the most likely cause was a leftover
`EXPO_PUBLIC_ENABLE_NATIVE_TABS=false` line in the local, untracked
`mobile/.env`. It had been set while debugging blank tabs after the SDK 57
upgrade (#119). `EXPO_PUBLIC_*` values are inlined into the JS bundle at build
time, so every later build from that checkout, Release included, took the JS
branch. The old warning blamed a missing native binary instead. If you set the
variable for debugging, remove it afterwards.

### Hiding the bar

Both trees share one rule, `shouldHideTabBar(focusedRouteName)` in
`src/navigation/tab-bar.ts`: the bar is hidden on parcel selection
(`surveyParcels`) and shown everywhere else.

- **JS tree:** applied per screen through `tabBarStyle` (`display: "none"`).
- **Native tree:** `react-native-bottom-tabs` only has a navigator-level
  `tabBarHidden`, so `AppNavigation` tracks the focused leaf route
  (`getFocusedLeafRouteName`) and passes the result to the navigator.

To hide the bar on another screen, add its route name to
`ROUTES_WITHOUT_TAB_BAR` in `tab-bar.ts`. Both trees follow.
