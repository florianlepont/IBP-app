import { useRef, type ElementType } from "react"
import { AccountTabNavigator } from "../stacks/AccountStack"
import { HomeTabNavigator } from "../stacks/HomeStack"
import { PublicMapTabNavigator } from "../stacks/PublicMapStack"
import { SurveysTabNavigator } from "../stacks/SurveysStack"
import {
  makeAccountTabListeners,
  makePublicMapTabListeners,
  makeSurveysTabListeners,
  nativeTabScreenOptions,
  useTabListenerDeps,
} from "../tab-config"
import type { RootTabParamList } from "../types"

type TabNavigatorLike = {
  Navigator: ElementType
  Screen: ElementType
}

function getNativeTabNavigator(): TabNavigatorLike {
  // Keep the native tabs package out of module initialization so unsupported
  // runtimes can still boot and fall back cleanly.
  /* eslint-disable @typescript-eslint/no-var-requires */
  const nativeBottomTabsModule =
    require("@bottom-tabs/react-navigation") as typeof import("@bottom-tabs/react-navigation")
  /* eslint-enable @typescript-eslint/no-var-requires */
  return nativeBottomTabsModule.createNativeBottomTabNavigator<RootTabParamList>() as TabNavigatorLike
}

// The native surveys stack: same screens, native header with the search bar.
function NativeSurveysTab() {
  return <SurveysTabNavigator useNativeNav />
}

type NativeRootTabsProps = {
  /**
   * `@bottom-tabs/react-navigation` has no per-screen hide option, only this
   * navigator-level flag, so AppNavigation computes it from the focused leaf
   * route with the rule shared with the JS tree (D-13, tab-bar.ts).
   */
  tabBarHidden?: boolean
}

/**
 * The native (iOS) tab bar from react-native-bottom-tabs: four tabs. Search
 * is the native header search bar of Mes Relevés, not a tab (D-08).
 */
export function NativeRootTabs({ tabBarHidden = false }: NativeRootTabsProps) {
  const deps = useTabListenerDeps()
  const nativeTabRef = useRef<TabNavigatorLike | null>(null)

  if (nativeTabRef.current == null) {
    nativeTabRef.current = getNativeTabNavigator()
  }

  const NativeTab = nativeTabRef.current

  return (
    <NativeTab.Navigator
      screenOptions={nativeTabScreenOptions}
      minimizeBehavior="automatic"
      tabBarHidden={tabBarHidden}
    >
      <NativeTab.Screen name="home" component={HomeTabNavigator} />
      <NativeTab.Screen
        name="surveys"
        listeners={makeSurveysTabListeners(deps)}
        component={NativeSurveysTab}
      />
      <NativeTab.Screen
        name="publicMap"
        listeners={makePublicMapTabListeners(deps)}
        component={PublicMapTabNavigator}
      />
      <NativeTab.Screen
        name="account"
        listeners={makeAccountTabListeners(deps)}
        component={AccountTabNavigator}
      />
    </NativeTab.Navigator>
  )
}
