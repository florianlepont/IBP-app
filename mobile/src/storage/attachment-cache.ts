import * as FileSystem from "expo-file-system/legacy"
import { ApiError } from "../api/client"
import { AttachmentDownloadUrlResponse, getAttachmentDownloadUrl } from "../api/ibp-api"
import {
  buildAttachmentFileUri,
  deleteAttachmentFile,
  ensureAttachmentsDir,
  extensionForMimeType,
  localFileExists,
  resolveAttachmentUri,
} from "./attachment-files"
import { getDb } from "./db"
import { DbExecutor, runInTransaction } from "./transaction"
import { resolveUploadTarget } from "./utils"

// D-11: a pulled attachment (file_state "remote") has no bytes on disk yet.
// This module fetches them on demand through the D-01 download-url endpoint,
// caches them durably under documentDirectory/attachments/, and never deletes
// a local_attachments row (D-10): a lost or never-uploaded file is recorded as
// "missing"/"unavailable" instead.
export const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 60_000
export const LOCAL_FILE_MISSING_CODE = "local_file_missing"

export type AttachmentPreviewResult = "ready" | "remote" | "missing" | "unavailable"

type AttachmentCacheRow = {
  id: string
  survey_id: string
  local_uri: string
  mime_type: string
  remote_attachment_id: string | null
  file_state: "local" | "remote" | "missing" | "unavailable"
}

/**
 * Marks a local_attachments row "missing": its local file is gone and there is
 * nothing to re-download it from (no remote_attachment_id). Takes a DbExecutor
 * so a caller already inside a transaction (plan 11) can pass its own handle;
 * a standalone caller wraps this in runInTransaction (see ensureAttachmentCached
 * below and simulateMissingAttachmentFile's caller if it ever needs to).
 */
export async function markAttachmentFileMissing(
  tx: DbExecutor,
  localAttachmentId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await tx.runAsync(
    `UPDATE local_attachments
     SET file_state = 'missing',
         last_sync_error_code = ?,
         last_sync_error = ?,
         last_sync_error_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [LOCAL_FILE_MISSING_CODE, "Photo introuvable sur cet appareil", now, now, localAttachmentId],
  )
}

async function markAttachmentUnavailable(tx: DbExecutor, localAttachmentId: string): Promise<void> {
  const now = new Date().toISOString()
  await tx.runAsync(
    `UPDATE local_attachments SET file_state = 'unavailable', updated_at = ? WHERE id = ?`,
    [now, localAttachmentId],
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`attachment download timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Ensures a local_attachments row has a usable local file, downloading it
 * through the D-01 endpoint if needed. Never deletes the row (D-10).
 */
export async function ensureAttachmentCached(
  apiUrl: string,
  accessToken: string,
  localAttachmentId: string,
): Promise<AttachmentPreviewResult> {
  const db = await getDb()
  const row = await db.getFirstAsync<AttachmentCacheRow>(
    `SELECT id, survey_id, local_uri, mime_type, remote_attachment_id, file_state
     FROM local_attachments
     WHERE id = ?`,
    [localAttachmentId],
  )

  if (!row) {
    return "missing"
  }

  if (row.file_state === "unavailable") {
    return "unavailable"
  }

  if (row.file_state === "local") {
    const resolvedUri = resolveAttachmentUri(row.local_uri)
    if (await localFileExists(resolvedUri)) {
      if (resolvedUri !== row.local_uri) {
        const now = new Date().toISOString()
        await runInTransaction((tx) =>
          tx.runAsync(`UPDATE local_attachments SET local_uri = ?, updated_at = ? WHERE id = ?`, [
            resolvedUri,
            now,
            localAttachmentId,
          ]),
        )
      }
      return "ready"
    }
    // The local file is gone. Fall through to a re-download below only when
    // the server still has a copy; otherwise report "missing" (D-10).
  }

  if (!row.remote_attachment_id) {
    await runInTransaction((tx) => markAttachmentFileMissing(tx, localAttachmentId))
    return "missing"
  }

  let downloadUrl: AttachmentDownloadUrlResponse
  try {
    downloadUrl = await getAttachmentDownloadUrl(
      apiUrl,
      accessToken,
      row.survey_id,
      row.remote_attachment_id,
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Let withAuthRetry refresh the token and retry the whole call.
      throw error
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
      // The server has no downloadable bytes (deleted / never uploaded).
      // Stop asking until a later pull resets this attachment to "remote".
      await runInTransaction((tx) => markAttachmentUnavailable(tx, localAttachmentId))
      return "unavailable"
    }
    // 5xx, 429, timeout or a raw network error: transient, try again later.
    return "remote"
  }

  await ensureAttachmentsDir()
  const destination = buildAttachmentFileUri(
    `remote-${row.remote_attachment_id}.${extensionForMimeType(row.mime_type)}`,
  )

  let downloadResult: { status: number; uri: string } | null = null
  try {
    downloadResult = await withTimeout(
      FileSystem.downloadAsync(
        resolveUploadTarget(apiUrl, downloadUrl.url),
        destination,
        downloadUrl.requires_auth ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
      ),
      ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
    )
  } catch {
    await deleteAttachmentFile(destination)
    return "remote"
  }

  if (!downloadResult || downloadResult.status < 200 || downloadResult.status >= 300) {
    await deleteAttachmentFile(destination)
    return "remote"
  }

  const now = new Date().toISOString()
  const updateResult = await runInTransaction((tx) =>
    tx.runAsync(
      `UPDATE local_attachments SET local_uri = ?, file_state = 'local', updated_at = ? WHERE id = ?`,
      [destination, now, localAttachmentId],
    ),
  )

  if (updateResult.changes === 0) {
    // The row was deleted while the download was in flight; nothing to
    // update, and the orphan file must not linger on disk.
    await deleteAttachmentFile(destination)
    return "remote"
  }

  return "ready"
}

/**
 * Dev-only helper: deletes a photo's local file but keeps its row, letting the
 * owner reproduce the "missing local file" state on a real device (plans
 * 09/12). Never touches the row itself.
 */
export async function simulateMissingAttachmentFile(localAttachmentId: string): Promise<void> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ local_uri: string }>(
    `SELECT local_uri FROM local_attachments WHERE id = ?`,
    [localAttachmentId],
  )
  if (!row) {
    return
  }
  await deleteAttachmentFile(row.local_uri)
}
