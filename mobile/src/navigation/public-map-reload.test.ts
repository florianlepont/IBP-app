import { createPublicMapReloadSignal } from "./public-map-reload"

describe("createPublicMapReloadSignal", () => {
  test("a request made before any subscriber is delivered once, on subscribe", () => {
    const signal = createPublicMapReloadSignal()
    signal.request()
    signal.request()

    const listener = jest.fn()
    signal.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1)

    const late = jest.fn()
    signal.subscribe(late)
    expect(late).not.toHaveBeenCalled()
  })

  test("a request with subscribers calls each of them and leaves nothing pending", () => {
    const signal = createPublicMapReloadSignal()
    const first = jest.fn()
    const second = jest.fn()
    signal.subscribe(first)
    signal.subscribe(second)

    signal.request()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    const late = jest.fn()
    signal.subscribe(late)
    expect(late).not.toHaveBeenCalled()
  })

  test("an unsubscribed listener is not called, and the next request is pending again", () => {
    const signal = createPublicMapReloadSignal()
    const listener = jest.fn()
    const unsubscribe = signal.subscribe(listener)
    unsubscribe()

    signal.request()
    expect(listener).not.toHaveBeenCalled()

    const next = jest.fn()
    signal.subscribe(next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
