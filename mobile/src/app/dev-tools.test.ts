import { devOnlyHandler, shouldShowDevTools } from "./dev-tools"

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

describe("devOnlyHandler", () => {
  test("returns the handler when isDev is true", () => {
    const handler = () => "called"
    expect(devOnlyHandler(handler, true)).toBe(handler)
  })

  test("returns undefined when isDev is false", () => {
    const handler = () => "called"
    expect(devOnlyHandler(handler, false)).toBeUndefined()
  })
})
