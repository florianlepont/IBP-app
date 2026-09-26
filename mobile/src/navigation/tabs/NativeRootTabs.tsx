import { useRef, type ElementType } from "react"
import { Platform } from "react-native"
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

/** The native (iOS) tab bar from react-native-bottom-tabs. */
export function NativeRootTabs() {
  const deps = useTabListenerDeps()
  const nativeTabRef = useRef<TabNavigatorLike | null>(null)

  if (nativeTabRef.current == null) {
    nativeTabRef.current = getNativeTabNavigator()
  }

  const NativeTab = nativeTabRef.current

  return (
    <NativeTab.Navigator screenOptions={nativeTabScreenOptions} minimizeBehavior="automatic">
      <NativeTab.Screen name="home">{() => <HomeTabNavigator />}</NativeTab.Screen>
      <NativeTab.Screen name="surveys" listeners={makeSurveysTabListeners(deps)}>
        {() => <SurveysTabNavigator useNativeNav />}
      </NativeTab.Screen>
      {Platform.OS === "ios" ? (
        <NativeTab.Screen
          name="search"
          options={{ role: "search" as const }}
          listeners={makeSurveysTabListeners(deps)}
        >
          {() => <SurveysTabNavigator useNativeNav searchEntry />}
        </NativeTab.Screen>
      ) : null}
      <NativeTab.Screen name="publicMap" listeners={makePublicMapTabListeners(deps)}>
        {() => <PublicMapTabNavigator />}
      </NativeTab.Screen>
      <NativeTab.Screen name="account" listeners={makeAccountTabListeners(deps)}>
        {() => <AccountTabNavigator />}
      </NativeTab.Screen>
    </NativeTab.Navigator>
  )
}
