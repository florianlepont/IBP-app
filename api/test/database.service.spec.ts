const connect = jest.fn()
const poolQuery = jest.fn()
const end = jest.fn()

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect,
    query: poolQuery,
    end,
  })),
}))

import { DatabaseService } from "../src/database/database.service"

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
    const db = new DatabaseService()

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
    const db = new DatabaseService()

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
    const db = new DatabaseService()

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
    const db = new DatabaseService()

    const fn = jest.fn().mockResolvedValue("unused")

    await expect(db.transaction(fn)).rejects.toBe(beginError)
    expect(fn).not.toHaveBeenCalled()
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("forwards the handle's query(text, values) to the same client, not the pool", async () => {
    const client = buildClient()
    connect.mockResolvedValueOnce(client)
    const db = new DatabaseService()

    await db.transaction(async (handle) => {
      await handle.query("SELECT 1 WHERE $1 = $2", ["a", "b"])
      return null
    })

    expect(client.query).toHaveBeenCalledWith("SELECT 1 WHERE $1 = $2", ["a", "b"])
    expect(poolQuery).not.toHaveBeenCalled()
  })
})
