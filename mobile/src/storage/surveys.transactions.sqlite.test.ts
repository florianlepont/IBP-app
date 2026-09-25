/**
 * Fault-injection tests for every multi-statement local writer in surveys.ts
 * (D-08, ROADMAP criterion 4), plus UUID id format, op_type tagging and
 * post-commit photo file cleanup (D-09).
 *
 * Strategy: real SQL against a node:sqlite in-memory database (the global
 * expo-sqlite mock), the same approach as src/storage.test.ts and
 * transaction.sqlite.test.ts. Fault injection uses a SQLite trigger that
 * RAISEs ABORT on the statement under test, proving the whole writer rolls
 * back atomically rather than asserting on which SQL string was sent.
 */

import { randomUUID as nodeRandomUUID } from "node:crypto"
import { randomUUID } from "expo-crypto"
import {
  __getMockFile,
  __resetMockFileSystem,
  __setMockFile,
} from "../../test/expo-file-system-legacy.mock"
import { initLocalDb, getDb } from "./db"
import { buildAttachmentFileUri } from "./attachment-files"
import {
  createLocalDraft,
  queueLocalAttachment,
  queueDeleteAttachment,
  queueDeleteSurvey,
  updateLocalDraft,
  clearLocalIbpData,
  retrySurveyNow,
  discardSurveyLocalChanges,
} from "./surveys"

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const DRAFT_INPUT = {
  site_name: "Test site",
  region_version: "ACA" as const,
  vegetation_stage: "adult",
  parcel_ids: ["AB001"],
  factors: { A: { native_genus_count: 5 } },
}

const activeTriggers = new Set<string>()

// Each call site below inlines its own `RAISE(ABORT, 'injected')` trigger body
// (rather than sharing one templated string) so the fault being injected is
// visible directly at the test that exercises it.
async function createTrigger(
  name: string,
  event: "INSERT" | "DELETE" | "UPDATE",
  table: string,
  when: string,
  raiseSql: string,
): Promise<void> {
  const db = await getDb()
  await db.execAsync(
    `CREATE TRIGGER ${name} BEFORE ${event} ON ${table} WHEN ${when} BEGIN ${raiseSql}; END;`,
  )
  activeTriggers.add(name)
}

async function dropAllTriggers(): Promise<void> {
  const db = await getDb()
  for (const name of activeTriggers) {
    await db.execAsync(`DROP TRIGGER IF EXISTS ${name};`)
  }
  activeTriggers.clear()
}

async function insertSurveyRow(overrides: Record<string, unknown> = {}): Promise<void> {
  const db = await getDb()
  const now = "2026-01-01T00:00:00.000Z"
  const row = {
    id: "seed-survey",
    site_name: "Seed site",
    status: "draft",
    visibility: "private",
    sync_version: 1,
    sync_state: "pending",
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
    payload_json: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
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

async function insertAttachmentRow(overrides: Record<string, unknown> = {}): Promise<void> {
  const db = await getDb()
  const now = "2026-01-01T00:00:00.000Z"
  const row = {
    id: "seed-attachment",
    survey_id: "seed-survey",
    local_uri: "file:///mock/documents/attachments/seed.jpg",
    mime_type: "image/jpeg",
    size_bytes: 1024,
    sync_state: "pending",
    remote_attachment_id: null,
    storage_key: null,
    upload_url: null,
    confirm_url: null,
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    created_at: now,
    updated_at: now,
    file_state: "local",
    ...overrides,
  }
  await db.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, created_at, updated_at, file_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.survey_id,
      row.local_uri,
      row.mime_type,
      row.size_bytes,
      row.sync_state,
      row.remote_attachment_id,
      row.storage_key,
      row.upload_url,
      row.confirm_url,
      row.last_sync_error,
      row.last_sync_error_code,
      row.last_sync_error_at,
      row.created_at,
      row.updated_at,
      row.file_state,
    ],
  )
}

async function insertQueueRow(overrides: {
  survey_id: string
  payload: unknown
  status?: string
  op_type?: string | null
}): Promise<void> {
  const db = await getDb()
  const now = "2026-01-01T00:00:00.000Z"
  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at, op_type)
     VALUES (?, ?, ?, 0, NULL, ?, ?, ?)`,
    [
      overrides.survey_id,
      JSON.stringify(overrides.payload),
      overrides.status ?? "pending",
      now,
      now,
      overrides.op_type ?? null,
    ],
  )
}

async function selectQueueRowsForSurvey(surveyId: string): Promise<Array<Record<string, unknown>>> {
  const db = await getDb()
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM sync_queue WHERE survey_id = ? ORDER BY id ASC`,
    [surveyId],
  )
}

async function selectSurveyById(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  return db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM local_surveys WHERE id = ?`, [id])
}

async function selectAttachmentById(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  return db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM local_attachments WHERE id = ?`, [
    id,
  ])
}

async function countRows(table: string): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)
  return Number(row?.count ?? 0)
}

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
  __resetMockFileSystem()
  ;(randomUUID as jest.Mock).mockReset().mockImplementation(() => nodeRandomUUID())
})

afterEach(async () => {
  await dropAllTriggers()
})

describe("atomicity: rollback on injected failure", () => {
  test("createLocalDraft rejects and leaves no local_surveys row when the sync_queue insert fails", async () => {
    ;(randomUUID as jest.Mock).mockImplementationOnce(() => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    await createTrigger(
      "trg_abort_create_draft",
      "INSERT",
      "sync_queue",
      `NEW.survey_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(createLocalDraft(DRAFT_INPUT)).rejects.toThrow()

    expect(await selectSurveyById("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBeNull()
    expect(await countRows("local_surveys")).toBe(0)
  })

  test("queueLocalAttachment rejects and leaves no local_attachments row when the sync_queue insert fails", async () => {
    await insertSurveyRow({ id: "survey-attach-target" })
    ;(randomUUID as jest.Mock).mockImplementationOnce(() => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    await createTrigger(
      "trg_abort_queue_attachment",
      "INSERT",
      "sync_queue",
      `NEW.survey_id = 'survey-attach-target'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(
      queueLocalAttachment({
        survey_id: "survey-attach-target",
        local_uri: "file:///photo.jpg",
        mime_type: "image/jpeg",
        size_bytes: 100,
      }),
    ).rejects.toThrow()

    expect(await countRows("local_attachments")).toBe(0)
  })

  test("updateLocalDraft rejects, keeps the old queued upsert and leaves local_surveys untouched", async () => {
    await insertSurveyRow({
      id: "survey-update-target",
      site_name: "Old name",
      payload_json: JSON.stringify({
        id: "survey-update-target",
        sync_version: 1,
        site_name: "Old name",
        status: "draft",
        visibility: "private",
        parcel_ids: [],
        factors: {},
      }),
      updated_at: "2026-01-01T00:00:00.000Z",
    })
    await insertQueueRow({
      survey_id: "survey-update-target",
      payload: {
        id: "survey-update-target",
        sync_version: 1,
        site_name: "Old name",
        status: "draft",
        visibility: "private",
        parcel_ids: [],
        factors: {},
      },
      op_type: "survey_upsert",
    })

    await createTrigger(
      "trg_abort_update_draft",
      "INSERT",
      "sync_queue",
      `NEW.survey_id = 'survey-update-target'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(
      updateLocalDraft({
        survey_id: "survey-update-target",
        site_name: "New name",
        region_version: "ACA",
        vegetation_stage: "adult",
        parcel_ids: [],
        factors: {},
      }),
    ).rejects.toThrow()

    const rows = await selectQueueRowsForSurvey("survey-update-target")
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0].payload as string).site_name).toBe("Old name")

    const surveyRow = await selectSurveyById("survey-update-target")
    expect(surveyRow?.site_name).toBe("Old name")
    expect(surveyRow?.updated_at).toBe("2026-01-01T00:00:00.000Z")
  })

  test("queueDeleteAttachment rejects and keeps the queue row and attachment row when the local_attachments delete fails", async () => {
    await insertSurveyRow({ id: "survey-del-attach" })
    await insertAttachmentRow({
      id: "attachment-to-delete",
      survey_id: "survey-del-attach",
      local_uri: buildAttachmentFileUri("keep.jpg"),
    })
    await insertQueueRow({
      survey_id: "survey-del-attach",
      payload: {
        kind: "attachment_upload",
        local_attachment_id: "attachment-to-delete",
        survey_id: "survey-del-attach",
        local_uri: buildAttachmentFileUri("keep.jpg"),
        mime_type: "image/jpeg",
        size_bytes: 100,
      },
      op_type: "attachment_upload",
    })
    __setMockFile(buildAttachmentFileUri("keep.jpg"), 100)

    await createTrigger(
      "trg_abort_delete_attachment",
      "DELETE",
      "local_attachments",
      `OLD.id = 'attachment-to-delete'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(
      queueDeleteAttachment("survey-del-attach", "attachment-to-delete"),
    ).rejects.toThrow()

    expect(await selectAttachmentById("attachment-to-delete")).not.toBeNull()
    const rows = await selectQueueRowsForSurvey("survey-del-attach")
    expect(rows).toHaveLength(1)
    expect(__getMockFile(buildAttachmentFileUri("keep.jpg"))).toBeDefined()
  })

  test("queueDeleteSurvey rejects and leaves queue rows and attachments of that survey unchanged", async () => {
    await insertSurveyRow({ id: "survey-to-delete" })
    await insertAttachmentRow({ id: "attachment-under-survey", survey_id: "survey-to-delete" })
    await insertQueueRow({
      survey_id: "survey-to-delete",
      payload: { id: "survey-to-delete", sync_version: 1, site_name: "x" },
      op_type: "survey_upsert",
    })

    await createTrigger(
      "trg_abort_delete_survey",
      "DELETE",
      "local_surveys",
      `OLD.id = 'survey-to-delete'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(queueDeleteSurvey("survey-to-delete")).rejects.toThrow()

    expect(await selectSurveyById("survey-to-delete")).not.toBeNull()
    expect(await selectAttachmentById("attachment-under-survey")).not.toBeNull()
    const rows = await selectQueueRowsForSurvey("survey-to-delete")
    expect(rows).toHaveLength(1)
  })

  test("discardSurveyLocalChanges rejects and nothing it touched changes when the attachment delete fails", async () => {
    await insertSurveyRow({ id: "survey-discard", status: "error", sync_state: "failed" })
    await insertAttachmentRow({
      id: "attachment-discard",
      survey_id: "survey-discard",
      sync_state: "pending",
    })
    await insertQueueRow({
      survey_id: "survey-discard",
      payload: { id: "survey-discard", sync_version: 1, site_name: "x" },
      op_type: "survey_upsert",
    })

    await createTrigger(
      "trg_abort_discard",
      "DELETE",
      "local_attachments",
      `OLD.survey_id = 'survey-discard'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(discardSurveyLocalChanges("survey-discard")).rejects.toThrow()

    const rows = await selectQueueRowsForSurvey("survey-discard")
    expect(rows).toHaveLength(1)
    const surveyRow = await selectSurveyById("survey-discard")
    expect(surveyRow?.sync_state).toBe("failed")
    expect(surveyRow?.status).toBe("error")
    expect(await selectAttachmentById("attachment-discard")).not.toBeNull()
  })

  test("retrySurveyNow rejects and nothing it touched changes when the attachment update fails", async () => {
    await insertSurveyRow({ id: "survey-retry", status: "error", sync_state: "failed" })
    await insertAttachmentRow({
      id: "attachment-retry",
      survey_id: "survey-retry",
      sync_state: "failed",
    })
    await insertQueueRow({
      survey_id: "survey-retry",
      payload: { id: "survey-retry", sync_version: 1, site_name: "x" },
      status: "failed",
      op_type: "survey_upsert",
    })

    await createTrigger(
      "trg_abort_retry",
      "UPDATE",
      "local_attachments",
      `OLD.survey_id = 'survey-retry'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(retrySurveyNow("survey-retry")).rejects.toThrow()

    const rows = await selectQueueRowsForSurvey("survey-retry")
    expect(rows[0].status).toBe("failed")
    const surveyRow = await selectSurveyById("survey-retry")
    expect(surveyRow?.status).toBe("error")
    expect(surveyRow?.sync_state).toBe("failed")
    const attachmentRow = await selectAttachmentById("attachment-retry")
    expect(attachmentRow?.sync_state).toBe("failed")
  })

  test("clearLocalIbpData rejects and all tables keep their rows when the local_surveys delete fails", async () => {
    await insertSurveyRow({ id: "survey-clear" })
    await insertAttachmentRow({ id: "attachment-clear", survey_id: "survey-clear" })
    await insertQueueRow({
      survey_id: "survey-clear",
      payload: { id: "survey-clear", sync_version: 1, site_name: "x" },
      op_type: "survey_upsert",
    })
    const db = await getDb()
    await db.runAsync(
      `INSERT INTO local_meta (key, value, updated_at) VALUES ('downsync_cursor', 'abc', ?)`,
      ["2026-01-01T00:00:00.000Z"],
    )

    await createTrigger(
      "trg_abort_clear",
      "DELETE",
      "local_surveys",
      `1 = 1`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(clearLocalIbpData()).rejects.toThrow()

    expect(await countRows("local_surveys")).toBe(1)
    expect(await countRows("local_attachments")).toBe(1)
    expect(await countRows("sync_queue")).toBe(1)
    expect(await countRows("local_meta")).toBe(1)
  })
})

describe("id format", () => {
  test("createLocalDraft().id is a v4 UUID", async () => {
    const result = await createLocalDraft(DRAFT_INPUT)
    expect(result.id).toMatch(UUID_V4_RE)
  })

  test("queueLocalAttachment().id is a v4 UUID", async () => {
    await insertSurveyRow({ id: "survey-uuid-attach" })
    const result = await queueLocalAttachment({
      survey_id: "survey-uuid-attach",
      local_uri: "file:///photo.jpg",
      mime_type: "image/jpeg",
      size_bytes: 100,
    })
    expect(result.id).toMatch(UUID_V4_RE)
  })
})

describe("op_type tagging on insert", () => {
  test("createLocalDraft tags its queue row survey_upsert", async () => {
    const result = await createLocalDraft(DRAFT_INPUT)
    const rows = await selectQueueRowsForSurvey(result.id)
    expect(rows[0].op_type).toBe("survey_upsert")
  })

  test("updateLocalDraft tags its new queue row survey_upsert", async () => {
    const result = await createLocalDraft(DRAFT_INPUT)
    await updateLocalDraft({
      survey_id: result.id,
      site_name: "Updated",
      region_version: "ACA",
      vegetation_stage: "adult",
      parcel_ids: [],
      factors: {},
    })
    const rows = await selectQueueRowsForSurvey(result.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].op_type).toBe("survey_upsert")
  })

  test("queueLocalAttachment tags its queue row attachment_upload", async () => {
    await insertSurveyRow({ id: "survey-op-attach" })
    await queueLocalAttachment({
      survey_id: "survey-op-attach",
      local_uri: "file:///photo.jpg",
      mime_type: "image/jpeg",
      size_bytes: 100,
    })
    const rows = await selectQueueRowsForSurvey("survey-op-attach")
    expect(rows[0].op_type).toBe("attachment_upload")
  })

  test("queueDeleteAttachment (remote attachment) tags its queue row attachment_delete", async () => {
    await insertSurveyRow({ id: "survey-op-attach-delete" })
    await insertAttachmentRow({
      id: "attachment-remote",
      survey_id: "survey-op-attach-delete",
      remote_attachment_id: "remote-1",
    })
    await queueDeleteAttachment("survey-op-attach-delete", "attachment-remote")
    const rows = await selectQueueRowsForSurvey("survey-op-attach-delete")
    expect(rows).toHaveLength(1)
    expect(rows[0].op_type).toBe("attachment_delete")
  })

  test("queueDeleteSurvey tags its queue row survey_delete", async () => {
    await insertSurveyRow({ id: "survey-op-delete" })
    await queueDeleteSurvey("survey-op-delete")
    const rows = await selectQueueRowsForSurvey("survey-op-delete")
    expect(rows).toHaveLength(1)
    expect(rows[0].op_type).toBe("survey_delete")
  })
})

describe("legacy ids keep working", () => {
  test("a survey with a legacy timestamp id can still be updated and deleted", async () => {
    const legacyId = "survey-1700000000000"
    await insertSurveyRow({ id: legacyId })

    const updated = await updateLocalDraft({
      survey_id: legacyId,
      site_name: "Legacy updated",
      region_version: "ACA",
      vegetation_stage: "adult",
      parcel_ids: [],
      factors: {},
    })
    expect(updated.id).toBe(legacyId)

    const deleted = await queueDeleteSurvey(legacyId)
    expect(deleted.queued_delete).toBe(true)
    expect(await selectSurveyById(legacyId)).toBeNull()
  })
})

describe("reentrancy: no writer waits on its own mutex", () => {
  test("every writer resolves sequentially without advancing fake timers", async () => {
    jest.useFakeTimers()
    try {
      const draft = await createLocalDraft(DRAFT_INPUT)
      await updateLocalDraft({
        survey_id: draft.id,
        site_name: "Renamed",
        region_version: "ACA",
        vegetation_stage: "adult",
        parcel_ids: [],
        factors: {},
      })
      const attachment = await queueLocalAttachment({
        survey_id: draft.id,
        local_uri: "file:///photo.jpg",
        mime_type: "image/jpeg",
        size_bytes: 100,
      })
      await queueDeleteAttachment(draft.id, attachment.id)
      await retrySurveyNow(draft.id)
      await discardSurveyLocalChanges(draft.id)
      await queueDeleteSurvey(draft.id)
      await clearLocalIbpData()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe("file cleanup follows the row only after commit (D-09)", () => {
  test("queueDeleteAttachment removes the photo file after a successful delete", async () => {
    await insertSurveyRow({ id: "survey-file-cleanup" })
    const fileUri = buildAttachmentFileUri("cleanup.jpg")
    await insertAttachmentRow({
      id: "attachment-file-cleanup",
      survey_id: "survey-file-cleanup",
      local_uri: fileUri,
    })
    __setMockFile(fileUri, 100)

    const result = await queueDeleteAttachment("survey-file-cleanup", "attachment-file-cleanup")

    expect(result.removed_local).toBe(true)
    expect(__getMockFile(fileUri)).toBeUndefined()
  })

  test("clearLocalIbpData empties the attachments directory after commit", async () => {
    await insertSurveyRow({ id: "survey-clear-files" })
    const fileUri = buildAttachmentFileUri("clear-me.jpg")
    await insertAttachmentRow({
      id: "attachment-clear-files",
      survey_id: "survey-clear-files",
      local_uri: fileUri,
    })
    __setMockFile(fileUri, 100)

    await clearLocalIbpData()

    expect(__getMockFile(fileUri)).toBeUndefined()
  })
})
