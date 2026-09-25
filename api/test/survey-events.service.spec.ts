import { NotFoundException } from "@nestjs/common"
import { SURVEY_EVENT_INSERT_SQL, SurveyEventsService } from "../src/surveys/survey-events.service"
import { SurveysRepository } from "../src/surveys/surveys.repository"

const USER = {
  id: "u1",
  auth0_sub: "auth0|u1",
  email: "u1@example.com",
  role: "contributor" as const,
  first_name: "U",
  last_name: "One",
  display_name: "U One",
  profile_picture_url: null,
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function build() {
  const db = { query: jest.fn() }
  const repository = new SurveysRepository()
  const service = new SurveyEventsService(db as never, repository)
  return { db, repository, service }
}

describe("SurveyEventsService", () => {
  describe("insert", () => {
    it("writes one event with a fresh uuid and a JSON payload on the given Queryable", async () => {
      const { db, service } = build()
      const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) }

      await service.insert(tx, "s1", "u1", "created", { a: 1 })

      expect(db.query).not.toHaveBeenCalled()
      expect(tx.query).toHaveBeenCalledTimes(1)
      const [sql, values] = tx.query.mock.calls[0] as [string, unknown[]]
      expect(sql.startsWith(SURVEY_EVENT_INSERT_SQL)).toBe(true)
      expect(sql).not.toMatch(/\bseq\b/)
      expect(values).toHaveLength(5)
      expect(values[0]).toMatch(UUID_PATTERN)
      expect(values.slice(1)).toEqual(["s1", "u1", "created", '{"a":1}'])
    })

    it("passes a null actor through unchanged (reported events, 01.2 A-M6)", async () => {
      const { service } = build()
      const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) }

      await service.insert(tx, "s1", null, "reported", { report_id: "r1" })

      const values = tx.query.mock.calls[0][1] as unknown[]
      expect(values[2]).toBeNull()
      expect(values[3]).toBe("reported")
      expect(values[4]).toBe('{"report_id":"r1"}')
    })

    it("uses a distinct id per event", async () => {
      const { service } = build()
      const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) }
      await service.insert(tx, "s1", "u1", "updated", {})
      await service.insert(tx, "s1", "u1", "updated", {})
      expect(tx.query.mock.calls[0][1][0]).not.toBe(tx.query.mock.calls[1][1][0])
    })
  })

  describe("listForSurvey", () => {
    it("throws NotFoundException when the user does not own an active survey", async () => {
      const { db, service } = build()
      db.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.listForSurvey(USER, "s1")).rejects.toBeInstanceOf(NotFoundException)
      expect(db.query).toHaveBeenCalledTimes(1)
      const ownershipSql = db.query.mock.calls[0][0] as string
      expect(ownershipSql).toContain("user_id = $2")
      expect(ownershipSql).toContain("deleted_at IS NULL")
      expect(ownershipSql).not.toContain("*")
      expect(db.query.mock.calls[0][1]).toEqual(["s1", "u1"])
    })

    it("returns the events newest first after the ownership check", async () => {
      const { db, service } = build()
      const events = [
        { id: "e2", event_type: "updated" },
        { id: "e1", event_type: "created" },
      ]
      db.query.mockResolvedValueOnce({ rows: [{ id: "s1" }] })
      db.query.mockResolvedValueOnce({ rows: events })

      await expect(service.listForSurvey(USER, "s1")).resolves.toEqual({ items: events })

      const sql = (db.query.mock.calls[1][0] as string).replace(/\s+/g, " ")
      expect(sql).toContain(
        "SELECT id, survey_id, actor_id, event_type, payload, created_at::text FROM survey_events",
      )
      expect(sql).toContain("WHERE survey_id = $1")
      expect(sql).toContain("ORDER BY created_at DESC")
      expect(db.query.mock.calls[1][1]).toEqual(["s1"])
    })
  })
})
