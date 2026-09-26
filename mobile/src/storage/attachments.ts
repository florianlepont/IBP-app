import * as FileSystem from "expo-file-system/legacy"
import type { FileSystemUploadOptions } from "expo-file-system/legacy"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import { randomUUID } from "expo-crypto"
import {
  buildAttachmentFileUri,
  ensureAttachmentsDir,
  extensionForMimeType,
  getLocalFileSize,
  isInAttachmentsDir,
  localFileExists,
  resolveAttachmentUri,
} from "./attachment-files"
import { getDb } from "./db"
import { DbExecutor, runInTransaction } from "./transaction"
import { isAttachmentQueuePayload, safeParseJson } from "./utils"
import { AttachmentQueuePayload } from "./types"

// D-09/D-16: every captured photo is resized on its longer axis only (never
// upscaled), re-encoded to JPEG and persisted in documentDirectory before it
// is ever queued, so the app never keeps the only copy of a photo in a
// purgeable cache directory or reports a fake size to the sync engine.
export const MAX_PHOTO_EDGE_PX = 2048
export const PHOTO_JPEG_QUALITY = 0.7

// D-15: the API and presigned upload paths both stream from disk via an
// upload task instead of loading the whole file into memory as a blob.
export const UPLOAD_TIMEOUT_MS = 120_000

export class LocalFileMissingError extends Error {
  readonly code = "local_file_missing"

  constructor(uri: string) {
    super(`Local file missing: ${uri}`)
    this.name = "LocalFileMissingError"
  }
}

export class UploadTimeoutError extends Error {
  constructor() {
    super(`Upload timed out after ${UPLOAD_TIMEOUT_MS}ms`)
    this.name = "UploadTimeoutError"
  }
}

export type ResizeTarget = { width: number } | { height: number } | null

// Pure: resize target on the longer axis only, never upscaling (C8).
export function computeResizeTarget(
  width: number,
  height: number,
  maxEdge: number = MAX_PHOTO_EDGE_PX,
): ResizeTarget {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  const longEdge = Math.max(width, height)
  if (longEdge <= maxEdge) {
    return null
  }
  return width >= height ? { width: maxEdge } : { height: maxEdge }
}

export type CapturedPhotoAsset = {
  uri: string
  width?: number | null
  height?: number | null
  mimeType?: string | null
}

export type PreparedPhoto = {
  uri: string
  sizeBytes: number
  mimeType: "image/jpeg"
  width: number
  height: number
}

interface RenderedImageRef {
  width: number
  height: number
  saveAsync: (options: {
    format: SaveFormat
    compress: number
  }) => Promise<{ uri: string; width: number; height: number }>
}

async function persistRenderedImage(imageRef: RenderedImageRef): Promise<PreparedPhoto> {
  const saved = await imageRef.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_JPEG_QUALITY })

  await ensureAttachmentsDir()
  const dest = buildAttachmentFileUri(`${randomUUID()}.jpg`)
  await FileSystem.copyAsync({ from: saved.uri, to: dest })

  try {
    // Best-effort: the manipulator's temp file lives in the cache and the OS
    // will reclaim it eventually, but we no longer need it once copied.
    await FileSystem.deleteAsync(saved.uri, { idempotent: true })
  } catch {
    // Non-fatal: the durable copy already exists at `dest`.
  }

  const sizeBytes = await getLocalFileSize(dest)
  if (sizeBytes == null) {
    throw new Error(`preparePhotoForStorage: could not size persisted file: ${dest}`)
  }

  return {
    uri: dest,
    sizeBytes,
    mimeType: "image/jpeg",
    width: saved.width,
    height: saved.height,
  }
}

// D-09/D-16: always re-encodes (this is what converts HEIC to JPEG too), and
// resizes only when the asset's longer edge exceeds MAX_PHOTO_EDGE_PX.
export async function preparePhotoForStorage(asset: CapturedPhotoAsset): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri)
  const knownWidth = typeof asset.width === "number" && asset.width > 0 ? asset.width : null
  const knownHeight = typeof asset.height === "number" && asset.height > 0 ? asset.height : null

  if (knownWidth != null && knownHeight != null) {
    const target = computeResizeTarget(knownWidth, knownHeight)
    const imageRef = await (target ? context.resize(target) : context).renderAsync()
    return persistRenderedImage(imageRef)
  }

  // Unknown dimensions: render once (no resize) to read the real size off the
  // ImageRef, then decide whether a second, resized render is needed.
  const probe = await context.renderAsync()
  const target = computeResizeTarget(probe.width, probe.height)
  if (!target) {
    return persistRenderedImage(probe)
  }
  const resized = await context.resize(target).renderAsync()
  return persistRenderedImage(resized)
}

export type UploadAttachmentFileParams = {
  uploadTarget: string
  isApiUploadTarget: boolean
  localUri: string
  mimeType: string
  accessToken: string
}

// D-15: streams the file from disk via an upload task instead of reading it
// into a blob (T-01.5-23), and cancels after UPLOAD_TIMEOUT_MS instead of
// hanging forever (the legacy FileSystem.uploadAsync has no timeout option).
export async function uploadAttachmentFile(
  params: UploadAttachmentFileParams,
): Promise<{ status: number }> {
  const resolvedUri = resolveAttachmentUri(params.localUri)
  if (!(await localFileExists(resolvedUri))) {
    throw new LocalFileMissingError(resolvedUri)
  }

  const options: FileSystemUploadOptions = params.isApiUploadTarget
    ? {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: params.mimeType,
        headers: { Authorization: `Bearer ${params.accessToken}` },
      }
    : {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": params.mimeType },
      }

  const task = FileSystem.createUploadTask(params.uploadTarget, resolvedUri, options)

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      task.uploadAsync(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          void task.cancelAsync()
          reject(new UploadTimeoutError())
        }, UPLOAD_TIMEOUT_MS)
      }),
    ])

    if (!result) {
      throw new UploadTimeoutError()
    }

    return { status: result.status }
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function rewriteAttachmentQueuePayloads(
  tx: DbExecutor,
  localAttachmentId: string,
  newLocalUri: string,
): Promise<void> {
  const queueRows = await tx.getAllAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue WHERE payload LIKE ?`,
    [`%${localAttachmentId}%`],
  )

  for (const row of queueRows) {
    const payload = safeParseJson(row.payload)
    if (isAttachmentQueuePayload(payload) && payload.local_attachment_id === localAttachmentId) {
      const updated: AttachmentQueuePayload = { ...payload, local_uri: newLocalUri }
      await tx.runAsync(`UPDATE sync_queue SET payload = ? WHERE id = ?`, [
        JSON.stringify(updated),
        row.id,
      ])
    }
  }
}

type LegacyAttachmentRow = {
  id: string
  local_uri: string
  mime_type: string
  remote_attachment_id: string | null
}

// D-09/T-01.5-26: photos captured by older app versions were left pointing at
// the OS-purgeable ImagePicker cache. On every app start, rescue any such
// file that still exists into documentDirectory/attachments/, repointing the
// attachment row and its queued upload payload in one transaction. A synced
// attachment whose cache file is already gone becomes 'remote' so the
// download path (plan 11) re-fetches it; a pending one is left untouched so
// plan 11 can report it as unavailable at upload time.
export async function persistLegacyAttachmentFiles(): Promise<{
  moved: number
  markedRemote: number
}> {
  const db = await getDb()
  const rows = await db.getAllAsync<LegacyAttachmentRow>(
    `SELECT id, local_uri, mime_type, remote_attachment_id
     FROM local_attachments
     WHERE file_state = 'local' AND local_uri IS NOT NULL AND local_uri != ''`,
  )

  let moved = 0
  let markedRemote = 0

  for (const row of rows) {
    if (isInAttachmentsDir(row.local_uri)) {
      continue
    }

    const exists = await localFileExists(row.local_uri)
    if (exists) {
      await ensureAttachmentsDir()
      const dest = buildAttachmentFileUri(`${row.id}.${extensionForMimeType(row.mime_type)}`)
      await FileSystem.copyAsync({ from: row.local_uri, to: dest })

      await runInTransaction(async (tx) => {
        await tx.runAsync(`UPDATE local_attachments SET local_uri = ? WHERE id = ?`, [dest, row.id])
        await rewriteAttachmentQueuePayloads(tx, row.id, dest)
      })
      moved += 1
    } else if (row.remote_attachment_id) {
      await db.runAsync(`UPDATE local_attachments SET file_state = 'remote' WHERE id = ?`, [row.id])
      markedRemote += 1
    }
    // else: pending row whose cache file is already gone. Leave it; plan 11
    // reports it as unavailable when the sync engine tries to upload it.
  }

  return { moved, markedRemote }
}
