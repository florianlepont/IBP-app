import { getFocusedRouteNameFromRoute } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { AccountTabNavigator } from "../stacks/AccountStack"
import { HomeTabNavigator } from "../stacks/HomeStack"
import { PublicMapTabNavigator } from "../stacks/PublicMapStack"
import { SurveysTabNavigator } from "../stacks/SurveysStack"
import { shouldHideTabBar } from "../tab-bar"
import {
  JS_TAB_BAR_STYLE,
  TAB_TITLES,
  jsTabScreenOptions,
  makeAccountTabListeners,
  makePublicMapTabListeners,
  makeSurveysTabListeners,
  useTabListenerDeps,
} from "../tab-config"
import type { RootTabParamList } from "../types"

const JsTab = createBottomTabNavigator<RootTabParamList>()

/**
 * The JS tab bar from @react-navigation/bottom-tabs (Android, Expo Go
 * fallback). Four tabs; the bar is hidden on parcel selection through the rule
 * shared with the native tree (D-08, D-13).
 */
export function JsRootTabs() {
  const deps = useTabListenerDeps()

  return (
    <JsTab.Navigator screenOptions={jsTabScreenOptions}>
      <JsTab.Screen name="home" options={{ headerShown: false }} component={HomeTabNavigator} />
      <JsTab.Screen
        name="surveys"
        options={({ route }) => ({
          tabBarLabel: TAB_TITLES.surveys,
          headerShown: false,
          tabBarStyle: shouldHideTabBar(getFocusedRouteNameFromRoute(route))
            ? { display: "none" as const }
            : JS_TAB_BAR_STYLE,
        })}
        listeners={makeSurveysTabListeners(deps)}
        component={SurveysTabNavigator}
      />
      <JsTab.Screen
        name="publicMap"
        options={{ headerShown: false }}
        listeners={makePublicMapTabListeners(deps)}
        component={PublicMapTabNavigator}
      />
      <JsTab.Screen
        name="account"
        options={{ headerShown: false }}
        listeners={makeAccountTabListeners(deps)}
        component={AccountTabNavigator}
      />
    </JsTab.Navigator>
  )
}
