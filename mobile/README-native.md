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
