import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { PoolClient } from "pg"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import * as publicMapQueries from "../src/surveys/public-map.queries"
import { buildListForUserQuery } from "../src/surveys/surveys.repository"
import { buildEventListQuery } from "../src/surveys/survey-events.service"
import { buildReportListQuery } from "../src/reports/reports.service"

// D-13 / D-15: on 10 000 seeded surveys the public queries never scan surveys, parcels or
// survey_parcels sequentially, and they return the same rows as the pre-01.7 queries.
// Everything runs in one transaction that is rolled back (RESEARCH Pitfall 11), so the 2 000
// seeded public surveys never reach the other specs' LIMIT 500 assertions.
// D-11 / D-15: the three paginated lists (first page and a middle page) are index-driven on
// the same seed, plus 30 000 survey events and 20 000 reports.

// The API's query builders, as the script loads them from dist.
const apiQueries = {
  ...publicMapQueries,
  buildListForUserQuery,
  buildEventListQuery,
  buildReportListQuery,
}
type ApiQueries = typeof apiQueries
type ListCase = { query: string; variant: string; text: string; values: unknown[] }

type Bbox = { minLng: number; maxLng: number; minLat: number; maxLat: number }
type ExplainResult = {
  query: string
  variant: string
  executionMs: number
  seqScans: string[]
  plan: string
}
type ExplainModule = {
  EXPLAIN_BBOX: Bbox
  SEEDED_SURVEYS: number
  SEEDED_EVENTS: number
  SEEDED_REPORTS: number
  LIST_PAGE_LIMIT: number
  LIST_MIDDLE_ROW: number
  BUSY_USER_EMAIL: string
  BUSY_SURVEY_ID: string
  WATCHED_RELATIONS: string[]
  buildLegacyMapItemsQuery: (input?: { from?: string; to?: string; region?: string }) => {
    text: string
    values: unknown[]
  }
  buildLegacyParcelStatusesSql: (withBbox: boolean) => string
  seed: (client: PoolClient) => Promise<void>
  buildListCases: (client: PoolClient, queries: ApiQueries) => Promise<ListCase[]>
  runExplain: (client: PoolClient, queries: ApiQueries) => Promise<ExplainResult[]>
}

const explain = jest.requireActual<ExplainModule>("../scripts/explain-public-routes")

const SLOW_TIMEOUT_MS = 120_000

type PlanNode = {
  "Node Type": string
  "Relation Name"?: string
  "Index Name"?: string
  Plans?: PlanNode[]
}

function walk(node: PlanNode, visit: (node: PlanNode) => void): void {
  visit(node)
  for (const child of node.Plans ?? []) {
    walk(child, visit)
  }
}

// The plan-09 study-status query (window over the features' communes), kept as the reference
// for its LATERAL rewrite.
const PLAN_09_STUDIED_BY_COMMUNES_SQL = `WITH latest_public AS (
   SELECT p.commune_code, p.section, p.number, s.id, s.observation_year, s.scores,
     ROW_NUMBER() OVER (
       PARTITION BY sp.parcel_id
       ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST
     ) AS rank_in_parcel
   FROM surveys s
   JOIN survey_parcels sp ON sp.survey_id = s.id
   JOIN parcels p ON p.parcel_id = sp.parcel_id
   WHERE s.deleted_at IS NULL
     AND s.status = 'submitted'
     AND s.visibility = 'public'
     AND ($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)
     AND p.commune_code = ANY($2::text[])
 )
 SELECT lp.commune_code, lp.section, lp.number, lp.id::text AS latest_submitted_survey_id,
   lp.observation_year AS latest_observation_year,
   (lp.scores ->> 'ibp_total')::integer AS latest_ibp_total
 FROM latest_public lp
 WHERE lp.rank_in_parcel = 1`

type MapItemRow = {
  id: string
  region_version: string | null
  scores: Record<string, unknown>
  submitted_at: string
  parcel_centroid_lat: number | null
  parcel_centroid_lng: number | null
}

// AVG over 1-3 doubles may differ in the last bit with the summation order, so the averages
// are compared to 9 decimals (the API rounds them to 2).
const roundAverage = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 1e9) / 1e9

// Rows that tie on submitted_at have no defined order in either query: order ties by id.
function normaliseMapItems(rows: MapItemRow[]): MapItemRow[] {
  return rows
    .map((row) => ({
      ...row,
      parcel_centroid_lat: roundAverage(row.parcel_centroid_lat),
      parcel_centroid_lng: roundAverage(row.parcel_centroid_lng),
    }))
    .sort((a, b) =>
      a.submitted_at === b.submitted_at
        ? a.id.localeCompare(b.id)
        : a.submitted_at < b.submitted_at
          ? 1
          : -1,
    )
}

describe("public routes on 10 000 surveys: EXPLAIN and legacy parity (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let client: PoolClient
  let inTransaction = false

  const counts = async (): Promise<Record<string, number>> =>
    (
      await db.query<Record<string, number>>(
        `SELECT (SELECT count(*) FROM users)::int AS users,
                (SELECT count(*) FROM parcels)::int AS parcels,
                (SELECT count(*) FROM surveys)::int AS surveys,
                (SELECT count(*) FROM survey_parcels)::int AS links,
                (SELECT count(*) FROM survey_events)::int AS events,
                (SELECT count(*) FROM reports)::int AS reports`,
      )
    ).rows[0]

  let countsBefore: Record<string, number>

  const explainJson = async (text: string, values: unknown[]): Promise<PlanNode> => {
    const result = await client.query<{ "QUERY PLAN": Array<{ Plan: PlanNode }> }>(
      `EXPLAIN (FORMAT JSON) ${text}`,
      values,
    )
    return result.rows[0]["QUERY PLAN"][0].Plan
  }

  const seqScansOn = (plan: PlanNode): string[] => {
    const found: string[] = []
    walk(plan, (node) => {
      if (
        node["Node Type"] === "Seq Scan" &&
        node["Relation Name"] &&
        explain.WATCHED_RELATIONS.includes(node["Relation Name"])
      ) {
        found.push(node["Relation Name"])
      }
    })
    return found
  }

  const nodeTypes = (plan: PlanNode): string[] => {
    const found: string[] = []
    walk(plan, (node) => {
      found.push(node["Node Type"])
    })
    return found
  }

  const indexesUsed = (plan: PlanNode): string[] => {
    const found = new Set<string>()
    walk(plan, (node) => {
      if (node["Index Name"]) {
        found.add(node["Index Name"])
      }
    })
    return [...found]
  }

  const rollback = async () => {
    if (inTransaction) {
      inTransaction = false
      await client.query("ROLLBACK")
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    await app.init()

    countsBefore = await counts()
    client = await db.connect()
    await client.query("BEGIN")
    inTransaction = true
    // The pool's 10 s statement_timeout (plan 06) is too short for the seed; SET LOCAL ends
    // with the rollback.
    await client.query("SET LOCAL statement_timeout = 0")
    await explain.seed(client)
  }, SLOW_TIMEOUT_MS)

  afterAll(async () => {
    try {
      await rollback()
    } finally {
      client?.release()
      await app?.close()
    }
  })

  it(
    "seeds 10 000 surveys, 2 000 of them public and submitted",
    async () => {
      const result = await client.query<{ total: number; public_submitted: number }>(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE status = 'submitted' AND visibility = 'public')::int AS public_submitted
         FROM surveys WHERE id LIKE 'explain-s%'`,
      )
      expect(result.rows[0]).toEqual({ total: explain.SEEDED_SURVEYS, public_submitted: 2000 })

      const links = await client.query<{ links: number; dangling: number; no_centroid: number }>(
        `SELECT count(*)::int AS links,
                count(*) FILTER (WHERE p.parcel_id IS NULL)::int AS dangling,
                count(*) FILTER (WHERE p.centroid_lat IS NULL)::int AS no_centroid
         FROM survey_parcels sp
         LEFT JOIN parcels p ON p.parcel_id = sp.parcel_id
         WHERE sp.survey_id LIKE 'explain-s%'`,
      )
      expect(links.rows[0].links).toBeGreaterThan(19_000)
      expect(links.rows[0].dangling).toBe(0)
      expect(links.rows[0].no_centroid).toBeGreaterThan(0)
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "map items: limit-first index scan and LATERAL aggregate, no seq scan",
    async () => {
      for (const filters of [{}, { region: "ACA" }, { from: "2020-01-01", to: "2100-12-31" }]) {
        const query = publicMapQueries.buildPublicMapItemsQuery(filters)
        const plan = await explainJson(query.text, query.values)
        expect(seqScansOn(plan)).toEqual([])
        expect(indexesUsed(plan)).toEqual(
          expect.arrayContaining(["idx_surveys_public_submitted", "survey_parcels_pkey"]),
        )
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "parcel statuses: bbox on the centroid index and LATERAL latest survey, no seq scan",
    async () => {
      const bbox = explain.EXPLAIN_BBOX
      for (const year of [null, 2022]) {
        const plan = await explainJson(publicMapQueries.PUBLIC_PARCEL_STATUSES_BBOX_SQL, [
          year,
          bbox.minLng,
          bbox.maxLng,
          bbox.minLat,
          bbox.maxLat,
        ])
        expect(seqScansOn(plan)).toEqual([])
        expect(indexesUsed(plan)).toEqual(
          expect.arrayContaining(["idx_parcels_centroid_lat_lng", "idx_survey_parcels_parcel_id"]),
        )
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "map items: same rows as the pre-01.7 query",
    async () => {
      const cases = [
        {},
        { region: "ACA" },
        { from: "2020-01-01", to: "2100-12-31" },
        { from: "2100-01-01" },
      ]
      for (const filters of cases) {
        const legacy = explain.buildLegacyMapItemsQuery(filters)
        const current = publicMapQueries.buildPublicMapItemsQuery(filters)
        expect(current.values).toEqual(legacy.values)

        const before = await client.query<MapItemRow>(legacy.text, legacy.values)
        const after = await client.query<MapItemRow>(current.text, current.values)

        expect(normaliseMapItems(after.rows)).toEqual(normaliseMapItems(before.rows))
        for (let index = 1; index < after.rows.length; index += 1) {
          expect(after.rows[index - 1].submitted_at >= after.rows[index].submitted_at).toBe(true)
        }
        if (Object.keys(filters).length === 0) {
          expect(after.rows).toHaveLength(500)
          expect(after.rows.some((row) => row.parcel_centroid_lat === null)).toBe(true)
        }
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "parcel statuses with a bbox: same rows as the pre-01.7 query",
    async () => {
      const bboxes: Bbox[] = [
        explain.EXPLAIN_BBOX,
        // The whole seeded range: more than 1 000 parcels, so the LIMIT decides.
        { minLng: -5, maxLng: 9, minLat: 41, maxLat: 52 },
        // Nothing seeded there.
        { minLng: 100, maxLng: 101, minLat: -10, maxLat: -9 },
      ]
      const legacySql = explain.buildLegacyParcelStatusesSql(true)
      for (const bbox of bboxes) {
        for (const year of [null, 2022]) {
          const values = [year, bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat]
          const before = await client.query(legacySql, values)
          const after = await client.query(publicMapQueries.PUBLIC_PARCEL_STATUSES_BBOX_SQL, values)
          expect(after.rows).toEqual(before.rows)
          if (bbox === explain.EXPLAIN_BBOX) {
            expect(after.rows.length).toBeGreaterThan(0)
            expect(after.rows.some((row) => row.study_status === "studied")).toBe(true)
            expect(after.rows.some((row) => row.study_status === "not_studied")).toBe(true)
          }
          if (bbox.minLng === -5) {
            expect(after.rows).toHaveLength(1000)
          }
        }
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "parcel statuses without a bbox: same rows as the pre-01.7 query",
    async () => {
      const legacySql = explain.buildLegacyParcelStatusesSql(false)
      for (const year of [null, 2023]) {
        const before = await client.query(legacySql, [year])
        const after = await client.query(publicMapQueries.PUBLIC_PARCEL_STATUSES_SQL, [year])
        expect(after.rows).toHaveLength(1000)
        expect(after.rows).toEqual(before.rows)
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "studied parcels by commune: same rows as the plan-09 window query",
    async () => {
      const communes = ["99000", "99001", "99017", "99399", "00000"]
      const sortKey = (row: { commune_code: string; section: string; number: string }) =>
        `${row.commune_code}|${row.section}|${row.number}`
      for (const year of [null, 2021]) {
        const before = await client.query(PLAN_09_STUDIED_BY_COMMUNES_SQL, [year, communes])
        const after = await client.query(publicMapQueries.PUBLIC_STUDIED_BY_COMMUNES_SQL, [
          year,
          communes,
        ])
        expect(after.rows.length).toBeGreaterThan(0)
        const sort = (rows: typeof after.rows) =>
          [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
        expect(sort(after.rows)).toEqual(sort(before.rows))
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "seeds 30 000 events (1 000+ on the busy survey) and 20 000 reports",
    async () => {
      const result = await client.query<{
        events: number
        busy_events: number
        reports: number
        open_reports: number
        busy_surveys: number
      }>(
        `SELECT (SELECT count(*) FROM survey_events WHERE id LIKE 'explain-e%')::int AS events,
                (SELECT count(*) FROM survey_events WHERE survey_id = $1)::int AS busy_events,
                (SELECT count(*) FROM reports WHERE reason LIKE 'Explain reason %')::int AS reports,
                (SELECT count(*) FROM reports WHERE reason LIKE 'Explain reason %' AND status = 'open')::int AS open_reports,
                (SELECT count(*) FROM surveys s JOIN users u ON u.id = s.user_id
                  WHERE u.email = $2 AND s.deleted_at IS NULL)::int AS busy_surveys`,
        [explain.BUSY_SURVEY_ID, explain.BUSY_USER_EMAIL],
      )
      const row = result.rows[0]
      expect(row.events).toBe(explain.SEEDED_EVENTS)
      expect(row.reports).toBe(explain.SEEDED_REPORTS)
      expect(row.busy_events).toBeGreaterThan(explain.LIST_MIDDLE_ROW + explain.LIST_PAGE_LIMIT)
      expect(row.busy_surveys).toBeGreaterThan(explain.LIST_MIDDLE_ROW + explain.LIST_PAGE_LIMIT)
      expect(row.open_reports).toBeGreaterThan(explain.LIST_MIDDLE_ROW + explain.LIST_PAGE_LIMIT)
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "paginated lists: first and middle pages are index scans, no seq scan and no full sort",
    async () => {
      const cases = await explain.buildListCases(client, apiQueries)
      expect(cases).toHaveLength(8)
      const expectedIndex: Record<string, string> = {
        "GET /surveys (busy user)": "idx_surveys_user_updated",
        "GET /surveys/:id/events (busy survey)": "idx_survey_events_survey",
        "GET /reports": "idx_reports_created_id",
        "GET /reports?status=open": "idx_reports_status_created",
      }
      for (const listCase of cases) {
        const plan = await explainJson(listCase.text, listCase.values)
        const label = `${listCase.query} ${listCase.variant}`
        expect({ label, seqScans: seqScansOn(plan) }).toEqual({ label, seqScans: [] })
        expect({ label, indexes: indexesUsed(plan) }).toEqual({
          label,
          indexes: [expectedIndex[listCase.query]],
        })
        // A plain Sort would mean the whole scope is read and sorted; an Incremental Sort only
        // orders the rows that share a timestamp.
        expect({ label, sort: nodeTypes(plan).includes("Sort") }).toEqual({ label, sort: false })
        expect(nodeTypes(plan)[0]).toBe("Limit")
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "paginated lists: the first and middle pages are slices of the unpaginated order",
    async () => {
      const cases = await explain.buildListCases(client, apiQueries)
      const busyUser = await client.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
        explain.BUSY_USER_EMAIL,
      ])
      const unpaginated = { limit: null, after: null }
      const full: Record<string, { text: string; values: unknown[] }> = {
        "GET /surveys (busy user)": buildListForUserQuery(busyUser.rows[0].id, {}, unpaginated),
        "GET /surveys/:id/events (busy survey)": buildEventListQuery(
          explain.BUSY_SURVEY_ID,
          unpaginated,
        ),
        "GET /reports": buildReportListQuery(null, unpaginated),
        "GET /reports?status=open": buildReportListQuery("open", unpaginated),
      }
      const limit = explain.LIST_PAGE_LIMIT
      for (const listCase of cases) {
        const all = (await client.query(full[listCase.query].text, full[listCase.query].values))
          .rows
        const page = (await client.query(listCase.text, listCase.values)).rows
        // Each page fetches limit + 1 rows (the extra one only tells that more exist).
        const start = listCase.variant.startsWith("first") ? 0 : explain.LIST_MIDDLE_ROW
        expect(page).toEqual(all.slice(start, start + limit + 1))
      }
    },
    SLOW_TIMEOUT_MS,
  )

  it(
    "the EXPLAIN script reports no seq scan after the rewrite and leaves no row behind",
    async () => {
      await rollback()
      expect(await counts()).toEqual(countsBefore)

      const results = await explain.runExplain(client, apiQueries)

      expect(results.map((result) => `${result.query} ${result.variant}`)).toEqual([
        "/public/map-items before (pre-01.7)",
        "/public/map-items after",
        "/public/parcels/status?bbox before (pre-01.7)",
        "/public/parcels/status?bbox after",
        "GET /surveys (busy user) first page (limit 50)",
        "GET /surveys (busy user) middle page (after row 500)",
        "GET /surveys/:id/events (busy survey) first page (limit 50)",
        "GET /surveys/:id/events (busy survey) middle page (after row 500)",
        "GET /reports first page (limit 50)",
        "GET /reports middle page (after row 500)",
        "GET /reports?status=open first page (limit 50)",
        "GET /reports?status=open middle page (after row 500)",
      ])
      for (const result of results.filter((entry) => !entry.variant.startsWith("before"))) {
        expect(result.seqScans).toEqual([])
        expect(Number.isFinite(result.executionMs)).toBe(true)
      }
      expect(await counts()).toEqual(countsBefore)
    },
    SLOW_TIMEOUT_MS,
  )
})
