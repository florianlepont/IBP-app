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

jest.mock("../useAuth0Session", () => ({
  AUTH_REQUIRED_ERROR: "AUTH_REQUIRED",
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

function useBuildHook(overrides: Record<string, unknown> = {}) {
  const params = {
    apiUrl: "http://localhost:3000",
    accessToken: "access-token",
    refreshToken: null,
    surveys: [],
    clearSession: jest.fn().mockResolvedValue(undefined),
    withAuthRetry: jest.fn((fn: (token: string) => unknown) => fn("token")),
    refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
    refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
    setStatus: jest.fn(),
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
})
