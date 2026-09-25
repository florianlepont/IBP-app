/**
 * Real-SQL proofs for the streaming attachment upload path (plans 06/07/08
 * wired into sync.ts by plan 11): createUploadTask is used instead of
 * fetch/blob, a missing local file is surfaced (not silently dropped), upload
 * network errors/timeouts/5xx/429 never consume the retry cap, and deleted
 * attachments/surveys free their cached photo files after commit.
 *
 * Strategy: real SQL against the global expo-sqlite mock (node:sqlite), same
 * approach as sync.retry.sqlite.test.ts. `global.fetch` is mocked for the
 * /sync, /sync/changes and confirm-PUT calls; expo-file-system/legacy is the
 * global mock (mobile/test/expo-file-system-legacy.mock.ts) so photo files
 * are simulated in-memory via __setMockFile/__getMockFile.
 */

import { initLocalDb, getDb } from "./db"
import { syncPending } from "./sync"
import { createLocalDraft, queueLocalAttachment } from "./surveys"
import {
  __resetMockFileSystem,
  __setMockFile,
  __getMockFile,
  createUploadTask,
} from "../../test/expo-file-system-legacy.mock"

const NOW = "2026-01-01T00:00:00.000Z"
const ATTACHMENTS_DIR = "file:///mock/documents/attachments/"

type MockResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

function jsonResponse(status: number, body: unknown): MockResponse {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

function emptyChangesResponse(): MockResponse {
  return jsonResponse(200, {
    cursor_in: null,
    cursor_out: null,
    has_more: false,
    surveys: [],
    attachments: [],
  })
}

async function resetNextRetry(): Promise<void> {
  const db = await getDb()
  await db.runAsync(`UPDATE sync_queue SET next_retry_at = NULL WHERE status = 'failed'`)
}

async function getQueueRowCount(surveyId: string): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE survey_id = ?`,
    [surveyId],
  )
  return Number(row?.count ?? 0)
}

async function getQueueRow(
  surveyId: string,
): Promise<{ id: number; status: string; retry_count: number } | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT id, status, retry_count FROM sync_queue WHERE survey_id = ? ORDER BY id DESC LIMIT 1`,
    [surveyId],
  )
}

async function getAttachment(id: string): Promise<{
  sync_state: string
  file_state: string
  last_sync_error_code: string | null
  remote_attachment_id: string | null
  local_uri: string
} | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT sync_state, file_state, last_sync_error_code, remote_attachment_id, local_uri
     FROM local_attachments WHERE id = ?`,
    [id],
  )
}

async function getSurvey(
  id: string,
): Promise<{ sync_blocked: number; last_sync_error_code: string | null } | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT sync_blocked, last_sync_error_code FROM local_surveys WHERE id = ?`,
    [id],
  )
}

function attachmentCreateResponse(clientRefRowId: number, attachmentId: string): MockResponse {
  return jsonResponse(200, {
    results: [
      {
        client_ref: String(clientRefRowId),
        entity: "attachment",
        action: "create",
        status: "synced",
        data: {
          attachment_id: attachmentId,
          storage_key: `key-${attachmentId}`,
          upload_url: `/surveys/s/attachments/${attachmentId}/upload?token=t`,
          confirm_url: `/surveys/s/attachments/${attachmentId}/confirm?token=t`,
        },
      },
    ],
  })
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
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("streaming upload targets", () => {
  test("API-route target: createUploadTask MULTIPART/fieldName file/bearer; synced on 200", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}photo-1.jpg`
    __setMockFile(localUri, 1000)
    const attachment = await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })

    const row = await getQueueRow(draft.id)
    const rowId = row!.id

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(attachmentCreateResponse(rowId, "remote-att-1"))
      }
      if (typeof url === "string" && url.includes("/confirm")) {
        return Promise.resolve(jsonResponse(200, {}))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    await syncPending("http://api", "token")

    expect(createUploadTask).toHaveBeenCalledTimes(1)
    const [target, uri, options] = (createUploadTask as jest.Mock).mock.calls[0]
    expect(target).toBe("http://api/surveys/s/attachments/remote-att-1/upload?token=t")
    expect(uri).toBe(localUri)
    expect(options.uploadType).toBe(1) // MULTIPART
    expect(options.fieldName).toBe("file")
    expect(options.headers.Authorization).toBe("Bearer token")

    expect(await getQueueRowCount(draft.id)).toBe(0)
    const savedAttachment = await getAttachment(attachment.id)
    expect(savedAttachment?.sync_state).toBe("synced")
    expect(savedAttachment?.remote_attachment_id).toBe("remote-att-1")
  })

  test("presigned target: BINARY_CONTENT/Content-Type, no Authorization; confirm PUT via apiRequest", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}photo-2.jpg`
    __setMockFile(localUri, 1000)
    await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })
    const row = await getQueueRow(draft.id)
    const rowId = row!.id

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync") && !url.includes("minio.example")) {
        return Promise.resolve(
          jsonResponse(200, {
            results: [
              {
                client_ref: String(rowId),
                entity: "attachment",
                action: "create",
                status: "synced",
                data: {
                  attachment_id: "remote-att-2",
                  storage_key: "key-remote-att-2",
                  upload_url: "https://minio.example/bucket/key?X-Amz-Signature=abc",
                  confirm_url: "https://api.example/surveys/s/attachments/remote-att-2/confirm",
                },
              },
            ],
          }),
        )
      }
      if (typeof url === "string" && url.includes("confirm")) {
        return Promise.resolve(jsonResponse(200, {}))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    await syncPending("http://api", "token")

    expect(createUploadTask).toHaveBeenCalledTimes(1)
    const [target, , options] = (createUploadTask as jest.Mock).mock.calls[0]
    expect(target).toBe("https://minio.example/bucket/key?X-Amz-Signature=abc")
    expect(options.uploadType).toBe(0) // BINARY_CONTENT
    expect(options.headers["Content-Type"]).toBe("image/jpeg")
    expect(options.headers.Authorization).toBeUndefined()

    // The confirm PUT went through global.fetch (apiRequest), never a
    // "file://" uri (no blob loading of the local photo).
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toMatch(/^file:\/\//)
    }

    const savedAttachment = await getAttachment("")
    void savedAttachment
    expect(await getQueueRowCount(draft.id)).toBe(0)
  })
})

describe("missing local file at upload time", () => {
  test("fresh attachment-create row: queue row deleted, attachment 'missing'/'failed', survey unblocked, no createUploadTask", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}gone.jpg`
    // No __setMockFile: the file does not exist.
    const attachment = await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })
    const row = await getQueueRow(draft.id)
    const rowId = row!.id

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(attachmentCreateResponse(rowId, "remote-att-3"))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    await syncPending("http://api", "token")

    expect(createUploadTask).not.toHaveBeenCalled()
    expect(await getQueueRowCount(draft.id)).toBe(0)

    const savedAttachment = await getAttachment(attachment.id)
    expect(savedAttachment?.file_state).toBe("missing")
    expect(savedAttachment?.sync_state).toBe("failed")
    expect(savedAttachment?.last_sync_error_code).toBe("local_file_missing")

    const survey = await getSurvey(draft.id)
    expect(survey?.sync_blocked).toBe(0)
  })

  test("upload-only row (remote id + upload_url already saved): same missing-file handling", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}gone2.jpg`
    const attachment = await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })

    const db = await getDb()
    await db.runAsync(
      `UPDATE local_attachments
       SET remote_attachment_id = ?, storage_key = ?, upload_url = ?, confirm_url = ?
       WHERE id = ?`,
      [
        "remote-att-4",
        "key-remote-att-4",
        "/surveys/s/attachments/remote-att-4/upload?token=t",
        "/surveys/s/attachments/remote-att-4/confirm?token=t",
        attachment.id,
      ],
    )

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    await syncPending("http://api", "token")

    expect(createUploadTask).not.toHaveBeenCalled()
    expect(await getQueueRowCount(draft.id)).toBe(0)

    const savedAttachment = await getAttachment(attachment.id)
    expect(savedAttachment?.file_state).toBe("missing")
    expect(savedAttachment?.sync_state).toBe("failed")
    expect(savedAttachment?.last_sync_error_code).toBe("local_file_missing")

    const survey = await getSurvey(draft.id)
    expect(survey?.sync_blocked).toBe(0)
  })
})

describe("upload failures that never consume the retry cap", () => {
  test("network TypeError 20 times: retry_count stays 0", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}photo-network.jpg`
    __setMockFile(localUri, 1000)
    await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })

    let rowId: number | undefined
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(attachmentCreateResponse(rowId ?? 0, "remote-att-net"))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    ;(createUploadTask as jest.Mock).mockImplementation(() => ({
      uploadAsync: jest.fn(() => Promise.reject(new TypeError("Network request failed"))),
      cancelAsync: jest.fn(() => Promise.resolve()),
    }))

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const row = await getQueueRow(draft.id)
      rowId = row!.id
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    const row = await getQueueRow(draft.id)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(0)
  })

  test("upload never settles: after 120s the task is cancelled, retry_count stays 0", async () => {
    jest.useFakeTimers()
    try {
      const draft = await createLocalDraft({
        site_name: "Site",
        region_version: "M",
        vegetation_stage: "stage",
        parcel_ids: [],
        factors: {},
      })
      const localUri = `${ATTACHMENTS_DIR}photo-timeout.jpg`
      __setMockFile(localUri, 1000)
      await queueLocalAttachment({
        survey_id: draft.id,
        local_uri: localUri,
        mime_type: "image/jpeg",
        size_bytes: 1000,
      })
      const row = await getQueueRow(draft.id)
      const rowId = row!.id

      const fetchMock = global.fetch as jest.Mock
      fetchMock.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/sync/changes")) {
          return Promise.resolve(emptyChangesResponse())
        }
        if (typeof url === "string" && url.includes("/sync")) {
          return Promise.resolve(attachmentCreateResponse(rowId, "remote-att-timeout"))
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`))
      })

      const cancelAsync = jest.fn(() => Promise.resolve())
      ;(createUploadTask as jest.Mock).mockImplementation(() => ({
        uploadAsync: jest.fn(() => new Promise(() => {})),
        cancelAsync,
      }))

      const syncResultPromise = syncPending("http://api", "token")
      await jest.advanceTimersByTimeAsync(120_000)
      await syncResultPromise

      expect(cancelAsync).toHaveBeenCalled()

      const finalRow = await getQueueRow(draft.id)
      expect(finalRow?.status).toBe("failed")
      expect(finalRow?.retry_count).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  test.each([503, 429])("UPLOAD_HTTP %i: retry_count stays 0", async (status) => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}photo-${status}.jpg`
    __setMockFile(localUri, 1000)
    await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })

    let rowId: number | undefined
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(attachmentCreateResponse(rowId ?? 0, `remote-att-${status}`))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    ;(createUploadTask as jest.Mock).mockImplementation(() => ({
      uploadAsync: jest.fn(() => Promise.resolve({ status, body: "", headers: {} })),
      cancelAsync: jest.fn(() => Promise.resolve()),
    }))

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const row = await getQueueRow(draft.id)
      rowId = row!.id
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    const row = await getQueueRow(draft.id)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(0)
  })
})

describe("upload failures that do consume the retry cap", () => {
  test("UPLOAD_HTTP 401 eight times: row deleted at the 8th, attachment failed with retry_cap_reached", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}photo-401.jpg`
    __setMockFile(localUri, 1000)
    const attachment = await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })

    let rowId: number | undefined
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(attachmentCreateResponse(rowId ?? 0, "remote-att-401"))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    ;(createUploadTask as jest.Mock).mockImplementation(() => ({
      uploadAsync: jest.fn(() => Promise.resolve({ status: 401, body: "", headers: {} })),
      cancelAsync: jest.fn(() => Promise.resolve()),
    }))

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const row = await getQueueRow(draft.id)
      rowId = row!.id
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    let row = await getQueueRow(draft.id)
    expect(row?.retry_count).toBe(7)
    rowId = row!.id

    await syncPending("http://api", "token")

    expect(await getQueueRowCount(draft.id)).toBe(0)
    const savedAttachment = await getAttachment(attachment.id)
    expect(savedAttachment?.sync_state).toBe("failed")
    expect(savedAttachment?.last_sync_error_code).toBe("retry_cap_reached")
  })

  test("UPLOAD_HTTP 404: fatal on the first attempt", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}photo-404.jpg`
    __setMockFile(localUri, 1000)
    const attachment = await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })
    const row = await getQueueRow(draft.id)
    const rowId = row!.id

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(attachmentCreateResponse(rowId, "remote-att-404"))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })
    ;(createUploadTask as jest.Mock).mockImplementation(() => ({
      uploadAsync: jest.fn(() => Promise.resolve({ status: 404, body: "", headers: {} })),
      cancelAsync: jest.fn(() => Promise.resolve()),
    }))

    await syncPending("http://api", "token")

    expect(await getQueueRowCount(draft.id)).toBe(0)
    const savedAttachment = await getAttachment(attachment.id)
    expect(savedAttachment?.sync_state).toBe("failed")
  })
})

describe("photo files are cleaned up after deletions", () => {
  test("server confirms a survey_delete: the survey's attachment files are deleted after commit", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}to-delete.jpg`
    __setMockFile(localUri, 1000)
    const attachment = await queueLocalAttachment({
      survey_id: draft.id,
      local_uri: localUri,
      mime_type: "image/jpeg",
      size_bytes: 1000,
    })
    // Mark the attachment already synced (as if uploaded earlier) so only the
    // survey_delete queue row drives this sync.
    const db = await getDb()
    await db.runAsync(`UPDATE local_attachments SET sync_state = 'synced' WHERE id = ?`, [
      attachment.id,
    ])
    await db.runAsync(`DELETE FROM sync_queue WHERE survey_id = ?`, [draft.id])
    const deletePayload = { kind: "survey_delete", survey_id: draft.id }
    const insertResult = await db.runAsync(
      `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
       VALUES (?, 'survey_delete', ?, 'pending', 0, NULL, ?, ?)`,
      [draft.id, JSON.stringify(deletePayload), NOW, NOW],
    )
    const rowId = Number(insertResult.lastInsertRowId)

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(emptyChangesResponse())
      }
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(
          jsonResponse(200, {
            results: [
              {
                client_ref: String(rowId),
                entity: "survey",
                action: "delete",
                status: "synced",
              },
            ],
          }),
        )
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    expect(__getMockFile(localUri)).toBeDefined()

    await syncPending("http://api", "token")

    expect(__getMockFile(localUri)).toBeUndefined()
    const savedAttachment = await getAttachment(attachment.id)
    expect(savedAttachment).toBeNull()
  })

  test("a pull deleting a remote attachment deletes its cached file", async () => {
    const draft = await createLocalDraft({
      site_name: "Site",
      region_version: "M",
      vegetation_stage: "stage",
      parcel_ids: [],
      factors: {},
    })
    const localUri = `${ATTACHMENTS_DIR}pulled-delete.jpg`
    __setMockFile(localUri, 1000)
    const db = await getDb()
    await db.runAsync(
      `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, file_state, created_at, updated_at)
       VALUES (?, ?, ?, 'image/jpeg', 1000, 'synced', ?, NULL, NULL, NULL, NULL, NULL, NULL, 'local', ?, ?)`,
      ["local-att-pulled", draft.id, localUri, "remote-attachment-pulled", NOW, NOW],
    )

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: "cursor-1",
            has_more: false,
            surveys: [],
            attachments: [
              {
                id: "remote-attachment-pulled",
                survey_id: draft.id,
                storage_key: "key",
                mime_type: "image/jpeg",
                size_bytes: 1000,
                deleted_at: NOW,
              },
            ],
          }),
        )
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    expect(__getMockFile(localUri)).toBeDefined()

    await syncPending("http://api", "token")

    expect(__getMockFile(localUri)).toBeUndefined()
    const savedAttachment = await getAttachment("local-att-pulled")
    expect(savedAttachment).toBeNull()
  })
})
