const mockDb = {
  runAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(null),
}

jest.mock("./db", () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}))

import {
  countUnsyncedLocalWork,
  getLocalDataOwner,
  LOCAL_OWNER_EMAIL_KEY,
  LOCAL_OWNER_SUB_KEY,
  setLocalDataOwner,
} from "./local-owner"

beforeEach(() => {
  jest.clearAllMocks()
})

describe("getLocalDataOwner", () => {
  test("returns null when no session_owner_sub row exists", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null)

    const owner = await getLocalDataOwner()

    expect(owner).toBeNull()
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(expect.any(String), [LOCAL_OWNER_SUB_KEY])
  })

  test("returns sub and email when both rows exist", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ value: "auth0|a" })
      .mockResolvedValueOnce({ value: "a@b.fr" })

    const owner = await getLocalDataOwner()

    expect(owner).toEqual({ sub: "auth0|a", email: "a@b.fr" })
    expect(mockDb.getFirstAsync).toHaveBeenNthCalledWith(1, expect.any(String), [
      LOCAL_OWNER_SUB_KEY,
    ])
    expect(mockDb.getFirstAsync).toHaveBeenNthCalledWith(2, expect.any(String), [
      LOCAL_OWNER_EMAIL_KEY,
    ])
  })

  test("returns null email when the email row is absent", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ value: "auth0|a" }).mockResolvedValueOnce(null)

    const owner = await getLocalDataOwner()

    expect(owner).toEqual({ sub: "auth0|a", email: null })
  })
})

describe("setLocalDataOwner", () => {
  test("upserts both sub and email keys when email is provided", async () => {
    await setLocalDataOwner({ sub: "auth0|a", email: "a@b.fr" })

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO local_meta"),
      [LOCAL_OWNER_SUB_KEY, "auth0|a", expect.any(String)],
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO local_meta"),
      [LOCAL_OWNER_EMAIL_KEY, "a@b.fr", expect.any(String)],
    )
  })

  test("upserts sub and deletes email key when email is null", async () => {
    await setLocalDataOwner({ sub: "auth0|a", email: null })

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO local_meta"),
      [LOCAL_OWNER_SUB_KEY, "auth0|a", expect.any(String)],
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM local_meta"),
      [LOCAL_OWNER_EMAIL_KEY],
    )
  })
})

describe("countUnsyncedLocalWork", () => {
  test("returns counts from the two COUNT queries", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 5 })

    const result = await countUnsyncedLocalWork()

    expect(result).toEqual({ surveys: 2, attachments: 5 })
    expect(mockDb.getFirstAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM local_surveys"),
    )
    expect(mockDb.getFirstAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM local_attachments"),
    )
  })

  test("defaults counts to zero when rows are absent", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

    const result = await countUnsyncedLocalWork()

    expect(result).toEqual({ surveys: 0, attachments: 0 })
  })
})
