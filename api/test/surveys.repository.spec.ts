import { NotFoundException } from "@nestjs/common"
import { SurveysRepository } from "../src/surveys/surveys.repository"

function buildDb(rows: unknown[] = []) {
  return { query: jest.fn().mockResolvedValue({ rows }) }
}

function sqlOf(db: { query: jest.Mock }, call = 0): string {
  return (db.query.mock.calls[call][0] as string).replace(/\s+/g, " ").trim()
}

describe("SurveysRepository", () => {
  const repository = new SurveysRepository()

  describe("findOwned", () => {
    it("selects only the ownership columns in 'ownership' mode", async () => {
      const db = buildDb([{ id: "s1" }])
      await repository.findOwned(db, "s1", "u1", { activeOnly: true, columns: "ownership" })

      const sql = sqlOf(db)
      expect(sql).toContain(
        "SELECT id, user_id, status, visibility, sync_version, deleted_at FROM surveys",
      )
      expect(sql).not.toContain("*")
      expect(sql).toContain("WHERE id = $1 AND user_id = $2")
      expect(db.query.mock.calls[0][1]).toEqual(["s1", "u1"])
    })

    it("selects every column in 'full' mode and keeps the owner predicate", async () => {
      const db = buildDb([{ id: "s1" }])
      await repository.findOwned(db, "s1", "u1", { activeOnly: true, columns: "full" })

      const sql = sqlOf(db)
      expect(sql).toContain("SELECT * FROM surveys")
      expect(sql).toContain("WHERE id = $1 AND user_id = $2")
    })

    it("adds deleted_at IS NULL only when activeOnly is set", async () => {
      const active = buildDb()
      await repository.findOwned(active, "s1", "u1", { activeOnly: true, columns: "ownership" })
      expect(sqlOf(active)).toContain("AND deleted_at IS NULL")

      const any = buildDb()
      await repository.findOwned(any, "s1", "u1", { activeOnly: false, columns: "ownership" })
      expect(sqlOf(any)).not.toContain("deleted_at IS NULL")
      expect(sqlOf(any)).toContain("WHERE id = $1 AND user_id = $2")
    })

    it("appends FOR UPDATE only when forUpdate is set", async () => {
      const locked = buildDb()
      await repository.findOwned(locked, "s1", "u1", {
        activeOnly: true,
        forUpdate: true,
        columns: "full",
      })
      expect(sqlOf(locked)).toMatch(/FOR UPDATE$/)

      const plain = buildDb()
      await repository.findOwned(plain, "s1", "u1", { activeOnly: true, columns: "full" })
      expect(sqlOf(plain)).not.toContain("FOR UPDATE")
    })

    it("returns the row, or null when there is none", async () => {
      const row = { id: "s1", user_id: "u1" }
      await expect(
        repository.findOwned(buildDb([row]), "s1", "u1", { activeOnly: true, columns: "full" }),
      ).resolves.toBe(row)
      await expect(
        repository.findOwned(buildDb(), "s1", "u1", { activeOnly: true, columns: "full" }),
      ).resolves.toBeNull()
    })
  })

  describe("findOwnedOrThrow", () => {
    it("throws NotFoundException('Survey not found') when there is no row", async () => {
      const error = await repository
        .findOwnedOrThrow(buildDb(), "s1", "u1", { activeOnly: true, columns: "ownership" })
        .catch((err: unknown) => err)
      expect(error).toBeInstanceOf(NotFoundException)
      expect((error as NotFoundException).message).toBe("Survey not found")
    })

    it("returns the row when it exists", async () => {
      const row = { id: "s1" }
      await expect(
        repository.findOwnedOrThrow(buildDb([row]), "s1", "u1", {
          activeOnly: true,
          columns: "ownership",
        }),
      ).resolves.toBe(row)
    })
  })

  describe("parcel links", () => {
    it("getSurveyParcelIds returns the ids ordered by parcel_id", async () => {
      const db = buildDb([{ parcel_id: "A" }, { parcel_id: "B" }])
      await expect(repository.getSurveyParcelIds(db, "s1")).resolves.toEqual(["A", "B"])
      expect(sqlOf(db)).toContain("ORDER BY parcel_id ASC")
      expect(db.query.mock.calls[0][1]).toEqual(["s1"])
    })

    it("syncSurveyParcels deletes then inserts the normalized ids", async () => {
      const db = buildDb()
      await repository.syncSurveyParcels(db, "s1", [" b ", "a", "a"])

      expect(sqlOf(db, 0)).toBe("DELETE FROM survey_parcels WHERE survey_id = $1")
      expect(sqlOf(db, 1)).toContain("SELECT $1, unnest($2::text[])")
      expect(db.query.mock.calls[1][1]).toEqual(["s1", ["B", "A"]])
    })

    it("syncSurveyParcels only deletes when there is no parcel", async () => {
      const db = buildDb()
      await repository.syncSurveyParcels(db, "s1", [])
      expect(db.query).toHaveBeenCalledTimes(1)
    })
  })
})
