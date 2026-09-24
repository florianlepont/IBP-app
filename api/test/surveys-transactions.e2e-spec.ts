import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { installEventInsertFailure, removeEventInsertFailures } from "./e2e-fault-injection"

// D-06/D-07/D-08/D-09: proves that every SurveysService write path is atomic
// with its event (ARCH-3), that a replay after an injected failure heals the
// survey (no silent loss), that concurrent submits on a parcel resolve to
// exactly one winner (A-M7), and that a concurrent upsert on the same
// sync_version never 500s (T-01.4-11).
describe("Surveys transactions (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService

  const validFactors = {
    A: 1,
    B: 1,
    C: 1,
    D: 1,
    E: 1,
    F: 1,
    G: 1,
    H: 1,
    I: 2,
    J: 2,
  }

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return response.body.access_token as string
  }

  async function resolveParcel(accessToken: string, lat: number, lng: number): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/v1/parcels/resolve")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ lat: String(lat), lng: String(lng) })
      .expect(200)
    const parcelId = response.body.parcel?.parcel_id as string
    expect(parcelId).toBeTruthy()
    return parcelId
  }

  async function getNextVersionNumber(
    parcelId: string,
    surveyIdToExclude?: string,
  ): Promise<number> {
    const result = await db.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(s.version_number), 0) + 1 AS next_version
       FROM surveys s
       JOIN survey_parcels sp
         ON sp.survey_id = s.id
       WHERE sp.parcel_id = $1
         AND s.deleted_at IS NULL
         AND s.status = 'submitted'
         AND ($2::text IS NULL OR s.id <> $2)`,
      [parcelId, surveyIdToExclude ?? null],
    )
    return result.rows[0]?.next_version ?? 1
  }

  async function createSubmittableSurvey(
    accessToken: string,
    id: string,
    parcelId: string,
    versionNumber: number,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id,
        sync_version: 1,
        site_name: "Submittable Forest",
        status: "draft",
        visibility: "private",
        parcel_id: parcelId,
        observation_year: 2025,
        version_number: versionNumber,
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: validFactors,
      })
      .expect(201)
  }

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

  it("rolls back an upsert create when the 'created' event insert fails", async () => {
    const accessToken = await login(`e2e-tx-create-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-create-${Date.now()}`
    const parcelId = await resolveParcel(accessToken, 46.1, 3.1)

    await installEventInsertFailure(db, { surveyId, eventType: "created" })

    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        operations: [
          {
            client_ref: "create-1",
            entity: "survey",
            action: "upsert",
            payload: {
              id: surveyId,
              sync_version: 1,
              site_name: "Create Rollback Forest",
              parcel_ids: [parcelId],
              factors: {},
              scores: {},
            },
          },
        ],
      })
      .expect(200)

    expect(response.body.results[0].status).toBe("retryable_error")

    const surveyRow = await db.query(`SELECT id FROM surveys WHERE id = $1`, [surveyId])
    expect(surveyRow.rows).toHaveLength(0)

    const parcelLinks = await db.query(
      `SELECT parcel_id FROM survey_parcels WHERE survey_id = $1`,
      [surveyId],
    )
    expect(parcelLinks.rows).toHaveLength(0)
  })

  it("rolls back an upsert update and heals on replay after the failure is removed", async () => {
    const accessToken = await login(`e2e-tx-update-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-update-${Date.now()}`

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Original Name",
        factors: {},
        scores: {},
      })
      .expect(201)

    await installEventInsertFailure(db, { surveyId, eventType: "updated" })

    const failedUpsert = {
      client_ref: "update-1",
      entity: "survey",
      action: "upsert",
      payload: {
        id: surveyId,
        sync_version: 2,
        site_name: "Updated Name",
        factors: {},
        scores: {},
      },
    }

    const failedResponse = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: [failedUpsert] })
      .expect(200)

    expect(failedResponse.body.results[0].status).toBe("retryable_error")

    const afterFailure = await db.query<{ sync_version: number; site_name: string }>(
      `SELECT sync_version, site_name FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(afterFailure.rows[0].sync_version).toBe(1)
    expect(afterFailure.rows[0].site_name).toBe("Original Name")

    await removeEventInsertFailures(db)

    const replayResponse = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ operations: [failedUpsert] })
      .expect(200)

    expect(replayResponse.body.results[0].status).toBe("synced")

    const afterReplay = await db.query<{ sync_version: number; site_name: string }>(
      `SELECT sync_version, site_name FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(afterReplay.rows[0].sync_version).toBe(2)
    expect(afterReplay.rows[0].site_name).toBe("Updated Name")

    const events = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM survey_events
       WHERE survey_id = $1
         AND event_type = 'updated'
         AND payload ->> 'sync_version' = '2'`,
      [surveyId],
    )
    expect(events.rows[0].count).toBe("1")
  })

  it("rolls back a patch when the 'updated' event insert fails", async () => {
    const accessToken = await login(`e2e-tx-patch-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-patch-${Date.now()}`
    const originalParcelId = await resolveParcel(accessToken, 46.2, 3.2)
    const newParcelId = await resolveParcel(accessToken, 46.3, 3.3)

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Original Patch Name",
        parcel_ids: [originalParcelId],
        factors: {},
        scores: {},
      })
      .expect(201)

    await installEventInsertFailure(db, { surveyId, eventType: "updated" })

    await request(app.getHttpServer())
      .patch(`/v1/surveys/${surveyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ site_name: "Patched Name", parcel_ids: [newParcelId] })
      .expect(500)

    const surveyRow = await db.query<{ site_name: string }>(
      `SELECT site_name FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(surveyRow.rows[0].site_name).toBe("Original Patch Name")

    const parcelLinks = await db.query<{ parcel_id: string }>(
      `SELECT parcel_id FROM survey_parcels WHERE survey_id = $1`,
      [surveyId],
    )
    expect(parcelLinks.rows.map((row) => row.parcel_id)).toEqual([originalParcelId])
  })

  it("rolls back a submit when the 'submitted' event insert fails", async () => {
    const accessToken = await login(`e2e-tx-submit-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-submit-${Date.now()}`
    const parcelId = await resolveParcel(accessToken, 46.4, 3.4)
    const versionNumber = await getNextVersionNumber(parcelId)
    await createSubmittableSurvey(accessToken, surveyId, parcelId, versionNumber)

    await installEventInsertFailure(db, { surveyId, eventType: "submitted" })

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(500)

    const afterFailure = await db.query<{ status: string; submitted_at: string | null }>(
      `SELECT status, submitted_at::text FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(afterFailure.rows[0].status).toBe("draft")
    expect(afterFailure.rows[0].submitted_at).toBeNull()

    await removeEventInsertFailures(db)

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201)
  })

  it("rolls back a delete when the 'deleted' event insert fails, including attachments", async () => {
    const accessToken = await login(`e2e-tx-delete-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-delete-${Date.now()}`

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Delete Rollback Forest",
        factors: {},
        scores: {},
      })
      .expect(201)

    const attachment = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ mime_type: "image/jpeg", size_bytes: 1000 })
      .expect(201)
    const attachmentId = attachment.body.attachment_id as string
    expect(attachmentId).toBeTruthy()

    await installEventInsertFailure(db, { surveyId, eventType: "deleted" })

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(500)

    const surveyRow = await db.query<{ deleted_at: string | null }>(
      `SELECT deleted_at::text FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(surveyRow.rows[0].deleted_at).toBeNull()

    const attachmentRow = await db.query<{ deleted_at: string | null }>(
      `SELECT deleted_at::text FROM attachments WHERE id = $1`,
      [attachmentId],
    )
    expect(attachmentRow.rows[0].deleted_at).toBeNull()
  })

  it("gives exactly one winner for two concurrent submits on the same parcel version, never a 500", async () => {
    for (let i = 0; i < 5; i += 1) {
      const accessToken = await login(`e2e-tx-concurrent-submit-${Date.now()}-${i}@ibp.local`)
      const parcelId = await resolveParcel(accessToken, 47 + i / 10, 3.5 + i / 10)
      const versionNumber = await getNextVersionNumber(parcelId)

      const surveyIdA = `e2e-tx-cs-a-${Date.now()}-${i}`
      const surveyIdB = `e2e-tx-cs-b-${Date.now()}-${i}`
      await createSubmittableSurvey(accessToken, surveyIdA, parcelId, versionNumber)
      await createSubmittableSurvey(accessToken, surveyIdB, parcelId, versionNumber)

      const [responseA, responseB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/v1/surveys/${surveyIdA}/submit`)
          .set("Authorization", `Bearer ${accessToken}`),
        request(app.getHttpServer())
          .post(`/v1/surveys/${surveyIdB}/submit`)
          .set("Authorization", `Bearer ${accessToken}`),
      ])

      const statuses = [responseA.status, responseB.status].sort((a, b) => a - b)
      expect(statuses).toEqual([201, 409])
      expect(statuses).not.toContain(500)

      const conflictResponse = responseA.status === 409 ? responseA : responseB
      expect(conflictResponse.body.code).toBe("parcel_version_conflict")

      const submittedCount = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM surveys s
         JOIN survey_parcels sp ON sp.survey_id = s.id
         WHERE sp.parcel_id = $1
           AND s.status = 'submitted'
           AND s.version_number = $2`,
        [parcelId, versionNumber],
      )
      expect(submittedCount.rows[0].count).toBe("1")
    }
  })

  it("never 500s and converges on one sync_version for two concurrent upserts at the same sync_version", async () => {
    const accessToken = await login(`e2e-tx-concurrent-upsert-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-cu-${Date.now()}`

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Concurrent Base Name",
        factors: {},
        scores: {},
      })
      .expect(201)

    const buildBatch = (siteName: string) => ({
      operations: [
        {
          client_ref: `cu-${siteName}`,
          entity: "survey",
          action: "upsert",
          payload: {
            id: surveyId,
            sync_version: 2,
            site_name: siteName,
            factors: {},
            scores: {},
          },
        },
      ],
    })

    const [responseA, responseB] = await Promise.all([
      request(app.getHttpServer())
        .post("/v1/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(buildBatch("Concurrent Name A")),
      request(app.getHttpServer())
        .post("/v1/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .send(buildBatch("Concurrent Name B")),
    ])

    expect(responseA.status).toBe(200)
    expect(responseB.status).toBe(200)
    expect(responseA.body.results[0].status).not.toBe("retryable_error")
    expect(responseB.body.results[0].status).not.toBe("retryable_error")
    expect(responseA.body.results[0].status).not.toBe("fatal_error")
    expect(responseB.body.results[0].status).not.toBe("fatal_error")

    const surveyRow = await db.query<{ sync_version: number }>(
      `SELECT sync_version FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(surveyRow.rows[0].sync_version).toBe(2)

    const events = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM survey_events
       WHERE survey_id = $1
         AND event_type = 'updated'
         AND payload ->> 'sync_version' = '2'`,
      [surveyId],
    )
    expect(events.rows[0].count).toBe("1")
  })

  it("persists status='expired' and the 'expired' event when submit is rejected after the deadline", async () => {
    const accessToken = await login(`e2e-tx-expired-${Date.now()}@ibp.local`)
    const surveyId = `e2e-tx-expired-${Date.now()}`

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Expired Rollback Forest",
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: validFactors,
      })
      .expect(201)

    await db.query(`UPDATE surveys SET expires_at = NOW() - interval '1 minute' WHERE id = $1`, [
      surveyId,
    ])

    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(422)

    const surveyRow = await db.query<{ status: string }>(
      `SELECT status FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(surveyRow.rows[0].status).toBe("expired")

    const events = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM survey_events
       WHERE survey_id = $1
         AND event_type = 'expired'`,
      [surveyId],
    )
    expect(events.rows[0].count).toBe("1")
  })
})
