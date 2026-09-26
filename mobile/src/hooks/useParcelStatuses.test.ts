/**
 * Tests for useParcelStatuses.
 *
 * Strategy: render the real hook with renderHook (phase 01.9 D-01) under fake
 * timers, advance the debounce inside act and assert the fetch call and the
 * rendered items/loading state.
 */

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }))

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

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useParcelStatuses } from "./useParcelStatuses"

const MOCK_REGION = { latitude: 48, longitude: 2, latitudeDelta: 0.1, longitudeDelta: 0.1 }

type Props = Parameters<typeof useParcelStatuses>[0]

function buildProps(overrides: Partial<Props> = {}): Props {
  return {
    apiUrl: "http://localhost:3000",
    region: MOCK_REGION as never,
    ...overrides,
  }
}

async function renderStatuses(overrides: Partial<Props> = {}) {
  return renderHook((props: Props) => useParcelStatuses(props), {
    initialProps: buildProps(overrides),
  })
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(async () => {
  await cleanup()
})

describe("useParcelStatuses", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()

    mockComputeRegionBbox.mockReturnValue("0,0,1,1")
    mockComputeRegionZoom.mockReturnValue(14)
    mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns items and loading", async () => {
      const { result } = await renderStatuses()
      expect(result.current.items).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    test("computes bbox and zoom from region via useMemo", async () => {
      await renderStatuses()
      expect(mockComputeRegionBbox).toHaveBeenCalledWith(MOCK_REGION)
      expect(mockComputeRegionZoom).toHaveBeenCalledWith(MOCK_REGION)
    })

    test("defers the first fetch to the debounce timer on mount", async () => {
      await renderStatuses()
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
      await advance(400)
      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledTimes(1)
    })
  })

  // ─── enabled = false ──────────────────────────────────────────────────────

  describe("when disabled", () => {
    test("effect does not schedule a fetch", async () => {
      await renderStatuses({ enabled: false })
      await advance(1000)
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })

    test("effect clears items and loading when the hook becomes disabled", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: [{ id: "p1" }] })
      const { result, rerender } = await renderStatuses()
      await advance(400)
      expect(result.current.items).toEqual([{ id: "p1" }])

      await rerender(buildProps({ enabled: false }))

      expect(result.current.items).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledTimes(1)
    })
  })

  // ─── enabled = true (default) ─────────────────────────────────────────────

  describe("when enabled", () => {
    test("effect schedules fetch after debounce (default 400ms)", async () => {
      await renderStatuses()

      // Before debounce: not yet called
      await advance(399)
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()

      // After debounce: called
      await advance(1)

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(
        "http://localhost:3000",
        expect.objectContaining({ bbox: "0,0,1,1", zoom: 14 }),
      )
    })

    test("effect respects custom debounceMs", async () => {
      await renderStatuses({ debounceMs: 200 })

      await advance(199)
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
      await advance(1)

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
    })

    test("passes year to fetchPublicParcelStatuses when provided", async () => {
      await renderStatuses({ year: 2023 })
      await advance(400)

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ year: 2023 }),
      )
    })

    test("sets loading while the request is in flight", async () => {
      const pending = deferred<{ items: unknown[] }>()
      mockFetchPublicParcelStatuses.mockReturnValue(pending.promise)
      const { result } = await renderStatuses()

      await advance(400)
      expect(result.current.loading).toBe(true)

      await act(async () => {
        pending.resolve({ items: [] })
        await pending.promise
      })
      expect(result.current.loading).toBe(false)
    })

    test("handles successful fetch with valid items array", async () => {
      const items = [{ id: "p1" }, { id: "p2" }]
      mockFetchPublicParcelStatuses.mockResolvedValue({ items })
      const { result } = await renderStatuses()
      await advance(400)

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
      expect(result.current.items).toEqual(items)
      expect(result.current.loading).toBe(false)
    })

    test("handles successful fetch with non-array items (defaults to [])", async () => {
      mockFetchPublicParcelStatuses.mockResolvedValue({ items: null })
      const { result } = await renderStatuses()
      await advance(400)

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
      expect(result.current.items).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    test("handles fetch error gracefully", async () => {
      mockFetchPublicParcelStatuses.mockRejectedValue(new Error("fetch failed"))
      const { result } = await renderStatuses()
      await advance(400)

      expect(mockFetchPublicParcelStatuses).toHaveBeenCalled()
      expect(result.current.items).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    test("ignores a stale response once a newer request has started", async () => {
      const first = deferred<{ items: unknown[] }>()
      const second = deferred<{ items: unknown[] }>()
      mockFetchPublicParcelStatuses
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockResolvedValueOnce({ items: [{ id: "fresh" }] })
      const { result, rerender } = await renderStatuses({ year: 2021 })
      await advance(400)
      await rerender(buildProps({ year: 2022 }))
      await advance(400)
      await rerender(buildProps({ year: 2023 }))
      await advance(400)
      expect(result.current.items).toEqual([{ id: "fresh" }])

      await act(async () => {
        first.resolve({ items: [{ id: "stale" }] })
        second.reject(new Error("late"))
        await first.promise
        await second.promise.catch(() => undefined)
      })
      expect(result.current.items).toEqual([{ id: "fresh" }])
      expect(result.current.loading).toBe(false)
    })
  })

  // ─── cleanup ──────────────────────────────────────────────────────────────

  describe("cleanup", () => {
    test("unmounting before the debounce clears the scheduled timer", async () => {
      const { unmount } = await renderStatuses()
      await advance(399)

      await unmount()
      await advance(1000)
      expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    })
  })
})
