/**
 * Pure unit tests for the D-05/D-14 failure classifiers and the
 * buildSyncChangesPath helper. No SQLite, no fetch — these are the tested
 * vocabulary that decides whether a failure counts toward the retry cap.
 */

import { ApiError } from "../api/client"
import { LocalFileMissingError, UploadTimeoutError } from "./attachments"
import {
  classifyRequestError,
  classifyBatchResult,
  classifyUploadFailure,
  buildSyncChangesPath,
} from "./utils"
import { SyncBatchResult } from "./types"

function batchResult(overrides: Partial<SyncBatchResult> = {}): SyncBatchResult {
  return {
    client_ref: "1",
    entity: "survey",
    action: "upsert",
    status: "retryable_error",
    ...overrides,
  }
}

describe("classifyRequestError", () => {
  test("network TypeError is retryable", () => {
    expect(classifyRequestError(new TypeError("Network request failed"))).toBe("retryable")
  })

  test("ApiError 408 is retryable", () => {
    expect(classifyRequestError(new ApiError(408, "Request timeout", null))).toBe("retryable")
  })

  test.each([429, 500, 502, 503])("ApiError %i is retryable", (status) => {
    expect(classifyRequestError(new ApiError(status, "boom", null))).toBe("retryable")
  })

  test.each([401, 403])("ApiError %i is auth", (status) => {
    expect(classifyRequestError(new ApiError(status, "boom", null))).toBe("auth")
  })

  test.each([400, 404, 413, 422])("ApiError %i is unknown", (status) => {
    expect(classifyRequestError(new ApiError(status, "boom", null))).toBe("unknown")
  })

  test("SyntaxError is unknown", () => {
    expect(classifyRequestError(new SyntaxError("Unexpected token"))).toBe("unknown")
  })

  test("generic Error is unknown", () => {
    expect(classifyRequestError(new Error("boom"))).toBe("unknown")
  })

  test("non-network TypeError is unknown", () => {
    expect(classifyRequestError(new TypeError("x is not a function"))).toBe("unknown")
  })
})

describe("classifyBatchResult", () => {
  test("fatal_error is fatal", () => {
    expect(classifyBatchResult(batchResult({ status: "fatal_error" }))).toBe("fatal")
  })

  test.each([503, 429])("retryable_error with http_status %i is retryable", (httpStatus) => {
    expect(
      classifyBatchResult(
        batchResult({ status: "retryable_error", error: { http_status: httpStatus } }),
      ),
    ).toBe("retryable")
  })

  test("retryable_error with no http_status is unknown", () => {
    expect(classifyBatchResult(batchResult({ status: "retryable_error", error: {} }))).toBe(
      "unknown",
    )
  })

  test("retryable_error with http_status 409 is unknown", () => {
    expect(
      classifyBatchResult(batchResult({ status: "retryable_error", error: { http_status: 409 } })),
    ).toBe("unknown")
  })
})

describe("classifyUploadFailure", () => {
  test("LocalFileMissingError is fatal", () => {
    expect(classifyUploadFailure(new LocalFileMissingError("file:///gone.jpg"))).toBe("fatal")
  })

  test("UploadTimeoutError is retryable", () => {
    expect(classifyUploadFailure(new UploadTimeoutError())).toBe("retryable")
  })

  test.each(["UPLOAD_HTTP 503", "UPLOAD_HTTP 429", "UPLOAD_HTTP 408"])(
    "%s is retryable",
    (message) => {
      expect(classifyUploadFailure(new Error(message))).toBe("retryable")
    },
  )

  test.each([
    "UPLOAD_HTTP 400",
    "UPLOAD_HTTP 404",
    "UPLOAD_HTTP 409",
    "UPLOAD_HTTP 410",
    "UPLOAD_HTTP 413",
    "UPLOAD_HTTP 415",
    "UPLOAD_HTTP 422",
  ])("%s is fatal", (message) => {
    expect(classifyUploadFailure(new Error(message))).toBe("fatal")
  })

  test.each(["UPLOAD_HTTP 401", "UPLOAD_HTTP 403"])("%s is unknown", (message) => {
    expect(classifyUploadFailure(new Error(message))).toBe("unknown")
  })

  test("confirm ApiError 404 is fatal", () => {
    expect(classifyUploadFailure(new ApiError(404, "Not found", null))).toBe("fatal")
  })

  test("confirm ApiError 503 is retryable", () => {
    expect(classifyUploadFailure(new ApiError(503, "Unavailable", null))).toBe("retryable")
  })

  test("confirm ApiError 401 is unknown", () => {
    expect(classifyUploadFailure(new ApiError(401, "Unauthorized", null))).toBe("unknown")
  })

  test("network TypeError is retryable", () => {
    expect(classifyUploadFailure(new TypeError("Network request failed"))).toBe("retryable")
  })

  test("anything else is unknown", () => {
    expect(classifyUploadFailure(new Error("something odd"))).toBe("unknown")
    expect(classifyUploadFailure("a string")).toBe("unknown")
    expect(classifyUploadFailure(null)).toBe("unknown")
  })
})

describe("buildSyncChangesPath", () => {
  test("no cursor", () => {
    expect(buildSyncChangesPath(null, 50)).toBe("/sync/changes?limit=50")
  })

  test("with cursor, URL-encoded", () => {
    expect(buildSyncChangesPath("a b", 10)).toBe("/sync/changes?limit=10&cursor=a%20b")
  })
})
