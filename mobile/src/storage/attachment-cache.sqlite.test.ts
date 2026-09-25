/**
 * D-11/D-10 real-SQL proof: a pulled attachment's bytes are fetched on demand
 * and cached durably, a lost local file is re-fetched or reported missing,
 * and a row with no downloadable bytes is marked "unavailable" instead of
 * being deleted or retried forever.
 */

import { createNodeSqliteDb } from "../../test/node-sqlite-db"

const mockDb = createNodeSqliteDb()

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}))

const mockGetAttachmentDownloadUrl = jest.fn()
jest.mock("../api/ibp-api", () => ({
  getAttachmentDownloadUrl: (...args: unknown[]) => mockGetAttachmentDownloadUrl(...args),
}))

import { ApiError } from "../api/client"
import {
  ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
  ensureAttachmentCached,
  LOCAL_FILE_MISSING_CODE,
  markAttachmentFileMissing,
  simulateMissingAttachmentFile,
} from "./attachment-cache"
import { buildAttachmentFileUri } from "./attachment-files"
import { initLocalDb } from "./db"
import { runInTransaction } from "./transaction"
import * as FS from "../../test/expo-file-system-legacy.mock"

const API_URL = "https://api.example.com/v1"
const TOKEN = "access-token"

async function insertAttachment(overrides: Partial<Record<string, unknown>> = {}): Promise<string> {
  const id = (overrides.id as string) ?? `attachment-${Math.random().toString(36).slice(2)}`
  const now = new Date().toISOString()
  await mockDb.runAsync(
    `INSERT INTO local_attachments (
       id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id,
       storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code,
       last_sync_error_at, created_at, updated_at, file_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
    [
      id,
      (overrides.survey_id as string) ?? "survey-1",
      (overrides.local_uri as string) ?? "",
      (overrides.mime_type as string) ?? "image/jpeg",
      (overrides.size_bytes as number) ?? 0,
      (overrides.sync_state as string) ?? "synced",
      (overrides.remote_attachment_id as string | null) ?? null,
      now,
      now,
      (overrides.file_state as string) ?? "remote",
    ],
  )
  return id
}

async function getRow(id: string) {
  return mockDb.getFirstAsync<{
    local_uri: string
    file_state: string
    last_sync_error_code: string | null
    sync_state: string
  }>(
    `SELECT local_uri, file_state, last_sync_error_code, sync_state FROM local_attachments WHERE id = ?`,
    [id],
  )
}

beforeAll(async () => {
  await initLocalDb()
})

beforeEach(async () => {
  await mockDb.execAsync(
    `DELETE FROM local_surveys; DELETE FROM sync_queue; DELETE FROM local_attachments; DELETE FROM local_meta;`,
  )
  FS.__resetMockFileSystem()
  mockGetAttachmentDownloadUrl.mockReset()
  jest.useRealTimers()
})

describe("ensureAttachmentCached", () => {
  test("remote row, requires_auth true + relative url: downloads with Bearer header and becomes local", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-1" })
    mockGetAttachmentDownloadUrl.mockResolvedValue({
      url: "/surveys/survey-1/attachments/srv-1/content",
      expires_at: new Date().toISOString(),
      requires_auth: true,
    })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("ready")
    expect(FS.downloadAsync).toHaveBeenCalledWith(
      `${API_URL}/surveys/survey-1/attachments/srv-1/content`,
      buildAttachmentFileUri("remote-srv-1.jpg"),
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    )
    const row = await getRow(id)
    expect(row?.file_state).toBe("local")
    expect(row?.local_uri).toBe(buildAttachmentFileUri("remote-srv-1.jpg"))
  })

  test("remote row, requires_auth false + https url: no Authorization header", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-2" })
    mockGetAttachmentDownloadUrl.mockResolvedValue({
      url: "https://storage.example.com/bucket/srv-2.jpg?sig=abc",
      expires_at: new Date().toISOString(),
      requires_auth: false,
    })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("ready")
    expect(FS.downloadAsync).toHaveBeenCalledWith(
      "https://storage.example.com/bucket/srv-2.jpg?sig=abc",
      buildAttachmentFileUri("remote-srv-2.jpg"),
      {},
    )
  })

  test("downloadAsync resolves with a non-2xx status: result remote, row unchanged, no file left", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-3" })
    mockGetAttachmentDownloadUrl.mockResolvedValue({
      url: "https://storage.example.com/bucket/srv-3.jpg",
      expires_at: new Date().toISOString(),
      requires_auth: false,
    })
    const dest = buildAttachmentFileUri("remote-srv-3.jpg")
    ;(FS.downloadAsync as jest.Mock).mockResolvedValue({ status: 403, uri: dest })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("remote")
    const row = await getRow(id)
    expect(row?.file_state).toBe("remote")
    expect(FS.__getMockFile(dest)).toBeUndefined()
  })

  test("downloadAsync never settles: times out and returns remote, row unchanged", async () => {
    jest.useFakeTimers()
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-4" })
    mockGetAttachmentDownloadUrl.mockResolvedValue({
      url: "https://storage.example.com/bucket/srv-4.jpg",
      expires_at: new Date().toISOString(),
      requires_auth: false,
    })
    ;(FS.downloadAsync as jest.Mock).mockReturnValue(new Promise(() => {}))

    const pending = ensureAttachmentCached(API_URL, TOKEN, id)
    await jest.advanceTimersByTimeAsync(ATTACHMENT_DOWNLOAD_TIMEOUT_MS)
    const result = await pending

    expect(result).toBe("remote")
    const row = await getRow(id)
    expect(row?.file_state).toBe("remote")
    jest.useRealTimers()
  })

  test("getAttachmentDownloadUrl rejects 409 attachment_not_uploaded: row becomes unavailable, no download attempted", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-5" })
    mockGetAttachmentDownloadUrl.mockRejectedValue(
      new ApiError(409, "attachment_not_uploaded", { code: "attachment_not_uploaded" }),
    )

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("unavailable")
    const row = await getRow(id)
    expect(row?.file_state).toBe("unavailable")
    expect(FS.downloadAsync).not.toHaveBeenCalled()
  })

  test("getAttachmentDownloadUrl rejects 404: row becomes unavailable, not deleted", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-6" })
    mockGetAttachmentDownloadUrl.mockRejectedValue(new ApiError(404, "Not found", null))

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("unavailable")
    const row = await getRow(id)
    expect(row).not.toBeNull()
    expect(row?.file_state).toBe("unavailable")
  })

  test("getAttachmentDownloadUrl rejects 401: rethrown so withAuthRetry can refresh", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-7" })
    mockGetAttachmentDownloadUrl.mockRejectedValue(new ApiError(401, "Unauthorized", null))

    await expect(ensureAttachmentCached(API_URL, TOKEN, id)).rejects.toThrow("Unauthorized")
  })

  test("getAttachmentDownloadUrl rejects 503: result remote, row unchanged", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-8" })
    mockGetAttachmentDownloadUrl.mockRejectedValue(new ApiError(503, "Service unavailable", null))

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("remote")
    const row = await getRow(id)
    expect(row?.file_state).toBe("remote")
  })

  test("getAttachmentDownloadUrl rejects with a raw network TypeError: result remote, row unchanged", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-9" })
    mockGetAttachmentDownloadUrl.mockRejectedValue(new TypeError("Network request failed"))

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("remote")
    const row = await getRow(id)
    expect(row?.file_state).toBe("remote")
  })

  test("a row already unavailable returns unavailable without any network call", async () => {
    const id = await insertAttachment({ file_state: "unavailable", remote_attachment_id: "srv-10" })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("unavailable")
    expect(mockGetAttachmentDownloadUrl).not.toHaveBeenCalled()
    expect(FS.downloadAsync).not.toHaveBeenCalled()
  })

  test("local row whose file exists: result ready, no network call", async () => {
    const uri = buildAttachmentFileUri("local-photo.jpg")
    FS.__setMockFile(uri, 1000)
    const id = await insertAttachment({ file_state: "local", local_uri: uri })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("ready")
    expect(mockGetAttachmentDownloadUrl).not.toHaveBeenCalled()
  })

  test("local row with an old-container uri that exists after re-basing: ready and local_uri updated", async () => {
    const currentUri = buildAttachmentFileUri("old-photo.jpg")
    FS.__setMockFile(currentUri, 1000)
    const oldUri = "file:///old-container-uuid/Documents/attachments/old-photo.jpg"
    const id = await insertAttachment({ file_state: "local", local_uri: oldUri })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("ready")
    const row = await getRow(id)
    expect(row?.local_uri).toBe(currentUri)
  })

  test("local row whose file is missing and remote_attachment_id is set: downloads again and returns ready", async () => {
    const staleUri = buildAttachmentFileUri("gone.jpg")
    const id = await insertAttachment({
      file_state: "local",
      local_uri: staleUri,
      remote_attachment_id: "srv-11",
    })
    mockGetAttachmentDownloadUrl.mockResolvedValue({
      url: "https://storage.example.com/bucket/srv-11.jpg",
      expires_at: new Date().toISOString(),
      requires_auth: false,
    })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("ready")
    const row = await getRow(id)
    expect(row?.file_state).toBe("local")
    expect(row?.local_uri).toBe(buildAttachmentFileUri("remote-srv-11.jpg"))
  })

  test("local row whose file is missing and no remote_attachment_id: returns missing, row kept", async () => {
    const staleUri = buildAttachmentFileUri("gone-forever.jpg")
    const id = await insertAttachment({
      file_state: "local",
      local_uri: staleUri,
      remote_attachment_id: null,
      sync_state: "synced",
    })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("missing")
    const row = await getRow(id)
    expect(row?.file_state).toBe("missing")
    expect(row?.last_sync_error_code).toBe(LOCAL_FILE_MISSING_CODE)
    expect(row?.sync_state).toBe("synced")
  })

  test("row deleted while the download is in flight: result remote, downloaded file removed", async () => {
    const id = await insertAttachment({ file_state: "remote", remote_attachment_id: "srv-12" })
    mockGetAttachmentDownloadUrl.mockResolvedValue({
      url: "https://storage.example.com/bucket/srv-12.jpg",
      expires_at: new Date().toISOString(),
      requires_auth: false,
    })
    const dest = buildAttachmentFileUri("remote-srv-12.jpg")
    ;(FS.downloadAsync as jest.Mock).mockImplementation(async (_url: string, fileUri: string) => {
      await mockDb.runAsync(`DELETE FROM local_attachments WHERE id = ?`, [id])
      FS.__setMockFile(fileUri, 1234)
      return { status: 200, uri: fileUri }
    })

    const result = await ensureAttachmentCached(API_URL, TOKEN, id)

    expect(result).toBe("remote")
    expect(FS.__getMockFile(dest)).toBeUndefined()
  })

  test("unknown local attachment id: result missing without throwing and nothing written", async () => {
    const result = await ensureAttachmentCached(API_URL, TOKEN, "does-not-exist")

    expect(result).toBe("missing")
    expect(mockGetAttachmentDownloadUrl).not.toHaveBeenCalled()
  })
})

describe("markAttachmentFileMissing", () => {
  test("sets file_state, error code and message on the row it is given", async () => {
    const id = await insertAttachment({ file_state: "local" })

    await runInTransaction((tx) => markAttachmentFileMissing(tx, id))

    const row = await getRow(id)
    expect(row?.file_state).toBe("missing")
    expect(row?.last_sync_error_code).toBe(LOCAL_FILE_MISSING_CODE)
  })
})

describe("simulateMissingAttachmentFile", () => {
  test("deletes the row's file but keeps the row as is", async () => {
    const uri = buildAttachmentFileUri("dev-check.jpg")
    FS.__setMockFile(uri, 500)
    const id = await insertAttachment({ file_state: "local", local_uri: uri })

    await simulateMissingAttachmentFile(id)

    expect(FS.__getMockFile(uri)).toBeUndefined()
    const row = await getRow(id)
    expect(row?.file_state).toBe("local")
    expect(row?.local_uri).toBe(uri)
  })

  test("unknown attachment id does nothing", async () => {
    await expect(simulateMissingAttachmentFile("nope")).resolves.toBeUndefined()
  })
})
