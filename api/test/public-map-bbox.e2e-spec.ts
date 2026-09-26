import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { randomUUID } from "crypto"
import { PoolClient } from "pg"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { buildPublicMapItemsQuery, PUBLIC_MAP_ITEMS_LIMIT } from "../src/surveys/public-map.queries"
import { PublicMapDbRow, PublicMapItem, toPublicMapItem } from "../src/surveys/public-map.utils"

// 01.9 D-05: GET /v1/public/map-items takes an optional bbox=minLng,minLat,maxLng,maxLat and
// keeps only the public surveys whose linked parcel centroid lies inside it. Without bbox the
// answer is exactly the pre-01.9 one, so installed apps are unaffected. A malformed bbox gets
// parseBbox's fixed 400 without echoing the input (T-01.9-14), an over-long one the
// ValidationPipe's 400 (T-01.9-11), and a private survey inside the box never shows up
// (T-01.9-13). The bbox predicate walks idx_parcels_centroid_lat_lng (migration 015, 01.7
// D-13): EXPLAIN on 10 000 seeded surveys shows no seq scan (T-01.9-12).
//
// This spec is new on purpose: 01.8 splits surveys-idempotency.e2e-spec.ts, so the bbox cases
// do not go there.

type ExplainModule = {
  EXPLAIN_BBOX: { minLng: number; maxLng: number; minLat: number; maxLat: number }
  WATCHED_RELATIONS: string[]
  seed: (client: PoolClient) => Promise<void>
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

const indexesUsed = (plan: PlanNode): string[] => {
  const found = new Set<string>()
  walk(plan, (node) => {
    if (node["Index Name"]) {
      found.add(node["Index Name"])
    }
  })
  return [...found]
}

// A small box far from the synthetic cadastre's parcels and from the EXPLAIN seed (mainland
// France): lng 12.30-12.40, lat 41.80-41.90.
const BOX = { minLng: 12.3, minLat: 41.8, maxLng: 12.4, maxLat: 41.9 }
const BOX_PARAM = `${BOX.minLng},${BOX.minLat},${BOX.maxLng},${BOX.maxLat}`
const INSIDE = { lat: 41.851234, lng: 12.351234 }
const OUTSIDE = { lat: 41.951234, lng: 12.451234 }

describe("public map items by bbox (e2e, 01.9 D-05)", () => {
  let app: NestExpressApplication
  let db: DatabaseService

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const userId = randomUUID()
  const insidePublicId = `bbox-in-pub-${stamp}`
  const outsidePublicId = `bbox-out-pub-${stamp}`
  const insidePrivateId = `bbox-in-prv-${stamp}`
  const surveyIds = [insidePublicId, outsidePublicId, insidePrivateId]
  const parcelIds = {
    inside: `99BBXIN${stamp}`,
    outside: `99BBXOUT${stamp}`,
    insidePrivate: `99BBXPRV${stamp}`,
  }

  const getItems = async (query: Record<string, string> = {}): Promise<PublicMapItem[]> => {
    const res = await request(app.getHttpServer())
      .get("/v1/public/map-items")
      .query(query)
      .expect(200)
    return res.body.items as PublicMapItem[]
  }

  const ids = (items: PublicMapItem[]) => items.map((item) => item.survey_id)

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    await app.init()

    await db.query(`INSERT INTO users (id, email, auth0_sub) VALUES ($1, $2, $3)`, [
      userId,
      `e2e-bbox-${stamp}@ibp.local`,
      `e2e-bbox|${stamp}`,
    ])
    const parcels: Array<[string, { lat: number; lng: number }]> = [
      [parcelIds.inside, INSIDE],
      [parcelIds.outside, OUTSIDE],
      [parcelIds.insidePrivate, INSIDE],
    ]
    for (const [parcelId, centroid] of parcels) {
      await db.query(
        `INSERT INTO parcels (id, parcel_id, commune_code, section, number, centroid, source)
         VALUES ($1, $2, '99BBX', 'BX', $3, $4::jsonb, 'synthetic_v1')`,
        [randomUUID(), parcelId, parcelId.slice(-4), JSON.stringify(centroid)],
      )
    }
    const surveys: Array<[string, string, string]> = [
      [insidePublicId, "public", parcelIds.inside],
      [outsidePublicId, "public", parcelIds.outside],
      [insidePrivateId, "private", parcelIds.insidePrivate],
    ]
    for (const [surveyId, visibility, parcelId] of surveys) {
      await db.query(
        `INSERT INTO surveys (id, user_id, site_name, status, visibility, region_version, scores,
                              created_at, updated_at, submitted_at, expires_at, sync_version,
                              observation_year, version_number)
         VALUES ($1, $2, $3, 'submitted', $4, 'ACA', '{"ibp_total": 21}'::jsonb,
                 now(), now(), now(), now() + interval '7 days', 1, 2025, 1)`,
        [surveyId, userId, `Bbox site ${surveyId}`, visibility],
      )
      await db.query(`INSERT INTO survey_parcels (survey_id, parcel_id) VALUES ($1, $2)`, [
        surveyId,
        parcelId,
      ])
    }
  })

  afterAll(async () => {
    try {
      if (db) {
        await db.query(`DELETE FROM survey_parcels WHERE survey_id = ANY($1::text[])`, [surveyIds])
        await db.query(`DELETE FROM surveys WHERE id = ANY($1::text[])`, [surveyIds])
        await db.query(`DELETE FROM parcels WHERE parcel_id = ANY($1::text[])`, [
          Object.values(parcelIds),
        ])
        await db.query(`DELETE FROM users WHERE id = $1`, [userId])
      }
    } finally {
      await app?.close()
    }
  })

  it("without bbox answers exactly the pre-01.9 query (installed apps unaffected)", async () => {
    const items = await getItems()

    const query = buildPublicMapItemsQuery()
    expect(query.values).toEqual([])
    const rows = await db.query<PublicMapDbRow>(query.text, query.values)
    const expected = rows.rows
      .map((row) => toPublicMapItem(row))
      .filter((item): item is PublicMapItem => Boolean(item))

    expect(items).toEqual(expected)
    expect(items.length).toBeLessThanOrEqual(PUBLIC_MAP_ITEMS_LIMIT)
    expect(ids(items)).toEqual(expect.arrayContaining([insidePublicId, outsidePublicId]))
    expect(ids(items)).not.toContain(insidePrivateId)
  })

  it("with bbox keeps the public survey inside, drops the one outside and the private one inside", async () => {
    const items = await getItems({ bbox: BOX_PARAM })

    expect(ids(items)).toContain(insidePublicId)
    expect(ids(items)).not.toContain(outsidePublicId)
    expect(ids(items)).not.toContain(insidePrivateId)
    for (const item of items) {
      // display_location is the rounded parcel centroid (2 decimals, privacy rule unchanged).
      expect(item.display_location.lng).toBeGreaterThanOrEqual(BOX.minLng - 0.005)
      expect(item.display_location.lng).toBeLessThanOrEqual(BOX.maxLng + 0.005)
      expect(item.display_location.lat).toBeGreaterThanOrEqual(BOX.minLat - 0.005)
      expect(item.display_location.lat).toBeLessThanOrEqual(BOX.maxLat + 0.005)
    }
    expect(items.find((item) => item.survey_id === insidePublicId)).toEqual({
      survey_id: insidePublicId,
      display_location: { lat: 41.85, lng: 12.35 },
      survey_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      region_code: "ACA",
      ibp_total: 21,
    })

    // The other filters still apply next to the bbox.
    expect(ids(await getItems({ bbox: BOX_PARAM, region: "ACA" }))).toContain(insidePublicId)
    expect(ids(await getItems({ bbox: BOX_PARAM, region: "IDF" }))).not.toContain(insidePublicId)

    // A box around the outside parcel only.
    const outsideItems = await getItems({ bbox: "12.42,41.92,12.48,41.98" })
    expect(ids(outsideItems)).toContain(outsidePublicId)
    expect(ids(outsideItems)).not.toContain(insidePublicId)
  })

  it("a blank bbox is no bbox", async () => {
    const withBlank = await getItems({ bbox: "" })
    expect(ids(withBlank)).toEqual(expect.arrayContaining([insidePublicId, outsidePublicId]))
  })

  it("rejects a malformed bbox with a fixed 400 that does not echo the input", async () => {
    const cases: Array<[string, string]> = [
      ["a,b,c,d", "bbox contains invalid coordinate values"],
      ["1,2", "bbox must contain exactly 4 comma-separated numbers"],
      ["12.4,41.8,12.3,41.9", "bbox bounds are invalid"],
    ]
    for (const [bbox, message] of cases) {
      const res = await request(app.getHttpServer())
        .get("/v1/public/map-items")
        .query({ bbox })
        .expect(400)
      expect(res.body.message).toBe(message)
      expect(JSON.stringify(res.body)).not.toContain(bbox)
    }
  })

  it("rejects a bbox longer than 128 characters in the ValidationPipe", async () => {
    const bbox = `1,2,3,${"4".repeat(123)}`
    expect(bbox).toHaveLength(129)
    const res = await request(app.getHttpServer())
      .get("/v1/public/map-items")
      .query({ bbox })
      .expect(400)
    expect(JSON.stringify(res.body)).not.toContain(bbox)

    // 128 characters pass the DTO and reach parseBbox.
    await request(app.getHttpServer())
      .get("/v1/public/map-items")
      .query({ bbox: `1,2,3,${"4".repeat(122)}` })
      .expect(200)
  })

  describe("EXPLAIN on 10 000 seeded surveys (rolled back)", () => {
    let client: PoolClient
    let inTransaction = false

    const explainJson = async (text: string, values: unknown[]): Promise<PlanNode> => {
      const result = await client.query<{ "QUERY PLAN": Array<{ Plan: PlanNode }> }>(
        `EXPLAIN (FORMAT JSON) ${text}`,
        values,
      )
      return result.rows[0]["QUERY PLAN"][0].Plan
    }

    beforeAll(async () => {
      client = await db.connect()
      await client.query("BEGIN")
      inTransaction = true
      // The pool's statement_timeout is too short for the seed; SET LOCAL ends with the
      // rollback, like public-routes-explain.e2e-spec.ts (RESEARCH Pitfall 11).
      await client.query("SET LOCAL statement_timeout = 0")
      await explain.seed(client)
    }, SLOW_TIMEOUT_MS)

    afterAll(async () => {
      try {
        if (inTransaction) {
          inTransaction = false
          await client.query("ROLLBACK")
        }
      } finally {
        client?.release()
      }
    })

    it(
      "the bbox query reads parcels by index, never scans parcels, and the no-bbox query is unchanged",
      async () => {
        // The 1 degree EXPLAIN box (about 1 % of the seeded parcels) sits close to the
        // planner's tipping point, and ANALYZE samples at random, so the plan varies between
        // runs. Either the planner reads the parcels through the centroid index and hashes
        // their ~180 links against survey_parcels (which it may read sequentially for the
        // hash, about 1.5 ms), or it walks idx_surveys_public_submitted and probes each
        // survey's parcels by key. Both are fine: parcels and surveys are never scanned, and
        // parcels are always reached through an index.
        const parcelIndexes = ["idx_parcels_centroid_lat_lng", "parcels_parcel_id_key"]
        const cases: Array<Record<string, string>> = [
          {},
          { region: "ACA" },
          { from: "2020-01-01", to: "2100-12-31" },
        ]
        for (const filters of cases) {
          const query = buildPublicMapItemsQuery({ ...filters, bbox: explain.EXPLAIN_BBOX })
          const plan = await explainJson(query.text, query.values)
          const used = indexesUsed(plan)
          expect({
            filters,
            seqScans: seqScansOn(plan).filter((relation) => relation !== "survey_parcels"),
            readsParcelsByIndex: parcelIndexes.some((index) => used.includes(index)),
          }).toEqual({ filters, seqScans: [], readsParcelsByIndex: true })
        }

        // A city-sized box (what the map sends when zoomed in): fully index-driven.
        const cityBox = { minLng: 2.3, maxLng: 2.4, minLat: 48.8, maxLat: 48.9 }
        const city = buildPublicMapItemsQuery({ bbox: cityBox })
        const cityPlan = await explainJson(city.text, city.values)
        expect(seqScansOn(cityPlan)).toEqual([])
        expect(indexesUsed(cityPlan)).toEqual(
          expect.arrayContaining(["idx_parcels_centroid_lat_lng", "idx_survey_parcels_parcel_id"]),
        )

        const plain = buildPublicMapItemsQuery()
        const plainPlan = await explainJson(plain.text, plain.values)
        expect(seqScansOn(plainPlan)).toEqual([])
        expect(indexesUsed(plainPlan)).toEqual(
          expect.arrayContaining(["idx_surveys_public_submitted", "survey_parcels_pkey"]),
        )
        expect(indexesUsed(plainPlan)).not.toContain("idx_parcels_centroid_lat_lng")
      },
      SLOW_TIMEOUT_MS,
    )

    it(
      "the bbox query returns the latest public surveys with a parcel centroid in the box",
      async () => {
        const bbox = explain.EXPLAIN_BBOX
        const query = buildPublicMapItemsQuery({ bbox })
        const current = await client.query<{ id: string }>(query.text, query.values)

        // Reference written without EXISTS: join, then distinct, then the same order and limit.
        const reference = await client.query<{ id: string }>(
          `SELECT id FROM (
             SELECT DISTINCT s.id, s.submitted_at
             FROM surveys s
             JOIN survey_parcels sp ON sp.survey_id = s.id
             JOIN parcels p ON p.parcel_id = sp.parcel_id
             WHERE s.status = 'submitted' AND s.visibility = 'public' AND s.deleted_at IS NULL
               AND s.submitted_at IS NOT NULL
               AND p.centroid_lng BETWEEN $1 AND $2
               AND p.centroid_lat BETWEEN $3 AND $4
           ) q
           ORDER BY submitted_at DESC, id
           LIMIT ${PUBLIC_MAP_ITEMS_LIMIT}`,
          [bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat],
        )

        expect(reference.rows.length).toBeGreaterThan(0)
        expect(new Set(current.rows.map((row) => row.id))).toEqual(
          new Set(reference.rows.map((row) => row.id)),
        )
      },
      SLOW_TIMEOUT_MS,
    )
  })
})
