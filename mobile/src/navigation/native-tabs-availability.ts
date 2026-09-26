import { Platform } from "react-native"
import Constants, { ExecutionEnvironment } from "expo-constants"

/**
 * Chooses between the native iOS tab bar (react-native-bottom-tabs) and the JS
 * fallback (phase 01.9-25, D-08 and C-7), and says why.
 *
 * - `platform`: not iOS; Android keeps the JS bar (owner decision).
 * - `expo-go`: Expo Go has no RNCTabView native view.
 * - `env-opt-out`: `EXPO_PUBLIC_ENABLE_NATIVE_TABS=false` in a dev build.
 * - `ok`: native tabs.
 *
 * A Release build ignores the env opt-out (`envOptOutIgnored` is then true),
 * so a leftover debug line in `mobile/.env`, inlined into the bundle at build
 * time, can no longer put the JS bar on an iPhone Release build.
 */
export type NativeTabsReason = "ok" | "platform" | "expo-go" | "env-opt-out"

export type NativeTabsAvailability = {
  native: boolean
  reason: NativeTabsReason
  envOptOutIgnored: boolean
}

export type NativeTabsAvailabilityInput = {
  platformOS?: string
  envOptOut?: boolean
  executionEnvironment?: string
  appOwnership?: string | null
  isDev?: boolean
}

export function getNativeTabsAvailability({
  platformOS = Platform.OS,
  envOptOut = process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS === "false",
  executionEnvironment = Constants.executionEnvironment,
  appOwnership = Constants.appOwnership,
  isDev = __DEV__,
}: NativeTabsAvailabilityInput = {}): NativeTabsAvailability {
  if (platformOS !== "ios") {
    return { native: false, reason: "platform", envOptOutIgnored: false }
  }
  if (executionEnvironment === ExecutionEnvironment.StoreClient || appOwnership === "expo") {
    return { native: false, reason: "expo-go", envOptOutIgnored: false }
  }
  if (envOptOut && isDev) {
    return { native: false, reason: "env-opt-out", envOptOutIgnored: false }
  }
  return { native: true, reason: "ok", envOptOutIgnored: envOptOut }
}
