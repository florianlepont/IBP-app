import { ForbiddenException } from "@nestjs/common"
import { DebugService } from "../src/debug/debug.service"
import { buildTestConfigService } from "./config-helper"

type MockClient = {
  query: jest.Mock
  release: jest.Mock
}

function buildService(queryImpl?: (sql: string) => Promise<unknown>, resetEnabled = true) {
  const client: MockClient = {
    query: jest.fn((sql: string) => queryImpl?.(sql)),
    release: jest.fn(),
  }
  const db = {
    connect: jest.fn().mockResolvedValue(client),
  }

  return {
    service: new DebugService(
      db as never,
      buildTestConfigService({ DEBUG_DATA_RESET_ENABLED: resetEnabled ? "true" : "false" }),
    ),
    db,
    client,
  }
}

describe("DebugService", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("blocks reset calls when debug.dataResetEnabled is false", async () => {
    const { service, db } = buildService(undefined, false)

    await expect(service.resetIbpData()).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.resetUserData()).rejects.toBeInstanceOf(ForbiddenException)
    expect(db.connect).not.toHaveBeenCalled()
  })

  it("deletes IBP data in order and returns deleted counts", async () => {
    const { service, client } = buildService(async (sql) => {
      if (sql === "DELETE FROM survey_events") return { rowCount: 4 }
      if (sql === "DELETE FROM attachments") return { rowCount: 3 }
      if (sql === "DELETE FROM surveys") return { rowCount: 2 }
      return { rowCount: 0 }
    })

    await expect(service.resetIbpData()).resolves.toEqual({
      surveys_deleted: 2,
      attachments_deleted: 3,
      events_deleted: 4,
    })
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "DELETE FROM survey_events",
      "DELETE FROM attachments",
      "DELETE FROM surveys",
      "COMMIT",
    ])
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("deletes user data in order and returns deleted counts", async () => {
    const { service, client } = buildService(async (sql) => {
      if (sql === "DELETE FROM survey_events") return { rowCount: 8 }
      if (sql === "DELETE FROM attachments") return { rowCount: 7 }
      if (sql === "DELETE FROM surveys") return { rowCount: 6 }
      if (sql === "DELETE FROM users") return { rowCount: 5 }
      return { rowCount: 0 }
    })

    await expect(service.resetUserData()).resolves.toEqual({
      users_deleted: 5,
      surveys_deleted: 6,
      attachments_deleted: 7,
      events_deleted: 8,
    })
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "DELETE FROM survey_events",
      "DELETE FROM attachments",
      "DELETE FROM surveys",
      "DELETE FROM users",
      "COMMIT",
    ])
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("rolls back and releases the client when a reset query fails", async () => {
    const error = new Error("delete failed")
    const { service, client } = buildService(async (sql) => {
      if (sql === "DELETE FROM attachments") {
        throw error
      }
      return { rowCount: 0 }
    })

    await expect(service.resetUserData()).rejects.toThrow("delete failed")
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "DELETE FROM survey_events",
      "DELETE FROM attachments",
      "ROLLBACK",
    ])
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})
