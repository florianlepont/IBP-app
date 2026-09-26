import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"

// D-02/D-05/D-11/D-12: proof that per-operation sync DTO validation, the
// bounded/formatted parcel_ids rule and the deterministic-pg-error mapping
// behave correctly under the production ValidationPipe (whitelist +
// forbidNonWhitelisted at the batch level), not a relaxed test pipe.
describe("Sync validation (e2e)", () => {
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
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  async function login(): Promise<string> {
    const email = `e2e-sync-validation-${Date.now()}-${Math.random().toString(16).slice(2)}@ibp.local`
    const response = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return response.body.access_token as string
  }

  function baseUpsertPayload(overrides: Record<string, unknown> = {}) {
    return {
      id: `e2e-sv-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sync_version: 1,
      site_name: "Sync Validation Forest",
      status: "draft",
      visibility: "private",
      factors: {},
      scores: {},
      ...overrides,
    }
  }

  it("processes a mixed batch: bad operations fail alone, valid ones sync", async () => {
    const accessToken = await login()
    const valid1 = baseUpsertPayload()
    const valid2 = baseUpsertPayload()
    const badFactors = baseUpsertPayload({ factors: "x" })
    const tooManyParcels = baseUpsertPayload({
      parcel_ids: Array.from({ length: 51 }, (_, i) => `1234${i % 10}AB000${i % 10}`),
    })

    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        operations: [
          { client_ref: "op-1", entity: "survey", action: "upsert", payload: valid1 },
          { client_ref: "op-2", entity: "survey", action: "upsert", payload: badFactors },
          { client_ref: "op-3", entity: "survey", action: "upsert", payload: tooManyParcels },
          { client_ref: "op-4", entity: "survey", action: "upsert", payload: valid2 },
        ],
      })
      .expect(200)

    expect(response.body.results).toHaveLength(4)
    expect(response.body.results[0]).toMatchObject({ client_ref: "op-1", status: "synced" })
    expect(response.body.results[1]).toMatchObject({
      client_ref: "op-2",
      status: "fatal_error",
      error: expect.objectContaining({ code: "invalid_sync_operation", http_status: 400 }),
    })
    expect(response.body.results[2]).toMatchObject({
      client_ref: "op-3",
      status: "fatal_error",
      error: expect.objectContaining({ http_status: 400 }),
    })
    expect(response.body.results[3]).toMatchObject({ client_ref: "op-4", status: "synced" })

    const validRows = await db.query<{ id: string }>("SELECT id FROM surveys WHERE id = ANY($1)", [
      [valid1.id, valid2.id],
    ])
    expect(validRows.rows.map((row) => row.id).sort()).toEqual([valid1.id, valid2.id].sort())

    const invalidRows = await db.query<{ id: string }>(
      "SELECT id FROM surveys WHERE id = ANY($1)",
      [[badFactors.id, tooManyParcels.id]],
    )
    expect(invalidRows.rows).toHaveLength(0)
  })

  it("rejects an empty or oversized batch, and any extra field on the request body", async () => {
    const accessToken = await login()

    await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: [] })
      .expect(400)

    const tooMany = Array.from({ length: 101 }, () => ({
      entity: "survey",
      action: "upsert",
      payload: baseUpsertPayload(),
    }))
    await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: tooMany })
      .expect(400)

    await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        operations: [{ entity: "survey", action: "upsert", payload: baseUpsertPayload() }],
        extra: 1,
      })
      .expect(400)
  })

  it("strips unknown payload fields instead of rejecting them (D-12)", async () => {
    const accessToken = await login()
    const payload = baseUpsertPayload({
      location: { source: "gps", lat: 48.6, lng: 1.8 },
      legacy_field: 1,
    })

    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: [{ entity: "survey", action: "upsert", payload }] })
      .expect(200)

    expect(response.body.results[0].status).toBe("synced")
  })

  it("accepts synthetic and IGN-shaped parcel_ids on /sync and enforces the same bound on REST", async () => {
    const accessToken = await login()
    const payload = baseUpsertPayload({
      parcel_ids: ["75056000AB0012", "2A004000AB0012"],
    })

    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: [{ entity: "survey", action: "upsert", payload }] })
      .expect(200)

    expect(response.body.results[0].status).toBe("synced")

    const linkedParcels = await db.query<{ parcel_id: string }>(
      "SELECT parcel_id FROM survey_parcels WHERE survey_id = $1 ORDER BY parcel_id",
      [payload.id],
    )
    expect(linkedParcels.rows.map((row) => row.parcel_id)).toEqual(
      ["2A004000AB0012", "75056000AB0012"].sort(),
    )

    const restPayload = baseUpsertPayload({
      parcel_ids: Array.from({ length: 51 }, (_, i) => `1234${i % 10}AB000${i % 10}`),
    })
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(restPayload)
      .expect(400)
  })

  it("maps a deterministic database error to a generic fatal_error and never leaks it (D-05)", async () => {
    await db.query(`
      CREATE OR REPLACE FUNCTION e2e_fail_survey_insert() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'new row violates check constraint "e2e_secret_constraint"'
          USING ERRCODE = '23514', CONSTRAINT = 'e2e_secret_constraint';
      END;
      $$ LANGUAGE plpgsql;
    `)
    await db.query(`
      CREATE TRIGGER e2e_fail_survey_insert
      BEFORE INSERT ON surveys
      FOR EACH ROW
      WHEN (NEW.id LIKE 'e2e-det-%')
      EXECUTE FUNCTION e2e_fail_survey_insert();
    `)

    try {
      const accessToken = await login()
      const failingId = `e2e-det-${Date.now()}`
      const failingPayload = baseUpsertPayload({ id: failingId })
      const okPayload = baseUpsertPayload()

      const response = await request(app.getHttpServer())
        .post("/v1/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          operations: [
            { client_ref: "op-fail", entity: "survey", action: "upsert", payload: failingPayload },
            { client_ref: "op-ok", entity: "survey", action: "upsert", payload: okPayload },
          ],
        })
        .expect(200)

      expect(response.body.results[0]).toMatchObject({
        client_ref: "op-fail",
        status: "fatal_error",
        error: expect.objectContaining({ code: "invalid_operation" }),
      })
      expect(JSON.stringify(response.body.results[0])).not.toContain("e2e_secret_constraint")
      expect(response.body.results[1]).toMatchObject({ client_ref: "op-ok", status: "synced" })
    } finally {
      await db.query("DROP TRIGGER IF EXISTS e2e_fail_survey_insert ON surveys")
      await db.query("DROP FUNCTION IF EXISTS e2e_fail_survey_insert()")
    }
  })
})
