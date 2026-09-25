import "dotenv/config"
import { randomUUID } from "crypto"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { PoolClient } from "pg"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"

// Real-PostgreSQL proof that GET /v1/sync/changes never skips a late commit (D-02, D-12).
// Two raw clients open overlapping transactions and commit them out of seq order. The feed
// only returns events whose xid8 is below the snapshot xmin and pages on (xid8, seq), so an
// event from a transaction that is still open is withheld, never jumped over.
//
// The snapshot xmin is cluster-wide: an unrelated writer left open elsewhere on the cluster only
// delays visibility. Positive assertions therefore poll briefly; negative ones are checked once
// while the blocking transaction is known to be open.

type ChangesBody = {
  cursor_in: string | null
  cursor_out: string | null
  has_more: boolean
  events: Array<{ id: string; survey_id: string; event_type: string }>
}

const FUTURE_CURSOR = "v2:99999999999:1"

describe("GET /v1/sync/changes ordering under concurrent commits (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let accessToken: string
  let userId: string
  let surveyId: string
  let openClients: PoolClient[] = []

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    await app.init()

    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: `e2e-feed-order-${Date.now()}@ibp.local` })
      .expect(201)
    accessToken = login.body.access_token as string

    surveyId = `e2e-feed-order-survey-${Date.now()}`
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Feed Ordering Forest",
        status: "draft",
        visibility: "private",
        factors: {},
        scores: {},
      })
      .expect(201)

    const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM surveys WHERE id = $1`, [
      surveyId,
    ])
    userId = owner.rows[0].user_id
  })

  afterEach(async () => {
    for (const client of openClients) {
      try {
        await client.query("ROLLBACK")
      } catch {
        // Already committed or rolled back.
      }
      client.release()
    }
    openClients = []
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  async function openClient(): Promise<PoolClient> {
    const client = await db.connect()
    openClients.push(client)
    return client
  }

  async function beginWithXid(client: PoolClient): Promise<string> {
    await client.query("BEGIN")
    const xid = await client.query<{ xid: string }>(`SELECT pg_current_xact_id()::text AS xid`)
    return xid.rows[0].xid
  }

  async function insertEvent(client: PoolClient, eventType: string): Promise<string> {
    const id = randomUUID()
    await client.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, NULL, $3, '{}'::jsonb)`,
      [id, surveyId, eventType],
    )
    return id
  }

  async function poll(cursor: string | null): Promise<ChangesBody> {
    const req = request(app.getHttpServer())
      .get("/v1/sync/changes")
      .set("Authorization", `Bearer ${accessToken}`)
    const response = await (cursor ? req.query({ cursor }) : req).expect(200)
    return response.body as ChangesBody
  }

  async function pollUntil(
    cursor: string | null,
    done: (body: ChangesBody) => boolean,
  ): Promise<ChangesBody> {
    let body = await poll(cursor)
    for (let attempt = 0; attempt < 30 && !done(body); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      body = await poll(cursor)
    }
    return body
  }

  // Drains the feed and returns a cursor positioned after every event visible right now.
  async function baseline(): Promise<string> {
    let cursor: string | null = null
    for (let page = 0; page < 50; page += 1) {
      const body = await poll(cursor)
      cursor = body.cursor_out ?? cursor
      if (!body.has_more) break
    }
    expect(cursor).toMatch(/^v2:\d+:\d+$/)
    return cursor as string
  }

  function ids(body: ChangesBody): string[] {
    return body.events.map((event) => event.id)
  }

  function count(values: string[], value: string): number {
    return values.filter((entry) => entry === value).length
  }

  it("late commit with an early xid is not skipped", async () => {
    const start = await baseline()
    const a = await openClient()
    const b = await openClient()

    // pg_current_xact_id() assigns A's xid before B's, before either transaction writes.
    const xidA = await beginWithXid(a)
    const xidB = await beginWithXid(b)
    expect(BigInt(xidA) < BigInt(xidB)).toBe(true)

    const eB = await insertEvent(b, "e2e_order_b")
    const eA = await insertEvent(a, "e2e_order_a")
    const seqs = await a.query<{ id: string; seq: string }>(
      `SELECT id, seq::text AS seq FROM survey_events WHERE id = $1`,
      [eA],
    )
    await a.query("COMMIT")

    // eA took the higher seq but the lower xid: it is visible, eB (still open) is withheld.
    const first = await pollUntil(start, (body) => ids(body).includes(eA))
    expect(ids(first)).toContain(eA)
    expect(ids(first)).not.toContain(eB)
    expect(first.cursor_out).toBe(`v2:${xidA}:${seqs.rows[0].seq}`)

    await b.query("COMMIT")

    const second = await pollUntil(first.cursor_out, (body) => ids(body).includes(eB))
    expect(count(ids(second), eB)).toBe(1)
    expect(ids(second)).not.toContain(eA)
    expect(second.cursor_out).toMatch(new RegExp(`^v2:${xidB}:\\d+$`))
  })

  it("an event is withheld while an older writer is open", async () => {
    const start = await baseline()
    const a = await openClient()
    const b = await openClient()

    // pg_current_xact_id() makes A the older writer even though it inserts last.
    await beginWithXid(a)
    await beginWithXid(b)
    const eB = await insertEvent(b, "e2e_withheld_b")
    await b.query("COMMIT")

    // A holds the snapshot xmin below B's xid, so B's committed event must wait.
    const whileOpen = await poll(start)
    expect(ids(whileOpen)).not.toContain(eB)
    expect(whileOpen.events).toHaveLength(0)
    expect(whileOpen.cursor_out).toBe(start)

    const eA = await insertEvent(a, "e2e_withheld_a")
    await a.query("COMMIT")

    const after = await pollUntil(start, (body) => ids(body).includes(eA) && ids(body).includes(eB))
    const returned = ids(after)
    expect(count(returned, eA)).toBe(1)
    expect(count(returned, eB)).toBe(1)
    expect(returned.indexOf(eA)).toBeLessThan(returned.indexOf(eB))
  })

  it("rolled-back writer leaves no gap", async () => {
    const start = await baseline()
    const a = await openClient()
    const b = await openClient()

    // pg_current_xact_id() burns an xid (and the insert a seq) that will never commit.
    await beginWithXid(a)
    const eA = await insertEvent(a, "e2e_rollback_a")
    await a.query("ROLLBACK")

    await b.query("BEGIN")
    const eB = await insertEvent(b, "e2e_rollback_b")
    await b.query("COMMIT")

    const after = await pollUntil(start, (body) => ids(body).includes(eB))
    expect(count(ids(after), eB)).toBe(1)
    expect(ids(after)).not.toContain(eA)
  })

  it("a cursor from the future restarts the feed", async () => {
    await baseline()
    const expected = await db.query<{ id: string }>(
      `SELECT e.id
       FROM survey_events e
       JOIN surveys s ON s.id = e.survey_id
       WHERE s.user_id = $1
       ORDER BY e.xid8, e.seq`,
      [userId],
    )
    expect(expected.rows.length).toBeGreaterThan(1)

    const returned: string[] = []
    let cursor: string = FUTURE_CURSOR
    for (let page = 0; page < 50; page += 1) {
      const body = await poll(cursor)
      returned.push(...ids(body))
      expect(body.cursor_out).toMatch(/^v2:\d+:\d+$/)
      cursor = body.cursor_out as string
      if (!body.has_more) break
    }

    expect(returned).toEqual(expected.rows.map((row) => row.id))
    const [, xid8] = cursor.split(":")
    expect(BigInt(xid8) < BigInt("99999999999")).toBe(true)
  })
})
