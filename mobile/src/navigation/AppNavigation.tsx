import { useCallback, useEffect, useState } from "react"
import { Platform, StatusBar } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { getNativeTabsAvailability, type NativeTabsAvailability } from "./native-tabs-availability"
import { PublicMapReloadContext, createPublicMapReloadSignal } from "./public-map-reload"
import { getFocusedLeafRouteName, shouldHideTabBar, type NavigationStateLike } from "./tab-bar"
import { JsRootTabs } from "./tabs/JsRootTabs"
import { NativeRootTabs } from "./tabs/NativeRootTabs"

/*
 * The navigation tree (phase 01.9-18 and 01.9-24, D-01 and D-04). One
 * NavigationContainer holds either the native (iOS) or the JS root tabs. The
 * tree passes no data: every screen is a route component under routes/ that
 * reads its own contexts, and the tree itself reads only stable action objects
 * and the session (for the isAuthenticated check in the tab listeners).
 *
 * Tabs (01.9-25, D-08): four tabs; the native tree is chosen by
 * native-tabs-availability.ts and the tab bar hides by the tab-bar.ts rule.
 *
 * Layout: tab-config.tsx (icons, titles, options, listeners), tabs/ (the two
 * root tab navigators), stacks/ (one stack navigator per tab), routes/ (the
 * screens), types.ts (param lists and the global RootParamList).
 */

// ─── Root (single NavigationContainer) ───────────────────────────────────────

function AppTabs({
  availability,
  tabBarHidden,
}: {
  availability: NativeTabsAvailability
  tabBarHidden: boolean
}) {
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
      {availability.native ? <NativeRootTabs tabBarHidden={tabBarHidden} /> : <JsRootTabs />}
    </>
  )
}

export function AppNavigation() {
  const [publicMapReload] = useState(createPublicMapReloadSignal)
  // Decided once per mount: the inputs are fixed for the lifetime of the bundle.
  const [availability] = useState(() => getNativeTabsAvailability())
  // The native tab bar can only be hidden at the navigator level, so the
  // focused leaf route is tracked here (D-13). The boolean state only changes
  // when entering or leaving a route without a tab bar, so ordinary navigation
  // does not re-render the tabs. The JS tree hides its bar per screen instead.
  const [tabBarHidden, setTabBarHidden] = useState(false)
  const onStateChange = useCallback((state: NavigationStateLike | undefined) => {
    setTabBarHidden(shouldHideTabBar(getFocusedLeafRouteName(state)))
  }, [])

  return (
    <PublicMapReloadContext.Provider value={publicMapReload}>
      <NavigationContainer onStateChange={availability.native ? onStateChange : undefined}>
        <AppTabs availability={availability} tabBarHidden={tabBarHidden} />
      </NavigationContainer>
    </PublicMapReloadContext.Provider>
  )
}
