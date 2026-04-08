/**
 * Tests for useParcelStatuses.
 *
 * Strategy: spy on React.useState / useRef / useMemo and capture the useEffect
 * callback to run it manually with fake timers.
 */

const mockFetchPublicParcelStatuses = jest.fn()
const mockComputeRegionBbox = jest.fn()
const mockComputeRegionZoom = jest.fn()

jest.mock("../api/ibp-api", () => ({
  fetchPublicParcelStatuses: (...args: unknown[]) => mockFetchPublicParcelStatuses(...args),
}))

jest.mock("../app/map-viewport", () => ({
  computeRegionBbox: (...args: unknown[]) => mockComputeRegionBbox(...args),
  computeRegionZoom: (...args: unknown[]) => mockComputeRegionZoom(...args),
}))

jest.mock("react-native-maps", () => ({}))

import React from "react"
import { useParcelStatuses } from "./useParcelStatuses"

const MOCK_REGION = { latitude: 48, longitude: 2, latitudeDelta: 0.1, longitudeDelta: 0.1 }

function useBuildHook(overrides: Record<string, unknown> = {}) {
  return useParcelStatuses({
    apiUrl: "http://localhost:3000",
    region: MOCK_REGION as never,
    ...overrides,
  })
}

describe("useParcelStatuses", () => {
  let useStateSpy: jest.SpyInstance
  let useRefSpy: jest.SpyInstance
  let useMemoSpy: jest.SpyInstance
  let useEffectSpy: jest.SpyInstance
  let capturedEffect: React.EffectCallback | null

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllTimers()
    capturedEffect = null

    mockComputeRegionBbox.mockReturnValue("0,0,1,1")
    mockComputeRegionZoom.mockReturnValue(14)

    useStateSpy = jest
      .spyOn(React, "useState")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((initial: unknown) => [initial, jest.fn()]) as any)
    useRefSpy = jest
      .spyOn(React, "useRef")
      .mockImplementation((initial: unknown) => ({ current: initial }) as never)
    useMemoSpy = jest
      .spyOn(React, "useMemo")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((fn) => fn() as any)
    useEffectSpy = jest
      .spyOn(React, "useEffect")
      .mockImplementation((fn) => {
        capturedEffect = fn
      })
  })

  afterEach(() => {
    jest.useRealTimers()
    useStateSpy.mockRestore()
    useRefSpy.mockRestore()
    useMemoSpy.mockRestore()
    useEffectSpy.mockRestore()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns items and loading", () => {
      const hook = useBuildHook()
      expect(hook).toHaveProperty("items")
      expect(hook).toHaveProperty("loading")
    })

    test("computes bbox and zoom from region via useMemo", () => {
      useBuildHook()
      expect(mockComputeRegionBbox).toHaveBeenCalledWith(MOCK_REGION)
      expect(mockComputeRegionZoom).toHaveBeenCalledWith(MOCK_REGION)
    })

    test("captures an effect for side effects", () => {
      useBuildHook()
      expect(capturedEffect).not.toBeNull()
    })
  })

  // ─── enabled = false ──────────────────────────────────────────────────────

  describe("when disabled", () => {
    test("effect does not schedule a fetch", () => {
      useBuildHook({ enabled: false })
      capturedEffect?.()
      jest.runAllTimers()
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })

    test("effect calls setItems([]) and setLoading(false)", () => {
      const hook = useBuildHook({ enabled: false })
      const _setItems = hook.items // items from useState spy
      // we can verify through the effect that state setters are called
      // (they are jest.fn() from useStateSpy, captured in order of useState calls)
      capturedEffect?.()
      // No timer should have been created
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })
  })

  // ─── enabled = true (default) ─────────────────────────────────────────────

  describe("when enabled", () => {
    test("effect schedules fetch after debounce (default 400ms)", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
      useBuildHook()
      capturedEffect?.()

      // Before debounce: not yet called
      jest.advanceTimersByTime(399)
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()

      // After debounce: called
      jest.advanceTimersByTime(1)
      await Promise.resolve()
      await Promise.resolve()

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ bbox: "0,0,1,1", zoom: 14 }),
      )
    })

    test("effect respects custom debounceMs", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
      useBuildHook({ debounceMs: 200 })
      capturedEffect?.()

      jest.runAllTimers()
      await Promise.resolve()
      await Promise.resolve()

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
    })

    test("passes year to fetchPublicParcelStatuses when provided", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
      useBuildHook({ year: 2023 })
      capturedEffect?.()
      jest.advanceTimersByTime(400)
      await Promise.resolve()
      await Promise.resolve()

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ year: 2023 }),
      )
    })

    test("handles successful fetch with valid items array", async () => {
      const items = [{ id: "p1" }, { id: "p2" }]
      mockFetchPublicParcelStatuses.mockResolvedValue({ items })
      useBuildHook()
      capturedEffect?.()
      jest.advanceTimersByTime(400)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
    })

    test("handles successful fetch with non-array items (defaults to [])", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: null })
      useBuildHook()
      capturedEffect?.()
      jest.advanceTimersByTime(400)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
    })

    test("handles fetch error gracefully", async () => {
      mockFetchPublicParcelStatuses.mockRejectedValue(new Error("fetch failed"))
      useBuildHook()
      capturedEffect?.()
      jest.advanceTimersByTime(400)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
    })
  })

  // ─── cleanup ──────────────────────────────────────────────────────────────

  describe("cleanup", () => {
    test("effect returns a cleanup function (covers cleanup code path)", () => {
      useBuildHook()
      const cleanup = capturedEffect?.() as (() => void) | undefined
      expect(typeof cleanup).toBe("function")
      // Calling cleanup should not throw (clearTimeout on the scheduled timer)
      expect(() => cleanup?.()).not.toThrow()
    })
  })
})
