/**
 * Tests for storage.ts — SQLite local persistence layer.
 *
 * Strategy: real SQL against a node:sqlite in-memory database, delivered via
 * the global expo-sqlite mock (mobile/test/expo-sqlite.mock.ts). Every test
 * seeds real rows (through the public functions or a direct INSERT matching
 * the schema) and asserts on the resulting table state, instead of asserting
 * on which SQL string was sent to a jest.fn() stub. A broken INSERT in
 * mobile/src/storage/surveys.ts must make this file fail.
 */

import {
  initLocalDb,
  createLocalDraft,
  updateLocalDraft,
  getLocalSurveyDraft,
  listLocalSurveys,
  listLocalAttachments,
  hasPendingSyncWork,
  queueDeleteSurvey,
  queueLocalAttachment,
  queueDeleteAttachment,
  retrySurveyNow,
  discardSurveyLocalChanges,
  markSurveyExpiredLocally,
  clearLocalIbpData,
  syncPending,
  pullRemoteChanges,
  getDb,
} from "./storage"

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_SURVEY_ID = "survey-test-1"
const TEST_NOW = "2026-01-01T00:00:00.000Z"

function makeSurveyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SURVEY_ID,
    site_name: "Test site",
    status: "draft",
    visibility: "private",
    sync_version: 1,
    sync_state: "pending",
    last_sync_error: null as string | null,
    last_sync_error_code: null as string | null,
    last_sync_error_at: null as string | null,
    sync_blocked: 0,
    created_at: TEST_NOW,
    updated_at: TEST_NOW,
    payload_json: null as string | null,
    ...overrides,
  }
}

async function insertSurveyRow(row: ReturnType<typeof makeSurveyRow>): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.site_name,
      row.status,
      row.visibility,
      row.sync_version,
      row.sync_state,
      row.last_sync_error,
      row.last_sync_error_code,
      row.last_sync_error_at,
      row.sync_blocked,
      row.payload_json,
      row.created_at,
      row.updated_at,
    ],
  )
}

async function insertQueueRow(overrides: {
  survey_id: string
  payload: unknown
  status?: string
  retry_count?: number
  next_retry_at?: string | null
}): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      overrides.survey_id,
      JSON.stringify(overrides.payload),
      overrides.status ?? "pending",
      overrides.retry_count ?? 0,
      overrides.next_retry_at ?? null,
      now,
      now,
    ],
  )
}

async function selectSurveyById(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  return db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM local_surveys WHERE id = ?`, [id])
}

async function selectQueueRowsForSurvey(surveyId: string): Promise<Array<Record<string, unknown>>> {
  const db = await getDb()
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM sync_queue WHERE survey_id = ? ORDER BY id ASC`,
    [surveyId],
  )
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await initLocalDb()
})

beforeEach(async () => {
  const db = await getDb()
  await db.execAsync(`
    DELETE FROM local_surveys;
    DELETE FROM sync_queue;
    DELETE FROM local_attachments;
    DELETE FROM local_meta;
  `)
})

// ═══════════════════════════════════════════════════════════════════════════
// expo-sqlite test double
// ═══════════════════════════════════════════════════════════════════════════

describe("expo-sqlite test double", () => {
  test("runs real SQL — a statement against a nonexistent table rejects", async () => {
    const db = await getDb()
    await expect(db.runAsync("INSERT INTO no_such_table VALUES (1)")).rejects.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// initLocalDb
// ═══════════════════════════════════════════════════════════════════════════

describe("initLocalDb", () => {
  test("creates all four tables", async () => {
    const db = await getDb()
    const rows = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table'`,
    )
    const names = rows.map((r) => r.name)
    expect(names).toEqual(
      expect.arrayContaining(["local_surveys", "sync_queue", "local_attachments", "local_meta"]),
    )
  })

  test("calling initLocalDb a second time resolves (duplicate-column errors swallowed)", async () => {
    await expect(initLocalDb()).resolves.toBeUndefined()
  })

  test("local_surveys has the columns added by schema upgrades", async () => {
    const db = await getDb()
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(local_surveys)`)
    const names = columns.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining(["visibility", "sync_blocked", "payload_json", "created_at"]),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// createLocalDraft
// ═══════════════════════════════════════════════════════════════════════════

describe("createLocalDraft", () => {
  const input = {
    site_name: "My forest",
    region_version: "ACA" as const,
    vegetation_stage: "adult",
    parcel_ids: ["AB001", "AB002"],
    factors: { A: { native_genus_count: 5 } },
  }

  test("returns a LocalSurvey with correct shape", async () => {
    const result = await createLocalDraft(input)

    expect(result.id).toMatch(/^survey-/)
    expect(result.site_name).toBe("My forest")
    expect(result.status).toBe("draft")
    expect(result.visibility).toBe("private")
    expect(result.sync_state).toBe("pending")
    expect(result.sync_version).toBe(1)
    expect(result.last_sync_error).toBeNull()
  })

  test("inserts into local_surveys", async () => {
    const result = await createLocalDraft(input)
    const row = await selectSurveyById(result.id)
    expect(row).not.toBeNull()
    expect(row?.site_name).toBe("My forest")
    expect(row?.status).toBe("draft")
  })

  test("inserts into sync_queue", async () => {
    const result = await createLocalDraft(input)
    const rows = await selectQueueRowsForSurvey(result.id)
    expect(rows).toHaveLength(1)
    const payload = JSON.parse(rows[0].payload as string)
    expect(payload.site_name).toBe("My forest")
    expect(payload.status).toBe("draft")
  })

  test("normalizes parcel_ids (uppercase, deduplication)", async () => {
    const result = await createLocalDraft({
      ...input,
      parcel_ids: ["ab001", "AB001", "ab002"],
    })
    const rows = await selectQueueRowsForSurvey(result.id)
    const payload = JSON.parse(rows[0].payload as string)
    expect(payload.parcel_ids).toHaveLength(2)
    expect(payload.parcel_ids).toContain("AB001")
    expect(payload.parcel_ids).toContain("AB002")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// updateLocalDraft
// ═══════════════════════════════════════════════════════════════════════════

describe("updateLocalDraft", () => {
  const seedExistingRow = () =>
    insertSurveyRow(
      makeSurveyRow({
        payload_json: JSON.stringify({
          id: TEST_SURVEY_ID,
          sync_version: 2,
          site_name: "Old name",
          status: "draft",
          visibility: "private",
          parcel_ids: [],
          factors: {},
        }),
        sync_version: 2,
      }),
    )

  const updateInput = {
    survey_id: TEST_SURVEY_ID,
    site_name: "New name",
    region_version: "ACA" as const,
    vegetation_stage: "adult",
    parcel_ids: ["XY123"],
    factors: { A: { native_genus_count: 3 } },
    visibility: "private" as const,
  }

  test("throws if survey not found", async () => {
    await expect(updateLocalDraft(updateInput)).rejects.toThrow(
      `Unknown local survey: ${TEST_SURVEY_ID}`,
    )
  })

  test("increments sync_version", async () => {
    await seedExistingRow()
    const result = await updateLocalDraft(updateInput)
    expect(result.sync_version).toBe(3)
    const row = await selectSurveyById(TEST_SURVEY_ID)
    expect(row?.sync_version).toBe(3)
  })

  test("returns updated LocalSurvey with new site_name", async () => {
    await seedExistingRow()
    const result = await updateLocalDraft(updateInput)
    expect(result.site_name).toBe("New name")
    expect(result.sync_state).toBe("pending")
  })

  test("inserts a new sync_queue row", async () => {
    await seedExistingRow()
    await updateLocalDraft(updateInput)
    const rows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    expect(rows.length).toBeGreaterThan(0)
    const payload = JSON.parse(rows[rows.length - 1].payload as string)
    expect(payload.site_name).toBe("New name")
  })

  test("updates local_surveys row", async () => {
    await seedExistingRow()
    await updateLocalDraft(updateInput)
    const row = await selectSurveyById(TEST_SURVEY_ID)
    expect(row?.site_name).toBe("New name")
    expect(row?.sync_state).toBe("pending")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getLocalSurveyDraft
// ═══════════════════════════════════════════════════════════════════════════

describe("getLocalSurveyDraft", () => {
  test("returns null if not found", async () => {
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result).toBeNull()
  })

  test("returns parsed payload_json when valid", async () => {
    const payload = {
      id: TEST_SURVEY_ID,
      sync_version: 1,
      site_name: "Test",
      status: "draft",
      visibility: "private",
      parcel_ids: [],
      factors: {},
    }
    await insertSurveyRow(
      makeSurveyRow({ site_name: "Test", payload_json: JSON.stringify(payload) }),
    )
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result?.site_name).toBe("Test")
    expect(result?.id).toBe(TEST_SURVEY_ID)
  })

  test("returns fallback payload if payload_json is null", async () => {
    await insertSurveyRow(
      makeSurveyRow({
        site_name: "Fallback site",
        visibility: "public",
        sync_version: 3,
        payload_json: null,
      }),
    )
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result?.id).toBe(TEST_SURVEY_ID)
    expect(result?.site_name).toBe("Fallback site")
    expect(result?.status).toBe("draft")
    expect(result?.visibility).toBe("public")
  })

  test("returns fallback payload if payload_json is invalid JSON", async () => {
    await insertSurveyRow(makeSurveyRow({ site_name: "Site", payload_json: "not-valid-json" }))
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result?.id).toBe(TEST_SURVEY_ID)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// listLocalSurveys
// ═══════════════════════════════════════════════════════════════════════════

describe("listLocalSurveys", () => {
  test("returns empty array when db is empty", async () => {
    const result = await listLocalSurveys()
    expect(result).toEqual([])
  })

  test("maps rows to LocalSurvey and computes completion_rate", async () => {
    await insertSurveyRow(makeSurveyRow({ status: "submitted", payload_json: null }))
    const result = await listLocalSurveys()
    expect(result).toHaveLength(1)
    expect(result[0].completion_rate).toBe(100) // submitted → 100%
    expect(result[0]).not.toHaveProperty("payload_json")
  })

  test("strips payload_json from returned objects", async () => {
    await insertSurveyRow(makeSurveyRow())
    const result = await listLocalSurveys()
    expect(result[0]).not.toHaveProperty("payload_json")
  })

  test("returns multiple surveys", async () => {
    await insertSurveyRow(makeSurveyRow({ id: "survey-1" }))
    await insertSurveyRow(makeSurveyRow({ id: "survey-2" }))
    const result = await listLocalSurveys()
    expect(result).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// listLocalAttachments
// ═══════════════════════════════════════════════════════════════════════════

describe("listLocalAttachments", () => {
  const attachmentInput = {
    survey_id: TEST_SURVEY_ID,
    local_uri: "file:///photo.jpg",
    mime_type: "image/jpeg",
    size_bytes: 1024,
  }

  test("returns all attachments when no filter", async () => {
    await insertSurveyRow(makeSurveyRow())
    await queueLocalAttachment(attachmentInput)
    const result = await listLocalAttachments()
    expect(result).toHaveLength(1)
    expect(result[0].survey_id).toBe(TEST_SURVEY_ID)
  })

  test("uses WHERE clause when surveyId provided", async () => {
    await insertSurveyRow(makeSurveyRow())
    await insertSurveyRow(makeSurveyRow({ id: "survey-other" }))
    await queueLocalAttachment(attachmentInput)
    await queueLocalAttachment({ ...attachmentInput, survey_id: "survey-other" })

    const result = await listLocalAttachments(TEST_SURVEY_ID)
    expect(result).toHaveLength(1)
    expect(result[0].survey_id).toBe(TEST_SURVEY_ID)
  })

  test("returns empty array when no attachments", async () => {
    const result = await listLocalAttachments()
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// hasPendingSyncWork
// ═══════════════════════════════════════════════════════════════════════════

describe("hasPendingSyncWork", () => {
  test("returns true when pending queue items exist", async () => {
    await insertQueueRow({ survey_id: TEST_SURVEY_ID, payload: { kind: "x" }, status: "pending" })
    const result = await hasPendingSyncWork()
    expect(result).toBe(true)
  })

  test("returns false when queue is empty", async () => {
    const result = await hasPendingSyncWork()
    expect(result).toBe(false)
  })

  test("returns false when failed items have a next_retry_at in the future", async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    await insertQueueRow({
      survey_id: TEST_SURVEY_ID,
      payload: { kind: "x" },
      status: "failed",
      next_retry_at: future,
    })
    const result = await hasPendingSyncWork()
    expect(result).toBe(false)
  })

  test("returns true when a failed item's next_retry_at is due", async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    await insertQueueRow({
      survey_id: TEST_SURVEY_ID,
      payload: { kind: "x" },
      status: "failed",
      next_retry_at: past,
    })
    const result = await hasPendingSyncWork()
    expect(result).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// queueDeleteSurvey
// ═══════════════════════════════════════════════════════════════════════════

describe("queueDeleteSurvey", () => {
  test("returns { queued_delete: false } if survey not found", async () => {
    const result = await queueDeleteSurvey(TEST_SURVEY_ID)
    expect(result).toEqual({ queued_delete: false })
  })

  test("deletes survey locally and queues a delete operation", async () => {
    await insertSurveyRow(makeSurveyRow())
    const result = await queueDeleteSurvey(TEST_SURVEY_ID)
    expect(result).toEqual({ queued_delete: true })

    const row = await selectSurveyById(TEST_SURVEY_ID)
    expect(row).toBeNull()

    const rows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    const deleteRow = rows.find((r) => JSON.parse(r.payload as string).kind === "survey_delete")
    expect(deleteRow).toBeDefined()
    const payload = JSON.parse(deleteRow?.payload as string)
    expect(payload.survey_id).toBe(TEST_SURVEY_ID)
  })

  test("also deletes local attachments", async () => {
    await insertSurveyRow(makeSurveyRow({ sync_state: "synced" }))
    await queueLocalAttachment({
      survey_id: TEST_SURVEY_ID,
      local_uri: "file:///photo.jpg",
      mime_type: "image/jpeg",
      size_bytes: 1024,
    })
    await queueDeleteSurvey(TEST_SURVEY_ID)
    const attachments = await listLocalAttachments(TEST_SURVEY_ID)
    expect(attachments).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// queueLocalAttachment
// ═══════════════════════════════════════════════════════════════════════════

describe("queueLocalAttachment", () => {
  const attachmentInput = {
    survey_id: TEST_SURVEY_ID,
    local_uri: "file:///photo.jpg",
    mime_type: "image/jpeg",
    size_bytes: 2048,
  }

  test("throws if survey does not exist locally", async () => {
    await expect(queueLocalAttachment(attachmentInput)).rejects.toThrow(
      `Unknown local survey: ${TEST_SURVEY_ID}`,
    )
  })

  test("returns a LocalAttachment object with pending sync_state", async () => {
    await insertSurveyRow(makeSurveyRow())
    const result = await queueLocalAttachment(attachmentInput)
    expect(result.id).toMatch(/^attachment-/)
    expect(result.survey_id).toBe(TEST_SURVEY_ID)
    expect(result.mime_type).toBe("image/jpeg")
    expect(result.size_bytes).toBe(2048)
    expect(result.sync_state).toBe("pending")
    expect(result.remote_attachment_id).toBeNull()
  })

  test("inserts into local_attachments and sync_queue", async () => {
    await insertSurveyRow(makeSurveyRow())
    await queueLocalAttachment(attachmentInput)

    const attachments = await listLocalAttachments(TEST_SURVEY_ID)
    expect(attachments).toHaveLength(1)

    const rows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    const attachmentQueueRow = rows.find(
      (r) => JSON.parse(r.payload as string).kind === "attachment_upload",
    )
    expect(attachmentQueueRow).toBeDefined()
    const payload = JSON.parse(attachmentQueueRow?.payload as string)
    expect(payload.mime_type).toBe("image/jpeg")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// queueDeleteAttachment
// ═══════════════════════════════════════════════════════════════════════════

describe("queueDeleteAttachment", () => {
  test("removes_local: false and queued_delete: false when not found", async () => {
    await insertSurveyRow(makeSurveyRow())
    const result = await queueDeleteAttachment(TEST_SURVEY_ID, "att-missing")
    expect(result.removed_local).toBe(false)
    expect(result.queued_delete).toBe(false)
    expect(result.remote_attachment_id).toBeNull()
  })

  test("removes local attachment and queues remote delete when remote_id exists", async () => {
    await insertSurveyRow(makeSurveyRow())
    const db = await getDb()
    const now = new Date().toISOString()
    await db.runAsync(
      `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, created_at, updated_at)
       VALUES ('att-1', ?, 'file:///photo.jpg', 'image/jpeg', 1024, 'synced', 'remote-123', NULL, NULL, NULL, ?, ?)`,
      [TEST_SURVEY_ID, now, now],
    )

    const result = await queueDeleteAttachment(TEST_SURVEY_ID, "att-1")
    expect(result.removed_local).toBe(true)
    expect(result.queued_delete).toBe(true)
    expect(result.remote_attachment_id).toBe("remote-123")

    const rows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    const deleteRow = rows.find((r) => JSON.parse(r.payload as string).kind === "attachment_delete")
    expect(deleteRow).toBeDefined()
  })

  test("removed_local: true but queued_delete: false when no remote_id", async () => {
    await insertSurveyRow(makeSurveyRow())
    const db = await getDb()
    const now = new Date().toISOString()
    await db.runAsync(
      `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, created_at, updated_at)
       VALUES ('att-1', ?, 'file:///photo.jpg', 'image/jpeg', 1024, 'pending', NULL, NULL, NULL, NULL, ?, ?)`,
      [TEST_SURVEY_ID, now, now],
    )

    const result = await queueDeleteAttachment(TEST_SURVEY_ID, "att-1")
    expect(result.removed_local).toBe(true)
    expect(result.queued_delete).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// retrySurveyNow
// ═══════════════════════════════════════════════════════════════════════════

describe("retrySurveyNow", () => {
  test("returns { queued: 0 } when no failed items found", async () => {
    const result = await retrySurveyNow(TEST_SURVEY_ID)
    expect(result.queued).toBe(0)
  })

  test("resets status and next_retry_at for failed queue items", async () => {
    await insertSurveyRow(makeSurveyRow({ status: "error", sync_state: "failed" }))
    await insertQueueRow({
      survey_id: TEST_SURVEY_ID,
      payload: { id: TEST_SURVEY_ID, sync_version: 1, site_name: "x" },
      status: "failed",
      next_retry_at: new Date().toISOString(),
    })

    const result = await retrySurveyNow(TEST_SURVEY_ID)
    expect(result.queued).toBe(1)

    const rows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    expect(rows[0].status).toBe("pending")
    expect(rows[0].next_retry_at).toBeNull()

    const surveyRow = await selectSurveyById(TEST_SURVEY_ID)
    expect(surveyRow?.sync_state).toBe("pending")
    expect(surveyRow?.status).toBe("draft")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// discardSurveyLocalChanges
// ═══════════════════════════════════════════════════════════════════════════

describe("discardSurveyLocalChanges", () => {
  test("deletes pending queue rows for survey", async () => {
    await insertSurveyRow(makeSurveyRow())
    await insertQueueRow({ survey_id: TEST_SURVEY_ID, payload: { id: TEST_SURVEY_ID } })

    const result = await discardSurveyLocalChanges(TEST_SURVEY_ID)
    expect(result.removed_queue).toBe(1)

    const rows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    expect(rows).toHaveLength(0)
  })

  test("marks survey as synced", async () => {
    await insertSurveyRow(makeSurveyRow({ status: "error" }))
    await discardSurveyLocalChanges(TEST_SURVEY_ID)
    const row = await selectSurveyById(TEST_SURVEY_ID)
    expect(row?.sync_state).toBe("synced")
    expect(row?.status).toBe("synced")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// markSurveyExpiredLocally
// ═══════════════════════════════════════════════════════════════════════════

describe("markSurveyExpiredLocally", () => {
  test("runs an UPDATE setting status to expired", async () => {
    await insertSurveyRow(makeSurveyRow())
    await markSurveyExpiredLocally(TEST_SURVEY_ID)
    const row = await selectSurveyById(TEST_SURVEY_ID)
    expect(row?.status).toBe("expired")
    expect(row?.sync_state).toBe("synced")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// clearLocalIbpData
// ═══════════════════════════════════════════════════════════════════════════

describe("clearLocalIbpData", () => {
  test("deletes all data from the four main tables", async () => {
    await insertSurveyRow(makeSurveyRow())
    await insertQueueRow({ survey_id: TEST_SURVEY_ID, payload: { id: TEST_SURVEY_ID } })
    const db = await getDb()
    const now = new Date().toISOString()
    await db.runAsync(
      `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, created_at, updated_at)
       VALUES ('att-1', ?, 'file:///photo.jpg', 'image/jpeg', 1024, 'pending', ?, ?)`,
      [TEST_SURVEY_ID, now, now],
    )
    await db.runAsync(`INSERT INTO local_meta (key, value, updated_at) VALUES (?, ?, ?)`, [
      "downsync_cursor",
      "cursor-1",
      now,
    ])

    await clearLocalIbpData()

    expect(await listLocalSurveys()).toEqual([])
    const queueRows = await selectQueueRowsForSurvey(TEST_SURVEY_ID)
    expect(queueRows).toHaveLength(0)
    expect(await listLocalAttachments()).toEqual([])
    const metaRow = await db.getFirstAsync(`SELECT value FROM local_meta WHERE key = ?`, [
      "downsync_cursor",
    ])
    expect(metaRow).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// syncPending — smoke tests (HTTP + DB interplay)
// ═══════════════════════════════════════════════════════════════════════════

describe("syncPending", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test("returns zero counts when queue is empty", async () => {
    // syncPending always calls pullRemoteChanges at the end (even with empty queue)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: null,
        has_more: false,
        surveys: [],
        attachments: [],
      }),
    })
    const result = await syncPending("http://api", "token")
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.pulled_surveys).toBe(0)
  })

  test("calls fetch with correct Authorization header when queue has items", async () => {
    await insertSurveyRow(makeSurveyRow())
    await createLocalDraft({
      site_name: "Test",
      region_version: "ACA",
      vegetation_stage: "adult",
      parcel_ids: [],
      factors: {},
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [] }),
    })

    await syncPending("http://api", "my-token")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/sync"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      }),
    )
  })

  test("increments failed count on HTTP error", async () => {
    await createLocalDraft({
      site_name: "Test",
      region_version: "ACA",
      vegetation_stage: "adult",
      parcel_ids: [],
      factors: {},
    })
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"))

    const result = await syncPending("http://api", "token")
    expect(result.failed).toBe(1)
    expect(result.synced).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// pullRemoteChanges — smoke tests
// ═══════════════════════════════════════════════════════════════════════════

describe("pullRemoteChanges", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test("returns zero counts when server returns empty response", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: null,
        has_more: false,
        surveys: [],
        attachments: [],
      }),
    })

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(0)
    expect(result.attachments).toBe(0)
    expect(result.has_more).toBe(false)
  })

  test("calls fetch with correct URL and Bearer token", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: null,
        has_more: false,
        surveys: [],
        attachments: [],
      }),
    })

    await pullRemoteChanges("http://api", "my-token")
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/sync/changes"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      }),
    )
  })

  test("counts pulled surveys correctly and writes both rows to local_surveys", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: "cursor-1",
        has_more: false,
        surveys: [
          { id: "s1", site_name: "Site 1", status: "draft", sync_version: 1 },
          { id: "s2", site_name: "Site 2", status: "draft", sync_version: 1 },
        ],
        attachments: [],
      }),
    })

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(2)
    expect(result.attachments).toBe(0)

    expect(await selectSurveyById("s1")).not.toBeNull()
    expect(await selectSurveyById("s2")).not.toBeNull()
  })
})
