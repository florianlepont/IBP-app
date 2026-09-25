import { createSyncFlight } from "./sync-flight"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("createSyncFlight (D-03)", () => {
  test("two run('sync', task) calls before the first settles: task called once, both get the same value", async () => {
    const flight = createSyncFlight()
    const gate = deferred<string>()
    const task = jest.fn(() => gate.promise)

    const first = flight.run("sync", task)
    const second = flight.run("sync", task)

    expect(task).toHaveBeenCalledTimes(1)
    gate.resolve("result")

    await expect(first).resolves.toBe("result")
    await expect(second).resolves.toBe("result")
  })

  test("two run('pull', task) calls: same sharing", async () => {
    const flight = createSyncFlight()
    const gate = deferred<string>()
    const task = jest.fn(() => gate.promise)

    const first = flight.run("pull", task)
    const second = flight.run("pull", task)

    expect(task).toHaveBeenCalledTimes(1)
    gate.resolve("pulled")

    await expect(first).resolves.toBe("pulled")
    await expect(second).resolves.toBe("pulled")
  })

  test("run('sync', a) then run('pull', b) while a is pending: b starts only after a settles", async () => {
    const flight = createSyncFlight()
    const gateA = deferred<string>()
    const order: string[] = []

    const taskA = jest.fn(async () => {
      order.push("a-start")
      const value = await gateA.promise
      order.push("a-end")
      return value
    })
    const taskB = jest.fn(async () => {
      order.push("b-start")
      return "b-result"
    })

    const promiseA = flight.run("sync", taskA)
    const promiseB = flight.run("pull", taskB)

    // Let taskA's synchronous prelude run before asserting it started.
    await Promise.resolve()
    expect(order).toEqual(["a-start"])
    expect(taskB).not.toHaveBeenCalled()

    gateA.resolve("a-result")

    await expect(promiseA).resolves.toBe("a-result")
    await expect(promiseB).resolves.toBe("b-result")

    expect(order).toEqual(["a-start", "a-end", "b-start"])
  })

  test("run('pull', b) then run('sync', a) while b is pending: a starts only after b settles", async () => {
    const flight = createSyncFlight()
    const gateB = deferred<string>()
    const order: string[] = []

    const taskB = jest.fn(async () => {
      order.push("b-start")
      const value = await gateB.promise
      order.push("b-end")
      return value
    })
    const taskA = jest.fn(async () => {
      order.push("a-start")
      return "a-result"
    })

    const promiseB = flight.run("pull", taskB)
    const promiseA = flight.run("sync", taskA)

    await Promise.resolve()
    expect(order).toEqual(["b-start"])
    expect(taskA).not.toHaveBeenCalled()

    gateB.resolve("b-result")

    await expect(promiseB).resolves.toBe("b-result")
    await expect(promiseA).resolves.toBe("a-result")

    expect(order).toEqual(["b-start", "b-end", "a-start"])
  })

  test("three waiters: sync in flight, then two run('pull') queued behind it: exactly one pull task runs after the sync settles", async () => {
    const flight = createSyncFlight()
    const gateSync = deferred<string>()
    const pullTask = jest.fn(async () => "pull-result")

    const syncPromise = flight.run("sync", () => gateSync.promise)
    const pullPromise1 = flight.run("pull", pullTask)
    const pullPromise2 = flight.run("pull", pullTask)

    gateSync.resolve("sync-result")

    await expect(syncPromise).resolves.toBe("sync-result")
    await expect(pullPromise1).resolves.toBe("pull-result")
    await expect(pullPromise2).resolves.toBe("pull-result")

    expect(pullTask).toHaveBeenCalledTimes(1)
  })

  test("a rejected task rejects all joined callers with the same error and clears the flight", async () => {
    const flight = createSyncFlight()
    const failure = new Error("boom")
    const gate = deferred<string>()
    const task = jest.fn(() => gate.promise)

    const first = flight.run("sync", task)
    const second = flight.run("sync", task)

    gate.reject(failure)

    await expect(first).rejects.toBe(failure)
    await expect(second).rejects.toBe(failure)

    // The next run of the same kind starts a fresh task rather than reusing
    // the rejected one.
    const nextTask = jest.fn(async () => "fresh")
    await expect(flight.run("sync", nextTask)).resolves.toBe("fresh")
    expect(nextTask).toHaveBeenCalledTimes(1)
  })

  test("after a flight settles, a new run of the same kind starts a new task (no stale caching)", async () => {
    const flight = createSyncFlight()

    const firstTask = jest.fn(async () => "first")
    await expect(flight.run("sync", firstTask)).resolves.toBe("first")

    const secondTask = jest.fn(async () => "second")
    await expect(flight.run("sync", secondTask)).resolves.toBe("second")

    expect(firstTask).toHaveBeenCalledTimes(1)
    expect(secondTask).toHaveBeenCalledTimes(1)
  })
})
