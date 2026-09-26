/**
 * Render-count harness (phase 01.9, D-02).
 *
 * What it measures: how many times each screen and each survey-list row renders
 * when the real `mobile/App.tsx` tree reacts to five events: the initial mount,
 * one status update, one form keystroke, one form keystroke followed by the
 * autosave delay, and a list refresh where a single survey changed.
 *
 * Why it replaces a React DevTools profile: ROADMAP criterion 1 asks for a
 * before/after profile, but no device or simulator is available and the owner
 * no longer profiles by hand (STATE 2026-09-25). Committed, deterministic counts
 * are a reproducible substitute: the same file runs before and after the phase.
 *
 * How the tree is mounted: react-test-renderer renders the real App with the
 * real hooks. The navigation libraries are replaced by fake navigators that
 * render EVERY tab and stack screen at once (simulating "every mounted tab"),
 * and support both `Screen` render callbacks and `component=` screens. Screen
 * entry modules are replaced by probes that count renders and return null,
 * except SurveyListScreen, which is wrapped by a counting passthrough so its
 * rows really render. Each row is a gesture-handler `Swipeable`, whose mock
 * counts renders: Swipeable renders = row renders.
 *
 * Mocked seams, chosen because the phase keeps them stable: screen entry
 * modules (`../screens/<Name>`), the navigation libraries, `react-native`,
 * gesture-handler, safe-area-context, the storage modules, the API module, the
 * Auth0 session hook and the local-data-owner hook. Everything between App and
 * the screens (hooks, contexts, navigators) is real, so later plans re-run this
 * file unchanged and only update EXPECTED.
 *
 * Storage returns FRESH row objects on every read, as the real SQLite read
 * does, so row memoisation is measured against realistic data.
 *
 * Timers: the first scenarios run on real timers (the mount only needs promise
 * flushes). The autosave scenario switches to Jest fake timers (setImmediate
 * left real for the promise flushes) to advance past the 900 ms autosave delay
 * deterministically.
 *
 * Regenerate the JSON baseline or after-numbers (absolute path):
 *   RENDER_COUNTS_OUT=<abs path> RENDER_COUNTS_GIT_HEAD=$(git rev-parse --short HEAD) \
 *     npm --workspace mobile run test:unit -- src/state/render-counts.test.tsx
 */

import fs from "fs"
import React from "react"
import renderer, { act } from "react-test-renderer"
import type { LocalSurvey } from "../storage/types"

type CountKey =
  | "home"
  | "surveyList"
  | "surveyDetail"
  | "surveyForm"
  | "factorDetail"
  | "parcelSelection"
  | "publicMap"
  | "account"
  | "settings"
  | "rows"

type Counts = Record<CountKey, number>

type ScenarioName =
  | "initialMount"
  | "statusUpdate"
  | "formKeystroke"
  | "formKeystrokeAutosave"
  | "oneSurveyRefresh"

const COUNT_KEYS: CountKey[] = [
  "home",
  "surveyList",
  "surveyDetail",
  "surveyForm",
  "factorDetail",
  "parcelSelection",
  "publicMap",
  "account",
  "settings",
  "rows",
]

const mockCounts: Record<string, number> = {}

type ReportStatus = (scope: "session", state: "idle", message: string) => void

const mockCaptured: {
  reportStatus: ReportStatus | null
  setSiteName: ((value: string) => void) | null
  refreshLocalSurveys: (() => Promise<void>) | null
  startEditSurvey: ((surveyId: string) => Promise<boolean>) | null
} = {
  reportStatus: null,
  setSiteName: null,
  refreshLocalSurveys: null,
  startEditSurvey: null,
}

function mockCount(name: string): void {
  mockCounts[name] = (mockCounts[name] ?? 0) + 1
}

// ─── Seeded local surveys (mutable; storage reads return fresh copies) ───────

function mockMakeSurvey(index: number): LocalSurvey {
  const n = String(index + 1).padStart(2, "0")
  return {
    id: `s-${n}`,
    site_name: `Site ${n}`,
    status: "draft",
    visibility: "private",
    sync_version: 1,
    sync_state: "synced",
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
    created_at: `2026-09-${n}T08:00:00.000Z`,
    updated_at: `2026-09-${n}T09:00:00.000Z`,
    completion_rate: (index * 5) % 101,
  }
}

const mockRows: LocalSurvey[] = Array.from({ length: 20 }, (_, index) => mockMakeSurvey(index))

// ─── react-native ────────────────────────────────────────────────────────────

jest.mock("react-native", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const mockComponent = (name: string) => {
    const Component = ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
    Component.displayName = name
    return Component
  }

  type ListProps = {
    data?: unknown[] | null
    initialNumToRender?: number
    renderItem?: (info: { item: unknown; index: number }) => React.ReactNode
    keyExtractor?: (item: unknown, index: number) => string
    ListHeaderComponent?: React.ComponentType | React.ReactElement | null
    ListEmptyComponent?: React.ComponentType | React.ReactElement | null
    ListFooterComponent?: React.ComponentType | React.ReactElement | null
  }
  const renderSlot = (slot: ListProps["ListHeaderComponent"]): React.ReactNode => {
    if (slot == null) return null
    if (ReactRef.isValidElement(slot)) return slot
    return ReactRef.createElement(slot as React.ComponentType)
  }
  const FlatList = (props: ListProps) => {
    const data = props.data ?? []
    const items = data
      .slice(0, props.initialNumToRender ?? 10)
      .map((item, index) =>
        ReactRef.createElement(
          ReactRef.Fragment,
          { key: props.keyExtractor ? props.keyExtractor(item, index) : String(index) },
          props.renderItem ? props.renderItem({ item, index }) : null,
        ),
      )
    return ReactRef.createElement(
      "FlatList",
      null,
      renderSlot(props.ListHeaderComponent),
      data.length === 0 ? renderSlot(props.ListEmptyComponent) : items,
      renderSlot(props.ListFooterComponent),
    )
  }

  const animatedValue = () => ({
    interpolate: jest.fn(() => ({})),
    setValue: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    stopAnimation: jest.fn(),
  })
  const animation = () => ({
    start: (cb?: () => void) => cb?.(),
    stop: jest.fn(),
    reset: jest.fn(),
  })
  const Animated = {
    Value: jest.fn(() => animatedValue()),
    ValueXY: jest.fn(() => ({ x: animatedValue(), y: animatedValue() })),
    View: mockComponent("Animated.View"),
    Text: mockComponent("Animated.Text"),
    Image: mockComponent("Animated.Image"),
    ScrollView: mockComponent("Animated.ScrollView"),
    FlatList,
    event: () => jest.fn(),
    timing: jest.fn(animation),
    spring: jest.fn(animation),
    decay: jest.fn(animation),
    sequence: jest.fn(animation),
    parallel: jest.fn(animation),
    stagger: jest.fn(animation),
    loop: jest.fn(animation),
    delay: jest.fn(animation),
    add: jest.fn(() => animatedValue()),
    multiply: jest.fn(() => animatedValue()),
    diffClamp: jest.fn(() => animatedValue()),
    createAnimatedComponent: (component: unknown) => component,
  }

  const known: Record<string, unknown> = {
    Animated,
    FlatList,
    AccessibilityInfo: {
      isReduceMotionEnabled: jest.fn(() => Promise.resolve(false)),
      isScreenReaderEnabled: jest.fn(() => Promise.resolve(false)),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      announceForAccessibility: jest.fn(),
    },
    Alert: { alert: jest.fn() },
    Appearance: {
      getColorScheme: () => "light",
      addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    AppState: {
      currentState: "active",
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Easing: {
      out: jest.fn((fn: unknown) => fn),
      in: jest.fn((fn: unknown) => fn),
      inOut: jest.fn((fn: unknown) => fn),
      cubic: jest.fn((t: number) => t),
      quad: jest.fn((t: number) => t),
      linear: jest.fn((t: number) => t),
      ease: jest.fn((t: number) => t),
      bezier: jest.fn(() => (t: number) => t),
    },
    I18nManager: { isRTL: false },
    Keyboard: {
      dismiss: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    LayoutAnimation: {
      configureNext: jest.fn(),
      create: jest.fn(),
      Presets: { easeInEaseOut: {}, linear: {}, spring: {} },
      Types: {},
      Properties: {},
    },
    Linking: {
      openURL: jest.fn(() => Promise.resolve()),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
    },
    PixelRatio: { get: () => 2, roundToNearestPixel: (n: number) => n },
    Platform: {
      OS: "android",
      Version: 34,
      select: <T,>(options: { ios?: T; android?: T; default?: T }): T | undefined =>
        options.android ?? options.default,
    },
    Share: { share: jest.fn(() => Promise.resolve({})) },
    StyleSheet: {
      create: <T extends object>(value: T): T => value,
      flatten: (value: unknown) => value,
      compose: (a: unknown, b: unknown) => [a, b],
      hairlineWidth: 0.5,
      absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
      absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    },
    Vibration: { vibrate: jest.fn() },
    useColorScheme: () => "light",
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
  }

  // Any other capitalised export is a host component; everything else is undefined.
  return new Proxy(known, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined
      if (prop in target) return target[prop]
      if (/^[A-Z]/.test(prop)) {
        target[prop] = mockComponent(prop)
        return target[prop]
      }
      return undefined
    },
  })
})

// ─── Gesture handler, safe area ──────────────────────────────────────────────

jest.mock("react-native-gesture-handler", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(ReactRef.Fragment, null, children)
  return {
    GestureHandlerRootView: passthrough,
    Swipeable: passthrough,
    RectButton: passthrough,
  }
})

jest.mock("react-native-gesture-handler/Swipeable", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const SwipeableProbe = ReactRef.forwardRef(function SwipeableProbe(
    { children }: { children?: React.ReactNode },
    _ref: React.Ref<unknown>,
  ) {
    mockCount("rows")
    return ReactRef.createElement(ReactRef.Fragment, null, children)
  })
  return { __esModule: true, default: SwipeableProbe }
})

jest.mock("react-native-safe-area-context", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(ReactRef.Fragment, null, children)
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

// ─── Navigation: fake navigators that render every screen at once ────────────

jest.mock("@react-navigation/native", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(ReactRef.Fragment, null, children)
  return {
    NavigationContainer: passthrough,
    useNavigation: () => mockNavigation,
    useRoute: () => ({ key: "route", name: "route", params: mockDefaultParams }),
    getFocusedRouteNameFromRoute: () => undefined,
    useFocusEffect: () => undefined,
    useIsFocused: () => true,
    createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
  }
})

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => mockCreateFakeNavigator(),
}))

jest.mock("@react-navigation/bottom-tabs", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    createBottomTabNavigator: () => mockCreateFakeNavigator(),
    useBottomTabBarHeight: () => 0,
    BottomTabBarHeightContext: ReactRef.createContext<number | undefined>(undefined),
  }
})

jest.mock("@bottom-tabs/react-navigation", () => ({
  createNativeBottomTabNavigator: () => mockCreateFakeNavigator(),
}))

jest.mock("react-native-bottom-tabs", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    BottomTabBarHeightContext: ReactRef.createContext<number | undefined>(undefined),
  }
})

jest.mock("react-native-screens", () => ({}))

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  dispatch: jest.fn(),
  canGoBack: () => true,
  isFocused: () => true,
  addListener: () => () => undefined,
  getParent: () => mockNavigation,
  getState: () => ({ routes: [], index: 0 }),
}

// Union of the params that screens with required params read.
const mockDefaultParams = { factor: "A", surveyId: "s-01", mode: "edit" }

type FakeScreenProps = {
  name: string
  component?: React.ComponentType<{ navigation: unknown; route: unknown }>
  children?: (props: { navigation: unknown; route: unknown }) => React.ReactNode
  initialParams?: Record<string, unknown>
}

function mockCreateFakeNavigator() {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const Navigator = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(ReactRef.Fragment, null, children)
  const Screen = (props: FakeScreenProps) => {
    const screenProps = {
      navigation: mockNavigation,
      route: {
        key: props.name,
        name: props.name,
        params: props.initialParams ?? mockDefaultParams,
      },
    }
    if (props.component) return ReactRef.createElement(props.component, screenProps)
    if (typeof props.children === "function") {
      return ReactRef.createElement(ReactRef.Fragment, null, props.children(screenProps))
    }
    return null
  }
  const Group = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(ReactRef.Fragment, null, children)
  return { Navigator, Screen, Group }
}

// ─── Screen probes (count renders, render nothing) ───────────────────────────

function mockProbe(name: string) {
  return function Probe(_props: unknown) {
    mockCount(name)
    return null
  }
}

jest.mock("../screens/HomeScreen", () => ({ HomeScreen: mockProbe("home") }))
jest.mock("../screens/SurveyDetailScreen", () => ({
  SurveyDetailScreen: mockProbe("surveyDetail"),
}))
jest.mock("../screens/SurveyFormScreen", () => ({ SurveyFormScreen: mockProbe("surveyForm") }))
jest.mock("../screens/FactorDetailScreen", () => ({
  FactorDetailScreen: mockProbe("factorDetail"),
}))
jest.mock("../screens/SurveyParcelSelectionScreen", () => ({
  SurveyParcelSelectionScreen: mockProbe("parcelSelection"),
}))
jest.mock("../screens/PublicMapScreen", () => ({ PublicMapScreen: mockProbe("publicMap") }))
jest.mock("../screens/AccountScreen", () => ({ AccountScreen: mockProbe("account") }))
jest.mock("../screens/SettingsScreen", () => ({ SettingsScreen: mockProbe("settings") }))
jest.mock("../screens/AuthGateScreen", () => ({ AuthGateScreen: mockProbe("authGate") }))
jest.mock("../screens/ProfileSetupScreen", () => ({
  ProfileSetupScreen: mockProbe("profileSetup"),
}))
jest.mock("../screens/LocalDataOwnerConflictScreen", () => ({
  LocalDataOwnerConflictScreen: mockProbe("ownerConflict"),
}))

// The real list, wrapped by a counting passthrough, so its rows really render.
jest.mock("../screens/SurveyListScreen", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const actual = jest.requireActual("../screens/SurveyListScreen") as {
    SurveyListScreen: React.ComponentType<Record<string, unknown>>
  }
  return {
    SurveyListScreen: (props: Record<string, unknown>) => {
      mockCount("surveyList")
      return ReactRef.createElement(actual.SurveyListScreen, props)
    },
  }
})

// ─── Hook passthroughs that capture trigger functions ────────────────────────

jest.mock("../hooks/useSurveyForm", () => {
  const actual = jest.requireActual("../hooks/useSurveyForm") as {
    useSurveyForm: () => { setSiteName: (value: string) => void }
  }
  return {
    ...actual,
    useSurveyForm: () => {
      const form = actual.useSurveyForm()
      mockCaptured.setSiteName = form.setSiteName
      return form
    },
  }
})

jest.mock("../hooks/useSurveyList", () => {
  const actual = jest.requireActual("../hooks/useSurveyList") as {
    useSurveyList: () => { refreshLocalSurveys: () => Promise<void> }
  }
  return {
    ...actual,
    useSurveyList: () => {
      const list = actual.useSurveyList()
      mockCaptured.refreshLocalSurveys = list.refreshLocalSurveys
      return list
    },
  }
})

jest.mock("../hooks/useEditingDraft", () => {
  const actual = jest.requireActual("../hooks/useEditingDraft") as {
    useEditingDraft: (params: unknown) => {
      handleStartEditSurvey: (surveyId: string) => Promise<boolean>
    }
  }
  return {
    ...actual,
    useEditingDraft: (params: unknown) => {
      const editing = actual.useEditingDraft(params)
      mockCaptured.startEditSurvey = editing.handleStartEditSurvey
      return editing
    },
  }
})

// ─── Session and local data owner ────────────────────────────────────────────

const mockOwner = { sub: "auth0|render", email: "render@example.fr" }
const mockSession = {
  accessToken: "token-render",
  sessionRestoring: false,
  currentUser: {
    id: "u-render",
    email: "render@example.fr",
    first_name: "Rene",
    last_name: "Dercount",
    display_name: "Rene Dercount",
  },
  profile: "render",
  sessionOwner: mockOwner,
  isAuthenticated: true,
  setProfileFromUser: jest.fn(),
  clearSession: jest.fn(async () => undefined),
  refreshSessionTokens: jest.fn(async () => undefined),
  withAuthRetry: <T,>(fn: (token: string, tokenSub: string | null) => Promise<T>) =>
    fn("token-render", mockOwner.sub),
  handleLoadMyProfile: jest.fn(async () => undefined),
  handleLogin: jest.fn(async () => null),
  handleRegister: jest.fn(async () => null),
  handleForgotPassword: jest.fn(async () => undefined),
  handleLogout: jest.fn(async () => undefined),
}

jest.mock("../hooks/useAuth0Session", () => ({
  ...(jest.requireActual("../hooks/auth-errors") as object),
  useAuth0Session: (params: { reportStatus: ReportStatus }) => {
    mockCaptured.reportStatus = params.reportStatus
    return mockSession
  },
}))

const mockLocalDataOwner = {
  status: "ok",
  syncAllowed: true,
  ensureSyncOwner: async () => true,
  foreignWork: { surveys: 0, attachments: 0 },
  foreignOwnerEmail: null,
  discardForeignData: jest.fn(async () => undefined),
  recheck: jest.fn(),
}

jest.mock("../hooks/useLocalDataOwner", () => ({
  useLocalDataOwner: () => mockLocalDataOwner,
}))

// ─── Storage ─────────────────────────────────────────────────────────────────

jest.mock("../storage/db", () => ({
  initLocalDb: jest.fn(async () => undefined),
  getDb: jest.fn(async () => {
    throw new Error("getDb is not available in the render-count harness")
  }),
}))

jest.mock("../storage/attachments", () => ({
  persistLegacyAttachmentFiles: jest.fn(async () => ({ moved: 0, missing: 0 })),
  preparePhotoForStorage: jest.fn(),
  uploadAttachmentFile: jest.fn(),
  computeResizeTarget: jest.fn(),
}))

jest.mock("../storage/surveys", () => ({
  listLocalSurveys: jest.fn(async () => mockRows.map((row) => ({ ...row }))),
  listLocalAttachments: jest.fn(async () => []),
  getLocalSurveyDraft: jest.fn(async (surveyId: string) => {
    const row = mockRows.find((candidate) => candidate.id === surveyId)
    if (!row) return null
    return {
      id: row.id,
      site_name: row.site_name,
      status: row.status,
      visibility: row.visibility,
      region_version: "ACA",
      vegetation_stage: "",
      parcel_ids: [],
      factors: {},
    }
  }),
  createLocalDraft: jest.fn(async (input: { site_name?: string }) => {
    const created = { ...mockMakeSurvey(mockRows.length), site_name: input.site_name ?? "" }
    mockRows.push(created)
    return { ...created }
  }),
  updateLocalDraft: jest.fn(async (input: { survey_id: string; site_name?: string }) => {
    const index = mockRows.findIndex((row) => row.id === input.survey_id)
    const next = {
      ...mockRows[index],
      site_name: input.site_name ?? mockRows[index].site_name,
      sync_state: "pending" as const,
      updated_at: "2026-09-26T10:00:00.000Z",
    }
    mockRows[index] = next
    return { ...next }
  }),
  clearLocalIbpData: jest.fn(async () => undefined),
  hasPendingSyncWork: jest.fn(async () => false),
  queueLocalAttachment: jest.fn(),
  queueDeleteAttachment: jest.fn(),
  queueDeleteSurvey: jest.fn(),
  retrySurveyNow: jest.fn(),
  discardSurveyLocalChanges: jest.fn(),
  markSurveyExpiredLocally: jest.fn(),
  submitSurvey: jest.fn(),
  updateSurveyVisibility: jest.fn(),
}))

jest.mock("../storage/sync", () => ({
  syncPending: jest.fn(async () => ({ synced: 0, failed: 0 })),
  pullRemoteChanges: jest.fn(async () => ({ surveys: 0, attachments: 0 })),
  submitSurvey: jest.fn(),
  updateSurveyVisibility: jest.fn(),
}))

jest.mock("../storage/local-owner", () => ({
  getLocalDataOwner: jest.fn(async () => mockOwner),
  setLocalDataOwner: jest.fn(async () => undefined),
  countUnsyncedLocalWork: jest.fn(async () => ({ surveys: 0, attachments: 0 })),
}))

// ─── API and native modules ──────────────────────────────────────────────────

jest.mock(
  "../api/ibp-api",
  () =>
    new Proxy(
      {},
      {
        get(target: Record<string, unknown>, prop) {
          if (typeof prop !== "string" || prop === "__esModule") return undefined
          if (!(prop in target)) target[prop] = jest.fn(async () => ({}))
          return target[prop]
        },
      },
    ),
)

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "bare", appOwnership: null, expoConfig: { extra: {} } },
  ExecutionEnvironment: { StoreClient: "storeClient", Bare: "bare", Standalone: "standalone" },
}))

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: "WIFI",
  })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  NetworkStateType: { WIFI: "WIFI", NONE: "NONE", CELLULAR: "CELLULAR" },
}))

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4, Balanced: 3 },
}))

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}))

jest.mock("react-native-auth0", () => ({
  __esModule: true,
  default: jest.fn(),
  CredentialsManagerError: class MockCredentialsManagerError extends Error {},
  CredentialsManagerErrorCodes: {},
}))

jest.mock("react-native-maps", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const stub = (name: string) => () => ReactRef.createElement(name)
  return {
    __esModule: true,
    default: stub("MapView"),
    Marker: stub("Marker"),
    Polygon: stub("Polygon"),
    Callout: stub("Callout"),
    PROVIDER_GOOGLE: "google",
  }
})

import App from "../../App"

// ─── Harness ─────────────────────────────────────────────────────────────────

/**
 * Pre-phase baseline (01.9-01, D-02). Plans 01.9-09, 01.9-18 and 01.9-22 may
 * change these numbers; every change must be a decrease for
 * statusUpdate/formKeystroke/formKeystrokeAutosave/oneSurveyRefresh.
 */
const EXPECTED: Partial<Record<ScenarioName, Counts>> = {}

const AUTOSAVE_DELAY_MS = 900

const originalConsoleError = console.error

function resetCounts(): void {
  for (const key of Object.keys(mockCounts)) delete mockCounts[key]
}

function snapshotCounts(): Counts {
  const result = {} as Counts
  for (const key of COUNT_KEYS) result[key] = mockCounts[key] ?? 0
  return result
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await flushPromises()
    })
  }
}

describe("render counts (D-02)", () => {
  const measured: Partial<Record<ScenarioName, Counts>> = {}
  let tree: renderer.ReactTestRenderer | null = null

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("react-test-renderer is deprecated")) return
      if (message.includes("The current testing environment is not configured to support act"))
        return
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
    jest.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterAll(async () => {
    if (tree) {
      const mounted = tree
      await act(async () => {
        mounted.unmount()
      })
    }
    jest.useRealTimers()
    jest.restoreAllMocks()

    const outPath = process.env.RENDER_COUNTS_OUT
    if (outPath) {
      const payload = {
        generatedAt: new Date().toISOString(),
        ...(process.env.RENDER_COUNTS_GIT_HEAD
          ? { gitHead: process.env.RENDER_COUNTS_GIT_HEAD }
          : {}),
        scenarios: measured,
      }
      fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
    }
  })

  function record(name: ScenarioName): Counts {
    const counts = snapshotCounts()
    measured[name] = counts
    console.log(name, JSON.stringify(counts))
    return counts
  }

  it("initialMount", async () => {
    resetCounts()
    await act(async () => {
      tree = renderer.create(<App />)
    })
    await settle()
    const counts = record("initialMount")
    expect(counts.rows).toBeGreaterThan(0)
    if (EXPECTED.initialMount) expect(counts).toEqual(EXPECTED.initialMount)
  })

  it("statusUpdate", async () => {
    expect(mockCaptured.reportStatus).not.toBeNull()
    resetCounts()
    await act(async () => {
      mockCaptured.reportStatus?.("session", "idle", "x")
    })
    const counts = record("statusUpdate")
    if (EXPECTED.statusUpdate) expect(counts).toEqual(EXPECTED.statusUpdate)
  })

  it("formKeystroke", async () => {
    expect(mockCaptured.setSiteName).not.toBeNull()
    resetCounts()
    await act(async () => {
      mockCaptured.setSiteName?.("a")
    })
    const counts = record("formKeystroke")
    if (EXPECTED.formKeystroke) expect(counts).toEqual(EXPECTED.formKeystroke)
  })

  it("formKeystrokeAutosave", async () => {
    expect(mockCaptured.startEditSurvey).not.toBeNull()
    // Outside the counted window: open survey 1 in edit mode.
    await act(async () => {
      await mockCaptured.startEditSurvey?.("s-01")
    })
    await settle()

    jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick", "queueMicrotask"] })
    resetCounts()
    await act(async () => {
      mockCaptured.setSiteName?.("Site 01b")
    })
    await act(async () => {
      jest.advanceTimersByTime(AUTOSAVE_DELAY_MS + 100)
    })
    await settle()
    jest.useRealTimers()

    const counts = record("formKeystrokeAutosave")
    if (EXPECTED.formKeystrokeAutosave) expect(counts).toEqual(EXPECTED.formKeystrokeAutosave)
  })

  it("oneSurveyRefresh", async () => {
    expect(mockCaptured.refreshLocalSurveys).not.toBeNull()
    resetCounts()
    mockRows[5] = { ...mockRows[5], site_name: `${mockRows[5].site_name} (renamed)` }
    await act(async () => {
      await mockCaptured.refreshLocalSurveys?.()
    })
    const counts = record("oneSurveyRefresh")
    if (EXPECTED.oneSurveyRefresh) expect(counts).toEqual(EXPECTED.oneSurveyRefresh)
  })
})
