import {
  SurveyQueuePayload,
  SurveyDeleteQueuePayload,
  SurveyVisibilityQueuePayload,
  AttachmentQueuePayload,
  AttachmentDeleteQueuePayload,
  UploadTargetResponse,
  SyncBatchResult,
  QueueOpType,
} from "./types"
import { FACTOR_KEYS, LEGACY_DEFAULT_FACTOR_VALUES } from "./db"
import type { DbExecutor } from "./transaction"
import { ApiError } from "../api/client"
import { LocalFileMissingError, UploadTimeoutError } from "./attachments"

export const isFilledValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "boolean") return true
  if (Array.isArray(value)) return value.some((item) => isFilledValue(item))
  if (typeof value === "object") {
    const objectValues = Object.values(value as Record<string, unknown>)
    return objectValues.some((item) => isFilledValue(item))
  }
  return false
}

export const normalizeParcelIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const output: string[] = []
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue
    }
    const normalized = candidate.trim().toUpperCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    output.push(normalized)
  }
  return output
}

export const resolvePayloadParcelIds = (payload: SurveyQueuePayload): string[] => {
  return normalizeParcelIds(payload.parcel_ids)
}

export const isLegacyDefaultFactorValue = (factorKey: string, rawValue: unknown): boolean => {
  const expected = LEGACY_DEFAULT_FACTOR_VALUES[factorKey]
  if (!expected || !rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return false
  }
  const value = rawValue as Record<string, unknown>
  const expectedKeys = Object.keys(expected)
  if (Object.keys(value).length !== expectedKeys.length) {
    return false
  }
  return expectedKeys.every((key) => typeof value[key] === "number" && value[key] === expected[key])
}

export const computeCompletionRate = (
  status: string,
  payload: SurveyQueuePayload | null,
): number => {
  if (status === "submitted") return 100
  if (!payload) return 0

  let completed = 0
  const total = 14

  if (typeof payload.site_name === "string" && payload.site_name.trim().length > 0) completed += 1
  if (payload.region_version === "ACA" || payload.region_version === "M") completed += 1
  if (typeof payload.vegetation_stage === "string" && payload.vegetation_stage.trim().length > 0)
    completed += 1

  const parcelIds = resolvePayloadParcelIds(payload)
  if (parcelIds.length > 0) completed += 1

  const factors = payload.factors
  if (factors && typeof factors === "object" && !Array.isArray(factors)) {
    for (const factorKey of FACTOR_KEYS) {
      const factorValue = (factors as Record<string, unknown>)[factorKey]
      if (isLegacyDefaultFactorValue(factorKey, factorValue)) {
        continue
      }
      if (isFilledValue(factorValue)) {
        completed += 1
      }
    }
  }

  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
}

export const toSurveyQueuePayload = (value: unknown): SurveyQueuePayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return isSurveyQueuePayload(value) ? value : null
}

export function isSurveyQueuePayload(payload: unknown): payload is SurveyQueuePayload {
  if (!payload || typeof payload !== "object") return false
  return (
    typeof (payload as { id?: string }).id === "string" &&
    typeof (payload as { sync_version?: number }).sync_version === "number" &&
    typeof (payload as { site_name?: string }).site_name === "string"
  )
}

export function isSurveyDeleteQueuePayload(payload: unknown): payload is SurveyDeleteQueuePayload {
  if (!payload || typeof payload !== "object") return false
  return (
    (payload as { kind?: string }).kind === "survey_delete" &&
    typeof (payload as { survey_id?: string }).survey_id === "string"
  )
}

export function isSurveyVisibilityQueuePayload(
  payload: unknown,
): payload is SurveyVisibilityQueuePayload {
  if (!payload || typeof payload !== "object") return false
  const kind = (payload as { kind?: string }).kind
  const surveyId = (payload as { survey_id?: string }).survey_id
  const visibility = (payload as { visibility?: string }).visibility
  return (
    kind === "survey_visibility_update" &&
    typeof surveyId === "string" &&
    (visibility === "private" || visibility === "public")
  )
}

export function isAttachmentDeleteQueuePayload(
  payload: unknown,
): payload is AttachmentDeleteQueuePayload {
  if (!payload || typeof payload !== "object") return false
  return (
    (payload as { kind?: string }).kind === "attachment_delete" &&
    typeof (payload as { survey_id?: string }).survey_id === "string" &&
    typeof (payload as { attachment_id?: string }).attachment_id === "string"
  )
}

export function isAttachmentQueuePayload(payload: unknown): payload is AttachmentQueuePayload {
  if (!payload || typeof payload !== "object") return false
  return (
    (payload as { kind?: string }).kind === "attachment_upload" &&
    typeof (payload as { local_attachment_id?: string }).local_attachment_id === "string" &&
    typeof (payload as { survey_id?: string }).survey_id === "string"
  )
}

export function toUploadTarget(
  data: Record<string, unknown> | undefined,
): UploadTargetResponse | null {
  if (!data) return null

  const attachmentId = data.attachment_id
  const storageKey = data.storage_key
  const uploadUrl = data.upload_url
  const confirmUrl = data.confirm_url

  if (typeof attachmentId !== "string" || typeof uploadUrl !== "string") {
    return null
  }

  return {
    attachment_id: attachmentId,
    storage_key: typeof storageKey === "string" ? storageKey : "",
    upload_url: uploadUrl,
    confirm_url: typeof confirmUrl === "string" ? confirmUrl : undefined,
  }
}

export function buildSyncResultMessage(result: SyncBatchResult): string {
  const errorMessage = result.error?.message ?? result.status
  const http = result.error?.http_status
  if (typeof http === "number") {
    return `HTTP ${http} ${errorMessage}`.trim()
  }
  return errorMessage
}

export function resolveUploadTarget(apiUrl: string, uploadUrl: string): string {
  const base = apiUrl.replace(/\/+$/, "")
  if (/^https?:\/\//i.test(uploadUrl)) {
    return uploadUrl
  }
  if (uploadUrl.startsWith("/")) {
    return `${base}${uploadUrl}`
  }
  return `${base}/${uploadUrl}`
}

export function deriveSurveyErrorCode(message: string): string {
  if (message.includes("HTTP 409")) return "sync_version_conflict"
  if (message.includes("HTTP 422")) return "survey_validation_failed"
  if (message.includes("HTTP 400")) return "bad_request"
  if (message.includes("HTTP 401")) return "unauthorized"
  if (message.includes("HTTP 403")) return "forbidden"
  if (message.includes("HTTP 404")) return "not_found"
  if (message.includes("HTTP 429")) return "rate_limited"
  if (message.includes("HTTP 5") || message.includes("BATCH_HTTP 5"))
    return "transient_upstream_error"
  if (message.includes("BATCH_HTTP")) return "network_gateway_error"
  if (message.includes("retry cap reached")) return "retry_cap_reached"
  return "sync_failed"
}

export function deriveAttachmentErrorCode(message: string): string {
  // D-14: an "unknown" failure that reached MAX_RETRY_COUNT is always
  // reported as retry_cap_reached, even when its underlying message also
  // contains an UPLOAD_HTTP/CONFIRM_HTTP code (e.g. eight capped 401s) — the
  // cap having been reached is the more actionable fact for the user.
  if (message.includes("retry cap reached")) return "retry_cap_reached"
  if (message.includes("Local file missing")) return "local_file_missing"
  if (message.includes("UPLOAD_HTTP 400")) return "attachment_bad_request"
  if (message.includes("UPLOAD_HTTP 401") || message.includes("CONFIRM_HTTP 401"))
    return "unauthorized"
  if (message.includes("UPLOAD_HTTP 403") || message.includes("CONFIRM_HTTP 403"))
    return "forbidden"
  if (message.includes("UPLOAD_HTTP 404") || message.includes("CONFIRM_HTTP 404"))
    return "not_found"
  if (message.includes("UPLOAD_HTTP 429") || message.includes("CONFIRM_HTTP 429"))
    return "rate_limited"
  if (message.includes("UPLOAD_HTTP 5") || message.includes("CONFIRM_HTTP 5"))
    return "transient_upstream_error"
  if (message.includes("HTTP 409")) return "sync_version_conflict"
  if (message.includes("HTTP 422")) return "attachment_validation_failed"
  return "attachment_sync_failed"
}

// D-05/D-14: one tested vocabulary decides whether a failure counts toward
// the 8-attempt retry cap. "fatal" blocks on the first attempt, "retryable"
// never counts (network/timeout/5xx/429), "unknown" counts (it's the only
// class that can eventually reach the cap).
export type FailureClassification = "fatal" | "retryable" | "unknown"

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /network request failed|failed to fetch|network error/i.test(error.message)
  )
}

function parseHttpCodeFromMessage(prefix: string, message: string): number | null {
  const match = new RegExp(`${prefix} (\\d+)`).exec(message)
  return match ? Number(match[1]) : null
}

/**
 * Classifies a batch-request-level exception (network error, apiRequest's
 * ApiError, an unparsable response, or anything else thrown while calling
 * POST /sync or GET /sync/changes). Returns "auth" for a 401/403 so the
 * caller can rethrow it untouched instead of touching any queue row.
 */
export function classifyRequestError(error: unknown): FailureClassification | "auth" {
  if (isNetworkError(error)) return "retryable"

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "auth"
    if (
      error.status === 408 ||
      error.status === 429 ||
      (error.status >= 500 && error.status < 600)
    ) {
      return "retryable"
    }
    return "unknown"
  }

  return "unknown"
}

/**
 * Classifies a per-operation result returned inside a successful POST /sync
 * batch response (server contract: api/src/surveys/sync-error.utils.ts).
 */
export function classifyBatchResult(result: SyncBatchResult): FailureClassification {
  if (result.status === "fatal_error") return "fatal"

  if (result.status === "retryable_error") {
    const httpStatus = result.error?.http_status
    if (
      httpStatus === 429 ||
      (typeof httpStatus === "number" && httpStatus >= 500 && httpStatus < 600)
    ) {
      return "retryable"
    }
    return "unknown"
  }

  return "unknown"
}

/**
 * Classifies an exception thrown while uploading or confirming an
 * attachment: the plan-07 error classes (LocalFileMissingError,
 * UploadTimeoutError), the UPLOAD_HTTP-coded error thrown by sync.ts when
 * uploadAttachmentFile resolves a non-2xx status, or an ApiError from
 * apiRequest's confirm PUT call.
 */
export function classifyUploadFailure(error: unknown): FailureClassification {
  if (error instanceof LocalFileMissingError) return "fatal"
  if (error instanceof UploadTimeoutError) return "retryable"

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "unknown"
    if (
      error.status === 408 ||
      error.status === 429 ||
      (error.status >= 500 && error.status < 600)
    ) {
      return "retryable"
    }
    return "fatal"
  }

  if (isNetworkError(error)) return "retryable"

  if (error instanceof Error) {
    const uploadCode = parseHttpCodeFromMessage("UPLOAD_HTTP", error.message)
    if (uploadCode !== null) {
      if (uploadCode === 401 || uploadCode === 403) return "unknown"
      if (uploadCode === 408 || uploadCode === 429 || (uploadCode >= 500 && uploadCode < 600)) {
        return "retryable"
      }
      return "fatal"
    }
  }

  return "unknown"
}

export function computeNextRetryAt(now: Date, retryCount: number): string {
  const seconds = Math.min(300, Math.pow(2, Math.min(retryCount, 8)) * 5)
  return new Date(now.getTime() + seconds * 1000).toISOString()
}

export function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function buildSyncChangesPath(cursor: string | null, limit: number): string {
  const params = [`limit=${encodeURIComponent(String(limit))}`]
  if (cursor) {
    params.push(`cursor=${encodeURIComponent(cursor)}`)
  }
  return `/sync/changes?${params.join("&")}`
}

export function buildSyncChangesUrl(apiUrl: string, cursor: string | null, limit: number): string {
  const base = apiUrl.replace(/\/+$/, "")
  return `${base}${buildSyncChangesPath(cursor, limit)}`
}

export function deriveQueueOpType(payload: unknown): QueueOpType {
  if (isSurveyDeleteQueuePayload(payload)) return "survey_delete"
  if (isSurveyVisibilityQueuePayload(payload)) return "survey_visibility"
  if (isAttachmentDeleteQueuePayload(payload)) return "attachment_delete"
  if (isAttachmentQueuePayload(payload)) return "attachment_upload"
  if (isSurveyQueuePayload(payload)) return "survey_upsert"
  return "unknown"
}

export async function deleteQueuedSurveyUpserts(db: DbExecutor, surveyId: string): Promise<void> {
  const rows = await db.getAllAsync<Array<{ id: number; payload: string }>[number]>(
    `SELECT id, payload
     FROM sync_queue
     WHERE survey_id = ?`,
    [surveyId],
  )

  for (const row of rows) {
    const payload = safeParseJson(row.payload)
    if (isSurveyQueuePayload(payload)) {
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id])
    }
  }
}

export async function hasPendingQueueForSurvey(db: DbExecutor, surveyId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM sync_queue
     WHERE survey_id = ?
       AND status IN ('pending', 'failed')`,
    [surveyId],
  )
  return Number(row?.count ?? 0) > 0
}
