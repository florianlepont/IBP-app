/**
 * Navigation tree tests (phase 01.9-24, D-04).
 *
 * The navigators are replaced by fakes that record every Screen's props and
 * render its `component`, and the route components by probes. The tests check
 * the tree choice (native or JS tabs), the tab options and icons, the tab and
 * stack listeners, the stack options, and the static surveys stack config.
 */

import React from "react"
import renderer, { act } from "react-test-renderer"

const mockPlatform = { OS: "android" as "android" | "ios" }

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatform.OS
    },
    select: (options: Record<string, unknown>) =>
      mockPlatform.OS in options ? options[mockPlatform.OS] : options.default,
  },
  StyleSheet: { create: <T,>(value: T): T => value },
  StatusBar: "StatusBar",
  View: "View",
  Pressable: "Pressable",
}))

const mockConstants: { executionEnvironment: string; appOwnership: string | null } = {
  executionEnvironment: "bare",
  appOwnership: null,
}

jest.mock("expo-constants", () => ({
  __esModule: true,
  get default() {
    return mockConstants
  },
  ExecutionEnvironment: { StoreClient: "storeClient", Bare: "bare", Standalone: "standalone" },
}))

type ScreenRecord = {
  name: string
  options?: unknown
  listeners?: Record<string, (...args: unknown[]) => void>
  component?: React.ComponentType<Record<string, unknown>>
}

const mockScreens: Record<string, ScreenRecord> = {}
const mockNavigators: Record<string, Record<string, unknown>[]> = {}
const mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() }

function mockCreateFakeNavigator(kind: string) {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const Navigator = ({ children, ...props }: { children?: React.ReactNode }) => {
    ;(mockNavigators[kind] ??= []).push(props)
    return ReactRef.createElement(ReactRef.Fragment, null, children)
  }
  const Screen = (props: ScreenRecord) => {
    mockScreens[props.name] = props
    if (!props.component) return null
    return ReactRef.createElement(props.component, {
      navigation: mockNavigation,
      route: { key: props.name, name: props.name, params: { factor: "A" } },
    })
  }
  return { Navigator, Screen }
}

jest.mock("@react-navigation/native", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    NavigationContainer: ({ children }: { children?: React.ReactNode }) =>
      ReactRef.createElement(ReactRef.Fragment, null, children),
    getFocusedRouteNameFromRoute: (route: { focused?: string }) => route.focused,
  }
})
jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => mockCreateFakeNavigator("stack"),
}))
jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => mockCreateFakeNavigator("jsTabs"),
}))
jest.mock("@bottom-tabs/react-navigation", () => ({
  createNativeBottomTabNavigator: () => mockCreateFakeNavigator("nativeTabs"),
}))

// ─── Route probes ────────────────────────────────────────────────────────────

const mockListConfigs: { useNativeNav: boolean }[] = []
const mockReloadSignals: unknown[] = []

function mockRoute() {
  return function RouteProbe() {
    return null
  }
}

jest.mock("./routes/HomeRoute", () => ({ HomeRoute: mockRoute() }))
jest.mock("./routes/SurveyDetailRoute", () => ({ SurveyDetailRoute: mockRoute() }))
jest.mock("./routes/SurveyFormRoute", () => ({ SurveyFormRoute: mockRoute() }))
jest.mock("./routes/FactorDetailRoute", () => ({ FactorDetailRoute: mockRoute() }))
jest.mock("./routes/ParcelSelectionRoute", () => ({
  ParcelSelectionRoute: mockRoute(),
}))
jest.mock("./routes/AccountRoute", () => ({ AccountRoute: mockRoute() }))
jest.mock("./routes/SettingsRoute", () => ({ SettingsRoute: mockRoute() }))
jest.mock("./routes/SurveyListRoute", () => {
  const config = jest.requireActual("./stacks/surveys-stack-config") as {
    useSurveysStackConfig: () => { useNativeNav: boolean }
  }
  return {
    SurveyListRoute: function SurveyListProbe() {
      mockListConfigs.push(config.useSurveysStackConfig())
      return null
    },
  }
})
jest.mock("./routes/PublicMapRoute", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const reload = jest.requireActual("./public-map-reload") as {
    PublicMapReloadContext: React.Context<unknown>
  }
  return {
    PublicMapRoute: function PublicMapProbe() {
      mockReloadSignals.push(ReactRef.useContext(reload.PublicMapReloadContext))
      return null
    },
  }
})

// ─── Contexts ────────────────────────────────────────────────────────────────

const mockSession = {
  state: { isAuthenticated: true },
  actions: { handleLoadMyProfile: jest.fn(async () => undefined) },
}
const mockSyncActions = { handlePullChanges: jest.fn(async () => undefined) }
const mockSurveyActions = { closeSurveyDetailSelection: jest.fn() }

jest.mock("../state/session-context", () => ({ useSession: () => mockSession }))
jest.mock("../state/sync-actions-context", () => ({ useSyncActions: () => mockSyncActions }))
jest.mock("../state/surveys-context", () => ({ useSurveyActions: () => mockSurveyActions }))

import { AppNavigation } from "./AppNavigation"
import { PublicMapReloadContext, createPublicMapReloadSignal } from "./public-map-reload"
import { fr } from "../i18n"
import {
  JS_TAB_BAR_STYLE,
  jsTabScreenOptions,
  nativeTabScreenOptions,
  TAB_TITLES,
} from "./tab-config"
import { JsRootTabs } from "./tabs/JsRootTabs"
import { NativeRootTabs } from "./tabs/NativeRootTabs"

type Options = Record<string, unknown>
type OptionsFn = (args: Record<string, unknown>) => Options

let warn: jest.SpyInstance
let silenceErrors = false
const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (silenceErrors) return
    if (String(args[0] ?? "").includes("react-test-renderer is deprecated")) return
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  mockPlatform.OS = "android"
  mockConstants.executionEnvironment = "bare"
  mockConstants.appOwnership = null
  delete process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS
  for (const key of Object.keys(mockScreens)) delete mockScreens[key]
  for (const key of Object.keys(mockNavigators)) delete mockNavigators[key]
  mockListConfigs.length = 0
  mockReloadSignals.length = 0
  mockSession.state.isAuthenticated = true
  jest.clearAllMocks()
})

async function mount(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer | undefined
  await act(async () => {
    tree = renderer.create(element)
  })
  return tree as renderer.ReactTestRenderer
}

function press(name: string) {
  mockScreens[name].listeners?.tabPress()
}

describe("AppNavigation tree choice", () => {
  test("Android mounts the JS tabs and logs the fallback", async () => {
    await mount(<AppNavigation />)
    expect(mockNavigators.jsTabs).toHaveLength(1)
    expect(mockNavigators.nativeTabs).toBeUndefined()
    expect(Object.keys(mockScreens)).toEqual(
      expect.arrayContaining(["home", "surveys", "publicMap", "account"]),
    )
    expect(mockScreens.search).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mockListConfigs).toEqual([{ useNativeNav: false }])
  })

  test("iOS in a native build mounts the native tabs with one survey stack", async () => {
    mockPlatform.OS = "ios"
    const tree = await mount(<AppNavigation />)
    expect(mockNavigators.nativeTabs).toHaveLength(1)
    expect(mockNavigators.jsTabs).toBeUndefined()
    expect(mockScreens.search).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
    expect(mockListConfigs).toEqual([{ useNativeNav: true }])

    // A re-render keeps the lazily created native navigator.
    await act(async () => {
      tree.update(<AppNavigation />)
    })
    expect(mockNavigators.nativeTabs.length).toBeGreaterThan(1)
  })

  test.each([
    ["the env opt-out", () => (process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS = "false")],
    ["Expo Go (store client)", () => (mockConstants.executionEnvironment = "storeClient")],
    ["Expo Go (app ownership)", () => (mockConstants.appOwnership = "expo")],
  ])("iOS falls back to the JS tabs with %s", async (_label, setup) => {
    mockPlatform.OS = "ios"
    setup()
    await mount(<AppNavigation />)
    expect(mockNavigators.jsTabs).toHaveLength(1)
    expect(mockNavigators.nativeTabs).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[tabs\] native=false reason=/)
  })

  test("a Release build ignores the env opt-out, stays native and says so once", async () => {
    mockPlatform.OS = "ios"
    process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS = "false"
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined)
    const globals = globalThis as { __DEV__?: boolean }
    const previousDev = globals.__DEV__
    globals.__DEV__ = false
    try {
      const tree = await mount(<AppNavigation />)
      await act(async () => {
        tree.update(<AppNavigation />)
      })
      expect(mockNavigators.nativeTabs).toBeDefined()
      expect(mockNavigators.jsTabs).toBeUndefined()
      expect(warn).not.toHaveBeenCalled()
      expect(info).toHaveBeenCalledTimes(1)
      expect(String(info.mock.calls[0][0])).toContain("[tabs] native=true reason=ok")
    } finally {
      globals.__DEV__ = previousDev
      info.mockRestore()
    }
  })

  test("the native tabs render no search tab", async () => {
    await mount(
      <PublicMapReloadContext.Provider value={createPublicMapReloadSignal()}>
        <NativeRootTabs />
      </PublicMapReloadContext.Provider>,
    )
    expect(mockScreens.surveys).toBeDefined()
    expect(mockScreens.search).toBeUndefined()
  })

  test("the root tabs refuse to render outside AppNavigation", async () => {
    silenceErrors = true
    try {
      await expect(mount(<JsRootTabs />)).rejects.toThrow(
        "The root tabs must be rendered inside AppNavigation",
      )
    } finally {
      silenceErrors = false
    }
  })
})

describe("tab listeners", () => {
  test("Mes Relevés pulls changes when signed in", async () => {
    await mount(<AppNavigation />)
    press("surveys")
    expect(mockSyncActions.handlePullChanges).toHaveBeenCalledTimes(1)
  })

  test("Mes Relevés does nothing when signed out", async () => {
    mockSession.state.isAuthenticated = false
    await mount(<AppNavigation />)
    press("surveys")
    expect(mockSyncActions.handlePullChanges).not.toHaveBeenCalled()
  })

  test("Explorer closes the detail selection and requests a map reload", async () => {
    await mount(<AppNavigation />)
    const signal = mockReloadSignals[0] as ReturnType<typeof createPublicMapReloadSignal>
    const reload = jest.fn()
    signal.subscribe(reload)
    press("publicMap")
    expect(mockSurveyActions.closeSurveyDetailSelection).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  test("Compte closes the detail selection and loads the profile silently when signed in", async () => {
    await mount(<AppNavigation />)
    press("account")
    expect(mockSurveyActions.closeSurveyDetailSelection).toHaveBeenCalledTimes(1)
    expect(mockSession.actions.handleLoadMyProfile).toHaveBeenCalledWith({ silent: true })
  })

  test("Compte only closes the detail selection when signed out", async () => {
    mockSession.state.isAuthenticated = false
    await mount(<AppNavigation />)
    press("account")
    expect(mockSurveyActions.closeSurveyDetailSelection).toHaveBeenCalledTimes(1)
    expect(mockSession.actions.handleLoadMyProfile).not.toHaveBeenCalled()
  })

  test("the native tree wires the same listeners", async () => {
    mockPlatform.OS = "ios"
    await mount(<AppNavigation />)
    press("surveys")
    press("publicMap")
    press("account")
    expect(mockSyncActions.handlePullChanges).toHaveBeenCalledTimes(1)
    expect(mockSurveyActions.closeSurveyDetailSelection).toHaveBeenCalledTimes(2)
    expect(mockSession.actions.handleLoadMyProfile).toHaveBeenCalledTimes(1)
  })
})

describe("tab options", () => {
  test("native options use SF Symbols on iOS and images elsewhere", () => {
    mockPlatform.OS = "ios"
    const options = nativeTabScreenOptions({ route: { name: "surveys" } })
    expect(options.title).toBe(TAB_TITLES.surveys)
    expect(options.tabBarIcon({ focused: true })).toEqual({
      sfSymbol: "list.bullet.clipboard.fill",
    })
    expect(options.tabBarIcon({ focused: false })).toEqual({ sfSymbol: "list.bullet.clipboard" })
    mockPlatform.OS = "android"
    expect(options.tabBarIcon({ focused: true })).toBeDefined()
  })

  test("JS options render an Ionicons icon and the platform bar metrics", () => {
    const options = jsTabScreenOptions({ route: { name: "account" } })
    expect(options.tabBarLabel).toBe("Compte")
    expect(options.tabBarStyle.height).toBe(68)
    const icon = options.tabBarIcon({ color: "red", size: 20 })
    expect(icon.props).toEqual(
      expect.objectContaining({ name: "person-outline", size: 20, color: "red" }),
    )
  })

  test("the JS surveys tab hides the bar on parcel selection only", async () => {
    await mount(<AppNavigation />)
    const options = mockScreens.surveys.options as OptionsFn
    expect(options({ route: { focused: "surveyParcels" } }).tabBarStyle).toEqual({
      display: "none",
    })
    expect(options({ route: { focused: "surveyForm" } }).tabBarStyle).toBe(JS_TAB_BAR_STYLE)
    expect(options({ route: {} }).tabBarLabel).toBe(TAB_TITLES.surveys)
  })
})

describe("stack options and listeners", () => {
  test("the surveys stack closes the detail selection before the detail is removed", async () => {
    await mount(<AppNavigation />)
    mockScreens.surveyDetail.listeners?.beforeRemove()
    expect(mockSurveyActions.closeSurveyDetailSelection).toHaveBeenCalledTimes(1)
  })

  test("the factor detail title names the factor", async () => {
    await mount(<AppNavigation />)
    const options = mockScreens.surveyFactorDetail.options as OptionsFn
    expect(options({ route: { params: { factor: "C" } } }).title).toBe("Facteur C")
  })

  test("the JS surveys stack shows its own header; the native one shows the search header", async () => {
    await mount(<AppNavigation />)
    const jsStack = mockNavigators.stack.find(
      (props) => (props.screenOptions as Options).headerTitleAlign === "left",
    )
    expect(jsStack).toBeDefined()
    expect((mockScreens.surveysHome.options as Options).headerShown).toBe(false)

    for (const key of Object.keys(mockScreens)) delete mockScreens[key]
    mockPlatform.OS = "ios"
    await mount(<AppNavigation />)
    expect(mockScreens.surveysHome.options).toEqual(
      expect.objectContaining({
        title: fr.navigation.headers.surveys,
        headerShown: true,
        headerTransparent: false,
        headerBlurEffect: "systemMaterial",
      }),
    )
  })

  test("the account header button opens the settings", async () => {
    await mount(<AppNavigation />)
    const options = (mockScreens.accountHome.options as OptionsFn)({
      navigation: mockNavigation,
    })
    expect(options.title).toBe(fr.navigation.headers.account)
    const button = await mount((options.headerRight as () => React.ReactElement)())
    const pressable = button.root.findByType("Pressable" as unknown as React.ElementType)
    expect(pressable.props.accessibilityLabel).toBe(fr.navigation.a11y.openSettings)
    pressable.props.onPress()
    expect(mockNavigation.navigate).toHaveBeenCalledWith("settings")
  })

  test("the shared stack options follow the platform at load time", () => {
    for (const os of ["ios", "android"] as const) {
      mockPlatform.OS = os
      jest.isolateModules(() => {
        const { baseStackScreenOptions } = jest.requireActual("./stacks/stack-options") as {
          baseStackScreenOptions: Options
        }
        expect("headerTransparent" in baseStackScreenOptions).toBe(os === "ios")
      })
    }
  })
})
