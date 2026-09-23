/**
 * CR-01 regression: the D-04 owner gate must be tied to the Auth0 `sub` that
 * was actually checked. When the session owner switches directly from account
 * A to account B while the owner status is "ok" (for A), no sync may run with
 * B's token against A's local queue.
 *
 * Composes the real useLocalDataOwner + useSurveySyncNetwork hooks (the same
 * wiring as useSurveySync) with renderHook; storage and the network layer are
 * mocked.
 */

jest.mock("react-native", () => ({}))

const mockGetLocalDataOwner = jest.fn()
const mockSetLocalDataOwner = jest.fn()
const mockCountUnsyncedLocalWork = jest.fn()

jest.mock("../storage/local-owner", () => ({
  getLocalDataOwner: (...args: unknown[]) => mockGetLocalDataOwner(...args),
  setLocalDataOwner: (...args: unknown[]) => mockSetLocalDataOwner(...args),
  countUnsyncedLocalWork: (...args: unknown[]) => mockCountUnsyncedLocalWork(...args),
}))

jest.mock("../storage/surveys", () => ({
  clearLocalIbpData: jest.fn().mockResolvedValue(undefined),
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

import { cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
import { IdTokenClaims } from "../app/id-token"
import { useLocalDataOwner } from "./useLocalDataOwner"
import { useSurveySyncNetwork } from "./survey-sync/useSurveySyncNetwork"

afterEach(async () => {
  await cleanup()
})

const OWNER_A: IdTokenClaims = { sub: "auth0|a", email: "a@example.fr" }
const OWNER_B: IdTokenClaims = { sub: "auth0|b", email: "b@example.fr" }

type HarnessProps = { sessionOwner: IdTokenClaims | null; accessToken: string }

// Mirrors the credentials manager: withAuthRetry hands the operation the token
// (and its sub) of whichever account is currently signed in.
let credentials: { token: string; sub: string | null } = { token: "", sub: null }

// Stable identities, as useSurveySync provides through useCallback (inline
// arrows would re-run every effect on each render).
const noopAsync = async (): Promise<void> => undefined
const noop = (): void => undefined
const SURVEYS: never[] = []
const withAuthRetry = <T>(fn: (token: string, tokenSub: string | null) => Promise<T>) =>
  fn(credentials.token, credentials.sub)

function useHarness(props: HarnessProps) {
  const owner = useLocalDataOwner({
    sessionOwner: props.sessionOwner,
    onLocalDataPurged: noopAsync,
  })
  const network = useSurveySyncNetwork({
    apiUrl: "http://localhost:3000/v1",
    accessToken: props.accessToken,
    surveys: SURVEYS,
    clearSession: noopAsync,
    withAuthRetry,
    refreshLocalSurveys: noopAsync,
    refreshLocalAttachments: noopAsync,
    setStatus: noop,
    syncAllowed: owner.syncAllowed,
    ensureSyncOwner: owner.ensureSyncOwner,
    ownerStatus: owner.status,
    recheckOwner: owner.recheck,
  } as never)
  return { owner, network }
}

let now = 0

beforeEach(() => {
  jest.clearAllMocks()
  // A controllable clock: tests step it past the 15 s auto-sync cooldown so the
  // cooldown never masks the behaviour under test.
  now = 1_000_000
  jest.spyOn(Date, "now").mockImplementation(() => now)
  mockSetLocalDataOwner.mockResolvedValue(undefined)
  mockHasPendingSyncWork.mockResolvedValue(true)
  mockSyncPending.mockResolvedValue({
    synced: 0,
    failed: 0,
    pulled_surveys: 0,
    pulled_attachments: 0,
  })
  mockPullRemoteChanges.mockResolvedValue({ surveys: 0, attachments: 0, pages: 1 })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("D-04 owner gate across an A -> B session switch (CR-01)", () => {
  test("never sends A's pending queue under B's token when sessionOwner goes A -> B while ok", async () => {
    // The device holds A's data, with unsynced work still queued.
    mockGetLocalDataOwner.mockResolvedValue({ sub: OWNER_A.sub, email: OWNER_A.email })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 2, attachments: 1 })
    credentials = { token: "token-a", sub: OWNER_A.sub }

    const { result, rerender } = await renderHook((props: HarnessProps) => useHarness(props), {
      initialProps: { sessionOwner: OWNER_A, accessToken: "token-a" },
    })

    await waitFor(() => expect(result.current.owner.status).toBe("ok"))
    mockSyncPending.mockClear()
    mockPullRemoteChanges.mockClear()

    // Login as B in one batched render: token and session owner change together,
    // without passing through null.
    now += 60_000
    credentials = { token: "token-b", sub: OWNER_B.sub }
    await rerender({ sessionOwner: OWNER_B, accessToken: "token-b" })

    await waitFor(() => expect(result.current.owner.status).toBe("conflict"))

    const sentUnderB = mockSyncPending.mock.calls.filter((call) => call[1] === "token-b")
    const pulledUnderB = mockPullRemoteChanges.mock.calls.filter((call) => call[1] === "token-b")
    expect(sentUnderB).toHaveLength(0)
    expect(pulledUnderB).toHaveLength(0)
    expect(result.current.owner.syncAllowed).toBe(false)
  })

  test("syncAllowed is false in the very render where the session owner changes", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: OWNER_A.sub, email: OWNER_A.email })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
    credentials = { token: "token-a", sub: OWNER_A.sub }

    const seen: Array<{ sub: string | undefined; syncAllowed: boolean }> = []
    const { result, rerender } = await renderHook(
      (props: HarnessProps) => {
        const value = useHarness(props)
        seen.push({ sub: props.sessionOwner?.sub, syncAllowed: value.owner.syncAllowed })
        return value
      },
      { initialProps: { sessionOwner: OWNER_A, accessToken: "token-a" } },
    )

    await waitFor(() => expect(result.current.owner.syncAllowed).toBe(true))

    seen.length = 0
    now += 60_000
    credentials = { token: "token-b", sub: OWNER_B.sub }
    await rerender({ sessionOwner: OWNER_B, accessToken: "token-b" })

    // The first render carrying B must not inherit A's approval.
    expect(seen[0]).toEqual({ sub: OWNER_B.sub, syncAllowed: false })
  })

  test("ensureSyncOwner rejects a token whose sub is not the approved session owner", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: OWNER_A.sub, email: OWNER_A.email })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
    credentials = { token: "token-a", sub: OWNER_A.sub }

    const { result } = await renderHook((props: HarnessProps) => useHarness(props), {
      initialProps: { sessionOwner: OWNER_A, accessToken: "token-a" },
    })
    await waitFor(() => expect(result.current.owner.syncAllowed).toBe(true))

    await expect(result.current.owner.ensureSyncOwner(OWNER_A.sub)).resolves.toBe(true)
    await expect(result.current.owner.ensureSyncOwner(OWNER_B.sub)).resolves.toBe(false)
    await expect(result.current.owner.ensureSyncOwner(null)).resolves.toBe(false)

    // The stored owner changed underneath (e.g. another flow re-adopted the
    // data): the execution-time check must re-read it and refuse.
    mockGetLocalDataOwner.mockResolvedValue({ sub: OWNER_B.sub, email: OWNER_B.email })
    await expect(result.current.owner.ensureSyncOwner(OWNER_A.sub)).resolves.toBe(false)
  })

  test("manual sync re-checks the stored owner right before syncPending", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: OWNER_A.sub, email: OWNER_A.email })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
    credentials = { token: "token-a", sub: OWNER_A.sub }

    const { result } = await renderHook((props: HarnessProps) => useHarness(props), {
      initialProps: { sessionOwner: OWNER_A, accessToken: "token-a" },
    })
    await waitFor(() => expect(result.current.owner.syncAllowed).toBe(true))
    mockSyncPending.mockClear()

    // Stored owner no longer matches the session at execution time.
    mockGetLocalDataOwner.mockResolvedValue({ sub: OWNER_B.sub, email: OWNER_B.email })
    await result.current.network.handleSync()
    await result.current.network.handlePullChanges()

    expect(mockSyncPending).not.toHaveBeenCalled()
    expect(mockPullRemoteChanges).not.toHaveBeenCalled()
  })
})
