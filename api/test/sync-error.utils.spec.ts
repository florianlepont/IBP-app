import { BadRequestException, ConflictException, HttpException } from "@nestjs/common"
import { mapSyncError } from "../src/surveys/sync-error.utils"

describe("mapSyncError", () => {
  it("maps a unique-violation pg error (23505) to a generic fatal error with no leaked detail", () => {
    const error = Object.assign(
      new Error('duplicate key value violates unique constraint "surveys_pkey"'),
      { code: "23505", constraint: "surveys_pkey" },
    )

    const result = mapSyncError(error)

    expect(result).toEqual({
      status: "fatal_error",
      error: {
        code: "invalid_operation",
        message: "Operation could not be processed",
      },
    })
    expect(JSON.stringify(result)).not.toContain("surveys_pkey")
  })

  it.each(["22P02", "22007", "22003", "23502", "23503", "23514"])(
    "maps deterministic pg error code %s to fatal_error with the generic message",
    (code) => {
      const error = Object.assign(new Error("some sql detail"), { code })

      const result = mapSyncError(error)

      expect(result.status).toBe("fatal_error")
      expect(result.error.code).toBe("invalid_operation")
      expect(result.error.message).toBe("Operation could not be processed")
      expect(result.error.details).toBeUndefined()
      expect(result.error.http_status).toBeUndefined()
    },
  )

  it.each(["40P01", "57014", "08006"])(
    "maps non-deterministic pg error code %s to retryable_error with a generic message",
    (code) => {
      const error = Object.assign(new Error("some sql detail"), { code })

      const result = mapSyncError(error)

      expect(result.status).toBe("retryable_error")
      expect(result.error.code).toBe("network_gateway_error")
      expect(result.error.message).toBe("Sync operation failed")
      expect(result.error.message).not.toContain("some sql detail")
    },
  )

  it("maps a plain Error without a pg code to retryable_error without leaking its message", () => {
    const error = new Error("select * from secret")

    const result = mapSyncError(error)

    expect(result.status).toBe("retryable_error")
    expect(result.error.message).not.toContain("secret")
  })

  it("preserves code/details/http_status for a ConflictException", () => {
    const error = new ConflictException({
      code: "sync_version_conflict",
      message: "Older sync_version received",
      details: { survey_id: "abc" },
    })

    const result = mapSyncError(error)

    expect(result).toEqual({
      status: "fatal_error",
      error: {
        code: "sync_version_conflict",
        message: "Older sync_version received",
        http_status: 409,
        details: { survey_id: "abc" },
      },
    })
  })

  it("preserves code/details/http_status for a BadRequestException", () => {
    const error = new BadRequestException({
      code: "invalid_sync_operation",
      message: "Invalid sync operation",
      details: { fields: ["parcel_ids"] },
    })

    const result = mapSyncError(error)

    expect(result).toEqual({
      status: "fatal_error",
      error: {
        code: "invalid_sync_operation",
        message: "Invalid sync operation",
        http_status: 400,
        details: { fields: ["parcel_ids"] },
      },
    })
  })

  it("keeps HTTP status mapping for 503, 429 and 500 unchanged", () => {
    expect(mapSyncError(new HttpException("Service Unavailable", 503))).toMatchObject({
      status: "retryable_error",
      error: { code: "network_gateway_error", http_status: 503 },
    })
    expect(mapSyncError(new HttpException("Too Many Requests", 429))).toMatchObject({
      status: "retryable_error",
      error: { code: "rate_limited", http_status: 429 },
    })
    expect(mapSyncError(new HttpException("Internal Server Error", 500))).toMatchObject({
      status: "retryable_error",
      error: { code: "transient_upstream_error", http_status: 500 },
    })
  })
})
