/**
 * Tests for useLocalDataOwner (D-04 owner-check hook).
 *
 * Uses the renderHook recipe from render-hook-smoke.test.ts: renderHook/act
 * are async, "react-native" must be jest.mock'ed before importing the "/pure"
 * entry point of @testing-library/react-native.
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

const mockClearLocalIbpData = jest.fn()

jest.mock("../storage/surveys", () => ({
  clearLocalIbpData: (...args: unknown[]) => mockClearLocalIbpData(...args),
}))

import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
import { IdTokenClaims } from "../app/id-token"
import { useLocalDataOwner } from "./useLocalDataOwner"

// `cleanup()` is async (it awaits each mounted tree's unmount); awaiting it
// here (rather than the fire-and-forget `afterEach(() => { cleanup() })`
// pattern) prevents one test's unmount from racing the next test's mount,
// which otherwise cross-contaminates renderHook state between tests.
afterEach(async () => {
  await cleanup()
})

function setup(sessionOwner: IdTokenClaims | null, onLocalDataPurged = jest.fn()) {
  return renderHook(
    (props: { sessionOwner: IdTokenClaims | null }) =>
      useLocalDataOwner({ sessionOwner: props.sessionOwner, onLocalDataPurged }),
    { initialProps: { sessionOwner } },
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSetLocalDataOwner.mockResolvedValue(undefined)
  mockClearLocalIbpData.mockResolvedValue(undefined)
})

describe("useLocalDataOwner", () => {
  test("sessionOwner null -> idle, syncAllowed false, no storage call", async () => {
    const { result } = await setup(null)

    expect(result.current.status).toBe("idle")
    expect(result.current.syncAllowed).toBe(false)
    expect(mockGetLocalDataOwner).not.toHaveBeenCalled()
  })

  test("stored owner null, sessionOwner present -> adopt", async () => {
    mockGetLocalDataOwner.mockResolvedValue(null)
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })

    const { result } = await setup({ sub: "a", email: "a@b.fr" })

    await waitFor(() => expect(result.current.status).toBe("ok"))

    expect(mockSetLocalDataOwner).toHaveBeenCalledWith({ sub: "a", email: "a@b.fr" })
    expect(result.current.syncAllowed).toBe(true)
  })

  test("stored owner matches sessionOwner -> match, no purge", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })

    const { result } = await setup({ sub: "a", email: "a@b.fr" })

    await waitFor(() => expect(result.current.status).toBe("ok"))

    expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    expect(result.current.syncAllowed).toBe(true)
  })

  test("owner differs with unsynced work -> conflict, no purge, no sync", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 2, attachments: 1 })

    const { result } = await setup({ sub: "b", email: "b@c.fr" })

    await waitFor(() => expect(result.current.status).toBe("conflict"))

    expect(result.current.foreignWork).toEqual({ surveys: 2, attachments: 1 })
    expect(result.current.foreignOwnerEmail).toBe("a@b.fr")
    expect(result.current.syncAllowed).toBe(false)
    expect(mockClearLocalIbpData).not.toHaveBeenCalled()
    expect(mockSetLocalDataOwner).not.toHaveBeenCalled()
  })

  test("owner differs with no unsynced work -> purge-and-adopt", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })
    const onLocalDataPurged = jest.fn().mockResolvedValue(undefined)

    const { result } = await setup({ sub: "b", email: "b@c.fr" }, onLocalDataPurged)

    await waitFor(() => expect(result.current.status).toBe("ok"))

    expect(mockClearLocalIbpData).toHaveBeenCalled()
    expect(mockSetLocalDataOwner).toHaveBeenCalledWith({ sub: "b", email: "b@c.fr" })
    expect(onLocalDataPurged).toHaveBeenCalledTimes(1)
  })

  test("discardForeignData purges after explicit confirmation", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 2, attachments: 1 })
    const onLocalDataPurged = jest.fn().mockResolvedValue(undefined)

    const { result } = await setup({ sub: "b", email: "b@c.fr" }, onLocalDataPurged)

    await waitFor(() => expect(result.current.status).toBe("conflict"))

    await act(async () => {
      await result.current.discardForeignData()
    })

    expect(mockClearLocalIbpData).toHaveBeenCalled()
    expect(mockSetLocalDataOwner).toHaveBeenCalledWith({ sub: "b", email: "b@c.fr" })
    expect(onLocalDataPurged).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe("ok")
    expect(result.current.syncAllowed).toBe(true)
  })

  test("storage rejection -> error, then recheck recovers", async () => {
    mockGetLocalDataOwner.mockRejectedValueOnce(new Error("boom"))
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })

    const { result } = await setup({ sub: "a", email: "a@b.fr" })

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.syncAllowed).toBe(false)

    mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })

    await act(async () => {
      await result.current.recheck()
    })

    expect(result.current.status).toBe("ok")
  })

  test("WR-07: an owner-check error is retried automatically with backoff", async () => {
    jest.useFakeTimers()
    try {
      mockGetLocalDataOwner.mockRejectedValueOnce(new Error("SQLITE_BUSY"))
      mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0, deletions: 0 })

      const { result } = await setup({ sub: "a", email: "a@b.fr" })
      await waitFor(() => expect(result.current.status).toBe("error"))

      mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })
      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })

      await waitFor(() => expect(result.current.status).toBe("ok"))
      expect(result.current.syncAllowed).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  test("sessionOwner changes from present to null -> idle", async () => {
    mockGetLocalDataOwner.mockResolvedValue({ sub: "a", email: "a@b.fr" })
    mockCountUnsyncedLocalWork.mockResolvedValue({ surveys: 0, attachments: 0 })

    const { result, rerender } = await setup({ sub: "a", email: "a@b.fr" })

    await waitFor(() => expect(result.current.status).toBe("ok"))

    await rerender({ sessionOwner: null })

    await waitFor(() => expect(result.current.status).toBe("idle"))
    expect(result.current.syncAllowed).toBe(false)
  })
})
