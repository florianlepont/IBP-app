import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import path from "node:path"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolve the package location — handles both local and hoisted workspace setups
const packageJsonPath = require.resolve("react-native-bottom-tabs/package.json", {
  paths: [scriptDir],
})
const packageDir = path.dirname(packageJsonPath)
const targetPath = path.join(packageDir, "ios/TabViewImpl.swift")

const source = readFileSync(targetPath, "utf8")

if (source.includes("shouldUseSystemTabBarAppearance")) {
  process.exit(0)
}

const updated = source
  .replace(
    `    tabBar.isHidden = props.tabBarHidden

    if props.scrollEdgeAppearance == "transparent" {`,
    `    tabBar.isHidden = props.tabBarHidden

    if #available(iOS 26.0, *), shouldUseSystemTabBarAppearance(props: props) {
      return
    }

    if props.scrollEdgeAppearance == "transparent" {`,
  )
  .replace(
    `#if !os(macOS)
  private func configureTransparentAppearance(tabBar: UITabBar, props: TabViewProps) {`,
    `#if !os(macOS)
  private func shouldUseSystemTabBarAppearance(props: TabViewProps) -> Bool {
    props.barTintColor == nil &&
      props.selectedActiveTintColor == nil &&
      props.inactiveTintColor == nil &&
      props.fontSize == nil &&
      props.fontFamily == nil &&
      props.fontWeight == nil &&
      props.translucent
  }

  private func configureTransparentAppearance(tabBar: UITabBar, props: TabViewProps) {`,
  )

if (updated === source) {
  throw new Error("Failed to apply react-native-bottom-tabs Liquid Glass patch")
}

writeFileSync(targetPath, updated)
console.log("Patched react-native-bottom-tabs for iOS 26 system tab bar appearance")
