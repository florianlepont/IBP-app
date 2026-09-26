/**
 * Tests for useSurveySync.
 *
 * Strategy: render the real hook with renderHook (phase 01.9 D-01). The
 * sub-hooks and external modules are mocked with STABLE objects, so the
 * hook's useCallback identities and effects behave as they do in the app.
 * Assertions read the rendered result (status, details, events) and the
 * collaborator mocks instead of intercepting React's own hooks.
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

// useAuth0Session mock return value (one stable object, as the real hook's
// callbacks are stable).
const mockAuth0Session = {
  accessToken: "token-abc" as string | null,
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
  handleForgotPassword: jest.fn(),
  handleLogout: jest.fn(),
}

// useLocalDataOwner mock return value (one stable object, mutated per test).
const mockLocalDataOwner = {
  status: "ok" as const,
  syncAllowed: true,
  foreignWork: { surveys: 0, attachments: 0 },
  foreignOwnerEmail: null as string | null,
  discardForeignData: jest.fn(),
  recheck: jest.fn(),
  ensureSyncOwner: jest.fn(),
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

const mockAttachmentPreviews = {
  handleEnsureAttachmentPreviews: jest.fn(),
  handleSimulateMissingAttachmentFile: jest.fn(),
}
jest.mock("./survey-sync/useAttachmentPreviews", () => ({
  useAttachmentPreviews: () => mockAttachmentPreviews,
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useSurveySync } from "./useSurveySync"

// Status texts produced by the hook. Kept in one place so the switch to
// status codes (phase 01.9 I18N) only edits this block.
const STATUS = {
  initial: "Ready",
  detailLoaded: (id: string) => `Canonical details loaded for ${id}`,
  detailError: (message: string) => `Load detail error: ${message}`,
  detailAuthRequired: "Login required before loading canonical details",
  eventsLoaded: (id: string) => `Events loaded for ${id}`,
  eventsError: (message: string) => `Load events error: ${message}`,
  eventsAuthRequired: "Login required before loading survey events",
  debugAuthRequired: "Login required before debug reset",
  debugIbpTitle: "Debug reset IBP data",
  debugUserTitle: "Debug reset user data",
  debugError: (title: string, message: string) => `${title} error: ${message}`,
  ibpResetDone: "IBP data reset done: 1 surveys, 0 attachments, 0 events",
  userResetDone: "User data reset done: 1 users, 0 surveys, 0 attachments",
  unsyncedTitle: "Données non synchronisées",
  deleteAccountButton: "Delete my account",
}

const noopAsync = async (): Promise<void> => undefined
const noop = (): void => undefined
const SURVEYS: never[] = []

const DEFAULT_PARAMS = Object.freeze({
  apiUrl: "http://localhost:3000",
  surveys: SURVEYS as unknown[],
  selectedSurveyId: null as string | null,
  surveyDetailTab: "details" as "details" | "events",
  editingSurveyId: null as string | null,
  refreshLocalSurveys: noopAsync,
  refreshLocalAttachments: noopAsync,
  onCloseSurveyDetail: noop,
  onStopEditing: noop,
})

async function renderSync(overrides: Partial<typeof DEFAULT_PARAMS> = {}) {
  // One params object per render so its identities stay stable across rerenders.
  const params = { ...DEFAULT_PARAMS, ...overrides }
  return renderHook(() => useSurveySync(params as never))
}

// The debug-reset and logout purges run behind the sync-activity tracker
// (WR-08), which adds a few microtask hops before clearLocalIbpData.
async function flushAsyncWork(turns = 20): Promise<void> {
  await act(async () => {
    for (let index = 0; index < turns; index += 1) {
      await Promise.resolve()
    }
  })
}

type AlertButton = { text?: string; style?: string; onPress?: () => void }

function alertButton(predicate: (button: AlertButton) => boolean, call = 0): AlertButton {
  const buttons = mockAlert.mock.calls[call][2] as AlertButton[]
  const button = buttons.find(predicate)
  if (!button) throw new Error("alert button not found")
  return button
}

const INITIAL_OPERATION_STATUS = { session: { state: "idle", message: "" } }
const UPDATED_OPERATION_STATUS = { session: { state: "running" } }

afterEach(async () => {
  await cleanup()
})

describe("useSurveySync", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockCreateInitialOperationStatus.mockReturnValue(INITIAL_OPERATION_STATUS)
    mockUpdateOperationStatus.mockReturnValue(UPDATED_OPERATION_STATUS)
    mockAuth0Session.accessToken = "token-abc"
    mockUseAuth0Session.mockReturnValue(mockAuth0Session)
    mockLocalDataOwner.status = "ok"
    mockLocalDataOwner.syncAllowed = true
    mockLocalDataOwner.foreignWork = { surveys: 0, attachments: 0 }
    mockLocalDataOwner.foreignOwnerEmail = null
    mockUseLocalDataOwner.mockReturnValue(mockLocalDataOwner)
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
    mockDeleteMyAccount.mockResolvedValue(undefined)
    mockClearLocalIbpData.mockResolvedValue(undefined)
    mockAuth0Session.clearSession.mockResolvedValue(undefined)
    mockAuth0Session.handleLogout.mockResolvedValue(undefined)
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
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", async () => {
      const { result } = await renderSync()
      const hook = result.current
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
      expect(hook).toHaveProperty("handleEnsureAttachmentPreviews")
      expect(hook).toHaveProperty("handleSimulateMissingAttachmentFile")
      expect(hook.status).toBe(STATUS.initial)
      expect(hook.operationStatus).toBe(INITIAL_OPERATION_STATUS)
    })

    test("does not return the removed pre-Auth0 stubs (D-02/ROADMAP criterion 7)", async () => {
      const { result } = await renderSync()
      const hook = result.current
      expect(hook).not.toHaveProperty("pendingEmailVerification")
      expect(hook).not.toHaveProperty("devVerificationToken")
      expect(hook).not.toHaveProperty("handleVerifyEmail")
      expect(hook).not.toHaveProperty("handleResendVerification")
      expect(hook).not.toHaveProperty("handleCancelEmailVerification")
    })

    test("calls useAuth0Session with correct params", async () => {
      await renderSync()
      expect(mockUseAuth0Session).toHaveBeenCalledWith(
        expect.objectContaining({ apiUrl: "http://localhost:3000" }),
      )
    })

    test("calls sub-hooks on initialization", async () => {
      await renderSync()
      expect(mockUseSurveySyncProfile).toHaveBeenCalled()
      expect(mockUseSurveySyncNetwork).toHaveBeenCalled()
      expect(mockUseSurveySyncSurveyOperations).toHaveBeenCalled()
    })
  })

  // ─── clearSurveySessionState ──────────────────────────────────────────────

  describe("clearSurveySessionState (via onSessionCleared callback)", () => {
    test("never calls clearLocalIbpData (D-02): a session end must not purge local data", async () => {
      await renderSync()
      const { onSessionCleared } = mockUseAuth0Session.mock.calls[0][0]
      await act(async () => {
        await onSessionCleared()
      })
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })

    test("still resolves without purging when the session ends via RENEW_FAILED", async () => {
      // clearSurveySessionState has no knowledge of *why* the session ended
      // (AUTH_REQUIRED vs RENEW_FAILED) — it only resets UI state either way.
      mockLoadSurveyDetail.mockResolvedValue({ id: "s1" })
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1", { silent: true })
      })
      expect(result.current.surveyDetails).toHaveProperty("s1")

      const { onSessionCleared } = mockUseAuth0Session.mock.calls[0][0]
      let outcome: unknown = "pending"
      await act(async () => {
        outcome = await onSessionCleared()
      })
      expect(outcome).toBeUndefined()
      expect(result.current.surveyDetails).toEqual({})
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })
  })

  // ─── reportStatus / setStatus ─────────────────────────────────────────────

  describe("reportStatus", () => {
    test("setStatus runs updateOperationStatus on the current operation status", async () => {
      const { result } = await renderSync()
      await act(async () => {
        result.current.setStatus("Hello")
      })

      expect(mockUpdateOperationStatus).toHaveBeenCalledWith(
        INITIAL_OPERATION_STATUS,
        "session",
        "idle",
        "Hello",
      )
      expect(result.current.operationStatus).toBe(UPDATED_OPERATION_STATUS)
    })
  })

  // ─── auto-load useEffects ─────────────────────────────────────────────────

  describe("auto-load useEffects (early return paths)", () => {
    test("both useEffects return early when selectedSurveyId is null", async () => {
      await renderSync({ surveyDetailTab: "events" })
      expect(mockLoadSurveyDetail).not.toHaveBeenCalled()
      expect(mockLoadSurveyEvents).not.toHaveBeenCalled()
    })

    test("auto-load detail effect proceeds past first check but returns when survey not found", async () => {
      // selectedSurveyId="s1" and accessToken="token-abc"; surveys=[] → not found.
      await renderSync({ selectedSurveyId: "s1" })
      expect(mockLoadSurveyDetail).not.toHaveBeenCalled()
    })

    test("auto-load detail effect loads a submitted survey silently", async () => {
      mockLoadSurveyDetail.mockResolvedValue({ id: "s1" })
      const { result } = await renderSync({
        selectedSurveyId: "s1",
        surveys: [{ id: "s1", status: "submitted", sync_state: "synced" }],
      })
      await flushAsyncWork()

      expect(mockLoadSurveyDetail).toHaveBeenCalledTimes(1)
      expect(result.current.surveyDetails).toEqual({ s1: { id: "s1" } })
      expect(result.current.status).toBe(STATUS.initial)
    })

    test("auto-load events effect loads events silently on the events tab", async () => {
      mockLoadSurveyEvents.mockResolvedValue({ items: [{ id: "e1" }] })
      const { result } = await renderSync({ selectedSurveyId: "s1", surveyDetailTab: "events" })
      await flushAsyncWork()

      expect(mockLoadSurveyEvents).toHaveBeenCalledTimes(1)
      expect(result.current.surveyEvents).toEqual({ s1: [{ id: "e1" }] })
      expect(result.current.status).toBe(STATUS.initial)
    })
  })

  describe("setStatus", () => {
    test("calling setStatus invokes reportStatus with session scope", async () => {
      const { result } = await renderSync()
      await act(async () => {
        result.current.setStatus("test message")
      })
      expect(result.current.status).toBe("test message")
    })
  })

  // ─── handleLoadCanonicalDetails ───────────────────────────────────────────

  describe("handleLoadCanonicalDetails", () => {
    test("calls loadSurveyDetail via withAuthRetry on success", async () => {
      const detail = { id: "s1", status: "submitted" }
      mockLoadSurveyDetail.mockResolvedValue(detail)

      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1")
      })

      expect(mockLoadSurveyDetail).toHaveBeenCalledWith("http://localhost:3000", "token-abc", "s1")
      expect(result.current.surveyDetails).toEqual({ s1: detail })
      expect(result.current.detailsLoadingSurveyId).toBeNull()
    })

    test("silent mode skips status updates", async () => {
      mockLoadSurveyDetail.mockResolvedValue({ id: "s1" })
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1", { silent: true })
      })
      expect(result.current.status).toBe(STATUS.initial)
    })

    test("non-silent mode calls setStatus on success", async () => {
      mockLoadSurveyDetail.mockResolvedValue({ id: "s1" })
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1")
      })
      expect(result.current.status).toBe(STATUS.detailLoaded("s1"))
    })

    test("AUTH_REQUIRED error calls clearSession", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("AUTH_REQUIRED"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1")
      })

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.detailAuthRequired)
    })

    test("generic error sets status message", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("Network error"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1")
      })
      expect(result.current.status).toBe(STATUS.detailError("Network error"))
      expect(result.current.detailsLoadingSurveyId).toBeNull()
    })

    test("silent mode on AUTH_REQUIRED skips status", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("AUTH_REQUIRED"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1", { silent: true })
      })
      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.initial)
    })

    test("silent mode on generic error skips status", async () => {
      mockLoadSurveyDetail.mockRejectedValue(new Error("Server error"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadCanonicalDetails("s1", { silent: true })
      })
      expect(result.current.status).toBe(STATUS.initial)
    })
  })

  // ─── handleLoadSurveyEvents ───────────────────────────────────────────────

  describe("handleLoadSurveyEvents", () => {
    test("calls loadSurveyEvents via withAuthRetry on success", async () => {
      mockLoadSurveyEvents.mockResolvedValue({ items: [{ id: "e1" }] })
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadSurveyEvents("s1")
      })

      expect(mockLoadSurveyEvents).toHaveBeenCalledWith("http://localhost:3000", "token-abc", "s1")
      expect(result.current.surveyEvents).toEqual({ s1: [{ id: "e1" }] })
      expect(result.current.status).toBe(STATUS.eventsLoaded("s1"))
      expect(result.current.eventsLoadingSurveyId).toBeNull()
    })

    test("silent mode on success skips status updates", async () => {
      mockLoadSurveyEvents.mockResolvedValue({})
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadSurveyEvents("s1", { silent: true })
      })
      expect(result.current.surveyEvents).toEqual({ s1: [] })
      expect(result.current.status).toBe(STATUS.initial)
    })

    test("AUTH_REQUIRED error calls clearSession", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("AUTH_REQUIRED"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadSurveyEvents("s1")
      })

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.eventsAuthRequired)
    })

    test("generic error sets status message", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("Connection lost"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadSurveyEvents("s1")
      })
      expect(result.current.status).toBe(STATUS.eventsError("Connection lost"))
    })

    test("silent mode on AUTH_REQUIRED skips status", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("AUTH_REQUIRED"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadSurveyEvents("s1", { silent: true })
      })
      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.initial)
    })

    test("silent mode on generic error skips status", async () => {
      mockLoadSurveyEvents.mockRejectedValue(new Error("Connection lost"))
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLoadSurveyEvents("s1", { silent: true })
      })
      expect(result.current.status).toBe(STATUS.initial)
    })
  })

  // ─── handleDebugResetIbpData ──────────────────────────────────────────────

  describe("handleDebugResetIbpData", () => {
    test("calls Alert.alert with correct title", async () => {
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetIbpData()
      })
      expect(mockAlert).toHaveBeenCalledWith(
        STATUS.debugIbpTitle,
        expect.any(String),
        expect.any(Array),
      )
    })

    test("Alert buttons include Cancel and Reset", async () => {
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetIbpData()
      })
      const buttons = mockAlert.mock.calls[0][2] as AlertButton[]
      const texts = buttons.map((b) => b.text)
      expect(texts).toContain("Cancel")
      expect(texts).toContain("Reset")
    })

    test("Reset button onPress calls withAuthRetry and clearLocalIbpData", async () => {
      mockResetIbpData.mockResolvedValue({
        surveys_deleted: 1,
        attachments_deleted: 0,
        events_deleted: 0,
      })
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetIbpData()
      })

      alertButton((b) => b.text === "Reset").onPress?.()
      await flushAsyncWork()

      expect(mockResetIbpData).toHaveBeenCalled()
      expect(mockClearLocalIbpData).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.ibpResetDone)
    })

    test("Reset button handles AUTH_REQUIRED error", async () => {
      mockResetIbpData.mockRejectedValue(new Error("AUTH_REQUIRED"))
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetIbpData()
      })

      alertButton((b) => b.text === "Reset").onPress?.()
      await flushAsyncWork()

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.debugAuthRequired)
    })

    test("Reset button handles generic error without throwing", async () => {
      mockResetIbpData.mockRejectedValue(new Error("Server error"))
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetIbpData()
      })

      const resetButton = alertButton((b) => b.text === "Reset")
      expect(() => resetButton.onPress?.()).not.toThrow()
      await flushAsyncWork()
      expect(result.current.status).toBe(STATUS.debugError(STATUS.debugIbpTitle, "Server error"))
    })

    test("Reset button calls onStopEditing when editingSurveyId is set", async () => {
      mockResetIbpData.mockResolvedValue({
        surveys_deleted: 0,
        attachments_deleted: 0,
        events_deleted: 0,
      })
      const onStopEditing = jest.fn()
      const { result } = await renderSync({ editingSurveyId: "survey-1", onStopEditing })
      await act(async () => {
        await result.current.handleDebugResetIbpData()
      })

      alertButton((b) => b.text === "Reset").onPress?.()
      await flushAsyncWork()

      expect(onStopEditing).toHaveBeenCalled()
    })
  })

  // ─── handleDebugResetUserData ─────────────────────────────────────────────

  describe("handleDebugResetUserData", () => {
    test("calls Alert.alert with correct title", async () => {
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetUserData()
      })
      expect(mockAlert).toHaveBeenCalledWith(
        STATUS.debugUserTitle,
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
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetUserData()
      })

      alertButton((b) => b.text === "Reset").onPress?.()
      await flushAsyncWork()

      expect(mockResetUserData).toHaveBeenCalled()
      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.userResetDone)
    })

    test("Reset button handles AUTH_REQUIRED error", async () => {
      mockResetUserData.mockRejectedValue(new Error("AUTH_REQUIRED"))
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetUserData()
      })

      alertButton((b) => b.text === "Reset").onPress?.()
      await flushAsyncWork()

      expect(mockAuth0Session.clearSession).toHaveBeenCalled()
      expect(result.current.status).toBe(STATUS.debugAuthRequired)
    })

    test("Reset button handles generic error without throwing", async () => {
      mockResetUserData.mockRejectedValue(new Error("Timeout"))
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDebugResetUserData()
      })

      const resetButton = alertButton((b) => b.text === "Reset")
      expect(() => resetButton.onPress?.()).not.toThrow()
      await flushAsyncWork()
      expect(result.current.status).toBe(STATUS.debugError(STATUS.debugUserTitle, "Timeout"))
    })

    test("Reset button calls onStopEditing when editingSurveyId is set", async () => {
      mockResetUserData.mockResolvedValue({
        users_deleted: 0,
        surveys_deleted: 0,
        attachments_deleted: 0,
      })
      const onStopEditing = jest.fn()
      const { result } = await renderSync({ editingSurveyId: "survey-x", onStopEditing })
      await act(async () => {
        await result.current.handleDebugResetUserData()
      })

      alertButton((b) => b.text === "Reset").onPress?.()
      await flushAsyncWork()

      expect(onStopEditing).toHaveBeenCalled()
    })
  })

  // ─── handleLogout (D-03 confirmed-purge logout) ───────────────────────────

  describe("handleLogout", () => {
    test("with unsynced work: shows a counted Alert and does not log out or purge until confirmed", async () => {
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 2, attachments: 5 })
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLogout()
      })

      expect(mockAlert).toHaveBeenCalledTimes(1)
      expect(mockAlert).toHaveBeenCalledWith(
        STATUS.unsyncedTitle,
        expect.stringContaining("2 relevés et 5 photos"),
        expect.any(Array),
      )
      expect(mockAuth0Session.handleLogout).not.toHaveBeenCalled()
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()

      alertButton((b) => b.style === "destructive").onPress?.()
      await flushAsyncWork()

      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).toHaveBeenCalledTimes(1)
    })

    test("with unsynced work: pressing cancel calls neither auth logout nor purge", async () => {
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 1, attachments: 0 })
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLogout()
      })

      alertButton((b) => b.style === "cancel").onPress?.()
      await flushAsyncWork()

      expect(mockAuth0Session.handleLogout).not.toHaveBeenCalled()
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })

    test("with nothing unsynced: no Alert, logs out and purges directly", async () => {
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleLogout()
      })

      expect(mockAlert).not.toHaveBeenCalled()
      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).toHaveBeenCalledTimes(1)
    })
  })

  // ─── performDeleteAccount (purges without the unsynced alert) ─────────────

  describe("performDeleteAccount (via handleDeleteAccount)", () => {
    test("success path purges local data without the unsynced-work alert", async () => {
      const { result } = await renderSync()
      await act(async () => {
        await result.current.handleDeleteAccount()
      })

      alertButton((b) => b.text === STATUS.deleteAccountButton).onPress?.()
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
    test("passes localDataOwner.syncAllowed through", async () => {
      mockLocalDataOwner.syncAllowed = false
      await renderSync()

      expect(mockUseSurveySyncNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ syncAllowed: false }),
      )
    })
  })

  // ─── handleDiscardForeignData (D-04 conflict: delete the other account's data) ───

  describe("handleDiscardForeignData", () => {
    test("shows an Alert with the foreign work summary; only destructive onPress calls discardForeignData", async () => {
      mockLocalDataOwner.foreignWork = { surveys: 3, attachments: 1 }
      const { result } = await renderSync()

      await act(async () => {
        result.current.handleDiscardForeignData()
      })

      expect(mockAlert).toHaveBeenCalledTimes(1)
      expect(mockAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("3 relevés et 1 photo"),
        expect.any(Array),
      )
      expect(mockLocalDataOwner.discardForeignData).not.toHaveBeenCalled()

      alertButton((b) => b.style === "cancel").onPress?.()
      expect(mockLocalDataOwner.discardForeignData).not.toHaveBeenCalled()

      alertButton((b) => b.style === "destructive").onPress?.()

      expect(mockLocalDataOwner.discardForeignData).toHaveBeenCalledTimes(1)
    })
  })

  // ─── handleSwitchToOwnerAccount (D-04 conflict: log back in with the owner) ───

  describe("handleSwitchToOwnerAccount", () => {
    test("calls auth handleLogout and never clearLocalIbpData", async () => {
      const { result } = await renderSync()

      await act(async () => {
        await result.current.handleSwitchToOwnerAccount()
      })

      expect(mockAuth0Session.handleLogout).toHaveBeenCalledTimes(1)
      expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    })
  })
})
