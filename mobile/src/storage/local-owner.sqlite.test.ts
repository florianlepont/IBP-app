/**
 * WR-06 regression, against real SQL (node:sqlite behind the expo-sqlite API):
 * a queued remote deletion whose local row is already gone must count as
 * unsynced local work, so logout warns before purging (D-03) and an account
 * switch reports a conflict instead of silently purging it (D-04).
 */

import { createNodeSqliteDb } from "../../test/node-sqlite-db"

const mockDb = createNodeSqliteDb()

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}))

import { hasUnsyncedWork, resolveLocalDataOwnership } from "../app/local-data-owner"
import { initLocalDb } from "./db"
import { countUnsyncedLocalWork, setLocalDataOwner } from "./local-owner"
import { queueDeleteSurvey } from "./surveys"

async function insertSyncedSurvey(id: string): Promise<void> {
  const now = new Date().toISOString()
  await mockDb.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, sync_blocked, payload_json, created_at, updated_at)
     VALUES (?, 'Parcelle', 'submitted', 'public', 3, 'synced', 0, NULL, ?, ?)`,
    [id, now, now],
  )
}

beforeAll(async () => {
  await initLocalDb()
})

beforeEach(async () => {
  await mockDb.execAsync(`
    DELETE FROM local_surveys;
    DELETE FROM sync_queue;
    DELETE FROM local_attachments;
    DELETE FROM local_meta;
  `)
})

describe("countUnsyncedLocalWork with pending remote deletions (WR-06)", () => {
  test("a fully synced device has no unsynced work", async () => {
    await insertSyncedSurvey("survey-synced")

    const work = await countUnsyncedLocalWork()

    expect(hasUnsyncedWork(work)).toBe(false)
  })

  test("a queued survey delete (local row already removed) counts as unsynced work", async () => {
    await insertSyncedSurvey("survey-public")

    const result = await queueDeleteSurvey("survey-public")
    expect(result.queued_delete).toBe(true)
    const localRow = await mockDb.getFirstAsync(`SELECT id FROM local_surveys WHERE id = ?`, [
      "survey-public",
    ])
    expect(localRow).toBeNull()

    const work = await countUnsyncedLocalWork()

    expect(work.deletions).toBe(1)
    expect(hasUnsyncedWork(work)).toBe(true)
  })

  test("an account switch with a pending delete is a conflict, not a silent purge", async () => {
    await setLocalDataOwner({ sub: "auth0|a", email: "a@example.fr" })
    await insertSyncedSurvey("survey-public")
    await queueDeleteSurvey("survey-public")

    const unsynced = await countUnsyncedLocalWork()

    expect(
      resolveLocalDataOwnership({ storedOwnerSub: "auth0|a", sessionSub: "auth0|b", unsynced }),
    ).toBe("conflict")
  })
})
