import { useContext, useEffect, useRef, useState, type ElementType } from "react"
import { Platform, Pressable, StatusBar, View } from "react-native"
import { NavigationContainer, getFocusedRouteNameFromRoute } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import Constants, { ExecutionEnvironment } from "expo-constants"
import { brandColors } from "./brand-tokens"
import { styles } from "./styles"
import {
  PublicMapReloadContext,
  createPublicMapReloadSignal,
  type PublicMapReloadSignal,
} from "../navigation/public-map-reload"
import { AccountRoute } from "../navigation/routes/AccountRoute"
import { FactorDetailRoute } from "../navigation/routes/FactorDetailRoute"
import { HomeRoute } from "../navigation/routes/HomeRoute"
import { ParcelSelectionRoute } from "../navigation/routes/ParcelSelectionRoute"
import { PublicMapRoute } from "../navigation/routes/PublicMapRoute"
import { SettingsRoute } from "../navigation/routes/SettingsRoute"
import { SurveyDetailRoute } from "../navigation/routes/SurveyDetailRoute"
import { SurveyFormRoute } from "../navigation/routes/SurveyFormRoute"
import { SurveyListRoute } from "../navigation/routes/SurveyListRoute"
import type {
  AccountStackParamList,
  HomeStackParamList,
  PublicMapStackParamList,
  RootTabParamList,
  SurveysStackParamList,
} from "../navigation/types"
import { useSession, type SessionActions } from "../state/session-context"
import { useSurveyActions } from "../state/surveys-context"
import { useSyncActions } from "../state/sync-actions-context"

/*
 * The navigation tree (phase 01.9-18, D-01). It holds the navigators, their
 * options and the tab listeners, and passes no data: every screen is a route
 * component under src/navigation/routes/ that reads its own contexts. The tree
 * itself reads only stable action objects and the session (for the
 * isAuthenticated check in the listeners), so a status update, a keystroke or
 * a list refresh never re-renders it. Plan 01.9-24 moves it into
 * src/navigation/.
 */

// ─── Navigators ──────────────────────────────────────────────────────────────

const JsTab = createBottomTabNavigator<RootTabParamList>()
const HomeStack = createNativeStackNavigator<HomeStackParamList>()
const AccountStack = createNativeStackNavigator<AccountStackParamList>()
const SurveysStack = createNativeStackNavigator<SurveysStackParamList>()
const PublicMapStack = createNativeStackNavigator<PublicMapStackParamList>()

type TabNavigatorLike = {
  Navigator: ElementType
  Screen: ElementType
}

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

function getNativeTabNavigator(): TabNavigatorLike {
  // Keep the native tabs package out of module initialization so unsupported
  // runtimes can still boot and fall back cleanly.
  /* eslint-disable @typescript-eslint/no-var-requires */
  const nativeBottomTabsModule =
    require("@bottom-tabs/react-navigation") as typeof import("@bottom-tabs/react-navigation")
  /* eslint-enable @typescript-eslint/no-var-requires */
  return nativeBottomTabsModule.createNativeBottomTabNavigator<RootTabParamList>() as TabNavigatorLike
}

// ─── Shared stack screen options ─────────────────────────────────────────────

const baseStackScreenOptions = {
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: brandColors.canvas },
  ...(Platform.OS === "ios"
    ? {
        headerTransparent: true,
        headerBlurEffect: "systemMaterial" as const,
      }
    : {
        headerStyle: { backgroundColor: brandColors.canvas },
        headerShadowVisible: false,
        headerTintColor: brandColors.forest,
        headerTitleStyle: {
          color: brandColors.forest,
          fontSize: 18,
          fontWeight: "800" as const,
        },
      }),
}

// ─── Native tab icons ─────────────────────────────────────────────────────────

const IOS_TAB_ICONS = {
  home: {
    focused: { sfSymbol: "house.fill" },
    unfocused: { sfSymbol: "house" },
  },
  surveys: {
    focused: { sfSymbol: "list.bullet.clipboard.fill" },
    unfocused: { sfSymbol: "list.bullet.clipboard" },
  },
  search: {
    focused: { sfSymbol: "magnifyingglass" },
    unfocused: { sfSymbol: "magnifyingglass" },
  },
  publicMap: {
    focused: { sfSymbol: "map.fill" },
    unfocused: { sfSymbol: "map" },
  },
  account: {
    focused: { sfSymbol: "person.crop.circle.fill" },
    unfocused: { sfSymbol: "person.crop.circle" },
  },
} as const

const ANDROID_TAB_ICONS = {
  home: require("../../assets/tabs/surveys.png"),
  surveys: require("../../assets/tabs/surveys.png"),
  search: require("../../assets/tabs/surveys.png"),
  publicMap: require("../../assets/tabs/public-map.png"),
  account: require("../../assets/tabs/account.png"),
} as const

const TAB_TITLES: Record<keyof RootTabParamList, string> = {
  home: "Accueil",
  surveys: "Mes Relevés",
  search: "Recherche",
  publicMap: "Explorer",
  account: "Compte",
}

const JS_TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  surveys: "list-outline",
  search: "search-outline",
  publicMap: "map-outline",
  account: "person-outline",
}

// ─── Native tab screen options ────────────────────────────────────────────────

const nativeTabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  title: TAB_TITLES[route.name],
  tabBarActiveTintColor: brandColors.forest,
  tabBarIcon: ({ focused }: { focused: boolean }) => {
    if (Platform.OS === "ios") {
      return focused ? IOS_TAB_ICONS[route.name].focused : IOS_TAB_ICONS[route.name].unfocused
    }
    return ANDROID_TAB_ICONS[route.name]
  },
})

// ─── JS tab screen options (Expo Go fallback) ─────────────────────────────────

const jsTabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  headerShown: false,
  title: TAB_TITLES[route.name],
  tabBarLabel: TAB_TITLES[route.name],
  tabBarActiveTintColor: brandColors.forest,
  tabBarInactiveTintColor: brandColors.textSecondary,
  tabBarStyle: {
    backgroundColor: brandColors.panel,
    borderTopColor: brandColors.divider,
    borderTopWidth: 1,
    height: Platform.select({ ios: 84, default: 68 }),
    paddingBottom: Platform.select({ ios: 22, default: 10 }),
    paddingTop: Platform.select({ ios: 8, default: 6 }),
  },
  tabBarLabelStyle: { fontSize: 12, fontWeight: "600" as const },
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={JS_TAB_ICONS[route.name]} size={size} color={color} />
  ),
})

// ─── Shared tab listeners ─────────────────────────────────────────────────────

type TabListenerDeps = {
  isAuthenticated: boolean
  handlePullChanges: () => Promise<void>
  handleLoadMyProfile: SessionActions["handleLoadMyProfile"]
  closeSurveyDetailSelection: () => void
  publicMapReload: PublicMapReloadSignal
}

function makeSurveysTabListeners({ isAuthenticated, handlePullChanges }: TabListenerDeps) {
  return {
    tabPress: () => {
      if (isAuthenticated) {
        void handlePullChanges()
      }
    },
  }
}

function makePublicMapTabListeners({
  closeSurveyDetailSelection,
  publicMapReload,
}: TabListenerDeps) {
  return {
    tabPress: () => {
      closeSurveyDetailSelection()
      // The map route reloads the public map (pending until it mounts).
      publicMapReload.request()
    },
  }
}

function makeAccountTabListeners({
  isAuthenticated,
  handleLoadMyProfile,
  closeSurveyDetailSelection,
}: TabListenerDeps) {
  return {
    tabPress: () => {
      closeSurveyDetailSelection()
      if (isAuthenticated) {
        void handleLoadMyProfile({ silent: true })
      }
    },
  }
}

/** Reads only the session and stable action objects. */
function useTabListenerDeps(): TabListenerDeps {
  const { state: session, actions: sessionActions } = useSession()
  const syncActions = useSyncActions()
  const surveyActions = useSurveyActions()
  const publicMapReload = useContext(PublicMapReloadContext)
  if (publicMapReload === null) {
    throw new Error("The root tabs must be rendered inside AuthenticatedAppNavigation")
  }
  return {
    isAuthenticated: session.isAuthenticated,
    handlePullChanges: syncActions.handlePullChanges,
    handleLoadMyProfile: sessionActions.handleLoadMyProfile,
    closeSurveyDetailSelection: surveyActions.closeSurveyDetailSelection,
    publicMapReload,
  }
}

// ─── Surveys stack ────────────────────────────────────────────────────────────

type SurveysTabNavigatorProps = { useNativeNav?: boolean; searchEntry?: boolean }

function SurveysTabNavigator({
  useNativeNav = false,
  searchEntry = false,
}: SurveysTabNavigatorProps) {
  const surveyActions = useSurveyActions()
  const nativeSearchEnabled = useNativeNav && Platform.OS === "ios" && searchEntry

  return (
    <View style={styles.tabScreenContainer}>
      <SurveysStack.Navigator
        screenOptions={{
          ...baseStackScreenOptions,
          headerLargeTitle: false,
          ...(useNativeNav
            ? {}
            : {
                headerShown: true,
                headerTitleAlign: "left",
                headerTitleStyle: {
                  fontSize: 30,
                  fontWeight: "900" as const,
                  color: brandColors.forest,
                },
                headerStyle: { backgroundColor: brandColors.canvas },
                headerShadowVisible: false,
                headerTintColor: brandColors.forest,
              }),
        }}
      >
        <SurveysStack.Screen
          name="surveysHome"
          options={{
            title: searchEntry ? "Recherche" : "Mes Relevés",
            headerShown: nativeSearchEnabled,
            headerLargeTitle: false,
            headerTransparent: nativeSearchEnabled ? false : undefined,
            headerBlurEffect: nativeSearchEnabled ? "systemMaterial" : undefined,
            headerShadowVisible: false,
            // headerSearchBarOptions are set by SurveyListRoute (it owns the query).
          }}
        >
          {(props) => (
            <SurveyListRoute {...props} useNativeNav={useNativeNav} searchEntry={searchEntry} />
          )}
        </SurveysStack.Screen>
        <SurveysStack.Screen
          name="surveyDetail"
          options={{
            title: "Detail",
            headerLargeTitle: false,
          }}
          listeners={{
            beforeRemove: () => {
              surveyActions.closeSurveyDetailSelection()
            },
          }}
        >
          {(props) => <SurveyDetailRoute {...props} />}
        </SurveysStack.Screen>
        <SurveysStack.Screen
          name="surveyForm"
          options={{
            // SurveyFormRoute sets the create/edit title.
            title: "New survey",
            headerLargeTitle: false,
          }}
        >
          {(props) => <SurveyFormRoute {...props} />}
        </SurveysStack.Screen>
        <SurveysStack.Screen
          name="surveyFactorDetail"
          options={({ route }) => ({
            title: `Factor ${route.params.factor}`,
            headerLargeTitle: false,
          })}
        >
          {(props) => <FactorDetailRoute {...props} />}
        </SurveysStack.Screen>
        <SurveysStack.Screen
          name="surveyParcels"
          options={{
            title: "Parcels",
            headerLargeTitle: false,
            headerStyle: { backgroundColor: "#132434" },
            headerShadowVisible: false,
            headerTintColor: brandColors.white,
            headerTitleStyle: {
              color: brandColors.white,
              fontSize: 18,
              fontWeight: "800" as const,
            },
            contentStyle: { backgroundColor: "#132434" },
          }}
        >
          {(props) => <ParcelSelectionRoute {...props} />}
        </SurveysStack.Screen>
      </SurveysStack.Navigator>
    </View>
  )
}

// ─── Home stack ──────────────────────────────────────────────────────────────

function HomeTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <HomeStack.Navigator screenOptions={{ ...baseStackScreenOptions, headerShown: false }}>
        <HomeStack.Screen name="homeRoot">{(props) => <HomeRoute {...props} />}</HomeStack.Screen>
      </HomeStack.Navigator>
    </View>
  )
}

// ─── Public map ───────────────────────────────────────────────────────────────

function PublicMapTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <PublicMapStack.Navigator screenOptions={{ ...baseStackScreenOptions, headerShown: false }}>
        <PublicMapStack.Screen name="publicMapHome">
          {(props) => <PublicMapRoute {...props} />}
        </PublicMapStack.Screen>
      </PublicMapStack.Navigator>
    </View>
  )
}

// ─── Account stack ────────────────────────────────────────────────────────────

function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={22} color={brandColors.forest} />
    </Pressable>
  )
}

function AccountTabNavigator() {
  return (
    <View style={styles.tabScreenContainer}>
      <AccountStack.Navigator
        screenOptions={{
          ...baseStackScreenOptions,
          headerLargeTitle: false,
        }}
      >
        <AccountStack.Screen
          name="accountHome"
          options={({ navigation }) => ({
            title: "Compte",
            headerLargeTitle: false,
            headerRight: () => (
              <HeaderIconButton
                icon="settings-outline"
                onPress={() => navigation.navigate("settings")}
              />
            ),
          })}
        >
          {(props) => <AccountRoute {...props} />}
        </AccountStack.Screen>
        <AccountStack.Screen name="settings" options={{ title: "Paramètres" }}>
          {(props) => <SettingsRoute {...props} />}
        </AccountStack.Screen>
      </AccountStack.Navigator>
    </View>
  )
}

// ─── Root tab navigators ──────────────────────────────────────────────────────

function NativeRootTabs() {
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

function JsRootTabs() {
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

export function AuthenticatedAppNavigation() {
  const [publicMapReload] = useState(createPublicMapReloadSignal)

  return (
    <PublicMapReloadContext.Provider value={publicMapReload}>
      <NavigationContainer>
        <AppTabs />
      </NavigationContainer>
    </PublicMapReloadContext.Provider>
  )
}
