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

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
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
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("2 item(s)"))
    })

    test("handles non-array items in response without throwing", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: null })
      const onStatusChange = jest.fn()
      const hook = await buildHook({ onStatusChange })

      await hook.loadPublicMap()

      // 0 items loaded
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("0 item(s)"))
    })

    test("calls onStatusChange with error message on failure", async () => {
      mockFetchPublicMapItems.mockRejectedValue(new Error("Network error"))
      const onStatusChange = jest.fn()
      const hook = await buildHook({ onStatusChange })

      await hook.loadPublicMap()

      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("Network error"))
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

      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("Parcel fetch failed"))
    })

    test("resolves successfully with valid bbox and zoom", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
      const hook = await buildHook()

      await expect(hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })).resolves.toBeUndefined()
    })
  })
})
