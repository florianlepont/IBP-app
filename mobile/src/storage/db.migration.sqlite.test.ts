/**
 * v0 (current pre-phase schema) -> v1 data-preservation proof (D-08).
 *
 * Own-handle recipe (mobile/src/storage/local-owner.sqlite.test.ts:8-37):
 * seed a real node:sqlite database with the exact CREATE TABLE text this
 * file's db.ts used before this phase, insert rows through raw SQL, then run
 * the current initLocalDb() and assert every row and value survives.
 */

import { createNodeSqliteDb } from "../../test/node-sqlite-db"

const mockDb = createNodeSqliteDb()

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}))

import { initLocalDb } from "./db"

const NOW = "2026-01-01T00:00:00.000Z"
const NEXT_RETRY_AT = "2026-01-01T00:05:00.000Z"

const PRE_PHASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS local_surveys (
    id TEXT PRIMARY KEY NOT NULL,
    site_name TEXT NOT NULL,
    status TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    sync_version INTEGER NOT NULL,
    sync_state TEXT NOT NULL,
    last_sync_error TEXT,
    last_sync_error_code TEXT,
    last_sync_error_at TEXT,
    sync_blocked INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
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
    remote_attachment_id TEXT,
    storage_key TEXT,
    upload_url TEXT,
    confirm_url TEXT,
    last_sync_error TEXT,
    last_sync_error_code TEXT,
    last_sync_error_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_local_attachments_survey
    ON local_attachments(survey_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS local_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`

// One row per payload kind, plus one garbage row. Order matters: sync_queue
// ids are assigned by AUTOINCREMENT in insertion order, and the op_type
// assertion below relies on that order.
const QUEUE_ROWS: Array<{ survey_id: string; payload: unknown; retry_count: number }> = [
  {
    survey_id: "survey-draft",
    payload: { id: "survey-draft", sync_version: 1, site_name: "Parcelle A" },
    retry_count: 0,
  },
  {
    survey_id: "survey-blocked",
    payload: { kind: "survey_delete", survey_id: "survey-blocked" },
    retry_count: 3,
  },
  {
    survey_id: "survey-synced",
    payload: { kind: "survey_visibility_update", survey_id: "survey-synced", visibility: "public" },
    retry_count: 12,
  },
  {
    survey_id: "survey-draft",
    payload: {
      kind: "attachment_upload",
      local_attachment_id: "att-pending",
      survey_id: "survey-draft",
      local_uri: "file:///a.jpg",
      mime_type: "image/jpeg",
      size_bytes: 100,
    },
    retry_count: 25,
  },
  {
    survey_id: "survey-synced",
    payload: { kind: "attachment_delete", survey_id: "survey-synced", attachment_id: "remote-1" },
    retry_count: 0,
  },
  {
    survey_id: "survey-draft",
    payload: "not json",
    retry_count: 3,
  },
]

async function seedPrePhaseInstall(): Promise<void> {
  await mockDb.execAsync(PRE_PHASE_SCHEMA)

  await mockDb.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES ('survey-draft', 'Parcelle A', 'draft', 'private', 1, 'pending', NULL, NULL, NULL, 0, ?, ?, ?)`,
    [JSON.stringify({ id: "survey-draft", sync_version: 1, site_name: "Parcelle A" }), NOW, NOW],
  )
  await mockDb.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES ('survey-synced', 'Parcelle B', 'submitted', 'public', 4, 'synced', NULL, NULL, NULL, 0, NULL, ?, ?)`,
    [NOW, NOW],
  )
  await mockDb.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES ('survey-blocked', 'Parcelle C', 'draft', 'private', 2, 'failed', 'boom', 'sync_failed', ?, 1, NULL, ?, ?)`,
    [NOW, NOW, NOW],
  )

  for (const row of QUEUE_ROWS) {
    await mockDb.runAsync(
      `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
       VALUES (?, ?, 'failed', ?, ?, ?, ?)`,
      [
        row.survey_id,
        typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload),
        row.retry_count,
        NEXT_RETRY_AT,
        NOW,
        NOW,
      ],
    )
  }

  await mockDb.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, created_at, updated_at)
     VALUES ('att-pending', 'survey-draft', 'file:///a.jpg', 'image/jpeg', 100, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    [NOW, NOW],
  )
  await mockDb.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, created_at, updated_at)
     VALUES ('att-remote', 'survey-synced', '', 'image/jpeg', 2048, 'synced', 'remote-1', 'key-1', NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    [NOW, NOW],
  )

  await mockDb.runAsync(
    `INSERT INTO local_meta (key, value, updated_at) VALUES ('downsync_cursor', 'cursor-1', ?)`,
    [NOW],
  )
  await mockDb.runAsync(
    `INSERT INTO local_meta (key, value, updated_at) VALUES ('session_owner_sub', 'auth0|abc', ?)`,
    [NOW],
  )
  await mockDb.runAsync(
    `INSERT INTO local_meta (key, value, updated_at) VALUES ('session_owner_email', 'a@example.fr', ?)`,
    [NOW],
  )
}

beforeAll(async () => {
  await seedPrePhaseInstall()
  await initLocalDb()
})

describe("db migration v0 -> v1 (data preservation, D-08)", () => {
  test("PRAGMA user_version is 1 after migration", async () => {
    const version = await mockDb.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`)
    expect(version?.user_version).toBe(1)
  })

  test("all three seeded surveys survive with their values unchanged", async () => {
    const surveys = await mockDb.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM local_surveys ORDER BY id`,
    )
    expect(surveys).toHaveLength(3)

    const draft = surveys.find((row) => row.id === "survey-draft")
    expect(draft?.status).toBe("draft")
    expect(draft?.sync_state).toBe("pending")
    expect(String(draft?.payload_json)).toContain("Parcelle A")

    const synced = surveys.find((row) => row.id === "survey-synced")
    expect(synced?.status).toBe("submitted")
    expect(synced?.sync_state).toBe("synced")
    expect(synced?.visibility).toBe("public")

    const blocked = surveys.find((row) => row.id === "survey-blocked")
    expect(blocked?.sync_blocked).toBe(1)
    expect(blocked?.last_sync_error_code).toBe("sync_failed")
    expect(blocked?.last_sync_error).toBe("boom")
  })

  test("all six seeded queue rows survive with retry_count reset and op_type backfilled", async () => {
    const rows = await mockDb.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM sync_queue ORDER BY id`,
    )
    expect(rows).toHaveLength(6)

    for (const row of rows) {
      expect(row.retry_count).toBe(0)
      expect(row.next_retry_at).toBeNull()
    }

    expect(rows.map((row) => row.op_type)).toEqual([
      "survey_upsert",
      "survey_delete",
      "survey_visibility",
      "attachment_upload",
      "attachment_delete",
      "unknown",
    ])
  })

  test("both attachments survive with file_state backfilled", async () => {
    const rows = await mockDb.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM local_attachments ORDER BY id`,
    )
    expect(rows).toHaveLength(2)

    const pending = rows.find((row) => row.id === "att-pending")
    expect(pending?.file_state).toBe("local")
    expect(pending?.local_uri).toBe("file:///a.jpg")

    const remote = rows.find((row) => row.id === "att-remote")
    expect(remote?.file_state).toBe("remote")
    expect(remote?.remote_attachment_id).toBe("remote-1")
    expect(remote?.storage_key).toBe("key-1")
  })

  test("all three local_meta rows survive", async () => {
    const rows = await mockDb.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM local_meta ORDER BY key`,
    )
    expect(rows).toEqual([
      { key: "downsync_cursor", value: "cursor-1" },
      { key: "session_owner_email", value: "a@example.fr" },
      { key: "session_owner_sub", value: "auth0|abc" },
    ])
  })

  test("both queue indexes exist", async () => {
    const indexes = await mockDb.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index'`,
    )
    const names = indexes.map((index) => index.name)
    expect(names).toContain("idx_sync_queue_status_next_retry")
    expect(names).toContain("idx_sync_queue_survey")
  })

  test("running initLocalDb again is idempotent and does not reset a retry_count set after migration", async () => {
    await mockDb.runAsync(
      `UPDATE sync_queue SET retry_count = 5 WHERE id = (SELECT MIN(id) FROM sync_queue)`,
    )

    await initLocalDb()

    const version = await mockDb.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`)
    expect(version?.user_version).toBe(1)

    const row = await mockDb.getFirstAsync<{ retry_count: number }>(
      `SELECT retry_count FROM sync_queue WHERE id = (SELECT MIN(id) FROM sync_queue)`,
    )
    expect(row?.retry_count).toBe(5)

    const rowCount = await mockDb.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue`,
    )
    expect(rowCount?.count).toBe(6)
  })
})
