import { BadRequestException, ForbiddenException } from "@nestjs/common"
import { decodeListCursor, encodeListCursor } from "../src/surveys/list-cursor"
import {
  buildListForUserQuery,
  SurveysRepository,
  toListPage,
} from "../src/surveys/surveys.repository"
import {
  buildEventListQuery,
  decodeEventListCursor,
  SurveyEventsService,
} from "../src/surveys/survey-events.service"
import {
  buildReportListQuery,
  REPORT_CURSOR_ID_PATTERN,
  ReportsService,
} from "../src/reports/reports.service"

// D-11: the three list builders and the shared paging rule. Unpaginated SQL is the pre-D-11
// query plus a tiebreaker; paginated SQL binds the cursor and limit + 1 as parameters.

const flat = (sql: string) => sql.replace(/\s+/g, " ").trim()
const UNPAGINATED = { limit: null, after: null }
const AFTER = { t: "2024-05-01 10:00:00.123456+00", i: "abc" }

const USER = {
  id: "u1",
  auth0_sub: "auth0|u1",
  email: "u1@example.com",
  role: "moderator" as const,
  first_name: "U",
  last_name: "One",
  display_name: "U One",
  profile_picture_url: null,
}

describe("toListPage", () => {
  const cursorOf = (row: { t: string; i: string }) => row
  const rows = [
    { t: "2024-01-03 00:00:00+00", i: "c" },
    { t: "2024-01-02 00:00:00+00", i: "b" },
    { t: "2024-01-01 00:00:00+00", i: "a" },
  ]

  it("returns every row with a null cursor when unpaginated", () => {
    expect(toListPage(rows, null, cursorOf)).toEqual({ items: rows, next_cursor: null })
  })

  it("returns a null cursor when the extra row did not come back", () => {
    expect(toListPage(rows, 3, cursorOf)).toEqual({ items: rows, next_cursor: null })
  })

  it("drops the extra row and points the cursor at the last kept row", () => {
    const page = toListPage(rows, 2, cursorOf)
    expect(page.items).toEqual(rows.slice(0, 2))
    expect(page.next_cursor).toBe(encodeListCursor(rows[1]))
    expect(decodeListCursor(page.next_cursor as string)).toEqual(rows[1])
  })

  it("maps each kept row through toItem", () => {
    const page = toListPage(rows, 1, cursorOf, (row) => row.i)
    expect(page.items).toEqual(["c"])
  })
})

describe("buildListForUserQuery", () => {
  it("keeps the pre-D-11 SQL, plus the id tiebreaker, when unpaginated", () => {
    const query = buildListForUserQuery("u1", undefined, UNPAGINATED)
    expect(flat(query.text)).toBe(
      "SELECT id, site_name, status, visibility, parcel_id, observation_year, version_number, updated_at::text, sync_version FROM surveys WHERE user_id = $1 AND deleted_at IS NULL ORDER BY surveys.updated_at DESC, surveys.id DESC",
    )
    expect(query.values).toEqual(["u1"])
  })

  it("appends the keyset after the filters and binds limit + 1", () => {
    const query = buildListForUserQuery(
      "u1",
      { status: "draft", from: "2024-01-01", to: "2024-12-31", q: " oak " },
      { limit: 20, after: AFTER },
    )
    const sql = flat(query.text)
    expect(sql).toContain(
      "WHERE user_id = $1 AND deleted_at IS NULL AND status = $2 AND updated_at::date >= $3::date AND updated_at::date <= $4::date AND (site_name ILIKE $5 OR parcel_id ILIKE $5) AND (updated_at, id) < ($6::timestamptz, $7)",
    )
    expect(sql.endsWith("LIMIT $8")).toBe(true)
    expect(query.values).toEqual([
      "u1",
      "draft",
      "2024-01-01",
      "2024-12-31",
      "%oak%",
      AFTER.t,
      AFTER.i,
      21,
    ])
  })

  it("ignores invalid filters", () => {
    const query = buildListForUserQuery(
      "u1",
      { status: "nope", from: "x", to: "y", q: "  " },
      UNPAGINATED,
    )
    expect(query.values).toEqual(["u1"])
  })

  it("is what SurveysRepository.listForUser runs", async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) }
    await expect(
      new SurveysRepository().listForUser(db, "u1", undefined, UNPAGINATED),
    ).resolves.toEqual({ items: [], next_cursor: null })
    const expected = buildListForUserQuery("u1", undefined, UNPAGINATED)
    expect(db.query).toHaveBeenCalledWith(expected.text, expected.values)
  })
})

describe("buildEventListQuery and decodeEventListCursor", () => {
  it("binds the keyset on (created_at, seq) and limit + 1", () => {
    const query = buildEventListQuery("s1", { limit: 5, after: { t: AFTER.t, i: "42" } })
    const sql = flat(query.text)
    expect(sql).toContain(
      "WHERE survey_id = $1 AND (created_at, seq) < ($2::timestamptz, $3::bigint)",
    )
    expect(sql).toContain("ORDER BY survey_events.created_at DESC, survey_events.seq DESC LIMIT $4")
    expect(query.values).toEqual(["s1", AFTER.t, "42", 6])
  })

  it("accepts seq values up to the bigint maximum and rejects anything else", () => {
    const max = encodeListCursor({ t: AFTER.t, i: "9223372036854775807" })
    expect(decodeEventListCursor(max)).toEqual({ t: AFTER.t, i: "9223372036854775807" })
    expect(decodeEventListCursor(undefined)).toBeNull()
    for (const i of ["9223372036854775808", "99999999999999999999", "x1", "-1"]) {
      expect(() => decodeEventListCursor(encodeListCursor({ t: AFTER.t, i }))).toThrow(
        new BadRequestException("Invalid cursor"),
      )
    }
  })

  it("strips seq from the items and mints the cursor from it", async () => {
    const db = { query: jest.fn() }
    const service = new SurveyEventsService(db as never, new SurveysRepository())
    db.query.mockResolvedValueOnce({ rows: [{ id: "s1" }] })
    db.query.mockResolvedValueOnce({
      rows: [
        { id: "e2", created_at: "2024-01-02 00:00:00+00", seq: "12" },
        { id: "e1", created_at: "2024-01-01 00:00:00+00", seq: "11" },
      ],
    })

    const page = await service.listForSurvey(USER, "s1", { limit: 1, after: null })

    expect(page.items).toEqual([{ id: "e2", created_at: "2024-01-02 00:00:00+00" }])
    expect(decodeEventListCursor(page.next_cursor as string)).toEqual({
      t: "2024-01-02 00:00:00+00",
      i: "12",
    })
  })
})

describe("buildReportListQuery and ReportsService.listReports", () => {
  it("keeps the pre-D-11 SQL when unpaginated and unfiltered", () => {
    const query = buildReportListQuery(null, UNPAGINATED)
    expect(flat(query.text)).toBe(
      "SELECT id, survey_id, reporter_user_id, reason, status, created_at::text, reviewed_at::text, reviewed_by::text FROM reports ORDER BY reports.created_at DESC, reports.id DESC",
    )
    expect(query.values).toEqual([])
  })

  it("puts the keyset after the status filter and binds limit + 1", () => {
    const query = buildReportListQuery("open", { limit: 3, after: AFTER })
    const sql = flat(query.text)
    expect(sql).toContain("WHERE status = $1 AND (created_at, id) < ($2::timestamptz, $3)")
    expect(sql.endsWith("LIMIT $4")).toBe(true)
    expect(query.values).toEqual(["open", AFTER.t, AFTER.i, 4])

    const unfiltered = buildReportListQuery(null, { limit: 3, after: AFTER })
    expect(flat(unfiltered.text)).toContain("WHERE (created_at, id) < ($1::timestamptz, $2)")
    expect(unfiltered.values).toEqual([AFTER.t, AFTER.i, 4])
  })

  it("accepts only uuid cursor ids", () => {
    expect(REPORT_CURSOR_ID_PATTERN.test("e81fbbab-06a8-49a0-87f8-e9b7f0c8dca5")).toBe(true)
    expect(REPORT_CURSOR_ID_PATTERN.test("not-a-uuid")).toBe(false)
  })

  function buildReports() {
    const db = { query: jest.fn() }
    const service = new ReportsService(db as never, {} as never)
    return { db, service }
  }

  const reportRow = (id: string, createdAt: string) => ({
    id,
    survey_id: "s1",
    reporter_user_id: "u2",
    reason: "r",
    status: "open",
    created_at: createdAt,
    reviewed_at: null,
    reviewed_by: null,
  })

  it("answers every row with a null cursor when unpaginated", async () => {
    const { db, service } = buildReports()
    const rows = [
      reportRow("r2", "2024-01-02 00:00:00+00"),
      reportRow("r1", "2024-01-01 00:00:00+00"),
    ]
    db.query.mockResolvedValueOnce({ rows })

    await expect(service.listReports(USER, " OPEN ")).resolves.toEqual({
      items: rows,
      next_cursor: null,
    })
    expect(db.query.mock.calls[0][1]).toEqual(["open"])
  })

  it("drops the extra row and mints the cursor from the last kept report", async () => {
    const { db, service } = buildReports()
    const rows = [
      reportRow("r2", "2024-01-02 00:00:00+00"),
      reportRow("r1", "2024-01-01 00:00:00+00"),
    ]
    db.query.mockResolvedValueOnce({ rows })

    const page = await service.listReports(USER, undefined, { limit: 1, after: null })

    expect(page.items).toEqual([rows[0]])
    expect(decodeListCursor(page.next_cursor as string)).toEqual({
      t: "2024-01-02 00:00:00+00",
      i: "r2",
    })
    expect(db.query.mock.calls[0][1]).toEqual([2])
  })

  it("returns a null cursor on the last page", async () => {
    const { db, service } = buildReports()
    db.query.mockResolvedValueOnce({ rows: [reportRow("r1", "2024-01-01 00:00:00+00")] })
    await expect(service.listReports(USER, undefined, { limit: 5, after: null })).resolves.toEqual(
      expect.objectContaining({ next_cursor: null }),
    )
  })

  it("checks the reviewer role before querying", async () => {
    const { db, service } = buildReports()
    await expect(
      service.listReports({ ...USER, role: "contributor" as never }, undefined, {
        limit: 1,
        after: AFTER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(db.query).not.toHaveBeenCalled()
  })
})
