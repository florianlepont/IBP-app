import { getDb, SYNC_BATCH_SIZE, MAX_RETRY_COUNT } from "./db"
import { runInTransaction, DbExecutor } from "./transaction"
import { createSyncFlight } from "./sync-flight"
import {
  QueueRow,
  SurveyQueuePayload,
  SurveyDeleteQueuePayload,
  SurveyVisibilityQueuePayload,
  AttachmentQueuePayload,
  AttachmentDeleteQueuePayload,
  UploadTargetResponse,
  SyncBatchOperation,
  SyncBatchResult,
  SyncBatchResponse,
  RemoteSurvey,
  RemoteAttachment,
  SyncChangesResponse,
  LocalAttachment,
} from "./types"
import {
  isSurveyQueuePayload,
  isSurveyDeleteQueuePayload,
  isSurveyVisibilityQueuePayload,
  isAttachmentQueuePayload,
  isAttachmentDeleteQueuePayload,
  toUploadTarget,
  buildSyncResultMessage,
  resolveUploadTarget,
  deriveSurveyErrorCode,
  deriveAttachmentErrorCode,
  computeNextRetryAt,
  safeParseJson,
  buildSyncChangesPath,
  normalizeParcelIds,
  hasPendingQueueForSurvey,
  classifyRequestError,
  classifyBatchResult,
  classifyUploadFailure,
  FailureClassification,
} from "./utils"
import { markSurveyExpiredLocally } from "./surveys"
import { apiRequest, ApiError } from "../api/client"
import { uploadAttachmentFile, LocalFileMissingError } from "./attachments"
import { markAttachmentFileMissing } from "./attachment-cache"
import { deleteAttachmentFile } from "./attachment-files"

// D-07: POST /sync carries a longer timeout than the client default because a
// batch can contain many operations; every other sync JSON call (changes,
// confirm PUT, submit) uses apiRequest's normal per-request default.
const SYNC_BATCH_TIMEOUT_MS = 60_000

// D-03: at most one drain (syncPending) or one pull (pullRemoteChanges) runs
// at a time on the phone. sync.ts owns the single module-level instance;
// drainQueue/pullChanges are the unguarded bodies, called directly from
// inside each other (drainQueue's opportunistic pull) so they never wait on
// their own flight.
const syncFlight = createSyncFlight()

type FailureOptions = {
  classification: FailureClassification
  errorCode?: string
  // D-10: set when the failure is a missing local photo file. In the same
  // transaction as the queue-row/attachment failure write, the attachment
  // row is also marked file_state 'missing' (never deleted).
  markFileMissing?: boolean
}

async function markSurveyQueueRowSynced(row: QueueRow): Promise<void> {
  const now = new Date().toISOString()
  await runInTransaction(async (tx) => {
    await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    // D-04: only flip to "synced" when no other queue row remains for this
    // survey (a row in a later batch, or one that just failed) — otherwise a
    // survey with more pending work would be shown as fully synced.
    await tx.runAsync(
      `UPDATE local_surveys
       SET sync_state = 'synced',
           status = CASE
             WHEN status IN ('submitted', 'expired') THEN status
             ELSE 'synced'
           END,
           last_sync_error = NULL,
           last_sync_error_code = NULL,
           last_sync_error_at = NULL,
           sync_blocked = 0,
           updated_at = ?
       WHERE id = ? AND NOT EXISTS (SELECT 1 FROM sync_queue WHERE survey_id = ?)`,
      [now, row.survey_id, row.survey_id],
    )
  })
}

async function markSurveyDeleteRowSynced(row: QueueRow): Promise<void> {
  const deletedUris = await runInTransaction(async (tx) => {
    const attachmentRows = await tx.getAllAsync<{ local_uri: string }>(
      `SELECT local_uri FROM local_attachments WHERE survey_id = ?`,
      [row.survey_id],
    )
    await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    await tx.runAsync(`DELETE FROM local_attachments WHERE survey_id = ?`, [row.survey_id])
    await tx.runAsync(`DELETE FROM local_surveys WHERE id = ?`, [row.survey_id])
    return attachmentRows.map((attachmentRow) => attachmentRow.local_uri)
  })

  // D-09: files are freed only after the deleting transaction commits, and
  // only best-effort — deleteAttachmentFile is a no-op outside the
  // attachments dir, and any failure here must not undo the DB delete above.
  await Promise.all(deletedUris.map((uri) => deleteAttachmentFile(uri).catch(() => undefined)))
}

async function markAttachmentDeleteRowSynced(row: QueueRow): Promise<void> {
  await runInTransaction(async (tx) => {
    await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
  })
}

async function uploadAttachmentAndMarkSynced(
  row: QueueRow,
  payload: AttachmentQueuePayload,
  target: UploadTargetResponse,
  apiUrl: string,
  accessToken: string,
): Promise<void> {
  const uploadTarget = resolveUploadTarget(apiUrl, target.upload_url)
  const confirmUrl = target.confirm_url ?? target.upload_url
  const confirmTarget = resolveUploadTarget(apiUrl, confirmUrl)
  const isApiUploadTarget =
    uploadTarget.includes("/surveys/") &&
    uploadTarget.includes("/attachments/") &&
    uploadTarget.includes("/upload?token=")

  // D-15: streams the file from disk via createUploadTask (120s cancellation)
  // instead of loading it into memory as a blob.
  const uploadResponse = await uploadAttachmentFile({
    uploadTarget,
    isApiUploadTarget,
    localUri: payload.local_uri,
    mimeType: payload.mime_type,
    accessToken,
  })

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    throw new Error(`UPLOAD_HTTP ${uploadResponse.status}`)
  }

  if (confirmTarget !== uploadTarget) {
    // confirmTarget is already an absolute URL (resolveUploadTarget); an
    // empty baseUrl keeps apiRequest's `${baseUrl}${path}` join a no-op.
    // Errors surface as ApiError so classifyUploadFailure can classify them
    // (D-07/D-15: every sync JSON call goes through apiRequest's timeout).
    await apiRequest({
      baseUrl: "",
      path: confirmTarget,
      method: "PUT",
      token: accessToken,
      expectJson: false,
    })
  }

  // D-08/D-17: only the local DB tail is transactional — a transaction never
  // spans network I/O, so the upload and confirm calls above run outside it.
  const now = new Date().toISOString()
  await runInTransaction(async (tx) => {
    await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    await tx.runAsync(
      `UPDATE local_attachments
       SET sync_state = 'synced',
           remote_attachment_id = ?,
           storage_key = ?,
           upload_url = ?,
           confirm_url = ?,
           last_sync_error = NULL,
           last_sync_error_code = NULL,
           last_sync_error_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [
        target.attachment_id,
        target.storage_key ?? null,
        target.upload_url,
        target.confirm_url ?? null,
        now,
        payload.local_attachment_id,
      ],
    )
  })
}

async function getLocalAttachmentById(
  db: DbExecutor,
  localAttachmentId: string,
): Promise<Pick<
  LocalAttachment,
  "id" | "remote_attachment_id" | "storage_key" | "upload_url" | "confirm_url"
> | null> {
  const row = await db.getFirstAsync<
    Pick<
      LocalAttachment,
      "id" | "remote_attachment_id" | "storage_key" | "upload_url" | "confirm_url"
    >
  >(
    `SELECT id, remote_attachment_id, storage_key, upload_url, confirm_url
     FROM local_attachments
     WHERE id = ?`,
    [localAttachmentId],
  )
  return row ?? null
}

async function saveAttachmentUploadTarget(
  db: DbExecutor,
  localAttachmentId: string,
  target: UploadTargetResponse,
): Promise<void> {
  await db.runAsync(
    `UPDATE local_attachments
     SET remote_attachment_id = ?,
         storage_key = ?,
         upload_url = ?,
         confirm_url = ?,
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         updated_at = ?
     WHERE id = ?`,
    [
      target.attachment_id,
      target.storage_key ?? null,
      target.upload_url,
      target.confirm_url ?? null,
      new Date().toISOString(),
      localAttachmentId,
    ],
  )
}

async function applyRemoteChanges(
  db: DbExecutor,
  surveys: RemoteSurvey[],
  attachments: RemoteAttachment[],
): Promise<{ surveys: number; attachments: number; deletedFileUris: string[] }> {
  const now = new Date().toISOString()
  let appliedSurveys = 0
  let appliedAttachments = 0
  // D-09: collected inside the transaction, deleted from disk only after it
  // commits (see pullChanges below) — a rolled-back page must not lose files.
  const deletedFileUris: string[] = []

  for (const survey of surveys) {
    if (!survey?.id) continue

    const existing = await db.getFirstAsync<{
      id: string
      sync_state: string
      sync_blocked: number
    }>(`SELECT id, sync_state, sync_blocked FROM local_surveys WHERE id = ?`, [survey.id])

    if (survey.deleted_at) {
      // D-07/T-01.5-27: a remote delete never wins over pending local work.
      // Only a survey_delete queued row is compatible with the survey
      // disappearing anyway; any other pending/failed row, or a
      // sync_blocked survey, keeps the survey and its attachments.
      if (existing) {
        const queueRows = await db.getAllAsync<{ payload: string }>(
          `SELECT payload FROM sync_queue WHERE survey_id = ? AND status IN ('pending', 'failed')`,
          [survey.id],
        )
        const hasNonDeleteQueueRow = queueRows.some(
          (queueRow) => !isSurveyDeleteQueuePayload(safeParseJson(queueRow.payload)),
        )
        if (hasNonDeleteQueueRow || existing.sync_blocked === 1) {
          continue
        }
      }
      const attachmentRows = await db.getAllAsync<{ local_uri: string }>(
        `SELECT local_uri FROM local_attachments WHERE survey_id = ?`,
        [survey.id],
      )
      deletedFileUris.push(...attachmentRows.map((attachmentRow) => attachmentRow.local_uri))
      await db.runAsync(`DELETE FROM sync_queue WHERE survey_id = ?`, [survey.id])
      await db.runAsync(`DELETE FROM local_attachments WHERE survey_id = ?`, [survey.id])
      await db.runAsync(`DELETE FROM local_surveys WHERE id = ?`, [survey.id])
      appliedSurveys += 1
      continue
    }

    const pendingQueue = await hasPendingQueueForSurvey(db, survey.id)

    if (!existing) {
      const payload = buildSurveyPayloadFromRemote(survey)
      const createdAt = survey.created_at ?? now
      await db.runAsync(
        `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'synced', NULL, NULL, NULL, 0, ?, ?, ?)`,
        [
          survey.id,
          survey.site_name ?? "Remote survey",
          survey.status ?? "draft",
          (survey.visibility as "private" | "public" | undefined) ?? "private",
          survey.sync_version ?? 1,
          JSON.stringify(payload),
          createdAt,
          now,
        ],
      )
      appliedSurveys += 1
      continue
    }

    // D-07/T-01.5-27: never overwrite a survey with a pending queue row or a
    // sync_blocked survey — that would silently discard local work.
    if (!pendingQueue && existing.sync_blocked !== 1) {
      const payload = buildSurveyPayloadFromRemote(survey)
      await db.runAsync(
        `UPDATE local_surveys
         SET site_name = ?,
             status = ?,
             visibility = ?,
             sync_version = ?,
             sync_state = 'synced',
             last_sync_error = NULL,
             last_sync_error_code = NULL,
             last_sync_error_at = NULL,
             sync_blocked = 0,
             payload_json = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          survey.site_name ?? "Remote survey",
          survey.status ?? "draft",
          (survey.visibility as "private" | "public" | undefined) ?? "private",
          survey.sync_version ?? 1,
          JSON.stringify(payload),
          now,
          survey.id,
        ],
      )
      appliedSurveys += 1
    }
  }

  for (const attachment of attachments) {
    if (!attachment?.id || !attachment.survey_id) continue

    if (attachment.deleted_at) {
      const deletedRow = await db.getFirstAsync<{ local_uri: string }>(
        `SELECT local_uri FROM local_attachments WHERE remote_attachment_id = ? OR id = ? LIMIT 1`,
        [attachment.id, `remote-${attachment.id}`],
      )
      if (deletedRow?.local_uri) {
        deletedFileUris.push(deletedRow.local_uri)
      }
      await db.runAsync(
        `DELETE FROM local_attachments
         WHERE remote_attachment_id = ?
            OR id = ?`,
        [attachment.id, `remote-${attachment.id}`],
      )
      appliedAttachments += 1
      continue
    }

    const existing = await db.getFirstAsync<{ id: string; file_state: string }>(
      `SELECT id, file_state
       FROM local_attachments
       WHERE remote_attachment_id = ?
          OR id = ?
       LIMIT 1`,
      [attachment.id, `remote-${attachment.id}`],
    )

    if (!existing) {
      // A brand-new pulled attachment has no local file — file_state
      // 'remote' tells plan 06's on-demand download it needs fetching.
      await db.runAsync(
        `INSERT INTO local_attachments (
           id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, file_state, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, NULL, NULL, NULL, NULL, NULL, 'remote', ?, ?)`,
        [
          `remote-${attachment.id}`,
          attachment.survey_id,
          "",
          attachment.mime_type ?? "application/octet-stream",
          attachment.size_bytes ?? 0,
          attachment.id,
          attachment.storage_key ?? null,
          now,
          now,
        ],
      )
    } else {
      // D-11: local_uri is never touched here. file_state only moves from
      // 'unavailable' back to 'remote' — the server announced a change to
      // this attachment (e.g. its upload finally completed), so plan 06's
      // on-demand download gets one more chance; 'local' and 'missing' are
      // left alone.
      const nextFileState = existing.file_state === "unavailable" ? "remote" : existing.file_state
      await db.runAsync(
        `UPDATE local_attachments
         SET survey_id = ?,
             mime_type = ?,
             size_bytes = ?,
             sync_state = 'synced',
             remote_attachment_id = ?,
             storage_key = ?,
             last_sync_error = NULL,
             last_sync_error_code = NULL,
             last_sync_error_at = NULL,
             file_state = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          attachment.survey_id,
          attachment.mime_type ?? "application/octet-stream",
          attachment.size_bytes ?? 0,
          attachment.id,
          attachment.storage_key ?? null,
          nextFileState,
          now,
          existing.id,
        ],
      )
    }

    appliedAttachments += 1
  }

  return { surveys: appliedSurveys, attachments: appliedAttachments, deletedFileUris }
}

function buildSurveyPayloadFromRemote(survey: RemoteSurvey): SurveyQueuePayload {
  return {
    id: survey.id,
    sync_version: survey.sync_version ?? 1,
    site_name: survey.site_name ?? "Remote survey",
    status: survey.status ?? "draft",
    visibility: (survey.visibility as "private" | "public" | undefined) ?? "private",
    parcel_ids: normalizeParcelIds(survey.parcel_ids),
    region_version: survey.region_version ?? undefined,
    vegetation_stage: survey.vegetation_stage ?? undefined,
    factors: survey.factors ?? {},
    scores: survey.scores ?? {},
    expires_at: survey.expires_at ?? undefined,
  }
}

async function getMetaValue(db: DbExecutor, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value
     FROM local_meta
     WHERE key = ?`,
    [key],
  )
  return row?.value ?? null
}

async function setMetaValue(db: DbExecutor, key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  await db.runAsync(
    `INSERT INTO local_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, value, now],
  )
}

/**
 * D-05/D-14: the 8-attempt retry cap only applies to "unknown" failures.
 * "fatal" blocks the queue row on the first attempt; "retryable" (network,
 * timeout, 5xx, 429) never increments retry_count and never blocks; "unknown"
 * increments retry_count and, once it reaches MAX_RETRY_COUNT, is treated as
 * fatal with a "retry cap reached" message so deriveSurveyErrorCode/
 * deriveAttachmentErrorCode naturally produce the "retry_cap_reached" code.
 */
function resolveFailureOutcome(
  classification: FailureClassification,
  retryCount: number,
  message: string,
): { terminal: boolean; finalMessage: string; nextRetryCount: number | null } {
  if (classification === "fatal") {
    return { terminal: true, finalMessage: message, nextRetryCount: null }
  }

  if (classification === "retryable") {
    return { terminal: false, finalMessage: message, nextRetryCount: null }
  }

  // "unknown" — the only class that counts toward the cap.
  const nextRetryCount = retryCount + 1
  if (nextRetryCount >= MAX_RETRY_COUNT) {
    return {
      terminal: true,
      finalMessage: `${message} | retry cap reached (${MAX_RETRY_COUNT})`,
      nextRetryCount,
    }
  }
  return { terminal: false, finalMessage: message, nextRetryCount }
}

async function handleSurveySyncFailure(
  row: QueueRow,
  message: string,
  options: FailureOptions,
): Promise<void> {
  const now = new Date()
  const nowIso = now.toISOString()
  const { terminal, finalMessage, nextRetryCount } = resolveFailureOutcome(
    options.classification,
    row.retry_count,
    message,
  )
  const errorCode = options.errorCode ?? deriveSurveyErrorCode(finalMessage)

  await runInTransaction(async (tx) => {
    if (terminal) {
      await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    } else if (nextRetryCount !== null) {
      // "unknown", not yet capped: count the attempt.
      await tx.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [nextRetryCount, computeNextRetryAt(now, nextRetryCount), nowIso, row.id],
      )
    } else {
      // "retryable": never counted, retry_count stays untouched.
      await tx.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [computeNextRetryAt(now, Math.max(1, row.retry_count)), nowIso, row.id],
      )
    }

    await tx.runAsync(
      `UPDATE local_surveys
       SET sync_state = 'failed',
           status = CASE
             WHEN status IN ('submitted', 'expired') THEN status
             ELSE 'error'
           END,
           last_sync_error = ?,
           last_sync_error_code = ?,
           last_sync_error_at = ?,
           sync_blocked = ?,
           updated_at = ?
       WHERE id = ?`,
      [finalMessage, errorCode, nowIso, terminal ? 1 : 0, nowIso, row.survey_id],
    )
  })
}

/**
 * D-10: a LocalFileMissingError is always fatal and additionally marks the
 * attachment row 'missing' in the same transaction as the failure write,
 * instead of being classified generically like any other upload error.
 */
function buildUploadFailureOptions(error: unknown): FailureOptions {
  if (error instanceof LocalFileMissingError) {
    return { classification: "fatal", errorCode: "local_file_missing", markFileMissing: true }
  }
  return { classification: classifyUploadFailure(error) }
}

async function handleAttachmentSyncFailure(
  row: QueueRow,
  payload: AttachmentQueuePayload,
  message: string,
  options: FailureOptions,
): Promise<void> {
  const now = new Date()
  const nowIso = now.toISOString()
  const { terminal, finalMessage, nextRetryCount } = resolveFailureOutcome(
    options.classification,
    row.retry_count,
    message,
  )
  const errorCode = options.errorCode ?? deriveAttachmentErrorCode(finalMessage)

  await runInTransaction(async (tx) => {
    if (terminal) {
      await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    } else if (nextRetryCount !== null) {
      await tx.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [nextRetryCount, computeNextRetryAt(now, nextRetryCount), nowIso, row.id],
      )
    } else {
      await tx.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [computeNextRetryAt(now, Math.max(1, row.retry_count)), nowIso, row.id],
      )
    }

    await tx.runAsync(
      `UPDATE local_attachments
       SET sync_state = 'failed',
           last_sync_error = ?,
           last_sync_error_code = ?,
           last_sync_error_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [finalMessage, errorCode, nowIso, nowIso, payload.local_attachment_id],
    )

    if (options.markFileMissing) {
      // D-10: the local_attachments row is never deleted by this path — the
      // above UPDATE already recorded the failure; this additionally flips
      // file_state to 'missing' in the same transaction.
      await markAttachmentFileMissing(tx, payload.local_attachment_id)
    }
  })
}

async function handleAttachmentDeleteSyncFailure(
  row: QueueRow,
  message: string,
  options: FailureOptions,
): Promise<void> {
  const now = new Date()
  const nowIso = now.toISOString()
  const { terminal, nextRetryCount } = resolveFailureOutcome(
    options.classification,
    row.retry_count,
    message,
  )

  await runInTransaction(async (tx) => {
    if (terminal) {
      await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
      return
    }

    if (nextRetryCount !== null) {
      await tx.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [nextRetryCount, computeNextRetryAt(now, nextRetryCount), nowIso, row.id],
      )
      return
    }

    await tx.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [computeNextRetryAt(now, Math.max(1, row.retry_count)), nowIso, row.id],
    )
  })
}

async function queueSurveyVisibilityChange(
  surveyId: string,
  visibility: "private" | "public",
): Promise<{ changed: boolean }> {
  return runInTransaction(async (tx) => {
    const survey = await tx.getFirstAsync<{
      id: string
      visibility: string | null
      payload_json: string | null
    }>(
      `SELECT id, visibility, payload_json
       FROM local_surveys
       WHERE id = ?`,
      [surveyId],
    )

    if (!survey?.id) {
      throw new Error(`Unknown local survey: ${surveyId}`)
    }

    const currentVisibility = survey.visibility === "public" ? "public" : "private"
    if (currentVisibility === visibility) {
      return { changed: false }
    }

    const now = new Date().toISOString()
    const queueRows = await tx.getAllAsync<Array<{ id: number; payload: string }>[number]>(
      `SELECT id, payload
       FROM sync_queue
       WHERE survey_id = ?`,
      [surveyId],
    )

    let hasDeleteQueued = false
    let upsertRowsUpdated = 0
    const staleVisibilityRowIds: number[] = []

    for (const row of queueRows) {
      const parsed = safeParseJson(row.payload)

      if (isSurveyDeleteQueuePayload(parsed)) {
        hasDeleteQueued = true
        continue
      }

      if (isSurveyQueuePayload(parsed)) {
        const nextPayload: SurveyQueuePayload = {
          ...parsed,
          visibility,
        }
        await tx.runAsync(
          `UPDATE sync_queue
           SET payload = ?, status = 'pending', retry_count = 0, next_retry_at = NULL, updated_at = ?
           WHERE id = ?`,
          [JSON.stringify(nextPayload), now, row.id],
        )
        upsertRowsUpdated += 1
        continue
      }

      if (isSurveyVisibilityQueuePayload(parsed)) {
        staleVisibilityRowIds.push(row.id)
      }
    }

    if (hasDeleteQueued) {
      throw new Error(`Survey ${surveyId} already has a queued delete operation`)
    }

    for (const rowId of staleVisibilityRowIds) {
      await tx.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [rowId])
    }

    if (upsertRowsUpdated === 0) {
      const queuePayload: SurveyVisibilityQueuePayload = {
        kind: "survey_visibility_update",
        survey_id: surveyId,
        visibility,
      }

      await tx.runAsync(
        `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
         VALUES (?, 'survey_visibility', ?, 'pending', 0, NULL, ?, ?)`,
        [surveyId, JSON.stringify(queuePayload), now, now],
      )
    }

    let payloadJson: string | null = survey.payload_json ?? null
    if (payloadJson) {
      const parsedPayload = safeParseJson(payloadJson)
      if (parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)) {
        payloadJson = JSON.stringify({
          ...(parsedPayload as Record<string, unknown>),
          visibility,
        })
      }
    }

    await tx.runAsync(
      `UPDATE local_surveys
       SET visibility = ?,
           sync_state = 'pending',
           last_sync_error = NULL,
           last_sync_error_code = NULL,
           last_sync_error_at = NULL,
           sync_blocked = 0,
           payload_json = COALESCE(?, payload_json),
           updated_at = ?
       WHERE id = ?`,
      [visibility, payloadJson, now, surveyId],
    )

    return { changed: true }
  })
}

/**
 * The unguarded drain body (D-03). Only reachable through the exported
 * `syncPending`, which wraps it in the "sync" flight, or through
 * this module's own opportunistic pull-after-drain call below, which reaches
 * into `pullChanges` directly rather than through the guarded
 * `pullRemoteChanges` export (calling the guarded export here would deadlock
 * on the flight this function itself is running under).
 */
async function drainQueue(
  apiUrl: string,
  accessToken: string,
): Promise<{ synced: number; failed: number; pulled_surveys: number; pulled_attachments: number }> {
  const db = await getDb()
  const nowIso = new Date().toISOString()

  const queueRows = await db.getAllAsync<QueueRow>(
    `SELECT id, survey_id, payload, status, retry_count, next_retry_at, op_type
     FROM sync_queue
     WHERE status IN ('pending', 'failed')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY id ASC`,
    [nowIso],
  )

  let synced = 0
  let failed = 0
  const operationRows = new Map<
    string,
    {
      row: QueueRow
      payload:
        | SurveyQueuePayload
        | AttachmentQueuePayload
        | AttachmentDeleteQueuePayload
        | SurveyDeleteQueuePayload
        | SurveyVisibilityQueuePayload
    }
  >()
  const operations: SyncBatchOperation[] = []
  const uploadOnlyRows: Array<{
    row: QueueRow
    payload: AttachmentQueuePayload
    target: UploadTargetResponse
  }> = []

  for (const row of queueRows) {
    const parsedPayload = safeParseJson(row.payload)

    if (isAttachmentQueuePayload(parsedPayload)) {
      const existingAttachment = await getLocalAttachmentById(db, parsedPayload.local_attachment_id)
      if (existingAttachment?.remote_attachment_id && existingAttachment.upload_url) {
        uploadOnlyRows.push({
          row,
          payload: parsedPayload,
          target: {
            attachment_id: existingAttachment.remote_attachment_id,
            storage_key: existingAttachment.storage_key ?? "",
            upload_url: existingAttachment.upload_url,
            confirm_url: existingAttachment.confirm_url ?? undefined,
          },
        })
        continue
      }

      const clientRef = String(row.id)
      operationRows.set(clientRef, { row, payload: parsedPayload })
      operations.push({
        client_ref: clientRef,
        entity: "attachment",
        action: "create",
        survey_id: parsedPayload.survey_id,
        payload: {
          mime_type: parsedPayload.mime_type,
          size_bytes: parsedPayload.size_bytes,
          captured_at: parsedPayload.captured_at ?? null,
          metadata: parsedPayload.metadata ?? {},
        },
      })
      continue
    }

    if (isAttachmentDeleteQueuePayload(parsedPayload)) {
      const clientRef = String(row.id)
      operationRows.set(clientRef, { row, payload: parsedPayload })
      operations.push({
        client_ref: clientRef,
        entity: "attachment",
        action: "delete",
        survey_id: parsedPayload.survey_id,
        payload: {
          attachment_id: parsedPayload.attachment_id,
        },
      })
      continue
    }

    if (isSurveyQueuePayload(parsedPayload)) {
      const clientRef = String(row.id)
      operationRows.set(clientRef, { row, payload: parsedPayload })
      operations.push({
        client_ref: clientRef,
        entity: "survey",
        action: "upsert",
        payload: parsedPayload,
      })
      continue
    }

    if (isSurveyDeleteQueuePayload(parsedPayload)) {
      const clientRef = String(row.id)
      operationRows.set(clientRef, { row, payload: parsedPayload })
      operations.push({
        client_ref: clientRef,
        entity: "survey",
        action: "delete",
        survey_id: parsedPayload.survey_id,
        payload: {
          id: parsedPayload.survey_id,
        },
      })
      continue
    }

    if (isSurveyVisibilityQueuePayload(parsedPayload)) {
      const clientRef = String(row.id)
      operationRows.set(clientRef, { row, payload: parsedPayload })
      operations.push({
        client_ref: clientRef,
        entity: "survey",
        action: "visibility_update",
        survey_id: parsedPayload.survey_id,
        payload: {
          visibility: parsedPayload.visibility,
        },
      })
      continue
    }

    failed += 1
    await handleSurveySyncFailure(row, "Invalid sync payload", {
      classification: "fatal",
      errorCode: "invalid_local_payload",
    })
  }

  // D-04: send at most SYNC_BATCH_SIZE operations per POST /sync, in queue
  // order. A batch-level failure (not auth) marks that chunk's rows and
  // stops processing the remaining chunks for this run — they stay untouched
  // (still 'pending', retry_count 0) for the next drain.
  for (let start = 0; start < operations.length; start += SYNC_BATCH_SIZE) {
    const chunkOps = operations.slice(start, start + SYNC_BATCH_SIZE)
    let batchResults: SyncBatchResult[] = []
    let batchFailed = false

    try {
      const response = await apiRequest<SyncBatchResponse>({
        baseUrl: apiUrl,
        path: "/sync",
        method: "POST",
        token: accessToken,
        json: { operations: chunkOps },
        timeoutMs: SYNC_BATCH_TIMEOUT_MS,
      })

      if (!Array.isArray(response?.results)) {
        // Counted as unknown (D-14): the server responded but the batch
        // envelope itself is malformed, which is not distinguishable from
        // an ambiguous client-side bug.
        throw new Error("Invalid sync batch response")
      }
      batchResults = response.results
    } catch (error) {
      const classification = classifyRequestError(error)
      if (classification === "auth") {
        // D-05/T-01.5-31: a batch-level 401/403 means the token is stale,
        // not that these operations failed — leave every row untouched and
        // let withAuthRetry refresh the token and retry the whole batch.
        throw error
      }

      const message = (error as Error).message
      for (const operation of chunkOps) {
        failed += 1
        const linked = operationRows.get(operation.client_ref)
        if (!linked) continue

        if (isAttachmentQueuePayload(linked.payload)) {
          await handleAttachmentSyncFailure(linked.row, linked.payload, message, {
            classification,
          })
        } else if (isAttachmentDeleteQueuePayload(linked.payload)) {
          await handleAttachmentDeleteSyncFailure(linked.row, message, {
            classification,
          })
        } else {
          await handleSurveySyncFailure(linked.row, message, {
            classification,
          })
        }
      }
      batchFailed = true
    }

    if (!batchFailed) {
      for (const result of batchResults) {
        const clientRef = result.client_ref ?? ""
        const linked = operationRows.get(clientRef)
        if (!linked) {
          continue
        }

        const message = buildSyncResultMessage(result)

        if (result.status === "synced") {
          if (isAttachmentQueuePayload(linked.payload)) {
            const target = toUploadTarget(result.data)
            if (!target) {
              failed += 1
              await handleAttachmentSyncFailure(
                linked.row,
                linked.payload,
                "Invalid attachment sync response",
                {
                  classification: "fatal",
                  errorCode: "invalid_attachment_response",
                },
              )
              continue
            }

            await saveAttachmentUploadTarget(db, linked.payload.local_attachment_id, target)

            try {
              await uploadAttachmentAndMarkSynced(
                linked.row,
                linked.payload,
                target,
                apiUrl,
                accessToken,
              )
              synced += 1
            } catch (error) {
              failed += 1
              await handleAttachmentSyncFailure(
                linked.row,
                linked.payload,
                (error as Error).message,
                buildUploadFailureOptions(error),
              )
            }
          } else if (isAttachmentDeleteQueuePayload(linked.payload)) {
            try {
              await markAttachmentDeleteRowSynced(linked.row)
              synced += 1
            } catch {
              // D-08/D-17: the write was rolled back — leave the row for the
              // next run instead of letting the whole drain crash.
              failed += 1
            }
          } else {
            try {
              if (isSurveyDeleteQueuePayload(linked.payload)) {
                await markSurveyDeleteRowSynced(linked.row)
              } else {
                await markSurveyQueueRowSynced(linked.row)
              }
              synced += 1
            } catch {
              // D-08/D-17: same rollback-and-continue treatment as above.
              failed += 1
            }
          }
          continue
        }

        const classification = classifyBatchResult(result)

        if (isAttachmentQueuePayload(linked.payload)) {
          failed += 1
          await handleAttachmentSyncFailure(linked.row, linked.payload, message, {
            classification,
            errorCode: result.error?.code,
          })
        } else if (isAttachmentDeleteQueuePayload(linked.payload)) {
          failed += 1
          await handleAttachmentDeleteSyncFailure(linked.row, message, {
            classification,
            errorCode: result.error?.code,
          })
        } else {
          failed += 1
          await handleSurveySyncFailure(linked.row, message, {
            classification,
            errorCode: result.error?.code,
          })
        }
      }
    }

    if (batchFailed) {
      break
    }
  }

  for (const item of uploadOnlyRows) {
    try {
      await uploadAttachmentAndMarkSynced(item.row, item.payload, item.target, apiUrl, accessToken)
      synced += 1
    } catch (error) {
      failed += 1
      await handleAttachmentSyncFailure(
        item.row,
        item.payload,
        (error as Error).message,
        buildUploadFailureOptions(error),
      )
    }
  }

  // Calls pullChanges directly (never the guarded pullRemoteChanges export):
  // this function already runs inside the "sync" flight, so going through
  // the guarded export here would wait on a flight it is itself holding.
  const pulled = await pullChanges(apiUrl, accessToken).catch(() => ({
    surveys: 0,
    attachments: 0,
    pages: 0,
    has_more: false,
  }))

  return {
    synced,
    failed,
    pulled_surveys: pulled.surveys,
    pulled_attachments: pulled.attachments,
  }
}

/**
 * The unguarded pull body (D-03). Reachable through the exported
 * `pullRemoteChanges` (guarded) or directly from `drainQueue` above
 * (unguarded, opportunistic pull at the end of a drain).
 */
async function pullChanges(
  apiUrl: string,
  accessToken: string,
  options?: { maxPages?: number; limit?: number },
): Promise<{ surveys: number; attachments: number; pages: number; has_more: boolean }> {
  const db = await getDb()
  const maxPages = Math.max(1, Math.min(10, options?.maxPages ?? 5))
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50))

  let cursor = await getMetaValue(db, "downsync_cursor")
  let pages = 0
  let totalSurveys = 0
  let totalAttachments = 0
  let hasMore = false

  for (let index = 0; index < maxPages; index += 1) {
    const payload = await apiRequest<SyncChangesResponse>({
      baseUrl: apiUrl,
      path: buildSyncChangesPath(cursor, limit),
      method: "GET",
      token: accessToken,
    })
    const surveys = Array.isArray(payload.surveys) ? payload.surveys : []
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : []
    const nextCursor =
      payload.cursor_out && payload.cursor_out !== cursor ? payload.cursor_out : null

    // D-08/D-17: a pulled page and its cursor advance together. If applying
    // the page throws (e.g. a local write fails), the whole transaction —
    // including the cursor write — rolls back, so a retried pull re-fetches
    // the same page instead of silently skipping it.
    const applied = await runInTransaction(async (tx) => {
      const result = await applyRemoteChanges(tx, surveys, attachments)
      if (nextCursor) {
        await setMetaValue(tx, "downsync_cursor", nextCursor)
      }
      return result
    })

    // D-09: files freed only after the page's transaction commits, best-effort.
    await Promise.all(
      applied.deletedFileUris.map((uri) => deleteAttachmentFile(uri).catch(() => undefined)),
    )

    totalSurveys += applied.surveys
    totalAttachments += applied.attachments
    pages += 1

    if (nextCursor) {
      cursor = nextCursor
    }

    hasMore = Boolean(payload.has_more)
    if (!hasMore) {
      break
    }
  }

  return {
    surveys: totalSurveys,
    attachments: totalAttachments,
    pages,
    has_more: hasMore,
  }
}

/**
 * Guarded drain entry point (D-03). Concurrent calls join the same in-flight
 * run and share its result; a concurrent `pullRemoteChanges` call waits for
 * this to settle before starting its own flight.
 */
export function syncPending(
  apiUrl: string,
  accessToken: string,
): Promise<{ synced: number; failed: number; pulled_surveys: number; pulled_attachments: number }> {
  return syncFlight.run("sync", () => drainQueue(apiUrl, accessToken))
}

/**
 * Guarded pull entry point (D-03). Concurrent calls join the same in-flight
 * run and share its result; a concurrent `syncPending` call waits for this to
 * settle before starting its own flight.
 */
export function pullRemoteChanges(
  apiUrl: string,
  accessToken: string,
  options?: { maxPages?: number; limit?: number },
): Promise<{ surveys: number; attachments: number; pages: number; has_more: boolean }> {
  return syncFlight.run("pull", () => pullChanges(apiUrl, accessToken, options))
}

export async function submitSurvey(
  apiUrl: string,
  accessToken: string,
  surveyId: string,
): Promise<{ ok: boolean; message: string }> {
  const db = await getDb()

  try {
    await apiRequest({
      baseUrl: apiUrl,
      path: `/surveys/${surveyId}/submit`,
      method: "POST",
      token: accessToken,
      expectJson: false,
    })
  } catch (error) {
    if (!(error instanceof ApiError)) {
      // Non-HTTP errors (network, timeout-as-thrown-before-status) propagate
      // as before — this function does not classify them.
      throw error
    }

    const body = error.body as { errors?: string[]; message?: string } | null
    const message =
      (Array.isArray(body?.errors) && body.errors.length > 0
        ? body.errors.join(" | ")
        : undefined) ??
      body?.message ??
      error.message
    const nowIso = new Date().toISOString()
    const isExpiredSubmit =
      /survey is expired|survey_expired|expired and cannot be submitted/i.test(message)
    const isValidationSubmit = error.status === 422

    if (isExpiredSubmit) {
      await markSurveyExpiredLocally(surveyId)
    } else if (isValidationSubmit) {
      await db.runAsync(
        `UPDATE local_surveys
         SET status = CASE
               WHEN status = 'expired' THEN 'expired'
               ELSE 'draft'
             END,
             sync_state = 'synced',
             last_sync_error = ?,
             last_sync_error_code = 'submit_validation',
             last_sync_error_at = ?,
             sync_blocked = 0,
             updated_at = ?
         WHERE id = ?`,
        [message, nowIso, nowIso, surveyId],
      )
    } else {
      await db.runAsync(
        `UPDATE local_surveys
         SET status = CASE
               WHEN status IN ('submitted', 'expired') THEN status
               ELSE 'error'
             END,
             sync_state = 'failed',
             last_sync_error = ?,
             last_sync_error_code = 'submit_failed',
             last_sync_error_at = ?,
             sync_blocked = 1,
             updated_at = ?
         WHERE id = ?`,
        [message, nowIso, nowIso, surveyId],
      )
    }

    return { ok: false, message }
  }

  await db.runAsync(
    `UPDATE local_surveys
     SET status = 'submitted',
         sync_state = 'synced',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         sync_blocked = 0,
         updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), surveyId],
  )

  return { ok: true, message: "Survey submitted" }
}

export async function updateSurveyVisibility(
  apiUrl: string,
  accessToken: string,
  surveyId: string,
  visibility: "private" | "public",
): Promise<{
  ok: boolean
  message: string
  visibility?: "private" | "public"
  queued: boolean
  synced: boolean
}> {
  const queued = await queueSurveyVisibilityChange(surveyId, visibility)
  if (!queued.changed) {
    return {
      ok: true,
      message: `Visibility already ${visibility}`,
      visibility,
      queued: false,
      synced: false,
    }
  }

  if (!accessToken || accessToken.trim().length === 0) {
    return {
      ok: true,
      message: `Visibility queued locally (${visibility}). Login and sync to push changes.`,
      visibility,
      queued: true,
      synced: false,
    }
  }

  try {
    // D-03/C5: goes through the guarded export, so it joins an in-flight
    // drain instead of starting a second concurrent one.
    const result = await syncPending(apiUrl, accessToken)
    if (result.failed > 0) {
      return {
        ok: false,
        message: `Visibility queued locally, but sync reported ${result.failed} failed operation(s)`,
        visibility,
        queued: true,
        synced: false,
      }
    }

    return {
      ok: true,
      message: `Visibility set to ${visibility} and synced`,
      visibility,
      queued: true,
      synced: true,
    }
  } catch (error) {
    return {
      ok: true,
      message: `Visibility queued locally (${visibility}); sync pending (${(error as Error).message})`,
      visibility,
      queued: true,
      synced: false,
    }
  }
}
