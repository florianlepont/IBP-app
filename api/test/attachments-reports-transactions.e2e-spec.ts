import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { installEventInsertFailure, removeEventInsertFailures } from "./e2e-fault-injection"

// T-01.4-17/18/19: proves that attachment create/upload/delete and report
// creation each run atomically with their survey_events insert (D-06), that
// storage cleanup only happens after commit (D-07), and that concurrent
// attachment creates cannot push a survey past the 10-attachment limit
// (T-01.4-18, forUpdate serialisation).
describe("Attachments and reports transactions (e2e)", () => {
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

  afterEach(async () => {
    await removeEventInsertFailures(db)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  async function loginAsNewUser(): Promise<string> {
    const email = `e2e-atx-${Date.now()}-${Math.random().toString(36).slice(2)}@ibp.local`
    const res = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return res.body.access_token as string
  }

  async function createDraftSurvey(
    accessToken: string,
    surveyId: string,
    visibility: "private" | "public" = "private",
  ): Promise<void> {
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Attachment/report transaction fixture",
        status: "draft",
        visibility,
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: {},
        scores: {},
      })
      .expect(201)
  }

  async function countRows(table: string, surveyId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE survey_id = $1`,
      [surveyId],
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  describe("attachment_created", () => {
    it("REST create: injected failure leaves nothing committed", async () => {
      const accessToken = await loginAsNewUser()
      const surveyId = `e2e-atx-created-rest-${Date.now()}`
      await createDraftSurvey(accessToken, surveyId)

      await installEventInsertFailure(db, { surveyId, eventType: "attachment_created" })

      await request(app.getHttpServer())
        .post(`/v1/surveys/${surveyId}/attachments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ mime_type: "image/jpeg", size_bytes: 1000 })
        .expect(500)

      expect(await countRows("attachments", surveyId)).toBe(0)
    })

    it("/v1/sync attachment.create: injected failure returns retryable_error and commits nothing; retry after removal succeeds", async () => {
      const accessToken = await loginAsNewUser()
      const surveyId = `e2e-atx-created-sync-${Date.now()}`
      await createDraftSurvey(accessToken, surveyId)

      await installEventInsertFailure(db, { surveyId, eventType: "attachment_created" })

      const failedResponse = await request(app.getHttpServer())
        .post("/v1/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          operations: [
            {
              client_ref: "op-attachment-create-fail",
              entity: "attachment",
              action: "create",
              survey_id: surveyId,
              payload: {
                mime_type: "image/jpeg",
                size_bytes: 1000,
                captured_at: null,
                metadata: {},
              },
            },
          ],
        })
        .expect(200)

      expect(failedResponse.body.results[0]).toMatchObject({
        client_ref: "op-attachment-create-fail",
        entity: "attachment",
        action: "create",
        status: "retryable_error",
      })
      expect(await countRows("attachments", surveyId)).toBe(0)

      await removeEventInsertFailures(db)

      const succeededResponse = await request(app.getHttpServer())
        .post("/v1/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          operations: [
            {
              client_ref: "op-attachment-create-retry",
              entity: "attachment",
              action: "create",
              survey_id: surveyId,
              payload: {
                mime_type: "image/jpeg",
                size_bytes: 1000,
                captured_at: null,
                metadata: {},
              },
            },
          ],
        })
        .expect(200)

      expect(succeededResponse.body.results[0]).toMatchObject({
        client_ref: "op-attachment-create-retry",
        entity: "attachment",
        action: "create",
        status: "synced",
      })
      expect(await countRows("attachments", surveyId)).toBe(1)
    })
  })

  describe("attachment_uploaded", () => {
    it("injected failure leaves uploaded_at null", async () => {
      const accessToken = await loginAsNewUser()
      const surveyId = `e2e-atx-uploaded-${Date.now()}`
      await createDraftSurvey(accessToken, surveyId)

      const createRes = await request(app.getHttpServer())
        .post(`/v1/surveys/${surveyId}/attachments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ mime_type: "image/jpeg", size_bytes: 1000 })
        .expect(201)

      const attachmentId = createRes.body.attachment_id as string
      const uploadToken = new URL(
        `http://localhost${createRes.body.confirm_url as string}`,
      ).searchParams.get("token")

      await installEventInsertFailure(db, { surveyId, eventType: "attachment_uploaded" })

      await request(app.getHttpServer())
        .put(`/v1/surveys/${surveyId}/attachments/${attachmentId}/upload`)
        .set("Authorization", `Bearer ${accessToken}`)
        .query({ token: uploadToken })
        .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        })
        .expect(500)

      const attachment = await db.query<{ uploaded_at: string | null }>(
        `SELECT uploaded_at::text FROM attachments WHERE id = $1`,
        [attachmentId],
      )
      expect(attachment.rows[0].uploaded_at).toBeNull()
    })
  })

  describe("attachment_deleted", () => {
    it("injected failure leaves deleted_at null", async () => {
      const accessToken = await loginAsNewUser()
      const surveyId = `e2e-atx-deleted-${Date.now()}`
      await createDraftSurvey(accessToken, surveyId)

      const createRes = await request(app.getHttpServer())
        .post(`/v1/surveys/${surveyId}/attachments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ mime_type: "image/jpeg", size_bytes: 1000 })
        .expect(201)

      const attachmentId = createRes.body.attachment_id as string

      await installEventInsertFailure(db, { surveyId, eventType: "attachment_deleted" })

      await request(app.getHttpServer())
        .delete(`/v1/surveys/${surveyId}/attachments/${attachmentId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(500)

      const attachment = await db.query<{ deleted_at: string | null }>(
        `SELECT deleted_at::text FROM attachments WHERE id = $1`,
        [attachmentId],
      )
      expect(attachment.rows[0].deleted_at).toBeNull()
    })
  })

  describe("concurrent attachment creates", () => {
    it("cannot push a survey past the 10-attachment limit", async () => {
      const accessToken = await loginAsNewUser()
      const surveyId = `e2e-atx-limit-${Date.now()}`
      await createDraftSurvey(accessToken, surveyId)

      for (let i = 0; i < 9; i += 1) {
        await request(app.getHttpServer())
          .post(`/v1/surveys/${surveyId}/attachments`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ mime_type: "image/jpeg", size_bytes: 1000 })
          .expect(201)
      }

      const responses = await Promise.all(
        [0, 1, 2].map(() =>
          request(app.getHttpServer())
            .post(`/v1/surveys/${surveyId}/attachments`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ mime_type: "image/jpeg", size_bytes: 1000 }),
        ),
      )

      const statuses = responses.map((res) => res.status).sort()
      expect(statuses).toEqual([201, 400, 400])
      expect(await countRows("attachments", surveyId)).toBe(10)
    })
  })

  describe("reported", () => {
    it("injected failure leaves nothing committed; retry after removal succeeds", async () => {
      const ownerToken = await loginAsNewUser()
      const reporterToken = await loginAsNewUser()
      const surveyId = `e2e-atx-report-${Date.now()}`
      await createDraftSurvey(ownerToken, surveyId, "public")

      await installEventInsertFailure(db, { surveyId, eventType: "reported" })

      await request(app.getHttpServer())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${reporterToken}`)
        .send({ survey_id: surveyId, reason: "Transaction test reason" })
        .expect(500)

      expect(await countRows("reports", surveyId)).toBe(0)

      await removeEventInsertFailures(db)

      await request(app.getHttpServer())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${reporterToken}`)
        .send({ survey_id: surveyId, reason: "Transaction test reason retry" })
        .expect(201)

      expect(await countRows("reports", surveyId)).toBe(1)

      const events = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_events WHERE survey_id = $1 AND event_type = 'reported'`,
        [surveyId],
      )
      expect(parseInt(events.rows[0].count, 10)).toBe(1)
    })
  })
})
