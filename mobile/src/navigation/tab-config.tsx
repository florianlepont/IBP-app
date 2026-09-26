import { useContext } from "react"
import { Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../app/brand-tokens"
import { fr } from "../i18n"
import { useSession, type SessionActions } from "../state/session-context"
import { useSurveyActions } from "../state/surveys-context"
import { useSyncActions } from "../state/sync-actions-context"
import { PublicMapReloadContext, type PublicMapReloadSignal } from "./public-map-reload"
import type { RootTabParamList } from "./types"

// ─── Tab icons and titles ─────────────────────────────────────────────────────

const IOS_TAB_ICONS = {
  home: {
    focused: { sfSymbol: "house.fill" },
    unfocused: { sfSymbol: "house" },
  },
  surveys: {
    focused: { sfSymbol: "list.bullet.clipboard.fill" },
    unfocused: { sfSymbol: "list.bullet.clipboard" },
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
  publicMap: require("../../assets/tabs/public-map.png"),
  account: require("../../assets/tabs/account.png"),
} as const

export const TAB_TITLES: Record<keyof RootTabParamList, string> = fr.navigation.tabs

const JS_TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  surveys: "list-outline",
  publicMap: "map-outline",
  account: "person-outline",
}

// ─── Native tab screen options ────────────────────────────────────────────────

export const nativeTabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  title: TAB_TITLES[route.name],
  tabBarActiveTintColor: brandColors.forest,
  tabBarIcon: ({ focused }: { focused: boolean }) => {
    if (Platform.OS === "ios") {
      return focused ? IOS_TAB_ICONS[route.name].focused : IOS_TAB_ICONS[route.name].unfocused
    }
    return ANDROID_TAB_ICONS[route.name]
  },
})

// ─── JS tab screen options (Android, Expo Go fallback) ────────────────────────

/** The JS bar style; the surveys tab swaps it for `display: none` (tab-bar.ts). */
export const JS_TAB_BAR_STYLE = {
  backgroundColor: brandColors.panel,
  borderTopColor: brandColors.divider,
  borderTopWidth: 1,
  height: Platform.select({ ios: 84, default: 68 }),
  paddingBottom: Platform.select({ ios: 22, default: 10 }),
  paddingTop: Platform.select({ ios: 8, default: 6 }),
}

export const jsTabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  headerShown: false,
  title: TAB_TITLES[route.name],
  tabBarLabel: TAB_TITLES[route.name],
  tabBarActiveTintColor: brandColors.forest,
  tabBarInactiveTintColor: brandColors.textSecondary,
  tabBarStyle: JS_TAB_BAR_STYLE,
  tabBarLabelStyle: { fontSize: 12, fontWeight: "600" as const },
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={JS_TAB_ICONS[route.name]} size={size} color={color} />
  ),
})

// ─── Shared tab listeners ─────────────────────────────────────────────────────

export type TabListenerDeps = {
  isAuthenticated: boolean
  handlePullChanges: () => Promise<void>
  handleLoadMyProfile: SessionActions["handleLoadMyProfile"]
  closeSurveyDetailSelection: () => void
  publicMapReload: PublicMapReloadSignal
}

export function makeSurveysTabListeners({ isAuthenticated, handlePullChanges }: TabListenerDeps) {
  return {
    tabPress: () => {
      if (isAuthenticated) {
        void handlePullChanges()
      }
    },
  }
}

export function makePublicMapTabListeners({
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

export function makeAccountTabListeners({
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
export function useTabListenerDeps(): TabListenerDeps {
  const { state: session, actions: sessionActions } = useSession()
  const syncActions = useSyncActions()
  const surveyActions = useSurveyActions()
  const publicMapReload = useContext(PublicMapReloadContext)
  if (publicMapReload === null) {
    throw new Error("The root tabs must be rendered inside AppNavigation")
  }
  return {
    isAuthenticated: session.isAuthenticated,
    handlePullChanges: syncActions.handlePullChanges,
    handleLoadMyProfile: sessionActions.handleLoadMyProfile,
    closeSurveyDetailSelection: surveyActions.closeSurveyDetailSelection,
    publicMapReload,
  }
}
