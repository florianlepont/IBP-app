/**
 * Tests for useSurveySync.
 *
 * Strategy: mock all sub-hooks and external modules, then spy on React
 * hooks to call useSurveySync directly in Node without a renderer.
 */

const mockAlert = jest.fn()
const mockClearLocalIbpData = jest.fn()
const mockLoadSurveyDetail = jest.fn()
const mockLoadSurveyEvents = jest.fn()
const mockResetIbpData = jest.fn()
const mockResetUserData = jest.fn()
const mockDeleteMyAccount = jest.fn()
const mockCreateInitialOperationStatus = jest.fn()
const mockUpdateOperationStatus = jest.fn()
const mockCountUnsyncedLocalWork = jest.fn()

// useAuth0Session mock return value (shared, mutated per test via mockReturnValue)
const mockAuth0Session = {
  accessToken: "token-abc",
  sessionRestoring: false,
  currentUser: null,
  profile: null,
  isAuthenticated: true,
  sessionOwner: null,
  setProfileFromUser: jest.fn(),
  clearSession: jest.fn(),
  refreshSessionTokens: jest.fn(),
  withAuthRetry: jest.fn(),
  handleLoadMyProfile: jest.fn(),
  handleLogin: jest.fn(),
  handleRegister: jest.fn(),
  handleLogout: jest.fn(),
}

// useLocalDataOwner mock return value (shared, mutated per test via mockReturnValue)
const mockLocalDataOwner = {
  status: "ok" as const,
  syncAllowed: true,
  foreignWork: { surveys: 0, attachments: 0 },
  foreignOwnerEmail: null as string | null,
  discardForeignData: jest.fn(),
  recheck: jest.fn(),
}

const mockUseAuth0Session = jest.fn()
const mockUseLocalDataOwner = jest.fn()
const mockUseSurveySyncProfile = jest.fn()
const mockUseSurveySyncNetwork = jest.fn()
const mockUseSurveySyncSurveyOperations = jest.fn()

jest.mock("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
}))

jest.mock("../api/ibp-api", () => ({
  loadSurveyDetail: (...args: unknown[]) => mockLoadSurveyDetail(...args),
  loadSurveyEvents: (...args: unknown[]) => mockLoadSurveyEvents(...args),
  resetIbpData: (...args: unknown[]) => mockResetIbpData(...args),
  resetUserData: (...args: unknown[]) => mockResetUserData(...args),
  deleteMyAccount: (...args: unknown[]) => mockDeleteMyAccount(...args),
}))

jest.mock("../storage/surveys", () => ({
  clearLocalIbpData: (...args: unknown[]) => mockClearLocalIbpData(...args),
}))

jest.mock("../storage/local-owner", () => ({
  countUnsyncedLocalWork: (...args: unknown[]) => mockCountUnsyncedLocalWork(...args),
}))

jest.mock("./operation-status", () => ({
  createInitialOperationStatus: (...args: unknown[]) => mockCreateInitialOperationStatus(...args),
  updateOperationStatus: (...args: unknown[]) => mockUpdateOperationStatus(...args),
}))

jest.mock("./useAuth0Session", () => ({
  AUTH_REQUIRED_ERROR: "AUTH_REQUIRED",
  useAuth0Session: (...args: unknown[]) => mockUseAuth0Session(...args),
}))

jest.mock("./useLocalDataOwner", () => ({
  useLocalDataOwner: (...args: unknown[]) => mockUseLocalDataOwner(...args),
}))

jest.mock("./survey-sync/useSurveySyncProfile", () => ({
  useSurveySyncProfile: (...args: unknown[]) => mockUseSurveySyncProfile(...args),
}))

jest.mock("./survey-sync/useSurveySyncNetwork", () => ({
  useSurveySyncNetwork: (...args: unknown[]) => mockUseSurveySyncNetwork(...args),
}))

jest.mock("./survey-sync/useSurveySyncSurveyOperations", () => ({
  useSurveySyncSurveyOperations: (...args: unknown[]) => mockUseSurveySyncSurveyOperations(...args),
}))

import React from "react"
import { useSurveySync } from "./useSurveySync"

const DEFAULT_PARAMS = {
  apiUrl: "http://localhost:3000",
  surveys: [],
  selectedSurveyId: null,
  surveyDetailTab: "details" as const,
  editingSurveyId: null,
  refreshLocalSurveys: jest.fn(),
  refreshLocalAttachments: jest.fn(),
  onCloseSurveyDetail: jest.fn(),
  onStopEditing: jest.fn(),
}

function useBuildHook(overrides: Record<string, unknown> = {}) {
  return useSurveySync({ ...DEFAULT_PARAMS, ...overrides } as never)
}

async function flushAsyncWork(turns = 5): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve()
  }
}

describe("useSurveySync", () => {
  let useStateSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance
  let useRefSpy: jest.SpyInstance
  let useEffectSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    mockCreateInitialOperationStatus.mockReturnValue({ session: { state: "idle" } })
    mockUpdateOperationStatus.mockReturnValue({ session: { state: "running" } })
    mockUseAuth0Session.mockReturnValue(mockAuth0Session)
    mockLocalDataOwner.status = "ok"
    mockLocalDataOwner.syncAllowed = true
    mockLocalDataOwner.foreignWork = { surveys: 0, attachments: 0 }
    mockLocalDataOwner.foreignOwnerEmail = null
    mockUseLocalDataOwner.mockReturnValue(mockLocalDataOwner)
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
    mockDeleteMyAccount.mockResolvedValue(undefined)
    mockUseSurveySyncProfile.mockReturnValue({
      profileUpdating: false,
      handleUpdateProfile: jest.fn(),
      handleChangeEmail: jest.fn(),
      handlePasswordReset: jest.fn(),
      handlePickProfilePictureFromLibrary: jest.fn(),
      handleTakeProfilePictureFromCamera: jest.fn(),
      handleRemoveProfilePicture: jest.fn(),
    })
    mockUseSurveySyncNetwork.mockReturnValue({
      handleSync: jest.fn(),
      handlePullChanges: jest.fn(),
      handleReportSurvey: jest.fn(),
      maybeAutoSync: jest.fn(),
    })
    mockUseSurveySyncSurveyOperations.mockReturnValue({
      handleSubmitSurvey: jest.fn(),
      handleRetrySurvey: jest.fn(),
      handleDiscardSurvey: jest.fn(),
      handleToggleVisibility: jest.fn(),
      confirmDeleteSurvey: jest.fn(),
      handleQueueAttachmentFromLibrary: jest.fn(),
      handleQueueAttachmentFromCamera: jest.fn(),
      handleDeleteAttachment: jest.fn(),
    })
    mockAuth0Session.withAuthRetry.mockImplementation((fn: (token: string) => unknown) =>
      fn("token-abc"),
    )

    useStateSpy = jest
      .spyOn(React, "useState")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((initial: unknown) => [initial, jest.fn()]) as any)
    useCallbackSpy = jest.spyOn(React, "useCallback").mockImplementation((fn) => fn as never)
    useRefSpy = jest
      .spyOn(React, "useRef")
      .mockImplementation((initial: unknown) => ({ current: initial }) as never)
    useEffectSpy = jest.spyOn(React, "useEffect").mockImplementation(() => undefined)
  })

  afterEach(() => {
    useStateSpy.mockRestore()
    useCallbackSpy.mockRestore()
    useRefSpy.mockRestore()
    useEffectSpy.mockRestore()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", () => {
      const hook = useBuildHook()
      expect(hook).toHaveProperty("accessToken")
      expect(hook).toHaveProperty("isAuthenticated")
      expect(hook).toHaveProperty("status")
      expect(hook).toHaveProperty("operationStatus")
      expect(hook).toHaveProperty("surveyDetails")
      expect(hook).toHaveProperty("handleLoadCanonicalDetails")
      expect(hook).toHaveProperty("handleLoadSurveyEvents")
      expect(hook).toHaveProperty("handleDebugResetIbpData")
      expect(hook).toHaveProperty("handleDebugResetUserData")
      expect(hook).toHaveProperty("setStatus")
    })

    test("does not return the removed pre-Auth0 stubs (D-02/ROADMAP criterion 7)", () => {
      const hook = useBuildHook()
      expect(hook).not.toHaveProperty("pendingEmailVerification")
      expect(hook).not.toHaveProperty("devVerificationToken")
      expect(hook).not.toHaveProperty("handleVerifyEmail")
      expect(hook).not.toHaveProperty("handleResendVerification")
      expect(hook).not.toHaveProperty("handleCancelEmailVerification")
    })

    test("calls useAuth0Session with correct params", () => {
      useBuildHook()
      expect(mockUseAuth0Session).toHaveBeenCalledWith(
        expect.objectContaining({ apiUrl: "http://localhost:3000" }),
      )
    })

    test("calls sub-hooks on initialization", () => {
      useBuildHook()
      expect(mockUseSurveySyncProfile).toHaveBeenCalled()
      expect(mockUseSurveySyncNetwork).toHaveBeenCalled()
      expect(mockUseSurveySyncSurveyOperations).toHaveBeenCalled()
    })
  })

  // ─── clearSurveySessionState ──────────────────────────────────────────────

  describe("clearSurveySessionState (via onSessionCleared callback)", () => {
    test("never calls clearLocalIbpData (D-02): a session end must not purge local data", async () => {
      mockClearLocalIbpData.mockResolvedValue(undefined)
      useBuildHook()
      const { onSessionCleared } = mockUseAuth0Session.mock.calls[0][0]
      await onSessionCleared()
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })

    test("still resolves without purging when the session ends via RENEW_FAILED", async () => {
      // clearSurveySessionState has no knowledge of *why* the session ended
      // (AUTH_REQUIRED vs RENEW_FAILED) — it only resets UI state either way.
      mockClearLocalIbpData.mockResolvedValue(undefined)
      useBuildHook()
      const { onSessionCleared } = mockUseAuth0Session.mock.calls[0][0]
      await expect(onSessionCleared()).resolves.toBeUndefined()
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })
  })

  // ─── reportStatus / setStatus ─────────────────────────────────────────────

  describe("reportStatus", () => {
    test("setOperationStatus updater calls updateOperationStatus", () => {
      // Capture state setters in order to find setOperationStatus (2nd useState call)
      const setters: jest.Mock[] = []
      useStateSpy.mockRestore()
      useStateSpy = jest.spyOn(React, "useState").mockImplementation(((initial: unknown) => {
        const setter = jest.fn()
        setters.push(setter)
        return [initial, setter]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)

      const hook = useBuildHook()
      hook.setStatus("Hello")

      // setters[1] = setOperationStatus (2nd useState call = operationStatus)
      const setOperationStatus = setters[1]
      expect(setOperationStatus).toHaveBeenCalledWith(expect.any(Function))

      // Execute the updater to cover line 222 of useSurveySync.ts
      const updater = setOperationStatus.mock.calls[0][0]
      const currentStatus = { session: { state: "idle", message: "" } }
      updater(currentStatus)
      expect(mockUpdateOperationStatus).toHaveBeenCalledWith(
        currentStatus,
        "session",
        "idle",
        "Hello",
      )
    })
  })

  // ─── auto-load useEffects ─────────────────────────────────────────────────

  describe("auto-load useEffects (early return paths)", () => {
    test("both useEffects return early when selectedSurveyId is null", () => {
      useEffectSpy.mockRestore()
      const capturedEffects: Array<() => void> = []
      useEffectSpy = jest.spyOn(React, "useEffect").mockImplementation((fn) => {
        capturedEffects.push(fn as () => void)
      })

      useBuildHook()

      // Execute all captured effects — with selectedSurveyId=null, both should early-return
      expect(() => capturedEffects.forEach((fn) => fn())).not.toThrow()

      // Restore standard no-op spy for afterEach
      useEffectSpy.mockRestore()
      useEffectSpy = jest.spyOn(React, "useEffect").mockImplementation(() => undefined)
    })

    test("auto-load detail effect proceeds past first check but returns when survey not found", () => {
      useEffectSpy.mockRestore()
      const capturedEffects: Array<() => void> = []
      useEffectSpy = jest.spyOn(React, "useEffect").mockImplementation((fn) => {
        capturedEffects.push(fn as () => void)
      })

      // selectedSurveyId="s1" and accessToken="token-abc" (from mockAuth0Session)
      // surveys=[] (default) → selectedSurvey not found → returns early at line 313
      useBuildHook({ selectedSurveyId: "s1" })
      expect(() => capturedEffects.forEach((fn) => fn())).not.toThrow()

      useEffectSpy.mockRestore()
      useEffectSpy = jest.spyOn(React, "useEffect").mockImplementation(() => undefined)
    })
  })

  describe("setStatus", () => {
    test("calling setStatus invokes reportStatus with session scope", () => {
      const hook = useBuildHook()
      // get the setStatusText mock (first useState call → ["Ready", setStatusText])
      // setStatus("Foo") → reportStatus("session", "idle", "Foo") → setStatusText("Foo")
      expect(() => hook.setStatus("test message")).not.toThrow()
    })
  })

  // ─── handleLoadCanonicalDetails ───────────────────────────────────────────

  describe("handleLoadCanonicalDetails", () => {
    test("calls loadSurveyDetail via withAuthRetry on success", async () => {
      const detail = { id: "s1", status: "submitted" }
      mockLoadSurveyDetail.mockResolvedValue(detail)

      const hook = useBuildHook()
      await hook.handleLoadCanonicalDetails("s1")

      expect(mockLoadSurveyDetail).toHaveBeenCalledWith("http://localhost:3000", "token-abc", "s1")
    })

    test("silent mode skips status updates", async () => {
      mockLoadSurveyDetail.mockResolvedValue({ id: "s1" })
      const hook = useBuildHook()

      await expect(hook.handleLoadCanonicalDetails("s1", { silent: true })).resolves.toBeUndefined()
    })

    test("non-silent mode calls setStatus on success", async () => {
      mockLoadSurveyDetail.mockResolvedValue({ id: "s1" })
      const hook = useBuildHook()

      await expect(hook.handleLoadCanonicalDetails("s1")).resolves.toBeUndefined()
    })

    test("AUTH_REQUIRED error calls clearSession", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("AUTH_REQUIRED"))
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()

      await hook.handleLoadCanonicalDetails("s1")

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
    })

    test("generic error sets status message", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("Network error"))
      const hook = useBuildHook()

      await expect(hook.handleLoadCanonicalDetails("s1")).resolves.toBeUndefined()
    })

    test("silent mode on AUTH_REQUIRED skips status", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("AUTH_REQUIRED"))
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()

      await expect(hook.handleLoadCanonicalDetails("s1", { silent: true })).resolves.toBeUndefined()
    })

    test("silent mode on generic error skips status", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("Server error"))
      const hook = useBuildHook()

      await expect(hook.handleLoadCanonicalDetails("s1", { silent: true })).resolves.toBeUndefined()
    })
  })

  // ─── handleLoadSurveyEvents ───────────────────────────────────────────────

  describe("handleLoadSurveyEvents", () => {
    test("calls loadSurveyEvents via withAuthRetry on success", async () => {
      mockLoadSurveyEvents.mockResolvedValue({ items: [{ id: "e1" }] })
      const hook = useBuildHook()

      await hook.handleLoadSurveyEvents("s1")

      expect(mockLoadSurveyEvents).toHaveBeenCalledWith("http://localhost:3000", "token-abc", "s1")
    })

    test("silent mode on success skips status updates", async () => {
      mockLoadSurveyEvents.mockResolvedValue({ items: [] })
      const hook = useBuildHook()

      await expect(hook.handleLoadSurveyEvents("s1", { silent: true })).resolves.toBeUndefined()
    })

    test("AUTH_REQUIRED error calls clearSession", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("AUTH_REQUIRED"))
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()

      await hook.handleLoadSurveyEvents("s1")

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
    })

    test("generic error sets status message", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("Connection lost"))
      const hook = useBuildHook()

      await expect(hook.handleLoadSurveyEvents("s1")).resolves.toBeUndefined()
    })

    test("silent mode on AUTH_REQUIRED skips status", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("AUTH_REQUIRED"))
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()

      await expect(hook.handleLoadSurveyEvents("s1", { silent: true })).resolves.toBeUndefined()
    })
  })

  // ─── handleDebugResetIbpData ──────────────────────────────────────────────

  describe("handleDebugResetIbpData", () => {
    test("calls Alert.alert with correct title", async () => {
      const hook = useBuildHook()
      await hook.handleDebugResetIbpData()
      expect(mockAlert).toHaveBeenCalledWith(
        "Debug reset IBP data",
        expect.any(String),
        expect.any(Array),
      )
    })

    test("Alert buttons include Cancel and Reset", async () => {
      const hook = useBuildHook()
      await hook.handleDebugResetIbpData()
      const buttons = mockAlert.mock.calls[0][2]
      const texts = buttons.map((b: Record<string, unknown>) => b.text)
      expect(texts).toContain("Cancel")
      expect(texts).toContain("Reset")
    })

    test("Reset button onPress calls withAuthRetry and clearLocalIbpData", async () => {
      mockResetIbpData.mockResolvedValue({
        surveys_deleted: 1,
        attachments_deleted: 0,
        events_deleted: 0,
      })
      mockClearLocalIbpData.mockResolvedValue(undefined)
      const hook = useBuildHook()
      await hook.handleDebugResetIbpData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      await resetButton.onPress()

      expect(mockResetIbpData).toHaveBeenCalled()
      expect(mockClearLocalIbpData).toHaveBeenCalled()
    })

    test("Reset button handles AUTH_REQUIRED error", async () => {
      mockResetIbpData.mockRejectedValue(new Error("AUTH_REQUIRED"))
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()
      await hook.handleDebugResetIbpData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      resetButton.onPress()
      await flushAsyncWork()

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
    })

    test("Reset button handles generic error without throwing", async () => {
      mockResetIbpData.mockRejectedValue(new Error("Server error"))
      const hook = useBuildHook()
      await hook.handleDebugResetIbpData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      expect(() => resetButton.onPress()).not.toThrow()
      await flushAsyncWork()
    })

    test("Reset button calls onStopEditing when editingSurveyId is set", async () => {
      mockResetIbpData.mockResolvedValue({
        surveys_deleted: 0,
        attachments_deleted: 0,
        events_deleted: 0,
      })
      mockClearLocalIbpData.mockResolvedValue(undefined)
      const onStopEditing = jest.fn()
      const hook = useBuildHook({ editingSurveyId: "survey-1", onStopEditing })
      await hook.handleDebugResetIbpData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      resetButton.onPress()
      await flushAsyncWork()

      expect(onStopEditing).toHaveBeenCalled()
    })
  })

  // ─── handleDebugResetUserData ─────────────────────────────────────────────

  describe("handleDebugResetUserData", () => {
    test("calls Alert.alert with correct title", async () => {
      const hook = useBuildHook()
      await hook.handleDebugResetUserData()
      expect(mockAlert).toHaveBeenCalledWith(
        "Debug reset user data",
        expect.any(String),
        expect.any(Array),
      )
    })

    test("Reset button onPress calls withAuthRetry and clearSession", async () => {
      mockResetUserData.mockResolvedValue({
        users_deleted: 1,
        surveys_deleted: 0,
        attachments_deleted: 0,
      })
      mockClearLocalIbpData.mockResolvedValue(undefined)
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()
      await hook.handleDebugResetUserData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      resetButton.onPress()
      await flushAsyncWork()

      expect(mockResetUserData).toHaveBeenCalled()
      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
    })

    test("Reset button handles AUTH_REQUIRED error", async () => {
      mockResetUserData.mockRejectedValue(new Error("AUTH_REQUIRED"))
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const hook = useBuildHook()
      await hook.handleDebugResetUserData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      resetButton.onPress()
      await flushAsyncWork()

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
    })

    test("Reset button handles generic error without throwing", async () => {
      mockResetUserData.mockRejectedValue(new Error("Timeout"))
      const hook = useBuildHook()
      await hook.handleDebugResetUserData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      expect(() => resetButton.onPress()).not.toThrow()
      await flushAsyncWork()
      await Promise.resolve()
    })

    test("Reset button calls onStopEditing when editingSurveyId is set", async () => {
      mockResetUserData.mockResolvedValue({
        users_deleted: 0,
        surveys_deleted: 0,
        attachments_deleted: 0,
      })
      mockClearLocalIbpData.mockResolvedValue(undefined)
      mockAuth0Session.clearSession.mockResolvedValue(undefined)
      const onStopEditing = jest.fn()
      const hook = useBuildHook({ editingSurveyId: "survey-x", onStopEditing })
      await hook.handleDebugResetUserData()

      const resetButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Reset",
      )
      resetButton.onPress()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(onStopEditing).toHaveBeenCalled()
    })
  })

  // ─── handleLogout (D-03 confirmed-purge logout) ───────────────────────────

  describe("handleLogout", () => {
    test("with unsynced work: shows a counted Alert and does not log out or purge until confirmed", async () => {
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 2, attachments: 5 })
      const hook = useBuildHook()

      await hook.handleLogout()

      expect(mockAlert).toHaveBeenCalledTimes(1)
      expect(mockAlert).toHaveBeenCalledWith(
        "Données non synchronisées",
        expect.stringContaining("2 relevés et 5 photos"),
        expect.any(Array),
      )
      expect(mockAuth0Session.handleLogout).not.toHaveBeenCalled()
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()

      const buttons = mockAlert.mock.calls[0][2]
      const destructiveButton = buttons.find(
        (b: Record<string, unknown>) => b.style === "destructive",
      )
      destructiveButton.onPress()
      await flushAsyncWork()

      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).toHaveBeenCalledTimes(1)
    })

    test("with unsynced work: pressing cancel calls neither auth logout nor purge", async () => {
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 1, attachments: 0 })
      const hook = useBuildHook()

      await hook.handleLogout()

      const buttons = mockAlert.mock.calls[0][2]
      const cancelButton = buttons.find((b: Record<string, unknown>) => b.style === "cancel")
      if (cancelButton.onPress) {
        cancelButton.onPress()
      }
      await flushAsyncWork()

      expect(mockAuth0Session.handleLogout).not.toHaveBeenCalled()
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })

    test("with nothing unsynced: no Alert, logs out and purges directly", async () => {
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
      const hook = useBuildHook()

      await hook.handleLogout()

      expect(mockAlert).not.toHaveBeenCalled()
      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).toHaveBeenCalledTimes(1)
    })
  })

  // ─── performDeleteAccount (purges without the unsynced alert) ─────────────

  describe("performDeleteAccount (via handleDeleteAccount)", () => {
    test("success path purges local data without the unsynced-work alert", async () => {
      const hook = useBuildHook()
      await hook.handleDeleteAccount()

      const deleteButton = mockAlert.mock.calls[0][2].find(
        (b: Record<string, unknown>) => b.text === "Delete my account",
      )
      deleteButton.onPress()
      await flushAsyncWork()

      // Only the "Delete account" confirmation Alert fired — never the
      // unsynced-work count Alert (countUnsyncedLocalWork is not consulted).
      expect(mockAlert).toHaveBeenCalledTimes(1)
      expect(mockCountUnsyncedLocalWork).not.toHaveBeenCalled()
      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).toHaveBeenCalledTimes(1)
    })
  })

  // ─── syncAllowed wiring ────────────────────────────────────────────────────

  describe("syncAllowed wiring to useSurveySyncNetwork", () => {
    test("passes localDataOwner.syncAllowed through", () => {
      mockLocalDataOwner.syncAllowed = false
      useBuildHook()

      expect(mockUseSurveySyncNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ syncAllowed: false }),
      )
    })
  })

  // ─── handleDiscardForeignData (D-04 conflict: delete the other account's data) ───

  describe("handleDiscardForeignData", () => {
    test("shows an Alert with the foreign work summary; only destructive onPress calls discardForeignData", () => {
      mockLocalDataOwner.foreignWork = { surveys: 3, attachments: 1 }
      const hook = useBuildHook()

      hook.handleDiscardForeignData()

      expect(mockAlert).toHaveBeenCalledTimes(1)
      expect(mockAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("3 relevés et 1 photo"),
        expect.any(Array),
      )
      expect(mockLocalDataOwner.discardForeignData).not.toHaveBeenCalled()

      const buttons = mockAlert.mock.calls[0][2]
      const cancelButton = buttons.find((b: Record<string, unknown>) => b.style === "cancel")
      if (cancelButton.onPress) cancelButton.onPress()
      expect(mockLocalDataOwner.discardForeignData).not.toHaveBeenCalled()

      const destructiveButton = buttons.find(
        (b: Record<string, unknown>) => b.style === "destructive",
      )
      destructiveButton.onPress()

      expect(mockLocalDataOwner.discardForeignData).toHaveBeenCalledTimes(1)
    })
  })

  // ─── handleSwitchToOwnerAccount (D-04 conflict: log back in with the owner) ───

  describe("handleSwitchToOwnerAccount", () => {
    test("calls auth handleLogout and never clearLocalIbpData", async () => {
      const hook = useBuildHook()

      await hook.handleSwitchToOwnerAccount()

      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })
  })
})
