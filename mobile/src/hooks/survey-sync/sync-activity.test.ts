import {
  createSyncActivity,
  isSyncSuspendedError,
  purgeWhileSyncSuspended,
  SYNC_SUSPENDED_ERROR,
} from "./sync-activity"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("createSyncActivity (WR-08)", () => {
  test("run passes the task result through", async () => {
    const activity = createSyncActivity()

    await expect(activity.run(async () => 42)).resolves.toBe(42)
  })

  test("run refuses new tasks while suspended, and accepts them again after resume", async () => {
    const activity = createSyncActivity()
    const task = jest.fn(async () => "sent")

    const resume = activity.suspend()
    await expect(activity.run(task)).rejects.toThrow(SYNC_SUSPENDED_ERROR)
    expect(task).not.toHaveBeenCalled()

    resume()
    resume() // idempotent
    await expect(activity.run(task)).resolves.toBe("sent")
  })

  test("nested suspensions keep sync blocked until every one resumes", async () => {
    const activity = createSyncActivity()
    const resumeA = activity.suspend()
    const resumeB = activity.suspend()

    resumeA()
    await expect(activity.run(async () => "x")).rejects.toThrow(SYNC_SUSPENDED_ERROR)

    resumeB()
    await expect(activity.run(async () => "x")).resolves.toBe("x")
  })

  test("waitForIdle resolves only after in-flight tasks settle, even failed ones", async () => {
    const activity = createSyncActivity()
    const first = deferred<string>()
    const second = deferred<string>()
    const events: string[] = []

    void activity.run(() => first.promise).catch(() => undefined)
    void activity.run(() => second.promise).catch(() => undefined)
    const idle = activity.waitForIdle().then(() => events.push("idle"))

    first.resolve("done")
    await Promise.resolve()
    expect(events).toEqual([])

    second.reject(new Error("network"))
    await idle
    expect(events).toEqual(["idle"])
  })

  test("purgeWhileSyncSuspended purges after in-flight writes and blocks new syncs meanwhile", async () => {
    const activity = createSyncActivity()
    const inFlight = deferred<void>()
    const events: string[] = []

    void activity.run(async () => {
      await inFlight.promise
      events.push("sync-write")
    })

    const purged = purgeWhileSyncSuspended(activity, async () => {
      events.push("purge")
    })

    const late = await activity.run(async () => "late").catch((error: unknown) => error)
    expect(isSyncSuspendedError(late)).toBe(true)

    inFlight.resolve()
    await purged

    expect(events).toEqual(["sync-write", "purge"])
    await expect(activity.run(async () => "after")).resolves.toBe("after")
  })
})
