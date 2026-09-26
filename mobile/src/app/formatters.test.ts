import {
  formatRemainingTime,
  formatSyncErrorForUser,
  isLessThan24HoursRemaining,
  resolveSubmissionDeadline,
} from "./formatters"
import { fr } from "../i18n"

describe("formatters time helpers", () => {
  const fixedNow = Date.parse("2026-03-10T12:00:00.000Z")

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(fixedNow)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test("resolves deadline from created_at when expires_at is missing", () => {
    const createdAt = "2026-03-01T00:00:00.000Z"
    expect(resolveSubmissionDeadline(createdAt, null)).toBe("2026-03-08T00:00:00.000Z")
  })

  test("detects less than 24h remaining", () => {
    expect(isLessThan24HoursRemaining("2026-03-11T11:00:00.000Z")).toBe(true)
    expect(isLessThan24HoursRemaining("2026-03-12T12:00:00.000Z")).toBe(false)
  })

  test("formats expired deadline", () => {
    expect(formatRemainingTime("2026-03-09T11:59:00.000Z")).toBe("expiré")
  })
})

describe("formatSyncErrorForUser", () => {
  test("returns null when there is no error", () => {
    expect(formatSyncErrorForUser(null)).toBeNull()
    expect(formatSyncErrorForUser("   ", null)).toBeNull()
    expect(formatSyncErrorForUser(undefined, "sync_failed")).toBeNull()
  })

  test("uses the French text of a known error code", () => {
    expect(formatSyncErrorForUser("x", "sync_version_conflict")).toBe(
      fr.syncErrors.byCode.sync_version_conflict,
    )
    expect(formatSyncErrorForUser("HTTP 503 survey-12 failed", "parcel_required")).toBe(
      fr.syncErrors.byCode.parcel_required,
    )
  })

  test("gives every error code the app stores a French text", () => {
    // Client codes: storage/utils.ts deriveSurveyErrorCode/deriveAttachmentErrorCode
    // and storage/sync.ts; server codes: the sync result error.code from the API.
    const codes = [
      "sync_version_conflict",
      "survey_validation_failed",
      "bad_request",
      "unauthorized",
      "forbidden",
      "not_found",
      "rate_limited",
      "transient_upstream_error",
      "network_gateway_error",
      "retry_cap_reached",
      "sync_failed",
      "local_file_missing",
      "attachment_bad_request",
      "attachment_validation_failed",
      "attachment_sync_failed",
      "invalid_local_payload",
      "invalid_attachment_response",
      "submit_validation",
      "submit_failed",
      "invalid_operation",
      "sync_fatal_error",
      "invalid_sync_operation",
      "parcel_required",
      "parcel_invalid",
      "parcel_version_conflict",
      "survey_id_conflict",
      "survey_submitted_read_only",
      "submitted_read_only_fields",
      "attachment_not_uploaded",
      "attachment_size_mismatch",
    ]
    const byCode: Record<string, string> = fr.syncErrors.byCode
    for (const code of codes) {
      expect({ code, text: formatSyncErrorForUser("raw", code) }).toEqual({
        code,
        text: byCode[code],
      })
      expect(byCode[code]).toEqual(expect.any(String))
    }
  })

  test("falls back to the stored text for rows written before error codes", () => {
    expect(formatSyncErrorForUser("HTTP 503", null)).toBe(fr.syncErrors.patterns.network)
    expect(formatSyncErrorForUser("site_name is required")).toBe(
      fr.syncErrors.patterns.siteNameMissing,
    )
    expect(formatSyncErrorForUser("region required", "http_400")).toBe(
      fr.syncErrors.patterns.regionMissing,
    )
    expect(formatSyncErrorForUser("vegetation required")).toBe(
      fr.syncErrors.patterns.vegetationMissing,
    )
    expect(formatSyncErrorForUser("HTTP 422 bad payload")).toBe(fr.syncErrors.patterns.invalidData)
    expect(formatSyncErrorForUser("Unauthorized")).toBe(fr.syncErrors.patterns.session)
  })

  test("returns the generic text for an unknown code with unmatched text", () => {
    expect(formatSyncErrorForUser("something odd", "brand_new_code")).toBe(fr.syncErrors.generic)
  })

  test("ignores inherited object keys used as codes", () => {
    expect(formatSyncErrorForUser("something odd", "toString")).toBe(fr.syncErrors.generic)
  })

  test("never echoes the raw error text", () => {
    const raw = "HTTP 503 for survey 9f1c2d3e-aaaa-bbbb-cccc-123456789abc"
    for (const code of [null, "sync_failed", "brand_new_code"]) {
      const text = formatSyncErrorForUser(raw, code)
      expect(text).not.toContain(raw)
      expect(text).not.toContain("9f1c2d3e")
    }
  })
})
