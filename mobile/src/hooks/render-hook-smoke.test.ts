/**
 * Smoke test establishing the renderHook recipe every later test in this plan copies.
 *
 * Facts that make this work under the mobile Jest config (ts-jest, testEnvironment
 * "node", no react-native moduleNameMapper):
 *
 * 1. renderHook and act from @testing-library/react-native 14.x are ASYNC:
 *      const { result, rerender, unmount } = await renderHook(() => useX(params))
 *      await act(async () => { ... })
 *    Awaiting them lets pending effects (useEffect) flush before assertions run.
 *
 * 2. Both @testing-library/react-native's main entry AND its "/pure" entry require
 *    "react-native" transitively at module-load time (fire-event.ts, pointer-events.ts).
 *    The mobile Jest config (ts-jest, testEnvironment "node") has no moduleNameMapper
 *    for "react-native", and the real package ships Flow/ESM syntax ts-jest cannot
 *    parse from node_modules. Every renderHook test file must therefore declare
 *    `jest.mock("react-native", () => ({ ... }))` with a plain-object factory
 *    containing only the members the code under test touches, BEFORE importing
 *    "@testing-library/react-native/pure". This project uses the "/pure" entry
 *    point (not the main entry) because "/pure" skips RNTL's matcher/auto-cleanup
 *    wiring, which pulls in even more react-native surface than this Jest config
 *    can support.
 *
 * 3. Because "/pure" skips RNTL's automatic per-test cleanup, each test (or a shared
 *    afterEach) must call `cleanup()` itself to unmount between tests.
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  StyleSheet: { flatten: (s: unknown) => s },
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useEffect, useState } from "react"

afterEach(() => {
  cleanup()
})

function useCounter(initial: number) {
  const [count, setCount] = useState(initial)
  const [effectRan, setEffectRan] = useState(false)

  useEffect(() => {
    setEffectRan(true)
  }, [])

  const increment = () => setCount((current) => current + 1)

  return { count, effectRan, increment }
}

describe("renderHook smoke test", () => {
  test("effect runs and is visible in result.current after renderHook", async () => {
    const { result } = await renderHook(() => useCounter(0))

    expect(result.current.count).toBe(0)
    expect(result.current.effectRan).toBe(true)
  })

  test("act flushes a state update triggered from result.current", async () => {
    const { result } = await renderHook(() => useCounter(5))

    await act(async () => {
      result.current.increment()
    })

    expect(result.current.count).toBe(6)
  })
})
