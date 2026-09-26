import { useEffect, useState } from "react"
import { Platform, StatusBar } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import Constants, { ExecutionEnvironment } from "expo-constants"
import { PublicMapReloadContext, createPublicMapReloadSignal } from "./public-map-reload"
import { JsRootTabs } from "./tabs/JsRootTabs"
import { NativeRootTabs } from "./tabs/NativeRootTabs"

/*
 * The navigation tree (phase 01.9-18 and 01.9-24, D-01 and D-04). One
 * NavigationContainer holds either the native (iOS) or the JS root tabs. The
 * tree passes no data: every screen is a route component under routes/ that
 * reads its own contexts, and the tree itself reads only stable action objects
 * and the session (for the isAuthenticated check in the tab listeners).
 *
 * Layout: tab-config.tsx (icons, titles, options, listeners), tabs/ (the two
 * root tab navigators), stacks/ (one stack navigator per tab), routes/ (the
 * screens), types.ts (param lists and the global RootParamList).
 */

// ─── Native availability detection ───────────────────────────────────────────

function isNativeBottomTabViewAvailable(): boolean {
  if (Platform.OS !== "ios") return false
  // Opt-out via env var (set EXPO_PUBLIC_ENABLE_NATIVE_TABS=false to force JS tabs)
  if (process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS === "false") return false
  return (
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    Constants.appOwnership !== "expo"
  )
}

// ─── Root (single NavigationContainer) ───────────────────────────────────────

function AppTabs() {
  const nativeBottomTabsAvailable = isNativeBottomTabViewAvailable()

  useEffect(() => {
    if (!nativeBottomTabsAvailable) {
      console.warn(
        "RNCTabView unavailable — falling back to JS tabs (Expo Go or native binary not built yet).",
      )
    }
  }, [nativeBottomTabsAvailable])

  return (
    <>
      <StatusBar barStyle={Platform.OS === "android" ? "dark-content" : "light-content"} />
      {nativeBottomTabsAvailable ? <NativeRootTabs /> : <JsRootTabs />}
    </>
  )
}

export function AppNavigation() {
  const [publicMapReload] = useState(createPublicMapReloadSignal)

  return (
    <PublicMapReloadContext.Provider value={publicMapReload}>
      <NavigationContainer>
        <AppTabs />
      </NavigationContainer>
    </PublicMapReloadContext.Provider>
  )
}
