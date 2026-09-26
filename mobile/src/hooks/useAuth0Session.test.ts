/**
 * Tests for useAuth0Session (mobile audit M-C1 / D-01 / D-01a / D-13).
 *
 * Uses the renderHook recipe from render-hook-smoke.test.ts: renderHook/act
 * are async, "react-native" must be jest.mock'ed before importing the "/pure"
 * entry point of @testing-library/react-native.
 */

jest.mock("react-native", () => ({}))

// Variables starting with "mock" can be referenced inside jest.mock factories
// despite hoisting — this is a Jest-specific allowance.
const mockGetCredentials = jest.fn()
const mockHasValidCredentials = jest.fn()
const mockSaveCredentials = jest.fn()
const mockClearCredentials = jest.fn()
const mockAuthorize = jest.fn()
const mockWebAuthClearSession = jest.fn()
const mockGetNetworkStateAsync = jest.fn()
const mockGetMyProfile = jest.fn()
const mockAddNetworkStateListener = jest.fn()
const mockLoadCachedProfile = jest.fn()
const mockSaveCachedProfile = jest.fn()
const mockClearCachedProfile = jest.fn()
const mockRemoveNetworkListener = jest.fn()

class MockCredentialsManagerError extends Error {
  type: string
  constructor(type: string) {
    super(`CredentialsManagerError: ${type}`)
    this.type = type
  }
}

jest.mock("react-native-auth0", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    credentialsManager: {
      getCredentials: (...args: unknown[]) => mockGetCredentials(...args),
      hasValidCredentials: (...args: unknown[]) => mockHasValidCredentials(...args),
      saveCredentials: (...args: unknown[]) => mockSaveCredentials(...args),
      clearCredentials: (...args: unknown[]) => mockClearCredentials(...args),
    },
    webAuth: {
      authorize: (...args: unknown[]) => mockAuthorize(...args),
      clearSession: (...args: unknown[]) => mockWebAuthClearSession(...args),
    },
  })),
  CredentialsManagerError: MockCredentialsManagerError,
  CredentialsManagerErrorCodes: {
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    NO_CREDENTIALS: "NO_CREDENTIALS",
    NO_REFRESH_TOKEN: "NO_REFRESH_TOKEN",
    RENEW_FAILED: "RENEW_FAILED",
    STORE_FAILED: "STORE_FAILED",
    REVOKE_FAILED: "REVOKE_FAILED",
    LARGE_MIN_TTL: "LARGE_MIN_TTL",
    CREDENTIAL_MANAGER_ERROR: "CREDENTIAL_MANAGER_ERROR",
    BIOMETRICS_FAILED: "BIOMETRICS_FAILED",
    NO_NETWORK: "NO_NETWORK",
    API_ERROR: "API_ERROR",
    API_EXCHANGE_FAILED: "API_EXCHANGE_FAILED",
    INCOMPATIBLE_DEVICE: "INCOMPATIBLE_DEVICE",
    CRYPTO_EXCEPTION: "CRYPTO_EXCEPTION",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
  },
}))

jest.mock("expo-network", () => ({
  getNetworkStateAsync: (...args: unknown[]) => mockGetNetworkStateAsync(...args),
  addNetworkStateListener: (...args: unknown[]) => mockAddNetworkStateListener(...args),
}))

jest.mock("../api/ibp-api", () => ({
  getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
}))

// Mocked the way sync-owner-gate.test.ts:18-22 mocks "../storage/local-owner".
jest.mock("../storage/profile-cache", () => ({
  loadCachedProfile: (...args: unknown[]) => mockLoadCachedProfile(...args),
  saveCachedProfile: (...args: unknown[]) => mockSaveCachedProfile(...args),
  clearCachedProfile: (...args: unknown[]) => mockClearCachedProfile(...args),
}))

import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
import { ApiError } from "../api/client"
import { fr } from "../i18n"
import { useAuth0Session } from "./useAuth0Session"

// logStatusDetail writes raw error detail to console.debug in dev builds.
let consoleDebug: jest.SpyInstance
beforeEach(() => {
  consoleDebug = jest.spyOn(console, "debug").mockImplementation(() => undefined)
})

afterEach(async () => {
  consoleDebug.mockRestore()
  await cleanup()
})

function credErr(type: string): MockCredentialsManagerError {
  return new MockCredentialsManagerError(type)
}

function base64url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function buildIdToken(sub: string, email?: string): string {
  const header = base64url(JSON.stringify({ alg: "RS256" }))
  const payload = base64url(JSON.stringify({ sub, ...(email ? { email } : {}) }))
  return `${header}.${payload}.sig`
}

const REPORT_STATUS = jest.fn()

function setup() {
  return renderHook(() =>
    useAuth0Session({
      apiUrl: "https://api.example.test/v1",
      reportStatus: REPORT_STATUS,
      onSessionCleared: mockOnSessionCleared,
    }),
  )
}

const mockOnSessionCleared = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true })
  mockGetMyProfile.mockResolvedValue(null)
  mockLoadCachedProfile.mockResolvedValue(null)
  mockSaveCachedProfile.mockResolvedValue(undefined)
  mockClearCachedProfile.mockResolvedValue(undefined)
  mockAddNetworkStateListener.mockImplementation(() => ({ remove: mockRemoveNetworkListener }))
})

describe("session restore", () => {
  test("NO_NETWORK during restore never ends the session", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(credErr("NO_NETWORK"))

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockOnSessionCleared).not.toHaveBeenCalled()
  })

  test("RENEW_FAILED while offline never ends the session", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(credErr("RENEW_FAILED"))
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: false, isInternetReachable: false })

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockOnSessionCleared).not.toHaveBeenCalled()
  })

  test("RENEW_FAILED while online ends the session", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(credErr("RENEW_FAILED"))
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true })

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockOnSessionCleared).toHaveBeenCalledTimes(1)
  })

  test("NO_CREDENTIALS ends the session", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(credErr("NO_CREDENTIALS"))

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockOnSessionCleared).toHaveBeenCalledTimes(1)
  })

  test("a plain timeout Error during restore never ends the session", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(new Error("timeout"))

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockOnSessionCleared).not.toHaveBeenCalled()
  })

  test("restore success exposes the session owner from the ID token", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockResolvedValue({
      accessToken: "access-1",
      idToken: buildIdToken("auth0|abc", "a@b.fr"),
    })
    mockGetMyProfile.mockResolvedValue({
      display_name: "A",
      email: "a@b.fr",
    })

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(result.current.sessionOwner).toEqual({ sub: "auth0|abc", email: "a@b.fr" })
  })
})

describe("withAuthRetry", () => {
  test("NO_NETWORK rejects with AUTH_TEMPORARILY_UNAVAILABLE, no session clear", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockRejectedValue(credErr("NO_NETWORK"))
    const operation = jest.fn()

    await expect(result.current.withAuthRetry(operation)).rejects.toThrow(
      "AUTH_TEMPORARILY_UNAVAILABLE",
    )
    expect(mockOnSessionCleared).not.toHaveBeenCalled()
    expect(operation).not.toHaveBeenCalled()
  })

  test("RENEW_FAILED while online rejects with AUTH_REQUIRED", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockRejectedValue(credErr("RENEW_FAILED"))
    mockGetNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true })

    await expect(result.current.withAuthRetry(jest.fn())).rejects.toThrow("AUTH_REQUIRED")
  })

  test("a 401 forces a refresh via getCredentials(undefined, undefined, undefined, true)", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials
      .mockResolvedValueOnce({ accessToken: "token-1" })
      .mockResolvedValueOnce({ accessToken: "token-2" })

    const operation = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(401, "Unauthorized", null))
      .mockResolvedValueOnce("ok")

    const value = await result.current.withAuthRetry(operation)

    expect(value).toBe("ok")
    expect(mockGetCredentials).toHaveBeenNthCalledWith(2, undefined, undefined, undefined, true)
    expect(operation).toHaveBeenNthCalledWith(2, "token-2", null)
  })

  test("passes the operation the sub of the account the token belongs to (CR-01)", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({
      accessToken: "token-b",
      idToken: buildIdToken("auth0|b", "b@c.fr"),
    })
    const operation = jest.fn().mockResolvedValue("ok")

    await result.current.withAuthRetry(operation)

    expect(operation).toHaveBeenCalledWith("token-b", "auth0|b")
  })

  test("a non-401 error is rethrown without forcing a refresh", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({ accessToken: "token-1" })
    const operation = jest.fn().mockRejectedValue(new Error("boom"))

    await expect(result.current.withAuthRetry(operation)).rejects.toThrow("boom")
    expect(mockGetCredentials).toHaveBeenCalledTimes(1)
  })
})

describe("email already linked to another account (WR-04)", () => {
  const linkedError = () =>
    new ApiError(403, "This email address already belongs to another account", {
      statusCode: 403,
      code: "email_already_linked",
      message: "This email address already belongs to another account",
    })

  test("a 403 is rethrown by withAuthRetry without forcing a token refresh", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({ accessToken: "token-1" })
    const operation = jest.fn().mockRejectedValue(linkedError())

    await expect(result.current.withAuthRetry(operation)).rejects.toMatchObject({ status: 403 })
    expect(operation).toHaveBeenCalledTimes(1)
    expect(mockGetCredentials).toHaveBeenCalledTimes(1)
    expect(mockGetCredentials).not.toHaveBeenCalledWith(undefined, undefined, undefined, true)
  })

  test("handleLogin shows a clear French message and drops the refused session", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockAuthorize.mockResolvedValue({
      accessToken: "token-b",
      idToken: buildIdToken("google-oauth2|b", "a@b.fr"),
    })
    mockSaveCredentials.mockResolvedValue(undefined)
    mockClearCredentials.mockResolvedValue(undefined)
    mockGetMyProfile.mockRejectedValue(linkedError())

    let message: string | null = null
    await act(async () => {
      message = await result.current.handleLogin()
    })

    expect(message).toContain("déjà associée à un autre compte")
    expect(REPORT_STATUS).toHaveBeenCalledWith(
      "auth",
      "error",
      expect.stringContaining("déjà associée à un autre compte"),
    )
    expect(mockClearCredentials).toHaveBeenCalled()
    expect(result.current.accessToken).toBe("")
    expect(result.current.sessionOwner).toBeNull()
    expect(mockGetCredentials).not.toHaveBeenCalledWith(undefined, undefined, undefined, true)
  })

  test("handleRegister maps the same 403 to the same message", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockAuthorize.mockResolvedValue({ accessToken: "token-b", idToken: buildIdToken("auth0|b") })
    mockSaveCredentials.mockResolvedValue(undefined)
    mockClearCredentials.mockResolvedValue(undefined)
    mockGetMyProfile.mockRejectedValue(linkedError())

    let message: string | null = null
    await act(async () => {
      message = await result.current.handleRegister()
    })

    expect(message).toContain("déjà associée à un autre compte")
    expect(mockClearCredentials).toHaveBeenCalled()
  })
})

describe("pre-Auth0 stub removal (D-02, ROADMAP criterion 7)", () => {
  test("the returned object has no refreshToken / pendingEmailVerification / devVerificationToken keys", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(result.current).not.toHaveProperty("refreshToken")
    expect(result.current).not.toHaveProperty("pendingEmailVerification")
    expect(result.current).not.toHaveProperty("devVerificationToken")
    expect(result.current).not.toHaveProperty("handleVerifyEmail")
    expect(result.current).not.toHaveProperty("handleResendVerification")
    expect(result.current).not.toHaveProperty("handleCancelEmailVerification")
  })
})

describe("refreshSessionTokens", () => {
  test("resolves { accessToken } and forces a refresh via getCredentials(..., true)", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({ accessToken: "refreshed-token" })

    const refreshed = await result.current.refreshSessionTokens()

    expect(refreshed).toEqual({ accessToken: "refreshed-token" })
    expect(refreshed).not.toHaveProperty("refreshToken")
    expect(mockGetCredentials).toHaveBeenCalledWith(undefined, undefined, undefined, true)
  })

  test("resolves null when the refresh is a genuine AUTH_REQUIRED rejection", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockRejectedValue(credErr("NO_REFRESH_TOKEN"))

    await expect(result.current.refreshSessionTokens()).resolves.toBeNull()
  })
})

describe("D-13 offline cold start: cached profile", () => {
  const cachedUser = {
    id: "user-cached",
    email: "cached@example.fr",
    display_name: "Cached User",
    role: "member",
    first_name: "Cached",
    last_name: "User",
    profile_picture_url: null,
  }

  const newerUser = {
    id: "user-cached",
    email: "cached@example.fr",
    display_name: "Newer User",
    role: "member",
    first_name: "Newer",
    last_name: "User",
    profile_picture_url: null,
  }

  test("restore offline with a usable cache for the id-token sub: isAuthenticated true, currentUser is the cached user", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockResolvedValue({
      accessToken: "access-1",
      idToken: buildIdToken("auth0|cached", "cached@example.fr"),
    })
    mockGetMyProfile.mockRejectedValue(new TypeError("Network request failed"))
    mockLoadCachedProfile.mockResolvedValue(cachedUser)

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.currentUser).toEqual(cachedUser)
    expect(mockLoadCachedProfile).toHaveBeenCalledWith("auth0|cached")
  })

  test("restore offline with no usable cache: isAuthenticated stays false (previous behaviour)", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockResolvedValue({
      accessToken: "access-1",
      idToken: buildIdToken("auth0|nocache", "nocache@example.fr"),
    })
    mockGetMyProfile.mockRejectedValue(new TypeError("Network request failed"))
    mockLoadCachedProfile.mockResolvedValue(null)

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(result.current.isAuthenticated).toBe(false)
    expect(mockLoadCachedProfile).toHaveBeenCalledWith("auth0|nocache")
  })

  test("restore online writes the profile to the cache", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockResolvedValue({
      accessToken: "access-1",
      idToken: buildIdToken("auth0|online", "online@example.fr"),
    })
    mockGetMyProfile.mockResolvedValue(cachedUser)

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockSaveCachedProfile).toHaveBeenCalledWith("auth0|online", cachedUser)
  })

  test("login success calls saveCachedProfile with the token's sub", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockAuthorize.mockResolvedValue({
      accessToken: "token-login",
      idToken: buildIdToken("auth0|login", "login@example.fr"),
    })
    mockSaveCredentials.mockResolvedValue(undefined)
    mockGetMyProfile.mockResolvedValue(cachedUser)

    await act(async () => {
      await result.current.handleLogin()
    })

    expect(mockSaveCachedProfile).toHaveBeenCalledWith("auth0|login", cachedUser)
  })

  test("handleLoadMyProfile success calls saveCachedProfile with the token's sub", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({
      accessToken: "token-load",
      idToken: buildIdToken("auth0|load", "load@example.fr"),
    })
    mockGetMyProfile.mockResolvedValue(cachedUser)

    await act(async () => {
      await result.current.handleLoadMyProfile()
    })

    expect(mockSaveCachedProfile).toHaveBeenCalledWith("auth0|load", cachedUser)
  })

  test("once online again, the cached profile refreshes and the network listener is removed", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockResolvedValue({
      accessToken: "access-1",
      idToken: buildIdToken("auth0|refresh", "refresh@example.fr"),
    })
    mockGetMyProfile.mockRejectedValueOnce(new TypeError("Network request failed"))
    mockLoadCachedProfile.mockResolvedValue(cachedUser)

    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))
    expect(result.current.currentUser).toEqual(cachedUser)
    expect(mockAddNetworkStateListener).toHaveBeenCalledTimes(1)

    const listener = mockAddNetworkStateListener.mock.calls[0][0] as (state: {
      isConnected: boolean
      isInternetReachable: boolean
    }) => void

    mockGetMyProfile.mockResolvedValue(newerUser)

    await act(async () => {
      listener({ isConnected: true, isInternetReachable: true })
    })
    await waitFor(() => expect(result.current.currentUser).toEqual(newerUser))

    expect(mockSaveCachedProfile).toHaveBeenCalledWith("auth0|refresh", newerUser)
    expect(mockRemoveNetworkListener).toHaveBeenCalled()
  })

  test("while online, /me keeps failing: retried every 60s, retry stops after it succeeds", async () => {
    jest.useFakeTimers()
    try {
      mockHasValidCredentials.mockResolvedValue(true)
      mockGetCredentials.mockResolvedValue({
        accessToken: "access-1",
        idToken: buildIdToken("auth0|retry", "retry@example.fr"),
      })
      mockGetMyProfile.mockRejectedValueOnce(new TypeError("Network request failed"))
      mockLoadCachedProfile.mockResolvedValue(cachedUser)

      const { result } = await setup()
      await waitFor(() => expect(result.current.sessionRestoring).toBe(false))
      expect(result.current.currentUser).toEqual(cachedUser)

      const callsBefore = mockGetMyProfile.mock.calls.length

      mockGetMyProfile.mockResolvedValue(newerUser)

      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000)
      })

      expect(mockGetMyProfile.mock.calls.length).toBe(callsBefore + 1)
      await waitFor(() => expect(result.current.currentUser).toEqual(newerUser))

      const callsAfterSuccess = mockGetMyProfile.mock.calls.length

      await act(async () => {
        await jest.advanceTimersByTimeAsync(120_000)
      })

      expect(mockGetMyProfile.mock.calls.length).toBe(callsAfterSuccess)
    } finally {
      jest.useRealTimers()
    }
  })

  test("handleLogout calls clearCachedProfile", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockWebAuthClearSession.mockResolvedValue(undefined)
    mockClearCredentials.mockResolvedValue(undefined)

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(mockClearCachedProfile).toHaveBeenCalled()
  })

  test("a restore classified session-ended calls clearCachedProfile", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(credErr("NO_CREDENTIALS"))

    const { result } = await setup()

    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(mockClearCachedProfile).toHaveBeenCalled()
  })

  test("a handleLoadMyProfile failure that is not AUTH_REQUIRED never calls clearCachedProfile", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({ accessToken: "token-1" })
    mockGetMyProfile.mockRejectedValue(new TypeError("Network request failed"))

    await act(async () => {
      await result.current.handleLoadMyProfile()
    })

    expect(mockClearCachedProfile).not.toHaveBeenCalled()
    expect(result.current.currentUser).toBeNull()
  })
})

describe("status texts from the French catalogue (D-06)", () => {
  const text = fr.status.session

  test("a launch without stored credentials reports the ready text", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(REPORT_STATUS).toHaveBeenCalledWith("session", "idle", text.ready())
  })

  test("a restore classified session-ended reports the expired-session text", async () => {
    mockHasValidCredentials.mockResolvedValue(true)
    mockGetCredentials.mockRejectedValue(credErr("NO_CREDENTIALS"))

    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    expect(REPORT_STATUS).toHaveBeenCalledWith("session", "error", text.restoreExpired())
  })

  test("a login failure shows the catalogue text, never the raw error", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockAuthorize.mockRejectedValue(new Error("a0.browser_terminated code 42"))

    let message: string | null = null
    await act(async () => {
      message = await result.current.handleLogin()
    })

    expect(message).toBe(text.loginFailed())
    expect(REPORT_STATUS).toHaveBeenCalledWith("auth", "error", text.loginFailed())
    for (const [, , reported] of REPORT_STATUS.mock.calls) {
      expect(reported).not.toContain("a0.browser_terminated")
    }
  })

  test("a login success reports the logged-in text", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockAuthorize.mockResolvedValue({ accessToken: "token-ok", idToken: buildIdToken("auth0|ok") })
    mockSaveCredentials.mockResolvedValue(undefined)
    mockGetMyProfile.mockResolvedValue({ id: "user-1", email: "ok@example.fr", display_name: "Ok" })

    await act(async () => {
      await result.current.handleLogin()
    })

    expect(REPORT_STATUS).toHaveBeenCalledWith("auth", "running", text.loggingIn())
    expect(REPORT_STATUS).toHaveBeenCalledWith("auth", "success", text.loggedIn())
  })

  test("a profile load failure reports the catalogue text without the error", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockGetCredentials.mockResolvedValue({ accessToken: "token-1" })
    mockGetMyProfile.mockRejectedValue(new Error("HTTP 500 internal_error"))

    await act(async () => {
      await result.current.handleLoadMyProfile()
    })

    expect(REPORT_STATUS).toHaveBeenCalledWith("profile", "error", text.profileLoadFailed())
    expect(REPORT_STATUS).not.toHaveBeenCalledWith(
      "profile",
      "error",
      expect.stringContaining("internal_error"),
    )
  })

  test("logout reports the logged-out text", async () => {
    mockHasValidCredentials.mockResolvedValue(false)
    const { result } = await setup()
    await waitFor(() => expect(result.current.sessionRestoring).toBe(false))

    mockWebAuthClearSession.mockResolvedValue(undefined)
    mockClearCredentials.mockResolvedValue(undefined)

    await act(async () => {
      await result.current.handleLogout()
    })

    expect(REPORT_STATUS).toHaveBeenCalledWith("auth", "success", text.loggedOut())
  })
})
