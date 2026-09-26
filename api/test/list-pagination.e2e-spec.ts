import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { randomUUID } from "crypto"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"

// D-11: keyset pagination on GET /v1/surveys, GET /v1/surveys/:id/events and GET /v1/reports.
// Without `limit` every list answers exactly as before (all rows, the documented order plus a
// deterministic tiebreaker, next_cursor null); with `limit` the pages, walked through
// next_cursor, return every row exactly once in that order. D-12: bad limits and cursors get a
// fixed 400 that never echoes the input. D-18/C-4: unknown query parameters are still ignored.

type ListBody<T> = { items: T[]; next_cursor: string | null }

const SURVEY_LIST_KEYS = [
  "id",
  "observation_year",
  "parcel_id",
  "site_name",
  "status",
  "sync_version",
  "updated_at",
  "version_number",
  "visibility",
]
const EVENT_KEYS = ["actor_id", "created_at", "event_type", "id", "payload", "survey_id"]
const REPORT_KEYS = [
  "created_at",
  "id",
  "reason",
  "reporter_user_id",
  "reviewed_at",
  "reviewed_by",
  "status",
  "survey_id",
]

const cursorOf = (json: unknown) =>
  `v1:${Buffer.from(JSON.stringify(json), "utf8").toString("base64url")}`

describe("list pagination (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  let ownerToken: string
  let ownerId: string
  let otherToken: string
  let otherId: string
  let moderatorToken: string
  const ownerSurveyIds: string[] = []
  let eventSurveyId: string

  async function login(label: string): Promise<{ token: string; id: string }> {
    const tokenRes = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: `e2e-page-${label}-${stamp}@ibp.local` })
      .expect(201)
    const token = tokenRes.body.access_token as string
    const me = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
    return { token, id: me.body.id as string }
  }

  async function createSurvey(token: string, id: string, visibility = "private") {
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${token}`)
      .send({
        id,
        sync_version: 1,
        site_name: `Page site ${id}`,
        status: "draft",
        visibility,
        factors: {},
        scores: {},
      })
      .expect(201)
  }

  async function get<T>(
    token: string,
    path: string,
    query: Record<string, string | number> = {},
    expected = 200,
  ): Promise<{ body: T }> {
    const response = await request(app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${token}`)
      .query(query)
      .expect(expected)
    return { body: response.body as T }
  }

  // Follows next_cursor until it is null. Every page but the last holds exactly `limit` items.
  async function walk<T>(
    token: string,
    path: string,
    limit: number,
    extra: Record<string, string> = {},
  ): Promise<T[]> {
    const all: T[] = []
    let cursor: string | null = null
    for (let page = 0; page < 1000; page += 1) {
      const query: Record<string, string | number> = { ...extra, limit }
      if (cursor) {
        query.cursor = cursor
      }
      const response = await get<ListBody<T>>(token, path, query)
      const body = response.body
      all.push(...body.items)
      if (body.next_cursor === null) {
        expect(body.items.length).toBeLessThanOrEqual(limit)
        return all
      }
      expect(body.items).toHaveLength(limit)
      expect(body.next_cursor).toMatch(/^v1:[A-Za-z0-9_-]+$/)
      cursor = body.next_cursor
    }
    throw new Error("pagination did not terminate")
  }

  async function expectBadRequest(token: string, path: string, query: Record<string, string>) {
    const response = await get<{ message: unknown }>(token, path, query, 400)
    return response.body
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    await app.init()

    const owner = await login("owner")
    ownerToken = owner.token
    ownerId = owner.id
    const other = await login("other")
    otherToken = other.token
    otherId = other.id
    const moderator = await login("moderator")
    moderatorToken = moderator.token
    await db.query(`UPDATE users SET role = 'moderator' WHERE id = $1`, [moderator.id])

    for (let index = 0; index < 8; index += 1) {
      const id = `e2e-page-${stamp}-${index}`
      await createSurvey(ownerToken, id, index < 4 ? "public" : "private")
      ownerSurveyIds.push(id)
    }
    await createSurvey(otherToken, `e2e-page-${stamp}-other-0`)
    await createSurvey(otherToken, `e2e-page-${stamp}-other-1`)

    // Two surveys share updated_at, so only the id tiebreaker orders them.
    await db.query(
      `UPDATE surveys SET updated_at = '2024-05-01 10:00:00.123456+00'
       WHERE id = ANY($1::text[])`,
      [[ownerSurveyIds[2], ownerSurveyIds[5]]],
    )

    // Events: the create event plus 8 more, two of them with the same created_at.
    eventSurveyId = ownerSurveyIds[0]
    for (let index = 0; index < 8; index += 1) {
      await db.query(
        `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
         VALUES ($1, $2, $3, 'updated', $4::jsonb)`,
        [randomUUID(), eventSurveyId, ownerId, JSON.stringify({ step: index })],
      )
    }
    await db.query(
      `UPDATE survey_events SET created_at = '2024-05-02 08:00:00.5+00'
       WHERE id IN (
         SELECT id FROM survey_events WHERE survey_id = $1 ORDER BY seq DESC LIMIT 2
       )`,
      [eventSurveyId],
    )

    // Reports: 9 over the owner's public surveys, mixed statuses, two sharing created_at.
    const reportIds: string[] = []
    for (let index = 0; index < 9; index += 1) {
      const id = randomUUID()
      reportIds.push(id)
      await db.query(
        `INSERT INTO reports (id, survey_id, reporter_user_id, reason, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          ownerSurveyIds[index % 4],
          otherId,
          `Page reason ${index}`,
          index % 3 === 0 ? "reviewed" : "open",
        ],
      )
    }
    await db.query(
      `UPDATE reports SET created_at = '2024-05-03 09:00:00.25+00' WHERE id = ANY($1::text[])`,
      [[reportIds[1], reportIds[4]]],
    )
  })

  afterAll(async () => {
    await app?.close()
  })

  describe("GET /v1/surveys", () => {
    const expectedRows = async (userId: string) =>
      (
        await db.query(
          `SELECT id, site_name, status, visibility, parcel_id, observation_year, version_number, updated_at::text, sync_version
           FROM surveys
           WHERE user_id = $1 AND deleted_at IS NULL
           ORDER BY updated_at DESC, id DESC`,
          [userId],
        )
      ).rows

    it("without limit answers every row in order with next_cursor null", async () => {
      const response = await get<ListBody<Record<string, unknown>>>(ownerToken, "/v1/surveys")
      expect(response.body.next_cursor).toBeNull()
      expect(response.body.items).toEqual(await expectedRows(ownerId))
      expect(response.body.items).toHaveLength(8)
      for (const item of response.body.items) {
        expect(Object.keys(item).sort()).toEqual(SURVEY_LIST_KEYS)
      }
    })

    it("still ignores unknown query parameters", async () => {
      const response = await get<ListBody<unknown>>(ownerToken, "/v1/surveys", { foo: "bar" })
      expect(response.body.items).toEqual(await expectedRows(ownerId))
      expect(response.body.next_cursor).toBeNull()
    })

    it("walks limit=3 pages through every row exactly once", async () => {
      const unpaginated = (await get<ListBody<{ id: string }>>(ownerToken, "/v1/surveys")).body
      const walked = await walk<{ id: string }>(ownerToken, "/v1/surveys", 3)
      expect(walked).toEqual(unpaginated.items)
      expect(new Set(walked.map((item) => item.id)).size).toBe(walked.length)
    })

    it("pages a filtered list inside the filter", async () => {
      const filtered = (
        await get<ListBody<{ id: string }>>(ownerToken, "/v1/surveys", { q: "Page site" })
      ).body
      const walked = await walk<{ id: string }>(ownerToken, "/v1/surveys", 2, { q: "Page site" })
      expect(walked).toEqual(filtered.items)
      expect(walked).toHaveLength(8)
    })

    it("keeps a replayed cursor inside the caller's scope", async () => {
      const first = await get<ListBody<{ id: string }>>(ownerToken, "/v1/surveys", { limit: 1 })
      expect(first.body.next_cursor).not.toBeNull()
      const replay = await get<ListBody<{ id: string }>>(otherToken, "/v1/surveys", {
        limit: 100,
        cursor: first.body.next_cursor as string,
      })
      const otherIds = new Set((await expectedRows(otherId)).map((row) => row.id as string))
      for (const item of replay.body.items) {
        expect(otherIds.has(item.id)).toBe(true)
      }
      expect(replay.body.items.some((item) => ownerSurveyIds.includes(item.id))).toBe(false)
    })

    it("accepts a cursor without a limit and applies only the keyset", async () => {
      const first = await get<ListBody<{ id: string }>>(ownerToken, "/v1/surveys", { limit: 3 })
      const rest = await get<ListBody<{ id: string }>>(ownerToken, "/v1/surveys", {
        cursor: first.body.next_cursor as string,
      })
      const all = await expectedRows(ownerId)
      expect(rest.body.items).toEqual(all.slice(3))
      expect(rest.body.next_cursor).toBeNull()
    })
  })

  describe("GET /v1/surveys/:id/events", () => {
    const path = () => `/v1/surveys/${eventSurveyId}/events`
    // The pre-D-11 select, in the new documented order.
    const expectedRows = async () =>
      (
        await db.query(
          `SELECT id, survey_id, actor_id, event_type, payload, created_at::text
           FROM survey_events
           WHERE survey_id = $1
           ORDER BY created_at DESC, seq DESC`,
          [eventSurveyId],
        )
      ).rows

    it("without params returns the same items as before, now with next_cursor null", async () => {
      const response = await get<ListBody<Record<string, unknown>>>(ownerToken, path())
      expect(response.body.next_cursor).toBeNull()
      expect(response.body.items).toEqual(await expectedRows())
      expect(response.body.items.length).toBeGreaterThanOrEqual(9)
      for (const item of response.body.items) {
        expect(Object.keys(item).sort()).toEqual(EVENT_KEYS)
      }
      expect(Object.keys(response.body).sort()).toEqual(["items", "next_cursor"])
    })

    it("still ignores unknown query parameters", async () => {
      const response = await get<ListBody<unknown>>(ownerToken, path(), { foo: "bar" })
      expect(response.body.items).toEqual(await expectedRows())
    })

    it("walks limit=3 pages through every event exactly once", async () => {
      const walked = await walk<Record<string, unknown>>(ownerToken, path(), 3)
      expect(walked).toEqual(await expectedRows())
      expect(new Set(walked.map((item) => item.id)).size).toBe(walked.length)
      for (const item of walked) {
        expect(Object.keys(item).sort()).toEqual(EVENT_KEYS)
      }
    })

    it("does not list another user's events, even with a replayed cursor", async () => {
      const first = await get<ListBody<unknown>>(ownerToken, path(), { limit: 1 })
      await get(otherToken, path(), { limit: 5, cursor: first.body.next_cursor as string }, 404)
    })
  })

  describe("GET /v1/reports", () => {
    const expectedRows = async (status?: string) =>
      (
        await db.query(
          `SELECT id, survey_id, reporter_user_id, reason, status, created_at::text,
                  reviewed_at::text, reviewed_by::text
           FROM reports
           ${status ? "WHERE status = $1" : ""}
           ORDER BY created_at DESC, id DESC`,
          status ? [status] : [],
        )
      ).rows

    it("without limit answers every row in order with next_cursor null", async () => {
      const response = await get<ListBody<Record<string, unknown>>>(moderatorToken, "/v1/reports")
      expect(response.body.next_cursor).toBeNull()
      expect(response.body.items).toEqual(await expectedRows())
      expect(response.body.items.length).toBeGreaterThanOrEqual(9)
      for (const item of response.body.items) {
        expect(Object.keys(item).sort()).toEqual(REPORT_KEYS)
      }
    })

    it("still ignores unknown query parameters", async () => {
      const response = await get<ListBody<unknown>>(moderatorToken, "/v1/reports", { foo: "bar" })
      expect(response.body.items).toEqual(await expectedRows())
    })

    it("walks limit=3 pages through every report exactly once, with and without status", async () => {
      const walked = await walk<{ id: string }>(moderatorToken, "/v1/reports", 3)
      expect(walked).toEqual(await expectedRows())
      expect(new Set(walked.map((item) => item.id)).size).toBe(walked.length)

      const open = await walk<{ id: string }>(moderatorToken, "/v1/reports", 3, { status: "open" })
      expect(open).toEqual(await expectedRows("open"))
      expect(open.length).toBeGreaterThanOrEqual(6)
    })

    it("still requires the reviewer role when a cursor is given", async () => {
      const first = await get<ListBody<unknown>>(moderatorToken, "/v1/reports", { limit: 1 })
      await get(
        otherToken,
        "/v1/reports",
        { limit: 5, cursor: first.body.next_cursor as string },
        403,
      )
    })
  })

  describe("bad limit and cursor (D-12)", () => {
    const paths = () => ["/v1/surveys", `/v1/surveys/${eventSurveyId}/events`, "/v1/reports"]
    const tokenFor = (path: string) => (path === "/v1/reports" ? moderatorToken : ownerToken)

    it("rejects limit 0, 101 and abc with 400 Invalid limit", async () => {
      for (const path of paths()) {
        for (const limit of ["0", "101", "abc"]) {
          const body = await expectBadRequest(tokenFor(path), path, { limit })
          expect(body.message).toBe("Invalid limit")
        }
      }
    })

    it("rejects malformed cursors with 400 Invalid cursor, without echoing them", async () => {
      const badDate = cursorOf({ t: "2024-02-30T00:00:00Z", i: "x" })
      for (const path of paths()) {
        for (const cursor of ["garbage", badDate]) {
          const body = await expectBadRequest(tokenFor(path), path, { cursor, limit: "3" })
          expect(body.message).toBe("Invalid cursor")
          expect(JSON.stringify(body)).not.toContain(cursor)
        }
      }
    })

    it("rejects ids that fail the endpoint's id pattern", async () => {
      const t = "2024-05-01 10:00:00.123456+00"
      const eventsBody = await expectBadRequest(ownerToken, `/v1/surveys/${eventSurveyId}/events`, {
        cursor: cursorOf({ t, i: "not-a-seq" }),
      })
      expect(eventsBody.message).toBe("Invalid cursor")
      const reportsBody = await expectBadRequest(moderatorToken, "/v1/reports", {
        cursor: cursorOf({ t, i: "not-a-uuid" }),
      })
      expect(reportsBody.message).toBe("Invalid cursor")
    })
  })
})
