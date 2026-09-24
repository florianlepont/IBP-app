import "dotenv/config"
import { randomUUID } from "crypto"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { installEventInsertFailure, removeEventInsertFailures } from "./e2e-fault-injection"

// Real-PostgreSQL proof of DatabaseService.transaction (D-06) and of the
// event-insert fault-injection helper (D-15) that later plans (03, 04) reuse
// in their own E2E specs.
describe("DatabaseService.transaction (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    await app.init()

    await db.query(`CREATE TABLE IF NOT EXISTS e2e_tx_probe (id text primary key)`)
  })

  afterEach(async () => {
    await removeEventInsertFailures(db)
  })

  afterAll(async () => {
    await db.query(`DROP TABLE IF EXISTS e2e_tx_probe`)
    if (app) {
      await app.close()
    }
  })

  it("commits everything written inside a successful transaction", async () => {
    await db.transaction(async (handle) => {
      await handle.query(`INSERT INTO e2e_tx_probe (id) VALUES ('c')`)
      return null
    })

    const result = await db.query<{ id: string }>(`SELECT id FROM e2e_tx_probe WHERE id = 'c'`)
    expect(result.rows).toHaveLength(1)
  })

  it("rolls back everything written when the callback throws", async () => {
    const error = new Error("boom")

    await expect(
      db.transaction(async (handle) => {
        await handle.query(`INSERT INTO e2e_tx_probe (id) VALUES ('a')`)
        throw error
      }),
    ).rejects.toBe(error)

    const result = await db.query<{ id: string }>(`SELECT id FROM e2e_tx_probe WHERE id = 'a'`)
    expect(result.rows).toHaveLength(0)
  })

  it("proves a scoped, removable trigger fails only the targeted survey+event_type", async () => {
    const email = `e2e-tx-fault-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    const accessToken = login.body.access_token as string

    const surveyId = `e2e-tx-fault-survey-${Date.now()}`
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Fault Injection Forest",
        status: "draft",
        visibility: "private",
        factors: {},
        scores: {},
      })
      .expect(201)

    await installEventInsertFailure(db, { surveyId, eventType: "e2e_probe" })

    await expect(
      db.query(
        `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
         VALUES ($1, $2, NULL, 'e2e_probe', '{}'::jsonb)`,
        [randomUUID(), surveyId],
      ),
    ).rejects.toMatchObject({ code: "P0001" })

    const otherEventType = await db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, NULL, 'e2e_other', '{}'::jsonb) RETURNING id`,
      [randomUUID(), surveyId],
    )
    expect(otherEventType.rows).toHaveLength(1)

    await removeEventInsertFailures(db)

    const afterRemoval = await db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, NULL, 'e2e_probe', '{}'::jsonb) RETURNING id`,
      [randomUUID(), surveyId],
    )
    expect(afterRemoval.rows).toHaveLength(1)
  })
})
