const mockPlatform = { OS: "ios" as string }

jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatform.OS
    },
  },
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

import { getNativeTabsAvailability } from "./native-tabs-availability"

const IOS_RELEASE = {
  platformOS: "ios",
  envOptOut: false,
  executionEnvironment: "bare",
  appOwnership: null,
  isDev: false,
} as const

describe("getNativeTabsAvailability (D-08, C-7)", () => {
  beforeEach(() => {
    mockPlatform.OS = "ios"
    mockConstants.executionEnvironment = "bare"
    mockConstants.appOwnership = null
    delete process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS
  })

  test("Android uses the JS tabs (platform)", () => {
    expect(getNativeTabsAvailability({ ...IOS_RELEASE, platformOS: "android" })).toEqual({
      native: false,
      reason: "platform",
      envOptOutIgnored: false,
    })
  })

  test("Expo Go detected by the store client environment", () => {
    expect(
      getNativeTabsAvailability({ ...IOS_RELEASE, executionEnvironment: "storeClient" }),
    ).toEqual({ native: false, reason: "expo-go", envOptOutIgnored: false })
  })

  test("Expo Go detected by the app ownership", () => {
    expect(getNativeTabsAvailability({ ...IOS_RELEASE, appOwnership: "expo" })).toEqual({
      native: false,
      reason: "expo-go",
      envOptOutIgnored: false,
    })
  })

  test("Expo Go wins over the env opt-out", () => {
    expect(
      getNativeTabsAvailability({
        ...IOS_RELEASE,
        appOwnership: "expo",
        envOptOut: true,
        isDev: true,
      }).reason,
    ).toBe("expo-go")
  })

  test("the env opt-out forces the JS tabs in a dev build", () => {
    expect(getNativeTabsAvailability({ ...IOS_RELEASE, envOptOut: true, isDev: true })).toEqual({
      native: false,
      reason: "env-opt-out",
      envOptOutIgnored: false,
    })
  })

  test("a Release build ignores the env opt-out and stays native", () => {
    expect(getNativeTabsAvailability({ ...IOS_RELEASE, envOptOut: true, isDev: false })).toEqual({
      native: true,
      reason: "ok",
      envOptOutIgnored: true,
    })
  })

  test("an iOS build without opt-out uses the native tabs, dev or Release", () => {
    expect(getNativeTabsAvailability(IOS_RELEASE)).toEqual({
      native: true,
      reason: "ok",
      envOptOutIgnored: false,
    })
    expect(getNativeTabsAvailability({ ...IOS_RELEASE, isDev: true })).toEqual({
      native: true,
      reason: "ok",
      envOptOutIgnored: false,
    })
  })

  test("defaults read the platform, the env flag and expo-constants", () => {
    expect(getNativeTabsAvailability({ isDev: false })).toEqual({
      native: true,
      reason: "ok",
      envOptOutIgnored: false,
    })

    process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS = "false"
    expect(getNativeTabsAvailability({ isDev: true }).reason).toBe("env-opt-out")
    expect(getNativeTabsAvailability({ isDev: false }).envOptOutIgnored).toBe(true)

    // Any other value is not an opt-out.
    process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS = "true"
    expect(getNativeTabsAvailability({ isDev: true }).reason).toBe("ok")

    mockConstants.executionEnvironment = "storeClient"
    expect(getNativeTabsAvailability({ isDev: false }).reason).toBe("expo-go")
    mockConstants.executionEnvironment = "bare"
    mockConstants.appOwnership = "expo"
    expect(getNativeTabsAvailability({ isDev: false }).reason).toBe("expo-go")

    mockPlatform.OS = "android"
    expect(getNativeTabsAvailability().reason).toBe("platform")
  })
})
