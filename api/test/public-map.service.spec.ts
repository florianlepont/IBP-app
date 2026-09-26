import { BadRequestException } from "@nestjs/common"
import { DatabaseService } from "../src/database/database.service"
import { CadastreProviderService, WfsParcelFeature } from "../src/surveys/cadastre-provider.service"
import {
  buildPublicMapItemsQuery,
  PUBLIC_PARCEL_STATUSES_BBOX_SQL,
  PUBLIC_PARCEL_STATUSES_SQL,
  PUBLIC_STUDIED_BY_COMMUNES_SQL,
} from "../src/surveys/public-map.queries"
import { PublicMapService } from "../src/surveys/public-map.service"

type QueryResult = { rows: unknown[] }

function buildDb(...results: QueryResult[]) {
  const query = jest.fn()
  for (const result of results) {
    query.mockResolvedValueOnce(result)
  }
  query.mockResolvedValue({ rows: [] })
  return { query }
}

function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").trim()
}

function buildCadastre(
  overrides: { wfsEnabled?: boolean; features?: WfsParcelFeature[] | null } = {},
) {
  return {
    wfsEnabled: overrides.wfsEnabled ?? false,
    fetchParcelFeaturesInBbox: jest.fn().mockResolvedValue(overrides.features ?? null),
  }
}

function buildService(
  db: { query: jest.Mock } = buildDb(),
  cadastre: ReturnType<typeof buildCadastre> = buildCadastre(),
): PublicMapService {
  return new PublicMapService(
    db as unknown as DatabaseService,
    cadastre as unknown as CadastreProviderService,
  )
}

const feature = (overrides: Partial<WfsParcelFeature> = {}): WfsParcelFeature => ({
  parcel_id: "75056000AB0001",
  commune_code: "75056",
  section: "AB",
  number: "0001",
  geometry: { type: "Polygon", coordinates: [] },
  ...overrides,
})

// The /public/map-items SQL as it was before 01.9 D-05, copied from the builder's output before
// the bbox was added: without a bbox the query must stay byte-identical.
const PRE_BBOX_MAP_ITEMS_SQL = [
  "SELECT",
  "   s.id,",
  "   s.region_version,",
  "   s.scores,",
  "   s.submitted_at::text,",
  "   agg.parcel_centroid_lat,",
  "   agg.parcel_centroid_lng",
  " FROM (",
  "   SELECT s.id, s.region_version, s.scores, s.submitted_at",
  "   FROM surveys s",
  "   WHERE s.status = 'submitted' AND s.visibility = 'public' AND s.deleted_at IS NULL",
  "     AND s.submitted_at IS NOT NULL",
  "%FILTERS%   ORDER BY s.submitted_at DESC",
  "   LIMIT 500",
  " ) s",
  " LEFT JOIN LATERAL (",
  "   SELECT",
  "     AVG(p.centroid_lat) AS parcel_centroid_lat,",
  "     AVG(p.centroid_lng) AS parcel_centroid_lng",
  "   FROM survey_parcels sp",
  "   JOIN parcels p",
  "     ON p.parcel_id = sp.parcel_id",
  "   WHERE sp.survey_id = s.id",
  " ) agg ON true",
  " ORDER BY s.submitted_at DESC",
].join("\n")

const preBboxSql = (filters: string[] = []): string =>
  PRE_BBOX_MAP_ITEMS_SQL.replace("%FILTERS%", filters.map((line) => `     AND ${line}\n`).join(""))

describe("public map queries (D-13)", () => {
  it("map items: limits the public surveys first, then aggregates their parcels in a LATERAL", () => {
    const { text, values } = buildPublicMapItemsQuery()
    const sql = flat(text)

    expect(values).toEqual([])
    expect(sql).toContain(
      "WHERE s.status = 'submitted' AND s.visibility = 'public' AND s.deleted_at IS NULL AND s.submitted_at IS NOT NULL",
    )
    expect(sql.indexOf("LIMIT 500")).toBeGreaterThan(-1)
    expect(sql.indexOf("LIMIT 500")).toBeLessThan(sql.indexOf("LATERAL"))
    expect(sql).not.toContain("GROUP BY s.id")
    expect(sql).toContain("AVG(p.centroid_lat)")
    expect(sql).toContain("AVG(p.centroid_lng)")
    expect(sql).not.toContain("centroid ->>")
    expect(sql).toMatch(/ORDER BY s\.submitted_at DESC$/)
  })

  it("map items: appends the optional filters in the pre-01.7 order (from, to, region)", () => {
    const { text, values } = buildPublicMapItemsQuery({
      from: "2026-01-01",
      to: "2026-12-31",
      region: "ACA",
    })
    const sql = flat(text)

    expect(values).toEqual(["2026-01-01", "2026-12-31", "ACA"])
    expect(sql).toContain("s.submitted_at::date >= $1::date")
    expect(sql).toContain("s.submitted_at::date <= $2::date")
    expect(sql).toContain("s.region_version = $3")
    expect(sql.indexOf("s.region_version = $3")).toBeLessThan(sql.indexOf("LIMIT 500"))
  })

  it("map items: numbers the parameters densely when only some filters are set", () => {
    const { text, values } = buildPublicMapItemsQuery({ to: "2026-12-31", region: "ACA" })
    expect(values).toEqual(["2026-12-31", "ACA"])
    expect(flat(text)).toContain("s.submitted_at::date <= $1::date")
    expect(flat(text)).toContain("s.region_version = $2")
  })

  it("map items: without a bbox the query is byte-identical to the pre-01.9 one (D-05)", () => {
    expect(buildPublicMapItemsQuery()).toEqual({ text: preBboxSql(), values: [] })
    expect(buildPublicMapItemsQuery({ bbox: null })).toEqual({ text: preBboxSql(), values: [] })
    expect(
      buildPublicMapItemsQuery({ from: "2026-01-01", to: "2026-12-31", region: "ACA" }),
    ).toEqual({
      text: preBboxSql([
        "s.submitted_at::date >= $1::date",
        "s.submitted_at::date <= $2::date",
        "s.region_version = $3",
      ]),
      values: ["2026-01-01", "2026-12-31", "ACA"],
    })
  })

  it("map items: the bbox is an EXISTS on the centroid columns, appended last, before the limit (D-05)", () => {
    const bbox = { minLng: 2, minLat: 48, maxLng: 3, maxLat: 49 }
    const { text, values } = buildPublicMapItemsQuery({
      from: "2026-01-01",
      to: "2026-12-31",
      region: "ACA",
      bbox,
    })
    const sql = flat(text)

    expect(values).toEqual(["2026-01-01", "2026-12-31", "ACA", 2, 3, 48, 49])
    expect(sql).toContain(
      "AND s.region_version = $3 AND EXISTS ( SELECT 1 FROM survey_parcels sp JOIN parcels p ON p.parcel_id = sp.parcel_id WHERE sp.survey_id = s.id AND p.centroid_lng BETWEEN $4::double precision AND $5::double precision AND p.centroid_lat BETWEEN $6::double precision AND $7::double precision )",
    )
    expect(sql.indexOf("EXISTS")).toBeLessThan(sql.indexOf("LIMIT 500"))
    expect(sql).toContain(
      "WHERE s.status = 'submitted' AND s.visibility = 'public' AND s.deleted_at IS NULL AND s.submitted_at IS NOT NULL",
    )

    const alone = buildPublicMapItemsQuery({ bbox })
    expect(alone.values).toEqual([2, 3, 48, 49])
    expect(flat(alone.text)).toContain("p.centroid_lng BETWEEN $1::double precision")
    expect(flat(alone.text)).toContain("p.centroid_lat BETWEEN $3::double precision")
  })

  it("parcel statuses: the bbox is a range on the generated columns, then a LATERAL latest survey", () => {
    const sql = flat(PUBLIC_PARCEL_STATUSES_BBOX_SQL)

    expect(sql).toContain("p.centroid_lng BETWEEN $2::double precision AND $3::double precision")
    expect(sql).toContain("p.centroid_lat BETWEEN $4::double precision AND $5::double precision")
    expect(sql).not.toContain("centroid ->>")
    expect(sql).not.toContain("ROW_NUMBER")
    expect(sql.indexOf("LIMIT 1000")).toBeLessThan(sql.indexOf("LEFT JOIN LATERAL"))
    expect(sql).toContain(
      "ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST LIMIT 1",
    )
    expect(sql).toContain(
      "s.status = 'submitted' AND s.visibility = 'public' AND s.deleted_at IS NULL",
    )
  })

  it("parcel statuses without a bbox and the studied query share the latest-survey probe", () => {
    for (const text of [PUBLIC_PARCEL_STATUSES_SQL, PUBLIC_STUDIED_BY_COMMUNES_SQL]) {
      const sql = flat(text)
      expect(sql).toContain("LATERAL")
      expect(sql).toContain("WHERE sp.parcel_id = p.parcel_id")
      expect(sql).toContain(
        "($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)",
      )
    }
    expect(flat(PUBLIC_STUDIED_BY_COMMUNES_SQL)).toContain("p.commune_code = ANY($2::text[])")
  })
})

describe("PublicMapService", () => {
  describe("getPublicMapItems", () => {
    it("runs the built query with normalised filters and maps the rows", async () => {
      const db = buildDb({
        rows: [
          {
            id: "s1",
            region_version: "ACA",
            scores: { ibp_total: 31 },
            submitted_at: "2026-03-04 10:00:00+00",
            parcel_centroid_lat: 48.8566,
            parcel_centroid_lng: 2.3522,
          },
          {
            id: "s2",
            region_version: null,
            scores: {},
            submitted_at: "2026-03-03 10:00:00+00",
            parcel_centroid_lat: null,
            parcel_centroid_lng: null,
          },
        ],
      })
      const service = buildService(db)

      const output = await service.getPublicMapItems({
        from: " 2026-01-01 ",
        to: "not-a-date",
        region: "  ACA ",
      })

      expect(db.query).toHaveBeenCalledTimes(1)
      const [text, values] = db.query.mock.calls[0] as [string, unknown[]]
      expect(text).toBe(buildPublicMapItemsQuery({ from: "2026-01-01", region: "ACA" }).text)
      expect(values).toEqual(["2026-01-01", "ACA"])
      expect(output).toEqual({
        items: [
          {
            survey_id: "s1",
            display_location: { lat: 48.86, lng: 2.35 },
            survey_date: "2026-03-04",
            region_code: "ACA",
            ibp_total: 31,
          },
        ],
      })
    })

    it("ignores a blank region and missing input", async () => {
      const db = buildDb()
      await buildService(db).getPublicMapItems({ region: "   " })
      await buildService(db).getPublicMapItems()
      expect(db.query.mock.calls[0][1]).toEqual([])
      expect(db.query.mock.calls[1][1]).toEqual([])
    })
    it("passes a parsed bbox to the query (D-05)", async () => {
      const db = buildDb()
      await buildService(db).getPublicMapItems({ region: "ACA", bbox: " 2.1, 48.5 ,2.6,48.9 " })
      const [text, values] = db.query.mock.calls[0] as [string, unknown[]]
      expect(text).toBe(
        buildPublicMapItemsQuery({
          region: "ACA",
          bbox: { minLng: 2.1, minLat: 48.5, maxLng: 2.6, maxLat: 48.9 },
        }).text,
      )
      expect(values).toEqual(["ACA", 2.1, 2.6, 48.5, 48.9])
    })

    it("rejects a malformed bbox with parseBbox's fixed message before any query (D-05)", async () => {
      const db = buildDb()
      const service = buildService(db)
      await expect(service.getPublicMapItems({ bbox: "1,2" })).rejects.toThrow(
        new BadRequestException("bbox must contain exactly 4 comma-separated numbers"),
      )
      await expect(service.getPublicMapItems({ bbox: "a,b,c,d" })).rejects.toThrow(
        new BadRequestException("bbox contains invalid coordinate values"),
      )
      await expect(service.getPublicMapItems({ bbox: "3,48,2,49" })).rejects.toThrow(
        new BadRequestException("bbox bounds are invalid"),
      )
      expect(db.query).not.toHaveBeenCalled()
    })

    it("treats a blank bbox as no bbox", async () => {
      const db = buildDb()
      await buildService(db).getPublicMapItems({ bbox: "  " })
      expect(db.query.mock.calls[0]).toEqual([preBboxSql(), []])
    })
  })

  describe("getPublicParcelStatuses", () => {
    it("answers an empty list below zoom 15 without any query or IGN call", async () => {
      const db = buildDb()
      const cadastre = buildCadastre({ wfsEnabled: true, features: [feature()] })

      const output = await buildService(db, cadastre).getPublicParcelStatuses({
        zoom: "14.9",
        bbox: "2,48,3,49",
      })

      expect(output).toEqual({ items: [] })
      expect(db.query).not.toHaveBeenCalled()
      expect(cadastre.fetchParcelFeaturesInBbox).not.toHaveBeenCalled()
    })

    it("rejects an invalid bbox before any query", async () => {
      const db = buildDb()
      await expect(
        buildService(db).getPublicParcelStatuses({ zoom: "16", bbox: "3,48,2,49" }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(db.query).not.toHaveBeenCalled()
    })

    it("uses the bbox query on the generated columns when IGN returns null", async () => {
      const db = buildDb({
        rows: [
          {
            parcel_id: "P1",
            study_status: "studied",
            latest_submitted_survey_id: "s1",
            latest_observation_year: 2025,
            latest_ibp_total: 30,
            geometry: { type: "Polygon", coordinates: [[[2, 48]]] },
            centroid: { lat: 48.5, lng: 2.5 },
          },
          {
            parcel_id: "P2",
            study_status: "not_studied",
            latest_submitted_survey_id: null,
            latest_observation_year: null,
            latest_ibp_total: null,
            geometry: {},
            centroid: { lat: 48.6, lng: 2.6 },
          },
          {
            parcel_id: "P2",
            study_status: "not_studied",
            latest_submitted_survey_id: null,
            latest_observation_year: null,
            latest_ibp_total: null,
            geometry: {},
            centroid: {},
          },
          {
            parcel_id: "P3",
            study_status: "not_studied",
            latest_submitted_survey_id: null,
            latest_observation_year: null,
            latest_ibp_total: null,
            geometry: {},
            centroid: {},
          },
        ],
      })
      const cadastre = buildCadastre({ wfsEnabled: true, features: null })

      const output = await buildService(db, cadastre).getPublicParcelStatuses({
        zoom: "16",
        bbox: "2,48,3,49",
        year: "2025",
      })

      expect(cadastre.fetchParcelFeaturesInBbox).toHaveBeenCalledWith({
        minLng: 2,
        minLat: 48,
        maxLng: 3,
        maxLat: 49,
      })
      expect(db.query).toHaveBeenCalledTimes(1)
      expect(db.query).toHaveBeenCalledWith(PUBLIC_PARCEL_STATUSES_BBOX_SQL, [2025, 2, 3, 48, 49])
      expect(output.items.map((item) => item.parcel_id)).toEqual(["P1", "P2", "P3"])
      expect(output.items[0].geometry).toEqual({ type: "Polygon", coordinates: [[[2, 48]]] })
      expect(output.items[1].geometry).toMatchObject({ type: "Polygon" })
      expect(output.items[2].geometry).toBeUndefined()
      expect(output.items[0]).toMatchObject({
        study_status: "studied",
        latest_submitted_survey_id: "s1",
        latest_observation_year: 2025,
        latest_ibp_total: 30,
      })
    })

    it("uses the bbox query when IGN answers an empty list", async () => {
      const db = buildDb()
      const cadastre = buildCadastre({ wfsEnabled: true, features: [] })
      await buildService(db, cadastre).getPublicParcelStatuses({ bbox: "2,48,3,49" })
      expect(db.query).toHaveBeenCalledWith(PUBLIC_PARCEL_STATUSES_BBOX_SQL, [null, 2, 3, 48, 49])
    })

    it("never calls IGN when the WFS is disabled", async () => {
      const db = buildDb()
      const cadastre = buildCadastre({ wfsEnabled: false, features: [feature()] })
      await buildService(db, cadastre).getPublicParcelStatuses({ zoom: "15", bbox: "2,48,3,49" })
      expect(cadastre.fetchParcelFeaturesInBbox).not.toHaveBeenCalled()
      expect(db.query).toHaveBeenCalledWith(PUBLIC_PARCEL_STATUSES_BBOX_SQL, [null, 2, 3, 48, 49])
    })

    it("uses the unbounded parcel query without a bbox, and never calls IGN", async () => {
      const db = buildDb()
      const cadastre = buildCadastre({ wfsEnabled: true, features: [feature()] })
      await buildService(db, cadastre).getPublicParcelStatuses({ year: "2024" })
      expect(cadastre.fetchParcelFeaturesInBbox).not.toHaveBeenCalled()
      expect(db.query).toHaveBeenCalledWith(PUBLIC_PARCEL_STATUSES_SQL, [2024])
    })

    it("runs the studied query with the distinct commune codes when IGN returns features", async () => {
      const features = [
        feature(),
        feature({ parcel_id: "75056000AB0002", number: "0002" }),
        feature({
          parcel_id: "13055000CD0003",
          commune_code: "13055",
          section: "CD",
          number: "0003",
        }),
      ]
      const db = buildDb({
        rows: [
          {
            commune_code: "75056",
            section: "AB",
            number: "0002",
            latest_submitted_survey_id: "s9",
            latest_observation_year: 2024,
            latest_ibp_total: 12,
          },
        ],
      })
      const cadastre = buildCadastre({ wfsEnabled: true, features })

      const output = await buildService(db, cadastre).getPublicParcelStatuses({
        zoom: "17",
        bbox: "2,48,3,49",
      })

      expect(db.query).toHaveBeenCalledTimes(1)
      expect(db.query).toHaveBeenCalledWith(PUBLIC_STUDIED_BY_COMMUNES_SQL, [
        null,
        ["75056", "13055"],
      ])
      expect(output.items).toEqual([
        {
          parcel_id: "75056000AB0001",
          study_status: "not_studied",
          latest_submitted_survey_id: null,
          latest_observation_year: null,
          latest_ibp_total: null,
          geometry: features[0].geometry,
        },
        {
          parcel_id: "75056000AB0002",
          study_status: "studied",
          latest_submitted_survey_id: "s9",
          latest_observation_year: 2024,
          latest_ibp_total: 12,
          geometry: features[1].geometry,
        },
        {
          parcel_id: "13055000CD0003",
          study_status: "not_studied",
          latest_submitted_survey_id: null,
          latest_observation_year: null,
          latest_ibp_total: null,
          geometry: features[2].geometry,
        },
      ])
    })
  })
})
