import { BadRequestException } from "@nestjs/common"
import {
  buildSyncChangesCursor,
  getChangedSubmittedReadOnlyFields,
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

  it.each(["v2:abc:1", "v2:1", "v2:1:2:3", "v2:-1:2", "not-a-date|x", "seq:5"])(
    "rejects the malformed cursor %p with 400 Invalid sync cursor",
    (cursor) => {
      expect(() => parseSyncChangesCursor(cursor)).toThrow(BadRequestException)
      expect(() => parseSyncChangesCursor(cursor)).toThrow("Invalid sync cursor")
    },
  )
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
