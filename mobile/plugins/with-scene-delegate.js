/**
 * Adopts the UIKit scene-based life cycle.
 *
 * iOS 26 and later terminate at launch any app built against the new SDK that
 * does not adopt it. Expo ships `ExpoAppSceneDelegate`, which implements the
 * scene life cycle and starts React Native from the connecting scene, but
 * SDK 57 does not yet wire it into the generated AppDelegate — so we do.
 *
 * This lives in a config plugin rather than in a hand-edited AppDelegate.swift
 * because `expo prebuild` regenerates that file from its own template and
 * silently discards manual changes.
 *
 * The scene manifest that points at the class below is declared in app.json
 * under `ios.infoPlist`.
 */
const { withAppDelegate } = require("expo/config-plugins")

const PROTOCOL = "ExpoReactNativeFactoryProvider"

const WINDOW_BOOTSTRAP =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\n/

const SCENE_DELEGATE = `
/// Concrete class for Info.plist's UISceneDelegateClassName to point at.
/// Everything is inherited: ExpoAppSceneDelegate builds the window from the
/// connecting UIWindowScene, starts React Native into it, and forwards scene,
/// URL and user-activity events back to the app delegate.
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {}
`

module.exports = function withSceneDelegate(config) {
  return withAppDelegate(config, (config) => {
    let src = config.modResults.contents

    if (src.includes("class SceneDelegate")) {
      return config
    }

    // The app delegate must expose its React Native factory to the scene.
    const declaration = "class AppDelegate: ExpoAppDelegate {"
    if (!src.includes(declaration)) {
      throw new Error(
        `with-scene-delegate: expected "${declaration}" in AppDelegate.swift. ` +
          "The Expo template changed — review the plugin before building.",
      )
    }
    src = src.replace(declaration, `class AppDelegate: ExpoAppDelegate, ${PROTOCOL} {`)

    // The scene owns the window now; creating one here leaves an orphan that
    // UIKit never displays.
    if (!WINDOW_BOOTSTRAP.test(src)) {
      throw new Error(
        "with-scene-delegate: could not find the window bootstrap to remove in " +
          "AppDelegate.swift. The Expo template changed — review the plugin before building.",
      )
    }
    src = src.replace(
      WINDOW_BOOTSTRAP,
      "    // The window is created by SceneDelegate, under the scene life cycle.\n",
    )

    config.modResults.contents = src + SCENE_DELEGATE
    return config
  })
}
