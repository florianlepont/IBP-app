/**
 * Tests for useSurveySyncNetwork.
 *
 * Strategy: spy on React.useRef / useEffect / useCallback so the hook can be
 * called directly in Node without a renderer (same pattern as useEditingDraft).
 */

const mockSyncPending = jest.fn()
const mockHasPendingSyncWork = jest.fn()
const mockPullRemoteChanges = jest.fn()
const mockCreateSurveyReport = jest.fn()

jest.mock("../../storage", () => ({
  syncPending: mockSyncPending,
  hasPendingSyncWork: mockHasPendingSyncWork,
  pullRemoteChanges: mockPullRemoteChanges,
}))

jest.mock("../../api/ibp-api", () => ({
  createSurveyReport: mockCreateSurveyReport,
}))

// auth-errors.ts imports react-native-auth0 for CredentialsManagerError; mock it
// minimally so the module resolves under the node test environment (no native code).
jest.mock("react-native-auth0", () => ({
  CredentialsManagerError: class MockCredentialsManagerError extends Error {},
  CredentialsManagerErrorCodes: {},
}))

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest
    .fn()
    .mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addNetworkStateListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  NetworkStateType: { WIFI: "WIFI", NONE: "NONE", CELLULAR: "CELLULAR" },
}))

import React from "react"
import { useSurveySyncNetwork } from "./useSurveySyncNetwork"
import { createSyncActivity } from "./sync-activity"

function useBuildHook(overrides: Record<string, unknown> = {}) {
  const params = {
    apiUrl: "http://localhost:3000",
    accessToken: "access-token",
    surveys: [],
    clearSession: jest.fn().mockResolvedValue(undefined),
    withAuthRetry: jest.fn((fn: (token: string, tokenSub: string | null) => unknown) =>
      fn("token", "auth0|owner"),
    ),
    refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
    refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
    setStatus: jest.fn(),
    syncAllowed: true,
    ensureSyncOwner: jest.fn().mockResolvedValue(true),
    ownerStatus: "ok",
    recheckOwner: jest.fn().mockResolvedValue(undefined),
    syncActivity: createSyncActivity(),
    ...overrides,
  }
  const hook = useSurveySyncNetwork(params as never)
  return { ...hook, ...params }
}

describe("useSurveySyncNetwork", () => {
  let useRefSpy: jest.SpyInstance
  let useEffectSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    useRefSpy = jest
      .spyOn(React, "useRef")
      .mockImplementation((initial: unknown) => ({ current: initial }))
    useEffectSpy = jest.spyOn(React, "useEffect").mockImplementation(() => undefined)
    useCallbackSpy = jest.spyOn(React, "useCallback").mockImplementation((fn) => fn as never)
  })

  afterEach(() => {
    useRefSpy.mockRestore()
    useEffectSpy.mockRestore()
    useCallbackSpy.mockRestore()
  })

  describe("handleSync", () => {
    test("calls syncPending and refreshes data on success", async () => {
      mockSyncPending.mockResolvedValue({
        synced: 2,
        failed: 0,
        pulled_surveys: 1,
        pulled_attachments: 0,
      })
      const { handleSync, setStatus, refreshLocalSurveys, refreshLocalAttachments } = useBuildHook()

      await handleSync()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Sync complete"))
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("2 synced"))
      expect(refreshLocalSurveys).toHaveBeenCalled()
      expect(refreshLocalAttachments).toHaveBeenCalled()
    })

    test("calls clearSession on AUTH_REQUIRED error", async () => {
      const { handleSync, clearSession, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handleSync()

      expect(clearSession).toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Login required"))
    })

    test("AUTH_TEMPORARILY_UNAVAILABLE keeps the session and reports retry-later", async () => {
      const { handleSync, clearSession, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_TEMPORARILY_UNAVAILABLE")),
      })

      await handleSync()

      expect(clearSession).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Synchronisation reportée"))
    })

    test("sets error status on generic error", async () => {
      const { handleSync, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Network timeout")),
      })

      await handleSync()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Network timeout"))
    })
  })

  describe("handlePullChanges", () => {
    test("pulls changes and sets status on success", async () => {
      mockPullRemoteChanges.mockResolvedValue({ surveys: 3, attachments: 1, pages: 2 })
      const { handlePullChanges, setStatus, refreshLocalSurveys, refreshLocalAttachments } =
        useBuildHook()

      await handlePullChanges()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Pull complete"))
      expect(refreshLocalSurveys).toHaveBeenCalled()
      expect(refreshLocalAttachments).toHaveBeenCalled()
    })

    test("calls clearSession on AUTH_REQUIRED", async () => {
      const { handlePullChanges, clearSession } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      await handlePullChanges()

      expect(clearSession).toHaveBeenCalled()
    })

    test("AUTH_TEMPORARILY_UNAVAILABLE keeps the session and reports retry-later", async () => {
      const { handlePullChanges, clearSession, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_TEMPORARILY_UNAVAILABLE")),
      })

      await handlePullChanges()

      expect(clearSession).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Synchronisation reportée"))
    })

    test("sets error status on generic error", async () => {
      const { handlePullChanges, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Connection refused")),
      })

      await handlePullChanges()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Connection refused"))
    })
  })

  describe("handleReportSurvey", () => {
    test("returns error and sets status when surveyId is empty", async () => {
      const { handleReportSurvey, setStatus } = useBuildHook()

      const result = await handleReportSurvey("", "spam")

      expect(result.ok).toBe(false)
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("required"))
    })

    test("returns error when reason is empty", async () => {
      const { handleReportSurvey, setStatus } = useBuildHook()

      const result = await handleReportSurvey("survey-1", "")

      expect(result.ok).toBe(false)
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("required"))
    })

    test("returns ok:true and sets status on successful report", async () => {
      mockCreateSurveyReport.mockResolvedValue({})
      const { handleReportSurvey, setStatus } = useBuildHook()

      const result = await handleReportSurvey("survey-1", "This is spam content")

      expect(result.ok).toBe(true)
      expect(result.message).toContain("moderation")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("moderation"))
    })

    test("calls clearSession and returns ok:false on AUTH_REQUIRED", async () => {
      const { handleReportSurvey, clearSession } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })

      const result = await handleReportSurvey("survey-1", "spam reason")

      expect(clearSession).toHaveBeenCalled()
      expect(result.ok).toBe(false)
    })

    test("AUTH_TEMPORARILY_UNAVAILABLE keeps the session and returns ok:false", async () => {
      const { handleReportSurvey, clearSession } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_TEMPORARILY_UNAVAILABLE")),
      })

      const result = await handleReportSurvey("survey-1", "spam reason")

      expect(clearSession).not.toHaveBeenCalled()
      expect(result.ok).toBe(false)
      expect(result.message).toContain("Signalement non envoyé")
    })

    test("returns ok:false and sets error status on generic failure", async () => {
      const { handleReportSurvey, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Report failed")),
      })

      const result = await handleReportSurvey("survey-1", "some reason")

      expect(result.ok).toBe(false)
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Report failed"))
    })

    test("trims surveyId and reason before sending", async () => {
      mockCreateSurveyReport.mockResolvedValue({})
      const { handleReportSurvey } = useBuildHook()

      const result = await handleReportSurvey("  survey-1  ", "  spam  ")

      expect(result.ok).toBe(true)
    })
  })

  describe("maybeAutoSync", () => {
    test("does nothing when lastOnlineState is not true", async () => {
      const { maybeAutoSync, withAuthRetry } = useBuildHook()
      // lastOnlineStateRef starts as null (from useRef spy)
      await maybeAutoSync("startup")
      expect(withAuthRetry).not.toHaveBeenCalled()
    })
  })

  // ─── D-04 owner gate (syncAllowed) ────────────────────────────────────────

  describe("syncAllowed gate (D-04)", () => {
    test("handleSync does not call withAuthRetry and sets the suspension status when syncAllowed is false", async () => {
      const { handleSync, setStatus, withAuthRetry } = useBuildHook({
        syncAllowed: false,
        ownerStatus: "conflict",
      })

      await handleSync()

      expect(withAuthRetry).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(
        "Synchronisation suspendue : des relevés locaux appartiennent à un autre compte.",
      )
    })

    test("maybeAutoSync does not call syncPending or pullRemoteChanges when syncAllowed is false, even online with pending work", async () => {
      // Force lastOnlineStateRef (3rd useRef call) to start "online" so the
      // syncAllowed gate — not the online gate — is what's under test.
      let refCallIndex = 0
      useRefSpy.mockRestore()
      useRefSpy = jest.spyOn(React, "useRef").mockImplementation(((initial: unknown) => {
        refCallIndex += 1
        if (refCallIndex === 3) {
          return { current: true }
        }
        return { current: initial }
      }) as never)
      mockHasPendingSyncWork.mockResolvedValue(true)

      const { maybeAutoSync } = useBuildHook({ syncAllowed: false, ownerStatus: "conflict" })
      await maybeAutoSync("auth-ready")

      expect(mockHasPendingSyncWork).not.toHaveBeenCalled()
      expect(mockSyncPending).not.toHaveBeenCalled()
      expect(mockPullRemoteChanges).not.toHaveBeenCalled()
    })

    test("handlePullChanges does not call pullRemoteChanges when syncAllowed is false", async () => {
      const { handlePullChanges, setStatus, withAuthRetry } = useBuildHook({
        syncAllowed: false,
        ownerStatus: "conflict",
      })

      await handlePullChanges()

      expect(withAuthRetry).not.toHaveBeenCalled()
      expect(mockPullRemoteChanges).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(
        "Synchronisation suspendue : des relevés locaux appartiennent à un autre compte.",
      )
    })

    test("WR-07: a failed owner check retries it on manual sync and does not blame another account", async () => {
      const { handleSync, setStatus, withAuthRetry, recheckOwner } = useBuildHook({
        syncAllowed: false,
        ownerStatus: "error",
      })

      await handleSync()

      expect(withAuthRetry).not.toHaveBeenCalled()
      expect(recheckOwner).toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalledWith(
        "Synchronisation suspendue : des relevés locaux appartiennent à un autre compte.",
      )
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Vérification"))
    })

    test("WR-07: a manual pull during the owner check reports the check, not a conflict", async () => {
      const { handlePullChanges, setStatus, recheckOwner } = useBuildHook({
        syncAllowed: false,
        ownerStatus: "checking",
      })

      await handlePullChanges()

      expect(recheckOwner).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Vérification"))
    })

    test("handleReportSurvey is not gated by syncAllowed", async () => {
      mockCreateSurveyReport.mockResolvedValue({})
      const { handleReportSurvey } = useBuildHook({ syncAllowed: false, ownerStatus: "conflict" })

      const result = await handleReportSurvey("survey-1", "reason text")

      expect(result.ok).toBe(true)
      expect(mockCreateSurveyReport).toHaveBeenCalled()
    })

    test("handleSync re-checks the owner with the token's sub right before syncPending (CR-01)", async () => {
      const ensureSyncOwner = jest.fn().mockResolvedValue(false)
      const { handleSync, setStatus } = useBuildHook({ ensureSyncOwner })

      await handleSync()

      expect(ensureSyncOwner).toHaveBeenCalledWith("auth0|owner")
      expect(mockSyncPending).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("vérification du compte"))
    })

    test("handlePullChanges re-checks the owner right before pullRemoteChanges (CR-01)", async () => {
      const ensureSyncOwner = jest.fn().mockResolvedValue(false)
      const { handlePullChanges } = useBuildHook({ ensureSyncOwner })

      await handlePullChanges()

      expect(ensureSyncOwner).toHaveBeenCalledWith("auth0|owner")
      expect(mockPullRemoteChanges).not.toHaveBeenCalled()
    })

    test("a token without a sub never reaches syncPending (CR-01)", async () => {
      const ensureSyncOwner = jest.fn(async (tokenSub: string | null) => tokenSub !== null)
      const { handleSync } = useBuildHook({
        ensureSyncOwner,
        withAuthRetry: jest.fn((fn: (token: string, tokenSub: string | null) => unknown) =>
          fn("token", null),
        ),
      })

      await handleSync()

      expect(ensureSyncOwner).toHaveBeenCalledWith(null)
      expect(mockSyncPending).not.toHaveBeenCalled()
    })

    test("syncAllowed true preserves existing handleSync behavior", async () => {
      mockSyncPending.mockResolvedValue({
        synced: 1,
        failed: 0,
        pulled_surveys: 0,
        pulled_attachments: 0,
      })
      const { handleSync, setStatus } = useBuildHook({ syncAllowed: true })

      await handleSync()

      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Sync complete"))
    })
  })
})
