/**
 * Tab tree tests (phase 01.9-25, D-08 and D-13).
 *
 * Both tab libraries are replaced by fake navigators that record the names of
 * their screens and the native navigator's props. The tests check that both
 * trees register exactly the four tabs and hide the tab bar on parcel
 * selection through the shared rule.
 */

import React from "react"
import renderer, { act } from "react-test-renderer"

const mockPlatform = { OS: "ios" as "android" | "ios" }

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

type ScreenProps = {
  name: string
  options?: unknown
  component?: React.ComponentType<Record<string, unknown>>
}

const mockTabScreens: Record<string, string[]> = {}
const mockNativeNavigatorProps: Record<string, unknown>[] = []
const mockJsSurveysOptions: unknown[] = []
const mockContainer: { onStateChange?: (state: unknown) => void } = {}

function mockCreateTabs(kind: "native" | "js") {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const Navigator = ({ children, ...props }: { children?: React.ReactNode }) => {
    mockTabScreens[kind] = []
    if (kind === "native") mockNativeNavigatorProps.push(props)
    return ReactRef.createElement(ReactRef.Fragment, null, children)
  }
  const Screen = (props: ScreenProps) => {
    mockTabScreens[kind].push(props.name)
    if (kind === "js" && props.name === "surveys") mockJsSurveysOptions.push(props.options)
    return null
  }
  return { Navigator, Screen }
}

jest.mock("@react-navigation/native", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    NavigationContainer: ({
      children,
      onStateChange,
    }: {
      children?: React.ReactNode
      onStateChange?: (state: unknown) => void
    }) => {
      mockContainer.onStateChange = onStateChange
      return ReactRef.createElement(ReactRef.Fragment, null, children)
    },
    getFocusedRouteNameFromRoute: (route: { focused?: string }) => route.focused,
  }
})
jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => mockCreateTabs("js"),
}))
jest.mock("@bottom-tabs/react-navigation", () => ({
  createNativeBottomTabNavigator: () => mockCreateTabs("native"),
}))

jest.mock("./tab-config", () => {
  const actual = jest.requireActual("./tab-config") as Record<string, unknown>
  return {
    ...actual,
    useTabListenerDeps: () => ({}),
    makeSurveysTabListeners: () => ({}),
    makePublicMapTabListeners: () => ({}),
    makeAccountTabListeners: () => ({}),
  }
})
jest.mock("./stacks/HomeStack", () => ({ HomeTabNavigator: () => null }))
jest.mock("./stacks/SurveysStack", () => ({ SurveysTabNavigator: () => null }))
jest.mock("./stacks/PublicMapStack", () => ({ PublicMapTabNavigator: () => null }))
jest.mock("./stacks/AccountStack", () => ({ AccountTabNavigator: () => null }))

import { AppNavigation } from "./AppNavigation"
import { JS_TAB_BAR_STYLE } from "./tab-config"

const FOUR_TABS = ["home", "surveys", "publicMap", "account"]

type Options = Record<string, unknown>
type OptionsFn = (args: Record<string, unknown>) => Options

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "warn").mockImplementation(() => undefined)
  const originalError = console.error
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0] ?? "").includes("react-test-renderer is deprecated")) return
    originalError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  mockPlatform.OS = "ios"
  for (const key of Object.keys(mockTabScreens)) delete mockTabScreens[key]
  mockNativeNavigatorProps.length = 0
  mockJsSurveysOptions.length = 0
  delete mockContainer.onStateChange
})

async function mount() {
  await act(async () => {
    renderer.create(<AppNavigation />)
  })
}

function surveysState(leaf: string) {
  return {
    index: 1,
    routes: [
      { name: "home" },
      {
        name: "surveys",
        state: { index: 1, routes: [{ name: "surveysHome" }, { name: leaf }] },
      },
      { name: "publicMap" },
      { name: "account" },
    ],
  }
}

describe("the four root tabs (D-08)", () => {
  test("the native tree registers exactly the four tabs", async () => {
    await mount()
    expect(mockTabScreens.native).toEqual(FOUR_TABS)
    expect(mockTabScreens.js).toBeUndefined()
  })

  test("the JS tree registers exactly the four tabs", async () => {
    mockPlatform.OS = "android"
    await mount()
    expect(mockTabScreens.js).toEqual(FOUR_TABS)
    expect(mockTabScreens.native).toBeUndefined()
  })
})

describe("the tab bar is hidden on parcel selection in both trees (D-13)", () => {
  test("native tree: tabBarHidden follows the focused leaf route", async () => {
    await mount()
    expect(mockNativeNavigatorProps.at(-1)?.tabBarHidden).toBe(false)

    await act(async () => {
      mockContainer.onStateChange?.(surveysState("surveyParcels"))
    })
    expect(mockNativeNavigatorProps.at(-1)?.tabBarHidden).toBe(true)

    await act(async () => {
      mockContainer.onStateChange?.({
        index: 1,
        routes: [
          { name: "home" },
          { name: "surveys", state: { index: 0, routes: [{ name: "surveysHome" }] } },
        ],
      })
    })
    expect(mockNativeNavigatorProps.at(-1)?.tabBarHidden).toBe(false)

    await act(async () => {
      mockContainer.onStateChange?.(undefined)
    })
    expect(mockNativeNavigatorProps.at(-1)?.tabBarHidden).toBe(false)
  })

  test("native tree: a state change that keeps the bar does not re-render the tabs", async () => {
    await mount()
    const renders = mockNativeNavigatorProps.length
    await act(async () => {
      mockContainer.onStateChange?.(surveysState("surveyDetail"))
      mockContainer.onStateChange?.(surveysState("surveyForm"))
    })
    expect(mockNativeNavigatorProps).toHaveLength(renders)
  })

  test("JS tree: the surveys tab bar is display none on parcel selection only", async () => {
    mockPlatform.OS = "android"
    await mount()
    expect(mockContainer.onStateChange).toBeUndefined()
    const options = mockJsSurveysOptions.at(-1) as OptionsFn
    expect(options({ route: { focused: "surveyParcels" } }).tabBarStyle).toEqual({
      display: "none",
    })
    expect(options({ route: { focused: "surveysHome" } }).tabBarStyle).toEqual(JS_TAB_BAR_STYLE)
    expect(options({ route: {} }).tabBarStyle).toEqual(JS_TAB_BAR_STYLE)
  })
})
