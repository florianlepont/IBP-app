/**
 * Oldest schema (before any of the columns added incrementally over time
 * existed) -> v1 proof. Exercises ensureColumn's ALTER TABLE path across
 * every table, not just the columns already present on a "current"
 * pre-phase install (see db.migration.sqlite.test.ts for that case).
 */

import { createNodeSqliteDb } from "../../test/node-sqlite-db"

const mockDb = createNodeSqliteDb()

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}))

import { initLocalDb } from "./db"

const NOW = "2026-02-01T00:00:00.000Z"

const OLDEST_SCHEMA = `
  CREATE TABLE IF NOT EXISTS local_surveys (
    id TEXT PRIMARY KEY NOT NULL,
    site_name TEXT NOT NULL,
    status TEXT NOT NULL,
    sync_version INTEGER NOT NULL,
    sync_state TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS local_attachments (
    id TEXT PRIMARY KEY NOT NULL,
    survey_id TEXT NOT NULL,
    local_uri TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sync_state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS local_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`

beforeAll(async () => {
  await mockDb.execAsync(OLDEST_SCHEMA)

  await mockDb.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, sync_version, sync_state, updated_at)
     VALUES ('survey-legacy', 'Parcelle Legacy', 'draft', 1, 'pending', ?)`,
    [NOW],
  )
  await mockDb.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, created_at, updated_at)
     VALUES ('survey-legacy', ?, 'failed', 40, ?, ?)`,
    [
      JSON.stringify({ id: "survey-legacy", sync_version: 1, site_name: "Parcelle Legacy" }),
      NOW,
      NOW,
    ],
  )
  await mockDb.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, created_at, updated_at)
     VALUES ('att-legacy', 'survey-legacy', 'file:///legacy.jpg', 'image/jpeg', 500, 'pending', ?, ?)`,
    [NOW, NOW],
  )

  await initLocalDb()
})

describe("db migration on the oldest schema shape", () => {
  test("the survey row survives and missing columns are backfilled", async () => {
    const survey = await mockDb.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM local_surveys WHERE id = 'survey-legacy'`,
    )
    expect(survey?.site_name).toBe("Parcelle Legacy")
    expect(survey?.status).toBe("draft")
    expect(survey?.created_at).toBe(NOW)
    expect(survey?.visibility).toBe("private")
    expect(survey?.sync_blocked).toBe(0)
    expect(survey?.payload_json).toBeNull()
  })

  test("the queue row survives with retry_count reset and op_type backfilled", async () => {
    const row = await mockDb.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM sync_queue WHERE survey_id = 'survey-legacy'`,
    )
    expect(row?.retry_count).toBe(0)
    expect(row?.next_retry_at).toBeNull()
    expect(row?.op_type).toBe("survey_upsert")
  })

  test("the attachment row survives with file_state backfilled", async () => {
    const row = await mockDb.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM local_attachments WHERE id = 'att-legacy'`,
    )
    expect(row?.file_state).toBe("local")
    expect(row?.remote_attachment_id).toBeNull()
    expect(row?.local_uri).toBe("file:///legacy.jpg")
  })

  test("PRAGMA user_version is 2", async () => {
    const version = await mockDb.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`)
    expect(version?.user_version).toBe(2)
  })

  test("every column added since the oldest schema now exists on every table", async () => {
    const surveyColumns = (
      await mockDb.getAllAsync<{ name: string }>(`PRAGMA table_info(local_surveys)`)
    ).map((column) => column.name)
    for (const column of [
      "last_sync_error",
      "last_sync_error_code",
      "last_sync_error_at",
      "sync_blocked",
      "payload_json",
      "created_at",
      "visibility",
    ]) {
      expect(surveyColumns).toContain(column)
    }

    const attachmentColumns = (
      await mockDb.getAllAsync<{ name: string }>(`PRAGMA table_info(local_attachments)`)
    ).map((column) => column.name)
    for (const column of [
      "remote_attachment_id",
      "storage_key",
      "upload_url",
      "confirm_url",
      "last_sync_error",
      "last_sync_error_code",
      "last_sync_error_at",
      "file_state",
    ]) {
      expect(attachmentColumns).toContain(column)
    }

    const queueColumns = (
      await mockDb.getAllAsync<{ name: string }>(`PRAGMA table_info(sync_queue)`)
    ).map((column) => column.name)
    expect(queueColumns).toContain("next_retry_at")
    expect(queueColumns).toContain("op_type")
  })
})
