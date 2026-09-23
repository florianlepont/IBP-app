import { shouldShowDevTools } from "./dev-tools"

describe("shouldShowDevTools", () => {
  test("returns false when isDev is false", () => {
    expect(shouldShowDevTools(false)).toBe(false)
  })

  test("returns true when isDev is true", () => {
    expect(shouldShowDevTools(true)).toBe(true)
  })

  test("defaults to __DEV__, which is true under the Jest config", () => {
    expect(shouldShowDevTools()).toBe(true)
  })
})
