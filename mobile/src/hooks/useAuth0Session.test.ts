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
}))

jest.mock("../api/ibp-api", () => ({
  getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
}))

import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
import { ApiError } from "../api/client"
import { useAuth0Session } from "./useAuth0Session"

afterEach(async () => {
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
