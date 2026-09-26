/**
 * Tests for usePublicMapExplorer.
 *
 * Strategy: render the real hook with renderHook from
 * @testing-library/react-native/pure (see render-hook-smoke.test.ts); each
 * callback runs inside act().
 */

jest.mock("react-native", () => ({}))

const mockFetchPublicMapItems = jest.fn()
const mockFetchPublicParcelStatuses = jest.fn()

jest.mock("../api/ibp-api", () => ({
  fetchPublicMapItems: (...args: unknown[]) => mockFetchPublicMapItems(...args),
  fetchPublicParcelStatuses: (...args: unknown[]) => mockFetchPublicParcelStatuses(...args),
}))

const mockShouldShowDevTools = jest.fn(() => false)

jest.mock("../app/dev-tools", () => ({ shouldShowDevTools: () => mockShouldShowDevTools() }))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { fr } from "../i18n"
import { usePublicMapExplorer } from "./usePublicMapExplorer"

const DEFAULT_PARAMS = {
  apiUrl: "http://localhost:3000",
  onStatusChange: jest.fn(),
}

/**
 * Wraps each callback of the rendered hook in act() so the state updates it
 * makes (loading, items, parcelStatuses) flush before the assertions run.
 */
function withAct<T extends object>(hook: T): T {
  const wrapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(hook)) {
    wrapped[key] =
      typeof value === "function"
        ? (...args: unknown[]) => act(() => (value as (...a: unknown[]) => unknown)(...args))
        : value
  }
  return wrapped as T
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function renderExplorer(overrides: Record<string, unknown> = {}) {
  return renderHook(() => usePublicMapExplorer({ ...DEFAULT_PARAMS, ...overrides } as never))
}

async function buildHook(overrides: Record<string, unknown> = {}) {
  const { result } = await renderHook(() =>
    usePublicMapExplorer({ ...DEFAULT_PARAMS, ...overrides } as never),
  )
  return withAct(result.current)
}

describe("usePublicMapExplorer", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await cleanup()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", async () => {
      const hook = await buildHook()
      expect(hook).toHaveProperty("items")
      expect(hook).toHaveProperty("loading")
      expect(hook).toHaveProperty("fromDate")
      expect(hook).toHaveProperty("toDate")
      expect(hook).toHaveProperty("region")
      expect(hook).toHaveProperty("parcelStatuses")
      expect(hook).toHaveProperty("parcelsLoading")
      expect(hook).toHaveProperty("loadPublicMap")
      expect(hook).toHaveProperty("loadPublicParcels")
    })

    test("initializes with empty state", async () => {
      const hook = await buildHook()
      expect(hook.items).toEqual([])
      expect(hook.loading).toBe(false)
      expect(hook.fromDate).toBe("")
      expect(hook.parcelStatuses).toEqual([])
    })
  })

  // ─── loadPublicMap ────────────────────────────────────────────────────────

  describe("loadPublicMap", () => {
    test("calls fetchPublicMapItems and notifies on success", async () => {
      const items = [{ id: "m1" }, { id: "m2" }]
      mockFetchPublicMapItems.mockResolvedValue({ items })
      const onStatusChange = jest.fn()
      const hook = await buildHook({ onStatusChange })

      await hook.loadPublicMap()

      expect(mockFetchPublicMapItems).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ from: "", to: "", region: "" }),
      )
      expect(onStatusChange).toHaveBeenCalledWith(fr.status.map.loaded({ count: 2 }))
    })

    test("handles non-array items in response without throwing", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: null })
      const onStatusChange = jest.fn()
      const hook = await buildHook({ onStatusChange })

      await hook.loadPublicMap()

      // 0 items loaded
      expect(onStatusChange).toHaveBeenCalledWith(fr.status.map.loaded({ count: 0 }))
    })

    test("calls onStatusChange with error message on failure", async () => {
      mockFetchPublicMapItems.mockRejectedValue(new Error("Network error"))
      const onStatusChange = jest.fn()
      const hook = await buildHook({ onStatusChange })

      await hook.loadPublicMap()

      expect(onStatusChange).toHaveBeenCalledWith(fr.status.map.loadFailed())
      expect(onStatusChange).not.toHaveBeenCalledWith(expect.stringContaining("Network error"))
    })

    test("completes without throwing (setLoading called via finally)", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const hook = await buildHook()
      await expect(hook.loadPublicMap()).resolves.toBeUndefined()
    })

    test("still resolves on error (finally block runs)", async () => {
      mockFetchPublicMapItems.mockRejectedValue(new Error("fail"))
      const hook = await buildHook()
      await expect(hook.loadPublicMap()).resolves.toBeUndefined()
    })
  })

  // ─── loadPublicMap by viewport (D-05) ─────────────────────────────────────

  describe("loadPublicMap with a bbox", () => {
    test("passes the bbox to fetchPublicMapItems", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const hook = await buildHook()

      await hook.loadPublicMap({ bbox: "1,43,2,44" })

      expect(mockFetchPublicMapItems).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ bbox: "1,43,2,44", from: "", to: "", region: "" }),
      )
    })

    test("only the latest of two overlapping loads updates the items", async () => {
      const first = deferred<{ items: unknown[] }>()
      const second = deferred<{ items: unknown[] }>()
      mockFetchPublicMapItems.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      const onStatusChange = jest.fn()
      const { result } = await renderExplorer({ onStatusChange })

      let firstLoad: Promise<void> = Promise.resolve()
      let secondLoad: Promise<void> = Promise.resolve()
      await act(async () => {
        firstLoad = result.current.loadPublicMap({ bbox: "0,0,1,1" })
        secondLoad = result.current.loadPublicMap({ bbox: "2,2,3,3" })
      })
      expect(result.current.loading).toBe(true)

      await act(async () => {
        second.resolve({ items: [{ survey_id: "new" }] })
        await secondLoad
      })
      await act(async () => {
        first.resolve({ items: [{ survey_id: "old" }] })
        await firstLoad
      })

      expect(result.current.items).toEqual([{ survey_id: "new" }])
      expect(result.current.loading).toBe(false)
      expect(onStatusChange).toHaveBeenCalledTimes(1)
      expect(onStatusChange).toHaveBeenCalledWith(fr.status.map.loaded({ count: 1 }))
    })

    test("a stale failure is ignored", async () => {
      const first = deferred<{ items: unknown[] }>()
      let rejectFirst: (error: Error) => void = () => undefined
      mockFetchPublicMapItems
        .mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            rejectFirst = reject
          }),
        )
        .mockReturnValueOnce(first.promise)
      const onStatusChange = jest.fn()
      const { result } = await renderExplorer({ onStatusChange })

      let staleLoad: Promise<void> = Promise.resolve()
      let latestLoad: Promise<void> = Promise.resolve()
      await act(async () => {
        staleLoad = result.current.loadPublicMap({ bbox: "0,0,1,1" })
        latestLoad = result.current.loadPublicMap({ bbox: "2,2,3,3" })
      })
      await act(async () => {
        rejectFirst(new Error("boom"))
        await staleLoad
      })
      expect(onStatusChange).not.toHaveBeenCalled()
      expect(result.current.loading).toBe(true)

      await act(async () => {
        first.resolve({ items: [] })
        await latestLoad
      })
      expect(onStatusChange).toHaveBeenCalledWith(fr.status.map.loaded({ count: 0 }))
      expect(result.current.loading).toBe(false)
    })

    test("skips a request whose bbox equals the last completed one", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const { result } = await renderExplorer()

      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44" }))
      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44" }))

      expect(mockFetchPublicMapItems).toHaveBeenCalledTimes(1)
    })

    test("skips a request whose bbox equals the one in flight", async () => {
      const pending = deferred<{ items: unknown[] }>()
      mockFetchPublicMapItems.mockReturnValue(pending.promise)
      const { result } = await renderExplorer()

      let load: Promise<void> = Promise.resolve()
      await act(async () => {
        load = result.current.loadPublicMap({ bbox: "1,43,2,44" })
        void result.current.loadPublicMap({ bbox: "1,43,2,44" })
      })
      await act(async () => {
        pending.resolve({ items: [] })
        await load
      })

      expect(mockFetchPublicMapItems).toHaveBeenCalledTimes(1)
    })

    test("force reloads the same bbox", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const { result } = await renderExplorer()

      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44" }))
      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44", force: true }))

      expect(mockFetchPublicMapItems).toHaveBeenCalledTimes(2)
    })

    test("a different bbox or filter is a new request", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const { result } = await renderExplorer()

      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44" }))
      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,45" }))
      await act(async () => {
        result.current.setRegion("ARA")
      })
      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,45" }))

      expect(mockFetchPublicMapItems).toHaveBeenCalledTimes(3)
      expect(mockFetchPublicMapItems).toHaveBeenLastCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ bbox: "1,43,2,45", region: "ARA" }),
      )
    })

    test("a call without options always reloads (Load button, Explorer tab press)", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const { result } = await renderExplorer()

      await act(() => result.current.loadPublicMap())
      await act(() => result.current.loadPublicMap())
      await act(() => result.current.loadPublicMap({}))

      expect(mockFetchPublicMapItems).toHaveBeenCalledTimes(2)
    })

    test("a failed load is retried with the same bbox and logs its detail", async () => {
      mockShouldShowDevTools.mockReturnValueOnce(true)
      const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => undefined)
      const error = new Error("GET http://secret.example/v1/public/map-items failed")
      mockFetchPublicMapItems.mockRejectedValueOnce(error).mockResolvedValueOnce({ items: [] })
      const onStatusChange = jest.fn()
      const { result } = await renderExplorer({ onStatusChange })

      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44" }))
      expect(onStatusChange).toHaveBeenLastCalledWith(fr.status.map.loadFailed())
      expect(onStatusChange).not.toHaveBeenCalledWith(expect.stringContaining("http"))
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining("map.load"), error)

      await act(() => result.current.loadPublicMap({ bbox: "1,43,2,44" }))
      expect(mockFetchPublicMapItems).toHaveBeenCalledTimes(2)
      debugSpy.mockRestore()
    })
  })

  // ─── loadPublicParcels ────────────────────────────────────────────────────

  describe("loadPublicParcels", () => {
    test("returns early when bbox is empty", async () => {
      const hook = await buildHook()

      await hook.loadPublicParcels({ bbox: "", zoom: 10 })

      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })

    test("returns early when bbox is whitespace only", async () => {
      const hook = await buildHook()

      await hook.loadPublicParcels({ bbox: "   ", zoom: 10 })

      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })

    test("calls fetchPublicParcelStatuses with correct params on success", async () => {
      const parcelItems = [{ id: "p1" }]
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: parcelItems })
      const hook = await buildHook()

      await hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 14 })

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ bbox: "0,0,1,1", zoom: 14 }),
      )
    })

    test("handles non-array items in response without throwing", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: undefined })
      const hook = await buildHook()

      await expect(hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })).resolves.toBeUndefined()
    })

    test("calls onStatusChange with error message on failure", async () => {
      mockFetchPublicParcelStatuses.mockRejectedValue(new Error("Parcel fetch failed"))
      const onStatusChange = jest.fn()
      const hook = await buildHook({ onStatusChange })

      await hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })

      expect(onStatusChange).toHaveBeenCalledWith(fr.status.map.parcelsLoadFailed())
      expect(onStatusChange).not.toHaveBeenCalledWith(
        expect.stringContaining("Parcel fetch failed"),
      )
    })

    test("resolves successfully with valid bbox and zoom", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
      const hook = await buildHook()

      await expect(hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })).resolves.toBeUndefined()
    })
  })
})
