import { getFocusedRouteNameFromRoute } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { AccountTabNavigator } from "../stacks/AccountStack"
import { HomeTabNavigator } from "../stacks/HomeStack"
import { PublicMapTabNavigator } from "../stacks/PublicMapStack"
import { SurveysTabNavigator } from "../stacks/SurveysStack"
import {
  TAB_TITLES,
  jsTabScreenOptions,
  makeAccountTabListeners,
  makePublicMapTabListeners,
  makeSurveysTabListeners,
  useTabListenerDeps,
} from "../tab-config"
import type { RootTabParamList } from "../types"

const JsTab = createBottomTabNavigator<RootTabParamList>()

/** The JS tab bar from @react-navigation/bottom-tabs (Android, Expo Go fallback). */
export function JsRootTabs() {
  const deps = useTabListenerDeps()

  return (
    <JsTab.Navigator screenOptions={jsTabScreenOptions}>
      <JsTab.Screen name="home" options={{ headerShown: false }}>
        {() => <HomeTabNavigator />}
      </JsTab.Screen>
      <JsTab.Screen
        name="surveys"
        options={({ route }) => ({
          tabBarLabel: TAB_TITLES.surveys,
          headerShown: false,
          tabBarStyle:
            getFocusedRouteNameFromRoute(route) === "surveyParcels"
              ? { display: "none" }
              : undefined,
        })}
        listeners={makeSurveysTabListeners(deps)}
      >
        {() => <SurveysTabNavigator />}
      </JsTab.Screen>
      <JsTab.Screen
        name="publicMap"
        options={{ headerShown: false }}
        listeners={makePublicMapTabListeners(deps)}
      >
        {() => <PublicMapTabNavigator />}
      </JsTab.Screen>
      <JsTab.Screen
        name="account"
        options={{ headerShown: false }}
        listeners={makeAccountTabListeners(deps)}
      >
        {() => <AccountTabNavigator />}
      </JsTab.Screen>
    </JsTab.Navigator>
  )
}
