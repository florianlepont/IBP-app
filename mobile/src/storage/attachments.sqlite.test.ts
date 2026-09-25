/**
 * persistLegacyAttachmentFiles against real SQL (node:sqlite behind the
 * expo-sqlite API), following the local-owner.sqlite.test.ts own-handle
 * recipe. File I/O still goes through the expo-file-system/legacy mock
 * (mobile/test/expo-file-system-legacy.mock.ts), wired globally.
 */

import { createNodeSqliteDb } from "../../test/node-sqlite-db"

const mockDb = createNodeSqliteDb()

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}))

import { __resetMockFileSystem, __setMockFile } from "../../test/expo-file-system-legacy.mock"
import { initLocalDb } from "./db"
import { persistLegacyAttachmentFiles } from "./attachments"

const CACHE_URI = "file:///mock/cache/imagepicker/legacy.jpg"
const CACHE_URI_2 = "file:///mock/cache/imagepicker/legacy2.jpg"
const ATTACHMENTS_DIR = "file:///mock/documents/attachments/"

async function insertSurvey(id: string): Promise<void> {
  const now = new Date().toISOString()
  await mockDb.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, sync_blocked, payload_json, created_at, updated_at)
     VALUES (?, 'Parcelle', 'draft', 'private', 1, 'pending', 0, NULL, ?, ?)`,
    [id, now, now],
  )
}

async function insertAttachment(row: {
  id: string
  survey_id: string
  local_uri: string
  mime_type?: string
  file_state: string
  remote_attachment_id?: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  await mockDb.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, updated_at, file_state, created_at)
     VALUES (?, ?, ?, ?, 100, 'pending', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
    [
      row.id,
      row.survey_id,
      row.local_uri,
      row.mime_type ?? "image/jpeg",
      row.remote_attachment_id ?? null,
      now,
      row.file_state,
      now,
    ],
  )
}

async function insertAttachmentUploadQueueRow(
  localAttachmentId: string,
  surveyId: string,
  localUri: string,
): Promise<void> {
  const now = new Date().toISOString()
  const payload = {
    kind: "attachment_upload",
    local_attachment_id: localAttachmentId,
    survey_id: surveyId,
    local_uri: localUri,
    mime_type: "image/jpeg",
    size_bytes: 100,
  }
  await mockDb.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at, op_type)
     VALUES (?, ?, 'pending', 0, NULL, ?, ?, 'attachment_upload')`,
    [surveyId, JSON.stringify(payload), now, now],
  )
}

beforeAll(async () => {
  await initLocalDb()
})

beforeEach(async () => {
  __resetMockFileSystem()
  await mockDb.execAsync(`
    DELETE FROM local_surveys;
    DELETE FROM sync_queue;
    DELETE FROM local_attachments;
    DELETE FROM local_meta;
  `)
})

describe("persistLegacyAttachmentFiles", () => {
  test("copies a pending attachment's cache file into the attachments dir and repoints the row and queue payload", async () => {
    await insertSurvey("survey-1")
    await insertAttachment({
      id: "att-1",
      survey_id: "survey-1",
      local_uri: CACHE_URI,
      file_state: "local",
    })
    await insertAttachmentUploadQueueRow("att-1", "survey-1", CACHE_URI)
    __setMockFile(CACHE_URI, 12345)

    const result = await persistLegacyAttachmentFiles()

    expect(result.moved).toBe(1)
    expect(result.markedRemote).toBe(0)

    const row = await mockDb.getFirstAsync<{ local_uri: string; file_state: string }>(
      `SELECT local_uri, file_state FROM local_attachments WHERE id = ?`,
      ["att-1"],
    )
    expect(row?.local_uri).toBe(`${ATTACHMENTS_DIR}att-1.jpg`)
    expect(row?.file_state).toBe("local")

    const queueRow = await mockDb.getFirstAsync<{ payload: string }>(
      `SELECT payload FROM sync_queue WHERE survey_id = ?`,
      ["survey-1"],
    )
    const payload = JSON.parse(queueRow?.payload ?? "{}")
    expect(payload.local_uri).toBe(`${ATTACHMENTS_DIR}att-1.jpg`)
  })

  test("a synced attachment whose cache file is gone becomes file_state 'remote'", async () => {
    await insertSurvey("survey-1")
    await insertAttachment({
      id: "att-remote",
      survey_id: "survey-1",
      local_uri: CACHE_URI_2,
      file_state: "local",
      remote_attachment_id: "remote-1",
    })
    // No __setMockFile: the cache file is gone.

    const result = await persistLegacyAttachmentFiles()

    expect(result.moved).toBe(0)
    expect(result.markedRemote).toBe(1)

    const row = await mockDb.getFirstAsync<{ file_state: string }>(
      `SELECT file_state FROM local_attachments WHERE id = ?`,
      ["att-remote"],
    )
    expect(row?.file_state).toBe("remote")
  })

  test("a pending attachment whose cache file is gone is left untouched", async () => {
    await insertSurvey("survey-1")
    await insertAttachment({
      id: "att-pending-gone",
      survey_id: "survey-1",
      local_uri: "file:///mock/cache/imagepicker/gone.jpg",
      file_state: "local",
      remote_attachment_id: null,
    })

    const result = await persistLegacyAttachmentFiles()

    expect(result.moved).toBe(0)
    expect(result.markedRemote).toBe(0)

    const row = await mockDb.getFirstAsync<{ local_uri: string; file_state: string }>(
      `SELECT local_uri, file_state FROM local_attachments WHERE id = ?`,
      ["att-pending-gone"],
    )
    expect(row?.local_uri).toBe("file:///mock/cache/imagepicker/gone.jpg")
    expect(row?.file_state).toBe("local")
  })

  test("rows already in the attachments dir are untouched", async () => {
    await insertSurvey("survey-1")
    const uri = `${ATTACHMENTS_DIR}att-already.jpg`
    await insertAttachment({
      id: "att-already",
      survey_id: "survey-1",
      local_uri: uri,
      file_state: "local",
    })
    __setMockFile(uri, 999)

    const result = await persistLegacyAttachmentFiles()

    expect(result.moved).toBe(0)
    expect(result.markedRemote).toBe(0)

    const row = await mockDb.getFirstAsync<{ local_uri: string }>(
      `SELECT local_uri FROM local_attachments WHERE id = ?`,
      ["att-already"],
    )
    expect(row?.local_uri).toBe(uri)
  })

  test("running it twice changes nothing more", async () => {
    await insertSurvey("survey-1")
    await insertAttachment({
      id: "att-1",
      survey_id: "survey-1",
      local_uri: CACHE_URI,
      file_state: "local",
    })
    await insertAttachmentUploadQueueRow("att-1", "survey-1", CACHE_URI)
    __setMockFile(CACHE_URI, 12345)

    const first = await persistLegacyAttachmentFiles()
    expect(first.moved).toBe(1)

    const second = await persistLegacyAttachmentFiles()
    expect(second.moved).toBe(0)
    expect(second.markedRemote).toBe(0)
  })
})
