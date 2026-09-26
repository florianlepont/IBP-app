/**
 * Tests for the stable-callback helpers (phase 01.9, D-01).
 *
 * The same-commit cases mount a parent that passes the stable callback to a
 * child whose useEffect calls it when the implementation changes. React runs
 * all layout effects of a commit before any passive effect, so a ref updated
 * in useLayoutEffect is already current when the child's useEffect runs. A
 * ref updated in useEffect would not be: child passive effects run before the
 * parent's (W1).
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  StyleSheet: { flatten: (s: unknown) => s },
}))

import { cleanup, renderHook } from "@testing-library/react-native/pure"
import React, { useEffect } from "react"
import renderer, { act } from "react-test-renderer"
import { useLatestCallback, useStableActions } from "./useLatestCallback"

afterEach(async () => {
  await cleanup()
})

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const originalConsoleError = console.error
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0] ?? "").includes("react-test-renderer is deprecated")) return
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("useLatestCallback", () => {
  test("keeps the same identity across rerenders and calls the latest function", async () => {
    let label = "first"
    const { result, rerender } = await renderHook(() =>
      useLatestCallback((suffix: string) => `${label}-${suffix}`),
    )
    const initial = result.current
    expect(initial("a")).toBe("first-a")

    label = "second"
    await rerender(undefined)

    expect(result.current).toBe(initial)
    expect(result.current("b")).toBe("second-b")
  })

  test("a child effect in the same commit already calls the new implementation", async () => {
    const calls: string[] = []

    function Child({ callback, version }: { callback: () => string; version: number }) {
      useEffect(() => {
        calls.push(callback())
      }, [callback, version])
      return null
    }

    function Parent({ version }: { version: number }) {
      const callback = useLatestCallback(() => `v${version}`)
      return React.createElement(Child, { callback, version })
    }

    let tree: renderer.ReactTestRenderer | null = null
    await act(async () => {
      tree = renderer.create(React.createElement(Parent, { version: 1 }))
    })
    await act(async () => {
      tree?.update(React.createElement(Parent, { version: 2 }))
    })

    expect(calls).toEqual(["v1", "v2"])
    await act(async () => {
      tree?.unmount()
    })
  })
})

type Actions = {
  greet: (name: string) => string
  count: () => number
}

describe("useStableActions", () => {
  test("returns the same object across rerenders and forwards to the latest members", async () => {
    let prefix = "hello"
    let total = 1
    const { result, rerender } = await renderHook(() =>
      useStableActions<Actions>({
        greet: (name) => `${prefix} ${name}`,
        count: () => total,
      }),
    )
    const initial = result.current
    expect(initial.greet("a")).toBe("hello a")
    expect(initial.count()).toBe(1)

    prefix = "bonjour"
    total = 2
    await rerender(undefined)

    expect(result.current).toBe(initial)
    expect(result.current.greet).toBe(initial.greet)
    expect(result.current.greet("b")).toBe("bonjour b")
    expect(result.current.count()).toBe(2)
  })

  test("a child effect in the same commit already calls the new member", async () => {
    const calls: string[] = []

    function Child({ actions, version }: { actions: { read: () => string }; version: number }) {
      useEffect(() => {
        calls.push(actions.read())
      }, [actions, version])
      return null
    }

    function Parent({ version }: { version: number }) {
      const actions = useStableActions({ read: () => `v${version}` })
      return React.createElement(Child, { actions, version })
    }

    let tree: renderer.ReactTestRenderer | null = null
    await act(async () => {
      tree = renderer.create(React.createElement(Parent, { version: 1 }))
    })
    await act(async () => {
      tree?.update(React.createElement(Parent, { version: 2 }))
    })

    expect(calls).toEqual(["v1", "v2"])
    await act(async () => {
      tree?.unmount()
    })
  })

  test("reports in development when the key set changes after the first render", async () => {
    let withExtra = false
    const { result, rerender } = await renderHook(() =>
      useStableActions<Record<string, () => string>>(
        withExtra ? { a: () => "a", extra: () => "x" } : { a: () => "a" },
      ),
    )
    const errorSpy = console.error as jest.Mock
    errorSpy.mockClear()
    errorSpy.mockImplementation(() => undefined)

    withExtra = true
    await rerender(undefined)

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("useStableActions: the action keys changed"),
      expect.anything(),
    )
    // The stable object keeps the keys of the first render.
    expect(Object.keys(result.current)).toEqual(["a"])
  })

  test("reports a removed key too", async () => {
    let withB = true
    const { rerender } = await renderHook(() =>
      useStableActions<Record<string, () => string>>(
        withB ? { a: () => "a", b: () => "b" } : { a: () => "a" },
      ),
    )
    const errorSpy = console.error as jest.Mock
    errorSpy.mockClear()
    errorSpy.mockImplementation(() => undefined)

    withB = false
    await rerender(undefined)

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("useStableActions: the action keys changed"),
      expect.anything(),
    )
  })
})
