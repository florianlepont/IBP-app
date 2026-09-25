import * as SQLite from "expo-sqlite"
import { getDb, MAX_RETRY_COUNT } from "./db"
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

// D-07: POST /sync carries a longer timeout than the client default because a
// batch can contain many operations; every other sync JSON call (changes,
// confirm PUT, submit) uses apiRequest's normal per-request default.
const SYNC_BATCH_TIMEOUT_MS = 60_000

type FailureOptions = {
  classification: FailureClassification
  errorCode?: string
}

async function markSurveyQueueRowSynced(db: SQLite.SQLiteDatabase, row: QueueRow): Promise<void> {
  const now = new Date().toISOString()
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
  await db.runAsync(
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
     WHERE id = ?`,
    [now, row.survey_id],
  )
}

async function markSurveyDeleteRowSynced(db: SQLite.SQLiteDatabase, row: QueueRow): Promise<void> {
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
  await db.runAsync(`DELETE FROM local_attachments WHERE survey_id = ?`, [row.survey_id])
  await db.runAsync(`DELETE FROM local_surveys WHERE id = ?`, [row.survey_id])
}

async function uploadAttachmentAndMarkSynced(
  db: SQLite.SQLiteDatabase,
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

  const uploadResponse = isApiUploadTarget
    ? await uploadFileViaApi(uploadTarget, payload, accessToken)
    : await uploadFileDirect(uploadTarget, payload)

  if (!uploadResponse.ok) {
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

  const now = new Date().toISOString()
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
  await db.runAsync(
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
}

async function uploadFileViaApi(
  uploadTarget: string,
  payload: AttachmentQueuePayload,
  accessToken: string,
): Promise<Response> {
  const form = new FormData()
  const file = {
    uri: payload.local_uri,
    type: payload.mime_type,
    name: `attachment-${payload.local_attachment_id}`,
  } as unknown as Blob
  form.append("file", file)

  return fetch(uploadTarget, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  })
}

async function uploadFileDirect(
  uploadTarget: string,
  payload: AttachmentQueuePayload,
): Promise<Response> {
  const fileResponse = await fetch(payload.local_uri)
  if (!fileResponse.ok) {
    throw new Error(`LOCAL_FILE_HTTP ${fileResponse.status}`)
  }
  const blob = await fileResponse.blob()

  return fetch(uploadTarget, {
    method: "PUT",
    headers: {
      "Content-Type": payload.mime_type,
    },
    body: blob,
  })
}

async function getLocalAttachmentById(
  db: SQLite.SQLiteDatabase,
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
  db: SQLite.SQLiteDatabase,
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
  db: SQLite.SQLiteDatabase,
  surveys: RemoteSurvey[],
  attachments: RemoteAttachment[],
): Promise<{ surveys: number; attachments: number }> {
  const now = new Date().toISOString()
  let appliedSurveys = 0
  let appliedAttachments = 0

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

  return { surveys: appliedSurveys, attachments: appliedAttachments }
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

async function getMetaValue(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value
     FROM local_meta
     WHERE key = ?`,
    [key],
  )
  return row?.value ?? null
}

async function setMetaValue(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
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
  db: SQLite.SQLiteDatabase,
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

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
  } else if (nextRetryCount !== null) {
    // "unknown", not yet capped: count the attempt.
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetryCount, computeNextRetryAt(now, nextRetryCount), nowIso, row.id],
    )
  } else {
    // "retryable": never counted, retry_count stays untouched.
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [computeNextRetryAt(now, Math.max(1, row.retry_count)), nowIso, row.id],
    )
  }

  await db.runAsync(
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
}

async function handleAttachmentSyncFailure(
  db: SQLite.SQLiteDatabase,
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

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
  } else if (nextRetryCount !== null) {
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetryCount, computeNextRetryAt(now, nextRetryCount), nowIso, row.id],
    )
  } else {
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [computeNextRetryAt(now, Math.max(1, row.retry_count)), nowIso, row.id],
    )
  }

  await db.runAsync(
    `UPDATE local_attachments
     SET sync_state = 'failed',
         last_sync_error = ?,
         last_sync_error_code = ?,
         last_sync_error_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [finalMessage, errorCode, nowIso, nowIso, payload.local_attachment_id],
  )
}

async function handleAttachmentDeleteSyncFailure(
  db: SQLite.SQLiteDatabase,
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

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    return
  }

  if (nextRetryCount !== null) {
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetryCount, computeNextRetryAt(now, nextRetryCount), nowIso, row.id],
    )
    return
  }

  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'failed', next_retry_at = ?, updated_at = ?
     WHERE id = ?`,
    [computeNextRetryAt(now, Math.max(1, row.retry_count)), nowIso, row.id],
  )
}

async function queueSurveyVisibilityChange(
  db: SQLite.SQLiteDatabase,
  surveyId: string,
  visibility: "private" | "public",
): Promise<{ changed: boolean }> {
  const survey = await db.getFirstAsync<{
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
  const queueRows = await db.getAllAsync<Array<{ id: number; payload: string }>[number]>(
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
      await db.runAsync(
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
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [rowId])
  }

  if (upsertRowsUpdated === 0) {
    const queuePayload: SurveyVisibilityQueuePayload = {
      kind: "survey_visibility_update",
      survey_id: surveyId,
      visibility,
    }

    await db.runAsync(
      `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
       VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
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

  await db.runAsync(
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
}

export async function syncPending(
  apiUrl: string,
  accessToken: string,
): Promise<{ synced: number; failed: number; pulled_surveys: number; pulled_attachments: number }> {
  const db = await getDb()
  const nowIso = new Date().toISOString()

  const queueRows = await db.getAllAsync<QueueRow>(
    `SELECT id, survey_id, payload, status, retry_count, next_retry_at
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
    await handleSurveySyncFailure(db, row, "Invalid sync payload", {
      classification: "fatal",
      errorCode: "invalid_local_payload",
    })
  }

  if (operations.length > 0) {
    let batchResults: SyncBatchResult[] = []

    try {
      const response = await apiRequest<SyncBatchResponse>({
        baseUrl: apiUrl,
        path: "/sync",
        method: "POST",
        token: accessToken,
        json: { operations },
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
      for (const operation of operations) {
        failed += 1
        const linked = operationRows.get(operation.client_ref)
        if (!linked) continue

        if (isAttachmentQueuePayload(linked.payload)) {
          await handleAttachmentSyncFailure(db, linked.row, linked.payload, message, {
            classification,
          })
        } else if (isAttachmentDeleteQueuePayload(linked.payload)) {
          await handleAttachmentDeleteSyncFailure(db, linked.row, message, {
            classification,
          })
        } else {
          await handleSurveySyncFailure(db, linked.row, message, {
            classification,
          })
        }
      }
      batchResults = []
    }

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
              db,
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
              db,
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
              db,
              linked.row,
              linked.payload,
              (error as Error).message,
              {
                classification: classifyUploadFailure(error),
              },
            )
          }
        } else if (isAttachmentDeleteQueuePayload(linked.payload)) {
          await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [linked.row.id])
          synced += 1
        } else {
          if (isSurveyDeleteQueuePayload(linked.payload)) {
            await markSurveyDeleteRowSynced(db, linked.row)
          } else {
            await markSurveyQueueRowSynced(db, linked.row)
          }
          synced += 1
        }
        continue
      }

      const classification = classifyBatchResult(result)

      if (isAttachmentQueuePayload(linked.payload)) {
        failed += 1
        await handleAttachmentSyncFailure(db, linked.row, linked.payload, message, {
          classification,
          errorCode: result.error?.code,
        })
      } else if (isAttachmentDeleteQueuePayload(linked.payload)) {
        failed += 1
        await handleAttachmentDeleteSyncFailure(db, linked.row, message, {
          classification,
          errorCode: result.error?.code,
        })
      } else {
        failed += 1
        await handleSurveySyncFailure(db, linked.row, message, {
          classification,
          errorCode: result.error?.code,
        })
      }
    }
  }

  for (const item of uploadOnlyRows) {
    try {
      await uploadAttachmentAndMarkSynced(
        db,
        item.row,
        item.payload,
        item.target,
        apiUrl,
        accessToken,
      )
      synced += 1
    } catch (error) {
      failed += 1
      await handleAttachmentSyncFailure(db, item.row, item.payload, (error as Error).message, {
        classification: classifyUploadFailure(error),
      })
    }
  }

  const pulled = await pullRemoteChanges(apiUrl, accessToken).catch(() => ({
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

export async function pullRemoteChanges(
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

    const applied = await applyRemoteChanges(db, surveys, attachments)
    totalSurveys += applied.surveys
    totalAttachments += applied.attachments
    pages += 1

    if (payload.cursor_out && payload.cursor_out !== cursor) {
      cursor = payload.cursor_out
      await setMetaValue(db, "downsync_cursor", cursor)
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
  const db = await getDb()
  const queued = await queueSurveyVisibilityChange(db, surveyId, visibility)
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
