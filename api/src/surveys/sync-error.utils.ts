import { HttpException } from "@nestjs/common"

export type SyncMappedError = {
  status: "retryable_error" | "fatal_error"
  error: { code: string; message: string; http_status?: number; details?: Record<string, unknown> }
}

// D-05/D-11: PostgreSQL SQLSTATE classes 22 (data exception) and 23 (integrity
// constraint violation) are deterministic — retrying them can never succeed —
// so they are always fatal, with no SQL detail (constraint names, values)
// reaching the client.
const DETERMINISTIC_DB_ERROR_CODE = "invalid_operation"
const DETERMINISTIC_DB_ERROR_MESSAGE = "Operation could not be processed"
const DETERMINISTIC_PG_SQLSTATE_PATTERN = /^(22|23)[0-9A-Z]{3}$/

function isDeterministicPgError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    !(error instanceof HttpException) &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    DETERMINISTIC_PG_SQLSTATE_PATTERN.test((error as { code: string }).code)
  )
}

export function mapSyncError(error: unknown): SyncMappedError {
  if (isDeterministicPgError(error)) {
    return {
      status: "fatal_error",
      error: {
        code: DETERMINISTIC_DB_ERROR_CODE,
        message: DETERMINISTIC_DB_ERROR_MESSAGE,
      },
    }
  }

  let httpStatus: number | undefined
  if (error instanceof HttpException) {
    httpStatus = error.getStatus()
  }

  const extracted = extractSyncErrorPayload(error)
  const retryable = typeof httpStatus === "number" ? httpStatus >= 500 || httpStatus === 429 : true
  const code = extracted.code
    ? extracted.code
    : retryable
      ? defaultRetryableSyncCode(httpStatus)
      : typeof httpStatus === "number"
        ? `http_${httpStatus}`
        : "sync_fatal_error"

  return {
    status: retryable ? "retryable_error" : "fatal_error",
    error: {
      code,
      message: extracted.message,
      http_status: httpStatus,
      details: extracted.details,
    },
  }
}

function extractSyncErrorPayload(error: unknown): {
  code?: string
  message: string
  details?: Record<string, unknown>
} {
  if (error instanceof HttpException) {
    const response = error.getResponse()
    if (typeof response === "string" && response.trim().length > 0) {
      return { message: response }
    }
    if (response && typeof response === "object") {
      const objectResponse = response as {
        code?: unknown
        message?: unknown
        details?: unknown
        error?: unknown
      }
      const message = Array.isArray(objectResponse.message)
        ? objectResponse.message.map((value) => String(value)).join(" | ")
        : typeof objectResponse.message === "string"
          ? objectResponse.message
          : typeof objectResponse.error === "string"
            ? objectResponse.error
            : "Sync operation failed"
      const code = typeof objectResponse.code === "string" ? objectResponse.code : undefined
      const details =
        objectResponse.details &&
        typeof objectResponse.details === "object" &&
        !Array.isArray(objectResponse.details)
          ? (objectResponse.details as Record<string, unknown>)
          : undefined
      return { code, message, details }
    }
  }

  // Non-HttpException errors (e.g. raw pg errors, unexpected exceptions) are
  // never echoed to the client — only the generic message crosses the
  // boundary. Callers that need the raw text for diagnostics must log it
  // themselves before it reaches mapSyncError.
  return { message: "Sync operation failed" }
}

function defaultRetryableSyncCode(httpStatus?: number): string {
  if (httpStatus === 429) {
    return "rate_limited"
  }
  if (
    httpStatus === 502 ||
    httpStatus === 503 ||
    httpStatus === 504 ||
    typeof httpStatus !== "number"
  ) {
    return "network_gateway_error"
  }
  return "transient_upstream_error"
}
