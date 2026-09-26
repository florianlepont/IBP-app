/**
 * Proof that .test.tsx files are collected by the mobile Jest config and that
 * the JSX transform (tsconfig.jest.json "jsx": "react-jsx") works end to end
 * with renderHook's `wrapper` option. Follows the renderHook recipe from
 * render-hook-smoke.test.ts: jest.mock("react-native") with a plain-object
 * factory BEFORE importing from "@testing-library/react-native/pure", and an
 * afterEach cleanup() call since the "/pure" entry skips automatic cleanup.
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  StyleSheet: { flatten: (s: unknown) => s },
}))

import { cleanup, renderHook } from "@testing-library/react-native/pure"
import React, { useContext } from "react"

afterEach(() => {
  cleanup()
})

const LabelContext = React.createContext<string>("default")

function useLabel(): string {
  return useContext(LabelContext)
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <LabelContext.Provider value="field">{children}</LabelContext.Provider>
}

describe("render-hook-wrapper", () => {
  test("returns the value provided by a JSX wrapper", async () => {
    const { result } = await renderHook(() => useLabel(), { wrapper })

    expect(result.current).toBe("field")
  })

  test("returns the context default without a wrapper", async () => {
    const { result } = await renderHook(() => useLabel())

    expect(result.current).toBe("default")
  })
})
