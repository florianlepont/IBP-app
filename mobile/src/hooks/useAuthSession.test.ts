import React from "react"
import renderer, { act } from "react-test-renderer"
import { ApiError } from "../api/client"

const originalConsoleError = console.error

const mockGetMyProfile = jest.fn()
const mockLoginWithCredentials = jest.fn()
const mockLogoutSession = jest.fn()
const mockRefreshAuthTokens = jest.fn()
const mockRegisterWithCredentials = jest.fn()
const mockResendVerificationEmail = jest.fn()
const mockVerifyEmail = jest.fn()
const mockClearStoredAuthSession = jest.fn()
const mockLoadStoredAuthSession = jest.fn()
const mockSaveStoredAuthSession = jest.fn()

jest.mock("../api/ibp-api", () => ({
  getMyProfile: mockGetMyProfile,
  loginWithCredentials: mockLoginWithCredentials,
  logoutSession: mockLogoutSession,
  refreshAuthTokens: mockRefreshAuthTokens,
  registerWithCredentials: mockRegisterWithCredentials,
  resendVerificationEmail: mockResendVerificationEmail,
  verifyEmail: mockVerifyEmail,
}))

jest.mock("../auth/session-storage", () => ({
  clearStoredAuthSession: mockClearStoredAuthSession,
  loadStoredAuthSession: mockLoadStoredAuthSession,
  saveStoredAuthSession: mockSaveStoredAuthSession,
}))

import { useAuthSession } from "./useAuthSession"

const TEST_USER = {
  id: "user-1",
  email: "user@example.com",
  role: "admin",
  first_name: "User",
  last_name: "Example",
  display_name: "Algernon",
  profile_picture_url: null,
}

type HookState = ReturnType<typeof useAuthSession>

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe("useAuthSession", () => {
  let latestHook: HookState
  let reportStatus: jest.Mock
  let onSessionCleared: jest.Mock

  function Harness() {
    latestHook = useAuthSession({
      apiUrl: "https://api.example.com",
      email: " USER@EXAMPLE.COM ",
      password: "Secret123!",
      displayName: "Algernon",
      reportStatus,
      onSessionCleared,
    })
    return null
  }

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("react-test-renderer is deprecated")) {
        return
      }
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    reportStatus = jest.fn()
    onSessionCleared = jest.fn()
    mockLoadStoredAuthSession.mockResolvedValue(null)
    mockClearStoredAuthSession.mockResolvedValue(undefined)
    mockSaveStoredAuthSession.mockResolvedValue(undefined)
    mockLogoutSession.mockResolvedValue(undefined)
    mockResendVerificationEmail.mockResolvedValue({})
    mockVerifyEmail.mockResolvedValue(undefined)
  })

  async function renderHarness() {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(React.createElement(Harness))
      await flushPromises()
    })
    return tree!
  }

  it("starts idle when no stored session exists", async () => {
    await renderHarness()

    expect(reportStatus).toHaveBeenCalledWith("session", "idle", "Ready")
    expect(latestHook.sessionRestoring).toBe(false)
    expect(latestHook.isAuthenticated).toBe(false)
    expect(latestHook.profile).toBe("Not logged in")
  })

  it("restores an existing session and loads the profile", async () => {
    mockLoadStoredAuthSession.mockResolvedValueOnce({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })
    mockGetMyProfile.mockResolvedValueOnce(TEST_USER)

    await renderHarness()

    expect(mockGetMyProfile).toHaveBeenCalledWith("https://api.example.com", "access-token")
    expect(mockSaveStoredAuthSession).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })
    expect(latestHook.currentUser).toEqual(TEST_USER)
    expect(latestHook.profile).toBe("Algernon (user@example.com)")
    expect(reportStatus).toHaveBeenCalledWith("session", "success", "Session restored")
  })

  it("surfaces pending email verification on 403 login and auto-resends in dev mode", async () => {
    mockLoginWithCredentials.mockRejectedValueOnce(new ApiError(403, "Email not verified", null))
    mockResendVerificationEmail.mockResolvedValueOnce({
      email_verification_token_dev: "dev-token",
    })
    await renderHarness()

    await act(async () => {
      await latestHook.handleLogin()
      await flushPromises()
    })

    expect(mockLoginWithCredentials).toHaveBeenCalledWith(
      "https://api.example.com",
      " USER@EXAMPLE.COM ",
      "Secret123!",
      { createIfMissing: false },
    )
    expect(mockResendVerificationEmail).toHaveBeenCalledWith(
      "https://api.example.com",
      "user@example.com",
    )
    expect(latestHook.pendingEmailVerification).toBe("user@example.com")
    expect(latestHook.devVerificationToken).toBe("dev-token")
    expect(reportStatus).toHaveBeenCalledWith("auth", "idle", "")
  })

  it("registers a new account and keeps the session while waiting for email verification", async () => {
    mockRegisterWithCredentials.mockResolvedValueOnce({
      access_token: "access-token",
      refresh_token: "refresh-token",
      user: TEST_USER,
      email_verification_token_dev: "verify-token",
    })
    await renderHarness()

    await act(async () => {
      await latestHook.handleRegister()
      await flushPromises()
    })

    expect(mockSaveStoredAuthSession).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    })
    expect(latestHook.isAuthenticated).toBe(true)
    expect(latestHook.currentUser).toEqual(TEST_USER)
    expect(latestHook.pendingEmailVerification).toBe("user@example.com")
    expect(latestHook.devVerificationToken).toBe("verify-token")
  })

  it("verifies, resends, cancels, and logs out using the expected API calls", async () => {
    mockRegisterWithCredentials.mockResolvedValueOnce({
      access_token: "access-token",
      refresh_token: "refresh-token",
      user: TEST_USER,
      email_verification_token_dev: "verify-token",
    })
    mockResendVerificationEmail.mockResolvedValueOnce({
      email_verification_token_dev: "verify-token-2",
    })
    await renderHarness()

    await act(async () => {
      await latestHook.handleRegister()
      await flushPromises()
    })

    await act(async () => {
      await latestHook.handleResendVerification()
      await latestHook.handleVerifyEmail("verify-token-2")
      await flushPromises()
    })

    expect(mockResendVerificationEmail).toHaveBeenCalledWith(
      "https://api.example.com",
      "user@example.com",
    )
    expect(mockVerifyEmail).toHaveBeenCalledWith("https://api.example.com", "verify-token-2")
    expect(latestHook.pendingEmailVerification).toBeNull()
    expect(latestHook.devVerificationToken).toBeNull()

    await act(async () => {
      await latestHook.handleLogout()
      await flushPromises()
    })

    expect(mockLogoutSession).toHaveBeenCalledWith("https://api.example.com", "access-token")
    expect(mockClearStoredAuthSession).toHaveBeenCalled()
    expect(onSessionCleared).toHaveBeenCalled()
    expect(latestHook.isAuthenticated).toBe(false)
    expect(reportStatus).toHaveBeenCalledWith("auth", "success", "Logged out")

    await act(async () => {
      await latestHook.handleCancelEmailVerification()
      await flushPromises()
    })
    expect(mockClearStoredAuthSession).toHaveBeenCalled()
  })
})
