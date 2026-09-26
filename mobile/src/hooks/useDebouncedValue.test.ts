/**
 * Tests for useDebouncedValue, on renderHook (see render-hook-smoke.test.ts)
 * with fake timers.
 */

jest.mock("react-native", () => ({}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useDebouncedValue } from "./useDebouncedValue"

async function renderDebounced(initial: string, delayMs = 400) {
  return renderHook(({ value }: { value: string }) => useDebouncedValue(value, delayMs), {
    initialProps: { value: initial },
  })
}

describe("useDebouncedValue", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(async () => {
    await cleanup()
    jest.useRealTimers()
  })

  test("returns the initial value at once", async () => {
    const { result } = await renderDebounced("a")
    expect(result.current).toBe("a")
  })

  test("keeps the old value until the delay has elapsed", async () => {
    const { result, rerender } = await renderDebounced("a")

    await rerender({ value: "b" })
    await act(async () => {
      jest.advanceTimersByTime(399)
    })
    expect(result.current).toBe("a")

    await act(async () => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe("b")
  })

  test("a change within the delay restarts the timer", async () => {
    const { result, rerender } = await renderDebounced("a")

    await rerender({ value: "b" })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    await rerender({ value: "c" })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(result.current).toBe("a")

    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current).toBe("c")
  })

  test("unmount clears the pending timer", async () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout")
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")
    const { rerender, unmount } = await renderDebounced("b-initial", 400)

    await rerender({ value: "b" })
    const debounceTimers = setTimeoutSpy.mock.results
      .filter((_result, index) => setTimeoutSpy.mock.calls[index]?.[1] === 400)
      .map((result) => result.value)
    const pendingTimer = debounceTimers[debounceTimers.length - 1]
    expect(pendingTimer).toBeDefined()
    expect(clearTimeoutSpy).not.toHaveBeenCalledWith(pendingTimer)

    await unmount()
    expect(clearTimeoutSpy).toHaveBeenCalledWith(pendingTimer)
    setTimeoutSpy.mockRestore()
    clearTimeoutSpy.mockRestore()
  })
})
