import "dotenv/config"
import { randomUUID } from "crypto"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"

// D-14: client-chosen survey and attachment ids are checked against SAFE_ID_PATTERN at the
// boundary (SafeIdPipe on route params, @Matches on the DTOs used by /sync), under the
// production ValidationPipe. Every id format the app has generated keeps working.
describe("Safe ids at the boundary (e2e)", () => {
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
    const email = `e2e-safe-ids-${Date.now()}-${Math.random().toString(16).slice(2)}@ibp.local`
    const response = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return response.body.access_token as string
  }

  function draftBody(id: string) {
    return {
      id,
      sync_version: 1,
      site_name: "Safe Id Forest",
      status: "draft",
      visibility: "private",
      factors: {},
      scores: {},
    }
  }

  let legacyCounter = 0
  function legacyId(): string {
    legacyCounter += 1
    return `survey-${Date.now()}${legacyCounter}`
  }

  it("accepts the legacy survey-<ms> and UUID id formats on POST /v1/surveys", async () => {
    const accessToken = await login()
    const ids = [legacyId(), randomUUID()]

    for (const id of ids) {
      await request(app.getHttpServer())
        .post("/v1/surveys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(draftBody(id))
        .expect(201)
      await request(app.getHttpServer())
        .get(`/v1/surveys/${id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    }

    const rows = await db.query<{ id: string }>("SELECT id FROM surveys WHERE id = ANY($1)", [ids])
    expect(rows.rows.map((row) => row.id).sort()).toEqual([...ids].sort())
  })

  it.each([
    ["path traversal", "../../x"],
    ["dot", "a.b"],
    ["too long", "a".repeat(129)],
  ])("rejects an unsafe id (%s) on POST /v1/surveys with 400 and stores nothing", async (_, id) => {
    const accessToken = await login()

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(draftBody(id))
      .expect(400)

    const rows = await db.query<{ id: string }>("SELECT id FROM surveys WHERE id = $1", [id])
    expect(rows.rows).toHaveLength(0)
  })

  it("rejects unsafe :id and :attachmentId route params with 400", async () => {
    const accessToken = await login()
    const validId = legacyId()
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(draftBody(validId))
      .expect(201)

    const dotted = await request(app.getHttpServer())
      .get("/v1/surveys/a.b")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
    expect(dotted.body.message).toBe("Invalid identifier")
    expect(JSON.stringify(dotted.body)).not.toContain("a.b")

    const encoded = await request(app.getHttpServer())
      .get("/v1/surveys/%2E%2E%2Fx")
      .set("Authorization", `Bearer ${accessToken}`)
    expect([400, 404]).toContain(encoded.status)

    await request(app.getHttpServer())
      .get(`/v1/surveys/${validId}/attachments/a.b/download-url`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${validId}/attachments/a.b`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
  })

  it("fails only the /sync operations that carry an unsafe id", async () => {
    const accessToken = await login()
    const validId = legacyId()

    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: "op-1",
            entity: "attachment",
            action: "create",
            survey_id: "../x",
            payload: { mime_type: "image/jpeg", size_bytes: 10 },
          },
          { client_ref: "op-2", entity: "survey", action: "upsert", payload: draftBody(validId) },
          {
            client_ref: "op-3",
            entity: "attachment",
            action: "delete",
            survey_id: validId,
            payload: { attachment_id: "../y" },
          },
          {
            client_ref: "op-4",
            entity: "survey",
            action: "delete",
            payload: { id: "a/b" },
          },
        ],
      })
      .expect(200)

    const invalid = {
      status: "fatal_error",
      error: expect.objectContaining({ code: "invalid_sync_operation", http_status: 400 }),
    }
    expect(response.body.results).toHaveLength(4)
    expect(response.body.results[0]).toMatchObject({ client_ref: "op-1", ...invalid })
    expect(response.body.results[1]).toMatchObject({ client_ref: "op-2", status: "synced" })
    expect(response.body.results[2]).toMatchObject({ client_ref: "op-3", ...invalid })
    expect(response.body.results[3]).toMatchObject({ client_ref: "op-4", ...invalid })

    const rows = await db.query<{ id: string }>("SELECT id FROM surveys WHERE id = $1", [validId])
    expect(rows.rows).toHaveLength(1)
  })
})
