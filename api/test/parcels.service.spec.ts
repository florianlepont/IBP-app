import { BadRequestException, UnprocessableEntityException } from "@nestjs/common"
import { DatabaseService } from "../src/database/database.service"
import { CadastreProviderService } from "../src/surveys/cadastre-provider.service"
import { ParcelsService } from "../src/surveys/parcels.service"
import { SurveyRow } from "../src/surveys/surveys.types"

type QueryResult = { rows: unknown[] }

function buildDb(...results: QueryResult[]) {
  const query = jest.fn()
  for (const result of results) {
    query.mockResolvedValueOnce(result)
  }
  query.mockResolvedValue({ rows: [] })
  return { query }
}

function sqlOf(db: { query: jest.Mock }, call = 0): string {
  return (db.query.mock.calls[call][0] as string).replace(/\s+/g, " ").trim()
}

function buildService(
  db: { query: jest.Mock } = buildDb(),
  cadastre: Partial<CadastreProviderService> = {},
): ParcelsService {
  return new ParcelsService(
    db as unknown as DatabaseService,
    cadastre as unknown as CadastreProviderService,
  )
}

function survey(overrides: Partial<SurveyRow> = {}): SurveyRow {
  return {
    id: "survey-1",
    parcel_id: null,
    observation_year: 2026,
    version_number: 2,
    ...overrides,
  } as SurveyRow
}

describe("ParcelsService", () => {
  describe("ensureParcelIds", () => {
    it("writes every parcel id with one INSERT … SELECT unnest … ON CONFLICT DO NOTHING", async () => {
      const db = buildDb()
      const service = buildService()

      const output = await service.ensureParcelIds(db, [
        "75056000AB0001",
        " 75056000ab0001 ",
        "13055000CD0002",
        "bad",
        "",
      ])

      expect(output).toEqual(["75056000AB0001", "13055000CD0002", "BAD"])
      expect(db.query).toHaveBeenCalledTimes(1)
      const sql = sqlOf(db)
      expect(sql).toContain("INSERT INTO parcels")
      expect(sql).toContain("unnest(")
      expect(sql).toContain("ON CONFLICT (parcel_id) DO NOTHING")

      const [ids, parcelIds, communes, sections, numbers] = db.query.mock.calls[0][1] as string[][]
      // Inserted in parcel_id order (lock order), one fresh uuid per row.
      expect(parcelIds).toEqual(["13055000CD0002", "75056000AB0001", "BAD"])
      expect(new Set(ids).size).toBe(3)
      // Same placeholder fields as the old single-id path (parseParcelIdentifier).
      expect(communes).toEqual(["00000", "00000", "00000"])
      expect(sections).toEqual(["AA", "AA", "AA"])
      expect(numbers).toEqual(["0000", "0000", "0000"])
    })

    it("derives commune, section and number from a short parcel id", async () => {
      const db = buildDb()
      await buildService().ensureParcelIds(db, ["75104ae3", "75104B12"])

      const [, parcelIds, communes, sections, numbers] = db.query.mock.calls[0][1] as string[][]
      expect(parcelIds).toEqual(["75104AE3", "75104B12"])
      expect(communes).toEqual(["75104", "75104"])
      expect(sections).toEqual(["AE", "BA"])
      expect(numbers).toEqual(["0003", "0012"])
    })

    it("issues no query for an empty or all-blank list", async () => {
      const db = buildDb()
      const service = buildService()

      await expect(service.ensureParcelIds(db, [])).resolves.toEqual([])
      await expect(service.ensureParcelIds(db, ["  "])).resolves.toEqual([])
      expect(db.query).not.toHaveBeenCalled()
    })
  })

  describe("validateParcelSubmit", () => {
    const parcels = ["P1", "P2", "P3"]

    it("accepts when every parcel's next version equals the survey version, in one GROUP BY query", async () => {
      // P1 has no prior version (next 1 -> survey v1 would pass); here all three expect v2.
      const db = buildDb({
        rows: [
          { parcel_id: "P1", next_version: 2 },
          { parcel_id: "P2", next_version: 2 },
          { parcel_id: "P3", next_version: 2 },
        ],
      })

      const result = await buildService().validateParcelSubmit(db, survey(), parcels)

      expect(result).toEqual({ errors: [] })
      expect(db.query).toHaveBeenCalledTimes(1)
      const sql = sqlOf(db)
      expect(sql).toContain("GROUP BY")
      expect(sql).toContain("FROM parcels p")
      expect(db.query.mock.calls[0][1]).toEqual([parcels, "survey-1"])
    })

    it("accepts version 1 when no parcel has a submitted version", async () => {
      const db = buildDb({
        rows: parcels.map((parcel_id) => ({ parcel_id, next_version: 1 })),
      })

      const result = await buildService().validateParcelSubmit(
        db,
        survey({ version_number: 1 }),
        parcels,
      )

      expect(result).toEqual({ errors: [] })
    })

    it("reports the first parcel, in survey order, whose next version differs", async () => {
      // Rows come back in any order; P2 (lower prior version) is the first mismatch.
      const db = buildDb({
        rows: [
          { parcel_id: "P3", next_version: 5 },
          { parcel_id: "P1", next_version: 2 },
          { parcel_id: "P2", next_version: 3 },
        ],
      })

      const result = await buildService().validateParcelSubmit(db, survey(), parcels)

      expect(result).toEqual({ errors: [], versionConflict: { expectedVersionNumber: 3 } })
    })

    it("rejects an equal version (another submit already took it)", async () => {
      const db = buildDb({ rows: [{ parcel_id: "P1", next_version: 3 }] })

      const result = await buildService().validateParcelSubmit(db, survey({ version_number: 2 }), [
        "P1",
      ])

      expect(result.versionConflict).toEqual({ expectedVersionNumber: 3 })
    })

    it("returns parcel_invalid when a parcel is missing from the registry", async () => {
      const db = buildDb({
        rows: [
          { parcel_id: "P1", next_version: 2 },
          { parcel_id: "P2", next_version: 2 },
        ],
      })

      const result = await buildService().validateParcelSubmit(db, survey(), parcels)

      expect(result).toEqual({
        code: "parcel_invalid",
        errors: ["one or more parcel_ids do not exist in parcel registry"],
      })
    })

    it("falls back to the legacy parcel_id and returns parcel_required without querying", async () => {
      const legacy = buildDb({ rows: [{ parcel_id: "LEGACY", next_version: 2 }] })
      await expect(
        buildService().validateParcelSubmit(legacy, survey({ parcel_id: "LEGACY" }), []),
      ).resolves.toEqual({ errors: [] })
      expect(legacy.query.mock.calls[0][1]).toEqual([["LEGACY"], "survey-1"])

      const none = buildDb()
      await expect(
        buildService().validateParcelSubmit(
          none,
          survey({ observation_year: null, version_number: null }),
          [],
        ),
      ).resolves.toEqual({
        code: "parcel_required",
        errors: [
          "parcel_ids is required for submit",
          "observation_year is required for submit",
          "version_number is required for submit",
        ],
      })
      expect(none.query).not.toHaveBeenCalled()
    })
  })

  describe("displayLocation", () => {
    it("reads centroid_lat/centroid_lng in one query and prefers the linked parcels' average", async () => {
      const db = buildDb({
        rows: [{ lat: 48.1234567, lng: 2.5, fallback_lat: 10, fallback_lng: 10 }],
      })

      const location = await buildService().displayLocation(db, "survey-1", " p1 ")

      expect(location).toEqual({ lat: 48.123457, lng: 2.5 })
      expect(db.query).toHaveBeenCalledTimes(1)
      const sql = sqlOf(db)
      expect(sql).toContain("centroid_lat")
      expect(sql).toContain("centroid_lng")
      expect(db.query.mock.calls[0][1]).toEqual(["survey-1", "P1"])
    })

    it("falls back to the legacy parcel's centroid, then to null", async () => {
      const fallback = buildDb({
        rows: [{ lat: null, lng: null, fallback_lat: 43.6, fallback_lng: 1.44 }],
      })
      await expect(buildService().displayLocation(fallback, "s", "P1")).resolves.toEqual({
        lat: 43.6,
        lng: 1.44,
      })

      const nothing = buildDb({
        rows: [{ lat: null, lng: null, fallback_lat: null, fallback_lng: null }],
      })
      await expect(buildService().displayLocation(nothing, "s", null)).resolves.toBeNull()
      expect(nothing.query.mock.calls[0][1]).toEqual(["s", null])
    })
  })

  describe("resolveParcelByCoordinates", () => {
    it("rejects missing coordinates", async () => {
      await expect(buildService().resolveParcelByCoordinates({ lat: "x" })).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })

    it("returns 422 when the provider resolves nothing", async () => {
      const service = buildService(buildDb(), {
        resolveFromPoint: jest.fn().mockResolvedValue(null),
      })
      await expect(
        service.resolveParcelByCoordinates({ lat: "48.8", lng: "2.3" }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException)
    })

    it("upserts the resolved parcel and returns its normalised centroid", async () => {
      const db = buildDb({
        rows: [
          {
            parcel_id: "75104AE0003",
            commune_code: "75104",
            section: "AE",
            number: "0003",
            centroid: { lat: 48.8566, lng: 2.3522 },
          },
        ],
      })
      const service = buildService(db, {
        resolveFromPoint: jest.fn().mockResolvedValue({
          parcel_id: "75104AE0003",
          commune_code: "75104",
          section: "AE",
          number: "0003",
          centroid: { lat: 48.8566, lng: 2.3522 },
          source: "synthetic_v1",
        }),
      })

      await expect(
        service.resolveParcelByCoordinates({ lat: "48.8566", lng: "2.3522" }),
      ).resolves.toEqual({
        parcel: {
          parcel_id: "75104AE0003",
          commune_code: "75104",
          section: "AE",
          number: "0003",
          centroid: { lat: 48.8566, lng: 2.3522 },
        },
      })
      expect(sqlOf(db)).toContain("ON CONFLICT (parcel_id) DO UPDATE")
    })
  })

  describe("getParcelSurveyHistory", () => {
    it("requires a parcel id and passes the owner and limit", async () => {
      await expect(
        buildService().getParcelSurveyHistory({ id: "u1" } as never, "  "),
      ).rejects.toBeInstanceOf(BadRequestException)

      const db = buildDb({ rows: [{ survey_id: "s1" }] })
      await expect(
        buildService(db).getParcelSurveyHistory({ id: "u1" } as never, "p1", "5"),
      ).resolves.toEqual({ parcel_id: "P1", items: [{ survey_id: "s1" }] })
      expect(db.query.mock.calls[0][1]).toEqual(["P1", "u1", 5])
    })
  })
})
