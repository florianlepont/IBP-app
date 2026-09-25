/**
 * Real-SQL tests for the sub-keyed, best-effort profile cache (D-13).
 *
 * The first describe intentionally runs before initLocalDb() to prove the
 * cache never throws into the auth flow when local_meta does not exist yet.
 * The second describe calls initLocalDb() in beforeAll, which (since getDb()
 * memoises one promise per module registry) upgrades the same in-memory
 * database in place, so both describes share one database across the file.
 */

import { createNodeSqliteDb } from "../../test/node-sqlite-db"

const mockDb = createNodeSqliteDb()

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}))

import { AuthUser } from "../app/types"
import { initLocalDb } from "./db"
import { clearCachedProfile, loadCachedProfile, saveCachedProfile } from "./profile-cache"

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "a@example.fr",
    display_name: "A B",
    role: "member",
    first_name: "A",
    last_name: "B",
    profile_picture_url: null,
    ...overrides,
  }
}

describe("profile-cache before initLocalDb (table missing)", () => {
  test("loadCachedProfile returns null when local_meta does not exist", async () => {
    await expect(loadCachedProfile("sub-a")).resolves.toBeNull()
  })

  test("saveCachedProfile resolves without throwing when local_meta does not exist", async () => {
    await expect(saveCachedProfile("sub-a", makeUser())).resolves.toBeUndefined()
  })

  test("clearCachedProfile resolves without throwing when local_meta does not exist", async () => {
    await expect(clearCachedProfile()).resolves.toBeUndefined()
  })
})

describe("profile-cache after initLocalDb", () => {
  beforeAll(async () => {
    await initLocalDb()
  })

  beforeEach(async () => {
    await mockDb.execAsync(`DELETE FROM local_meta;`)
  })

  test("saveCachedProfile then loadCachedProfile for the same sub returns a deep-equal user", async () => {
    const user = makeUser()
    await saveCachedProfile("sub-a", user)

    await expect(loadCachedProfile("sub-a")).resolves.toEqual(user)
  })

  test("loadCachedProfile returns null when the cache belongs to a different sub", async () => {
    await saveCachedProfile("sub-a", makeUser())

    await expect(loadCachedProfile("sub-b")).resolves.toBeNull()
  })

  test("saving for sub-b replaces the sub-a entry (one cached profile at a time)", async () => {
    await saveCachedProfile("sub-a", makeUser({ id: "user-a" }))
    await saveCachedProfile("sub-b", makeUser({ id: "user-b" }))

    await expect(loadCachedProfile("sub-a")).resolves.toBeNull()
    await expect(loadCachedProfile("sub-b")).resolves.toEqual(makeUser({ id: "user-b" }))
  })

  test("clearCachedProfile then loadCachedProfile returns null", async () => {
    await saveCachedProfile("sub-a", makeUser())
    await clearCachedProfile()

    await expect(loadCachedProfile("sub-a")).resolves.toBeNull()
  })

  test("a corrupted value (not JSON) makes loadCachedProfile return null", async () => {
    const now = new Date().toISOString()
    await mockDb.runAsync(
      `INSERT INTO local_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ["cached_profile", "not-json{{{", now],
    )

    await expect(loadCachedProfile("sub-a")).resolves.toBeNull()
  })

  test("a corrupted value (JSON missing id/email/display_name strings) makes loadCachedProfile return null", async () => {
    const now = new Date().toISOString()
    await mockDb.runAsync(
      `INSERT INTO local_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [
        "cached_profile",
        JSON.stringify({ sub: "sub-a", user: { id: "user-1" }, cached_at: now }),
        now,
      ],
    )

    await expect(loadCachedProfile("sub-a")).resolves.toBeNull()
  })
})
