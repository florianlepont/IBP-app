import { useEffect, useState } from "react"
import { Platform, StatusBar } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { getNativeTabsAvailability } from "./native-tabs-availability"
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

// ─── Root (single NavigationContainer) ───────────────────────────────────────

function AppTabs() {
  // Decided once per mount: the inputs are fixed for the lifetime of the bundle.
  const [availability] = useState(() => getNativeTabsAvailability())

  useEffect(() => {
    if (!availability.native) {
      console.warn(`[tabs] native=false reason=${availability.reason}`)
    } else if (availability.envOptOutIgnored) {
      console.info(
        "[tabs] native=true reason=ok (EXPO_PUBLIC_ENABLE_NATIVE_TABS=false ignored in Release)",
      )
    }
  }, [availability])

  return (
    <>
      <StatusBar barStyle={Platform.OS === "android" ? "dark-content" : "light-content"} />
      {availability.native ? <NativeRootTabs /> : <JsRootTabs />}
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
