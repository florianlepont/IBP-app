/**
 * Tests for usePublicMapExplorer.
 *
 * Strategy: spy on React.useState / useCallback / useRef so the hook can be
 * called directly in Node without a renderer.
 */

const mockFetchPublicMapItems = jest.fn()
const mockFetchPublicParcelStatuses = jest.fn()

jest.mock("../api/ibp-api", () => ({
  fetchPublicMapItems: (...args: unknown[]) => mockFetchPublicMapItems(...args),
  fetchPublicParcelStatuses: (...args: unknown[]) => mockFetchPublicParcelStatuses(...args),
}))

import React from "react"
import { usePublicMapExplorer } from "./usePublicMapExplorer"

const DEFAULT_PARAMS = {
  apiUrl: "http://localhost:3000",
  onStatusChange: jest.fn(),
}

function useBuildHook(overrides: Record<string, unknown> = {}) {
  return usePublicMapExplorer({ ...DEFAULT_PARAMS, ...overrides } as never)
}

describe("usePublicMapExplorer", () => {
  let useStateSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance
  let useRefSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    useStateSpy = jest
      .spyOn(React, "useState")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((initial: unknown) => [initial, jest.fn()]) as any)
    useCallbackSpy = jest.spyOn(React, "useCallback").mockImplementation((fn) => fn as never)
    useRefSpy = jest
      .spyOn(React, "useRef")
      .mockImplementation((initial: unknown) => ({ current: initial }) as never)
  })

  afterEach(() => {
    useStateSpy.mockRestore()
    useCallbackSpy.mockRestore()
    useRefSpy.mockRestore()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", () => {
      const hook = useBuildHook()
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

    test("initializes with empty state", () => {
      const hook = useBuildHook()
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
      const hook = useBuildHook({ onStatusChange })

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
      const hook = useBuildHook({ onStatusChange })

      await hook.loadPublicMap()

      // 0 items loaded
      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("0 item(s)"))
    })

    test("calls onStatusChange with error message on failure", async () => {
      mockFetchPublicMapItems.mockRejectedValue(new Error("Network error"))
      const onStatusChange = jest.fn()
      const hook = useBuildHook({ onStatusChange })

      await hook.loadPublicMap()

      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("Network error"))
    })

    test("completes without throwing (setLoading called via finally)", async () => {
      mockFetchPublicMapItems.mockResolvedValue({ items: [] })
      const hook = useBuildHook()
      await expect(hook.loadPublicMap()).resolves.toBeUndefined()
    })

    test("still resolves on error (finally block runs)", async () => {
      mockFetchPublicMapItems.mockRejectedValue(new Error("fail"))
      const hook = useBuildHook()
      await expect(hook.loadPublicMap()).resolves.toBeUndefined()
    })
  })

  // ─── loadPublicParcels ────────────────────────────────────────────────────

  describe("loadPublicParcels", () => {
    test("returns early when bbox is empty", async () => {
      const hook = useBuildHook()

      await hook.loadPublicParcels({ bbox: "", zoom: 10 })

      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })

    test("returns early when bbox is whitespace only", async () => {
      const hook = useBuildHook()

      await hook.loadPublicParcels({ bbox: "   ", zoom: 10 })

      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })

    test("calls fetchPublicParcelStatuses with correct params on success", async () => {
      const parcelItems = [{ id: "p1" }]
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: parcelItems })
      const hook = useBuildHook()

      await hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 14 })

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ bbox: "0,0,1,1", zoom: 14 }),
      )
    })

    test("handles non-array items in response without throwing", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: undefined })
      const hook = useBuildHook()

      await expect(hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })).resolves.toBeUndefined()
    })

    test("calls onStatusChange with error message on failure", async () => {
      mockFetchPublicParcelStatuses.mockRejectedValue(new Error("Parcel fetch failed"))
      const onStatusChange = jest.fn()
      const hook = useBuildHook({ onStatusChange })

      await hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })

      expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining("Parcel fetch failed"))
    })

    test("resolves successfully with valid bbox and zoom", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
      const hook = useBuildHook()

      await expect(hook.loadPublicParcels({ bbox: "0,0,1,1", zoom: 10 })).resolves.toBeUndefined()
    })
  })
})
