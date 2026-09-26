import { BadRequestException } from "@nestjs/common"
import {
  buildSyncChangesCursor,
  classifySameVersionContent,
  getChangedSubmittedReadOnlyFields,
  isStrictTimestamp,
  parseSyncChangesCursor,
} from "../src/surveys/surveys-normalize.utils"
import { SurveyRow, SurveyUpsertBody } from "../src/surveys/surveys.types"

function makeRow(overrides: Partial<SurveyRow> = {}): SurveyRow {
  return {
    id: "survey-1",
    user_id: "user-1",
    site_name: "Parcelle Nord",
    status: "submitted",
    visibility: "private",
    parcel_id: "12345AB0042",
    parcel_ids: ["12345AB0042"],
    observation_year: 2025,
    version_number: 1,
    previous_survey_id: null,
    region_version: "ACA",
    vegetation_stage: "collineen",
    factors: { A: 1, B: 2 },
    factor_results: {},
    scores: { ibp_total: 10 },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    submitted_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2026-12-31T00:00:00.000Z",
    sync_version: 1,
    last_sync_error: null,
    deleted_at: null,
    ...overrides,
  }
}

describe("getChangedSubmittedReadOnlyFields", () => {
  it("returns [] when every read-only field is identical", () => {
    const existing = makeRow()
    const body: SurveyUpsertBody = {
      site_name: existing.site_name,
      parcel_ids: existing.parcel_ids,
      observation_year: existing.observation_year ?? undefined,
      version_number: existing.version_number ?? undefined,
      previous_survey_id: existing.previous_survey_id ?? undefined,
      region_version: existing.region_version as SurveyUpsertBody["region_version"],
      vegetation_stage: existing.vegetation_stage ?? undefined,
      factors: existing.factors,
    }

    expect(getChangedSubmittedReadOnlyFields(body, existing, existing.parcel_ids ?? [])).toEqual([])
  })

  it("does not report a field that is absent, undefined or null on the body", () => {
    const existing = makeRow()
    const body: SurveyUpsertBody = {
      site_name: undefined,
      // parcel_ids intentionally omitted
      // observation_year intentionally omitted
    }

    expect(getChangedSubmittedReadOnlyFields(body, existing, existing.parcel_ids ?? [])).toEqual([])
  })

  it("reports site_name when it differs", () => {
    const existing = makeRow()
    const body: SurveyUpsertBody = { site_name: "Parcelle Sud" }

    expect(getChangedSubmittedReadOnlyFields(body, existing, existing.parcel_ids ?? [])).toEqual([
      "site_name",
    ])
  })

  it("does not report parcel_ids when the same set differs only in order/case/whitespace", () => {
    const existing = makeRow({ parcel_ids: ["12345AB0042", "12345AB0043"] })
    const body: SurveyUpsertBody = { parcel_ids: [" 12345ab0043 ", "12345AB0042"] }

    expect(getChangedSubmittedReadOnlyFields(body, existing, existing.parcel_ids ?? [])).toEqual([])
  })

  it("reports parcel_ids when the set actually changed", () => {
    const existing = makeRow({ parcel_ids: ["12345AB0042"] })
    const body: SurveyUpsertBody = { parcel_ids: ["12345AB0099"] }

    expect(getChangedSubmittedReadOnlyFields(body, existing, existing.parcel_ids ?? [])).toEqual([
      "parcel_ids",
    ])
  })

  it("falls back to [existing.parcel_id] when existingParcelIds is empty", () => {
    const existing = makeRow({ parcel_id: "12345AB0042", parcel_ids: undefined })
    const body: SurveyUpsertBody = { parcel_ids: ["12345AB0099"] }

    expect(getChangedSubmittedReadOnlyFields(body, existing, [])).toEqual(["parcel_ids"])
  })

  it("compares parcel_id after normalizeParcelId", () => {
    const existing = makeRow({ parcel_id: "12345AB0042" })
    const body: SurveyUpsertBody = { parcel_id: " 12345ab0042 " }

    expect(getChangedSubmittedReadOnlyFields(body, existing, existing.parcel_ids ?? [])).toEqual([])
  })

  it("compares observation_year, version_number and previous_survey_id after their normalize helpers", () => {
    const existing = makeRow({
      observation_year: 2025,
      version_number: 2,
      previous_survey_id: "prev-1",
    })

    expect(
      getChangedSubmittedReadOnlyFields(
        { observation_year: 2025, version_number: 2, previous_survey_id: "prev-1" },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual([])

    expect(
      getChangedSubmittedReadOnlyFields(
        { observation_year: 2026, version_number: 3, previous_survey_id: "prev-2" },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual(["observation_year", "version_number", "previous_survey_id"])
  })

  it("reports region_version and vegetation_stage when they differ", () => {
    const existing = makeRow({ region_version: "ACA", vegetation_stage: "collineen" })

    expect(
      getChangedSubmittedReadOnlyFields(
        { region_version: "M", vegetation_stage: "montagnard" },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual(["region_version", "vegetation_stage"])
  })

  it("does not report factors with the same content but different key order", () => {
    const existing = makeRow({ factors: { A: 1, B: 2 } })

    expect(
      getChangedSubmittedReadOnlyFields(
        { factors: { B: 2, A: 1 } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual([])
  })

  it("reports factors when a value changed", () => {
    const existing = makeRow({ factors: { A: 1, B: 2 } })

    expect(
      getChangedSubmittedReadOnlyFields(
        { factors: { A: 2, B: 2 } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual(["factors"])
  })

  it("reports factors when a key was added or removed", () => {
    const existing = makeRow({ factors: { A: 1, B: 2 } })

    expect(
      getChangedSubmittedReadOnlyFields(
        { factors: { A: 1, B: 2, C: 3 } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual(["factors"])

    expect(
      getChangedSubmittedReadOnlyFields({ factors: { A: 1 } }, existing, existing.parcel_ids ?? []),
    ).toEqual(["factors"])
  })

  it("compares nested objects recursively and arrays in order", () => {
    const existing = makeRow({ factors: { A: { nested: [1, 2, 3] } } })

    expect(
      getChangedSubmittedReadOnlyFields(
        { factors: { A: { nested: [1, 2, 3] } } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual([])

    expect(
      getChangedSubmittedReadOnlyFields(
        { factors: { A: { nested: [1, 3, 2] } } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual(["factors"])
  })

  it("never reports scores even when they differ (D-13)", () => {
    const existing = makeRow({ scores: { ibp_total: 10 } })

    expect(
      getChangedSubmittedReadOnlyFields(
        { scores: { ibp_total: 999 } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual([])
  })

  it("reports several differences, all in readonly-list order", () => {
    const existing = makeRow({
      site_name: "Parcelle Nord",
      observation_year: 2025,
      factors: { A: 1 },
    })

    expect(
      getChangedSubmittedReadOnlyFields(
        { site_name: "Parcelle Sud", observation_year: 2026, factors: { A: 2 } },
        existing,
        existing.parcel_ids ?? [],
      ),
    ).toEqual(["site_name", "observation_year", "factors"])
  })
})

describe("parseSyncChangesCursor", () => {
  it.each([undefined, "", "   "])("returns kind none for an empty cursor (%p)", (cursor) => {
    expect(parseSyncChangesCursor(cursor)).toEqual({ kind: "none", original: null })
  })

  it("parses a v2 cursor into string xid8 and seq", () => {
    expect(parseSyncChangesCursor("v2:9843:7")).toEqual({
      kind: "position",
      xid8: "9843",
      seq: "7",
      original: "v2:9843:7",
    })
  })

  it("keeps values beyond Number.MAX_SAFE_INTEGER as exact strings", () => {
    const cursor = "v2:18446744073709551615:9223372036854775807"
    expect(parseSyncChangesCursor(cursor)).toEqual({
      kind: "position",
      xid8: "18446744073709551615",
      seq: "9223372036854775807",
      original: cursor,
    })
  })

  it.each([
    ["2026-03-09 10:20:31.991+00|8ac1", "2026-03-09 10:20:31.991+00", "8ac1"],
    [
      "2026-03-09T10:20:31.991Z|survey-1712345678901",
      "2026-03-09T10:20:31.991Z",
      "survey-1712345678901",
    ],
  ])("parses the legacy cursor %p", (cursor, timestamp, eventId) => {
    expect(parseSyncChangesCursor(cursor)).toEqual({
      kind: "legacy",
      timestamp,
      eventId,
      original: cursor,
    })
  })

  it.each([
    "v2:abc:1",
    "v2:1",
    "v2:1:2:3",
    "v2:-1:2",
    "not-a-date|x",
    "seq:5",
    "seq:5|x",
    "2026-03-09T10:20:31.991Z",
    "v2:18446744073709551616:1",
    "v2:99999999999999999999:1",
    "v2:1:9223372036854775808",
    "2024-02-30T00:00:00Z|x",
    "2024-01-01 12:00:00 junk|x",
  ])("rejects the malformed cursor %p with 400 Invalid sync cursor", (cursor) => {
    expect(() => parseSyncChangesCursor(cursor)).toThrow(BadRequestException)
    expect(() => parseSyncChangesCursor(cursor)).toThrow("Invalid sync cursor")
  })
})

describe("isStrictTimestamp", () => {
  it.each([
    "2026-03-09 10:20:31.991234+00",
    "2026-03-09 10:20:31.991+00",
    "2026-03-09T10:20:31Z",
    "2026-03-09T10:20:31.991Z",
    "2024-02-29T00:00:00+02:00",
    "2026-01-01 00:00:00-0530",
    "2024-01-01 00:00:00+15:59",
    "0001-01-01 00:00:00Z",
  ])("accepts %p", (value) => {
    expect(isStrictTimestamp(value)).toBe(true)
  })

  it.each([
    "2024-02-30T00:00:00Z",
    "2023-02-29T00:00:00Z",
    "2024-13-01T00:00:00Z",
    "2024-00-10T00:00:00Z",
    "2024-01-00T00:00:00Z",
    "2024-01-01T24:00:00Z",
    "2024-01-01T23:60:00Z",
    "2024-01-01T23:59:60Z",
    "2024-01-01 12:00:00 junk",
    "2024-01-01",
    "2024-01-01T00:00:00.1234567Z",
    "2024-01-01T00:00:00",
    "2024-01-01 00:00:00+16",
    "2024-01-01 00:00:00+05:99",
    "0000-01-01 00:00:00Z",
    "",
  ])("rejects %p", (value) => {
    expect(isStrictTimestamp(value)).toBe(false)
  })
})

describe("parseSyncChangesCursor strict legacy form", () => {
  it("still parses a PostgreSQL timestamptz::text legacy cursor", () => {
    expect(parseSyncChangesCursor("2026-03-09 10:20:31.991+00|survey-1")).toEqual({
      kind: "legacy",
      timestamp: "2026-03-09 10:20:31.991+00",
      eventId: "survey-1",
      original: "2026-03-09 10:20:31.991+00|survey-1",
    })
  })

  it("never echoes the rejected cursor", () => {
    let thrown: unknown
    try {
      parseSyncChangesCursor("2024-02-30T00:00:00Z|secret-marker")
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(BadRequestException)
    const exception = thrown as BadRequestException
    expect(exception.message).toBe("Invalid sync cursor")
    expect(JSON.stringify(exception.getResponse())).not.toContain("secret-marker")
  })
})

describe("buildSyncChangesCursor", () => {
  it("builds a v2 cursor that round-trips through the parser", () => {
    const cursor = buildSyncChangesCursor("9843", "7")
    expect(cursor).toBe("v2:9843:7")
    expect(parseSyncChangesCursor(cursor)).toEqual({
      kind: "position",
      xid8: "9843",
      seq: "7",
      original: cursor,
    })
  })
})

describe("classifySameVersionContent", () => {
  function sameBody(existing: SurveyRow): SurveyUpsertBody {
    return {
      site_name: existing.site_name,
      visibility: existing.visibility,
      parcel_ids: existing.parcel_ids,
      observation_year: existing.observation_year ?? undefined,
      version_number: existing.version_number ?? undefined,
      region_version: existing.region_version as SurveyUpsertBody["region_version"],
      vegetation_stage: existing.vegetation_stage ?? undefined,
      factors: existing.factors,
    }
  }

  it("returns identical when the body matches the stored row", () => {
    const existing = makeRow()
    expect(classifySameVersionContent(sameBody(existing), existing, ["12345AB0042"])).toBe(
      "identical",
    )
  })

  it("ignores factor key order", () => {
    const existing = makeRow({ factors: { A: 1, B: { x: 1, y: [1, 2] } } })
    const body = { ...sameBody(existing), factors: { B: { y: [1, 2], x: 1 }, A: 1 } }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("identical")
  })

  it("ignores parcel id order and case", () => {
    const existing = makeRow({ parcel_ids: ["12345AB0042", "12345AB0043"] })
    const body = { ...sameBody(existing), parcel_ids: ["12345ab0043", "12345AB0042"] }
    expect(classifySameVersionContent(body, existing, ["12345AB0042", "12345AB0043"])).toBe(
      "identical",
    )
  })

  it("returns conflict when site_name differs", () => {
    const existing = makeRow()
    const body = { ...sameBody(existing), site_name: "Autre parcelle" }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("conflict")
  })

  it("returns conflict when one factor value differs", () => {
    const existing = makeRow()
    const body = { ...sameBody(existing), factors: { A: 1, B: 3 } }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("conflict")
  })

  it("returns conflict when the parcel id set differs", () => {
    const existing = makeRow()
    const body = { ...sameBody(existing), parcel_ids: ["12345AB0042", "12345AB0099"] }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("conflict")
  })

  it("returns visibility_only when only visibility differs", () => {
    const existing = makeRow({ visibility: "private" })
    const body: SurveyUpsertBody = { ...sameBody(existing), visibility: "public" }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("visibility_only")
  })

  it("returns identical when visibility is absent from the body", () => {
    const existing = makeRow({ visibility: "public" })
    const body = sameBody(existing)
    delete body.visibility
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("identical")
  })

  it("returns conflict when site_name and visibility both differ", () => {
    const existing = makeRow({ visibility: "private" })
    const body: SurveyUpsertBody = {
      ...sameBody(existing),
      site_name: "Autre parcelle",
      visibility: "public",
    }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("conflict")
  })

  it("excludes scores, status and expires_at", () => {
    const existing = makeRow()
    const body: SurveyUpsertBody = {
      ...sameBody(existing),
      scores: { ibp_total: 99 },
      status: "draft",
      expires_at: "2030-01-01T00:00:00.000Z",
    }
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("identical")
  })

  it("does not treat absent or null fields as changes", () => {
    const existing = makeRow()
    const body = {
      site_name: null,
      factors: null,
      parcel_ids: undefined,
      visibility: null,
    } as unknown as SurveyUpsertBody
    expect(classifySameVersionContent(body, existing, ["12345AB0042"])).toBe("identical")
    expect(classifySameVersionContent({}, existing, ["12345AB0042"])).toBe("identical")
  })
})
