import { createInitialOperationStatus, updateOperationStatus } from "./operation-status"

describe("createInitialOperationStatus", () => {
  const SCOPES = ["session", "auth", "profile", "sync", "survey", "attachment", "debug"] as const

  test("creates all required scopes with idle state", () => {
    const status = createInitialOperationStatus()
    for (const scope of SCOPES) {
      expect(status[scope].state).toBe("idle")
    }
  })

  test("uses provided initial message for all scopes", () => {
    const status = createInitialOperationStatus("Initializing...")
    for (const scope of SCOPES) {
      expect(status[scope].message).toBe("Initializing...")
    }
  })

  test("defaults to 'Ready' message", () => {
    const status = createInitialOperationStatus()
    expect(status.auth.message).toBe("Ready")
  })

  test("sets updated_at to epoch (new Date(0))", () => {
    const status = createInitialOperationStatus()
    expect(status.profile.updated_at).toBe(new Date(0).toISOString())
  })
})

describe("updateOperationStatus", () => {
  test("updates the specified scope state and message", () => {
    const initial = createInitialOperationStatus()
    const updated = updateOperationStatus(initial, "sync", "running", "Syncing...")
    expect(updated.sync.state).toBe("running")
    expect(updated.sync.message).toBe("Syncing...")
  })

  test("does not mutate other scopes", () => {
    const initial = createInitialOperationStatus()
    const updated = updateOperationStatus(initial, "auth", "error", "Auth failed")
    expect(updated.session).toBe(initial.session)
    expect(updated.profile).toBe(initial.profile)
    expect(updated.sync).toBe(initial.sync)
  })

  test("sets updated_at to a recent timestamp", () => {
    const before = Date.now()
    const initial = createInitialOperationStatus()
    const updated = updateOperationStatus(initial, "sync", "success", "Done")
    const after = Date.now()
    const updatedAt = new Date(updated.sync.updated_at).getTime()
    expect(updatedAt).toBeGreaterThanOrEqual(before)
    expect(updatedAt).toBeLessThanOrEqual(after)
  })

  test("can set state to error", () => {
    const initial = createInitialOperationStatus()
    const updated = updateOperationStatus(initial, "debug", "error", "Something broke")
    expect(updated.debug.state).toBe("error")
    expect(updated.debug.message).toBe("Something broke")
  })

  test("can set state to success", () => {
    const initial = createInitialOperationStatus()
    const updated = updateOperationStatus(initial, "session", "success", "Logged in")
    expect(updated.session.state).toBe("success")
  })

  test("does not mutate the original map", () => {
    const initial = createInitialOperationStatus()
    updateOperationStatus(initial, "sync", "running", "Syncing...")
    expect(initial.sync.state).toBe("idle")
  })
})
