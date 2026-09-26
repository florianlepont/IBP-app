const connect = jest.fn()
const poolQuery = jest.fn()
const end = jest.fn()
const on = jest.fn()

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect,
    query: poolQuery,
    end,
    on,
  })),
}))

import { Logger } from "@nestjs/common"
import { Pool } from "pg"
import { DatabaseService } from "../src/database/database.service"
import { buildTestConfigService } from "./config-helper"

function buildDb(overrides: Record<string, string | undefined> = {}): DatabaseService {
  return new DatabaseService(buildTestConfigService(overrides))
}

function buildClient() {
  return {
    query: jest.fn().mockResolvedValue({}),
    release: jest.fn(),
  }
}

describe("DatabaseService.transaction", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("commits when fn resolves, releases the client once", async () => {
    const client = buildClient()
    connect.mockResolvedValueOnce(client)
    const db = buildDb()

    const fn = jest.fn().mockResolvedValue("ok")
    const result = await db.transaction(fn)

    expect(result).toBe("ok")
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(client.query).toHaveBeenNthCalledWith(2, "COMMIT")
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("rolls back and rethrows the original error when fn rejects, never commits", async () => {
    const client = buildClient()
    connect.mockResolvedValueOnce(client)
    const db = buildDb()

    const error = new Error("fn failed")
    const fn = jest.fn().mockRejectedValue(error)

    await expect(db.transaction(fn)).rejects.toBe(error)

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN")
    expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK")
    expect(client.query).not.toHaveBeenCalledWith("COMMIT")
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("still rethrows the original fn error when ROLLBACK itself rejects, and still releases", async () => {
    const client = buildClient()
    client.query.mockImplementation((text: string) => {
      if (text === "ROLLBACK") {
        return Promise.reject(new Error("rollback failed"))
      }
      return Promise.resolve({})
    })
    connect.mockResolvedValueOnce(client)
    const db = buildDb()

    const error = new Error("fn failed")
    const fn = jest.fn().mockRejectedValue(error)

    await expect(db.transaction(fn)).rejects.toBe(error)
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("rethrows and releases when BEGIN itself rejects", async () => {
    const client = buildClient()
    const beginError = new Error("begin failed")
    client.query.mockImplementation((text: string) => {
      if (text === "BEGIN") {
        return Promise.reject(beginError)
      }
      return Promise.resolve({})
    })
    connect.mockResolvedValueOnce(client)
    const db = buildDb()

    const fn = jest.fn().mockResolvedValue("unused")

    await expect(db.transaction(fn)).rejects.toBe(beginError)
    expect(fn).not.toHaveBeenCalled()
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("forwards the handle's query(text, values) to the same client, not the pool", async () => {
    const client = buildClient()
    connect.mockResolvedValueOnce(client)
    const db = buildDb()

    await db.transaction(async (handle) => {
      await handle.query("SELECT 1 WHERE $1 = $2", ["a", "b"])
      return null
    })

    expect(client.query).toHaveBeenCalledWith("SELECT 1 WHERE $1 = $2", ["a", "b"])
    expect(poolQuery).not.toHaveBeenCalled()
  })
})

describe("DatabaseService pool (D-06)", () => {
  const poolDefaults = {
    PG_POOL_MAX: undefined,
    PG_IDLE_TIMEOUT_MS: undefined,
    PG_CONNECTION_TIMEOUT_MS: undefined,
    PG_STATEMENT_TIMEOUT_MS: undefined,
    PG_IDLE_IN_TRANSACTION_TIMEOUT_MS: undefined,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("builds the pool once with the bounded defaults", () => {
    buildDb({
      ...poolDefaults,
      POSTGRES_HOST: "db.internal",
      POSTGRES_PORT: "6543",
      POSTGRES_USER: "u",
      POSTGRES_PASSWORD: "p",
      POSTGRES_DB: "d_test",
    })

    expect(Pool).toHaveBeenCalledTimes(1)
    expect((Pool as unknown as jest.Mock).mock.calls[0][0]).toEqual({
      host: "db.internal",
      port: 6543,
      user: "u",
      password: "p",
      database: "d_test",
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 60000,
      application_name: "cortege-api",
    })
  })

  it("follows PG_POOL_MAX and PG_STATEMENT_TIMEOUT_MS overrides", () => {
    buildDb({ ...poolDefaults, PG_POOL_MAX: "4", PG_STATEMENT_TIMEOUT_MS: "250" })

    const options = (Pool as unknown as jest.Mock).mock.calls[0][0]
    expect(options.max).toBe(4)
    expect(options.statement_timeout).toBe(250)
    expect(options.connectionTimeoutMillis).toBe(5000)
  })

  it("logs an idle client error with message and code, without throwing", () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    buildDb()

    expect(on).toHaveBeenCalledTimes(1)
    expect(on.mock.calls[0][0]).toBe("error")
    const handler = on.mock.calls[0][1] as (err: Error) => void

    expect(() => handler(Object.assign(new Error("boom"), { code: "57P01" }))).not.toThrow()
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const logged = String(errorSpy.mock.calls[0][0])
    expect(logged).toContain("boom")
    expect(logged).toContain("57P01")
  })

  it("logs an idle client error without a code", () => {
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    buildDb()
    const handler = on.mock.calls[0][1] as (err: Error) => void

    handler(new Error("gone"))

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const logged = String(errorSpy.mock.calls[0][0])
    expect(logged).toContain("gone")
    expect(logged).not.toContain("code=")
  })
})
