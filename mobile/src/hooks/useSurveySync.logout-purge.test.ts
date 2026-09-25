/**
 * WR-08 regression: a sync still in flight when the user logs out (or when
 * another account's data is purged) must finish — or be refused — before the
 * local purge runs, so it can never write the previous user's surveys into a
 * database that the next account will adopt.
 *
 * Renders the real useSurveySync with the real useLocalDataOwner and
 * useSurveySyncNetwork; the auth session, storage and network are mocked.
 */

const mockAlert = jest.fn()
jest.mock("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
}))

const mockClearLocalIbpData = jest.fn()
jest.mock("../storage/surveys", () => ({
  clearLocalIbpData: (...args: unknown[]) => mockClearLocalIbpData(...args),
}))

const mockGetLocalDataOwner = jest.fn()
const mockSetLocalDataOwner = jest.fn()
const mockCountUnsyncedLocalWork = jest.fn()
jest.mock("../storage/local-owner", () => ({
  getLocalDataOwner: (...args: unknown[]) => mockGetLocalDataOwner(...args),
  setLocalDataOwner: (...args: unknown[]) => mockSetLocalDataOwner(...args),
  countUnsyncedLocalWork: (...args: unknown[]) => mockCountUnsyncedLocalWork(...args),
}))

const mockSyncPending = jest.fn()
const mockHasPendingSyncWork = jest.fn()
const mockPullRemoteChanges = jest.fn()
jest.mock("../storage", () => ({
  syncPending: (...args: unknown[]) => mockSyncPending(...args),
  hasPendingSyncWork: (...args: unknown[]) => mockHasPendingSyncWork(...args),
  pullRemoteChanges: (...args: unknown[]) => mockPullRemoteChanges(...args),
}))

jest.mock("../api/ibp-api", () => ({
  createSurveyReport: jest.fn(),
  deleteMyAccount: jest.fn(),
  loadSurveyDetail: jest.fn(),
  loadSurveyEvents: jest.fn(),
  resetIbpData: jest.fn(),
  resetUserData: jest.fn(),
}))

jest.mock("react-native-auth0", () => ({
  CredentialsManagerError: class MockCredentialsManagerError extends Error {},
  CredentialsManagerErrorCodes: {},
}))

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: "WIFI",
  }),
  addNetworkStateListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  NetworkStateType: { WIFI: "WIFI", NONE: "NONE", CELLULAR: "CELLULAR" },
}))

jest.mock("./survey-sync/useSurveySyncProfile", () => ({
  useSurveySyncProfile: () => ({ profileUpdating: false }),
}))

jest.mock("./survey-sync/useSurveySyncSurveyOperations", () => ({
  useSurveySyncSurveyOperations: () => ({}),
}))

jest.mock("./survey-sync/useAttachmentPreviews", () => ({
  useAttachmentPreviews: () => ({
    handleEnsureAttachmentPreviews: jest.fn(),
    handleSimulateMissingAttachmentFile: jest.fn(),
  }),
}))

// A stable fake Auth0 session for account A (useCallback identities in the
// real hook are stable; inline objects would re-run every effect).
const OWNER_A = { sub: "auth0|a", email: "a@example.fr" }
const mockAuthLogout = jest.fn()
const mockSession = {
  accessToken: "token-a",
  sessionRestoring: false,
  currentUser: { id: "u-a" },
  profile: "A",
  sessionOwner: OWNER_A as typeof OWNER_A | null,
  isAuthenticated: true,
  setProfileFromUser: jest.fn(),
  clearSession: jest.fn(async () => undefined),
  refreshSessionTokens: jest.fn(),
  withAuthRetry: <T>(fn: (token: string, tokenSub: string | null) => Promise<T>) =>
    fn("token-a", OWNER_A.sub),
  handleLoadMyProfile: jest.fn(),
  handleLogin: jest.fn(),
  handleRegister: jest.fn(),
  handleForgotPassword: jest.fn(),
  handleLogout: (...args: unknown[]) => mockAuthLogout(...args),
}
jest.mock("./useAuth0Session", () => ({
  AUTH_REQUIRED_ERROR: "AUTH_REQUIRED",
  useAuth0Session: () => mockSession,
}))

import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
import { useSurveySync } from "./useSurveySync"

afterEach(async () => {
  await cleanup()
})

const noopAsync = async (): Promise<void> => undefined
const noop = (): void => undefined
const SURVEYS: never[] = []
const PARAMS = {
  apiUrl: "http://localhost:3000/v1",
  surveys: SURVEYS,
  selectedSurveyId: null,
  surveyDetailTab: "details" as const,
  editingSurveyId: null,
  refreshLocalSurveys: noopAsync,
  refreshLocalAttachments: noopAsync,
  onCloseSurveyDetail: noop,
  onStopEditing: noop,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const SYNC_RESULT = { synced: 1, failed: 0, pulled_surveys: 3, pulled_attachments: 0 }

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.sessionOwner = OWNER_A
  mockGetLocalDataOwner.mockResolvedValue(OWNER_A)
  mockSetLocalDataOwner.mockResolvedValue(undefined)
  mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0, deletions: 0 })
  mockClearLocalIbpData.mockResolvedValue(undefined)
  mockHasPendingSyncWork.mockResolvedValue(true)
  mockAuthLogout.mockResolvedValue(undefined)
})

describe("logout purge vs in-flight sync (WR-08)", () => {
  test("the purge waits for an in-flight sync and runs after its writes", async () => {
    const inFlight = deferred<typeof SYNC_RESULT>()
    const events: string[] = []
    mockSyncPending.mockImplementation(async () => {
      events.push("sync:start")
      const result = await inFlight.promise
      events.push("sync:writes-done")
      return result
    })
    mockClearLocalIbpData.mockImplementation(async () => {
      events.push("purge")
    })

    const { result } = await renderHook(() => useSurveySync(PARAMS as never))
    await waitFor(() => expect(mockSyncPending).toHaveBeenCalledTimes(1))

    let logout: Promise<void> = Promise.resolve()
    await act(async () => {
      logout = result.current.handleLogout()
      await Promise.resolve()
    })

    // The sync has not finished writing: nothing may be purged yet.
    expect(mockClearLocalIbpData).not.toHaveBeenCalled()

    await act(async () => {
      inFlight.resolve(SYNC_RESULT)
      await logout
    })

    expect(events).toEqual(["sync:start", "sync:writes-done", "purge"])
    expect(mockAuthLogout).toHaveBeenCalledTimes(1)
  })

  test("no sync can start while the purge is in progress", async () => {
    mockSyncPending.mockResolvedValue(SYNC_RESULT)
    const purge = deferred<void>()
    mockClearLocalIbpData.mockImplementation(() => purge.promise)

    const { result } = await renderHook(() => useSurveySync(PARAMS as never))
    await waitFor(() => expect(mockSyncPending).toHaveBeenCalledTimes(1))
    mockSyncPending.mockClear()

    let logout: Promise<void> = Promise.resolve()
    await act(async () => {
      logout = result.current.handleLogout()
      await Promise.resolve()
    })
    await waitFor(() => expect(mockClearLocalIbpData).toHaveBeenCalled())

    // A manual sync attempted mid-purge must not reach syncPending.
    await act(async () => {
      await result.current.handleSync()
    })
    expect(mockSyncPending).not.toHaveBeenCalled()

    await act(async () => {
      purge.resolve()
      await logout
    })
  })
})
