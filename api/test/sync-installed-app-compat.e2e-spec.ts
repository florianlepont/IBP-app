import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"

// Proves that the exact payload shapes an installed mobile app sends today
// keep syncing without any rejection after this phase's upsert hardening
// (D-03, D-04, D-12, D-13): status/expires_at sent by the client are
// accepted and ignored, and a submitted survey is protected by value only.
//
// Payload shapes mirrored from mobile/src/storage/sync.ts (operation
// envelope construction ~695-770, buildSurveyPayloadFromRemote ~372-386)
// and mobile/src/storage/surveys.ts (~325-345, local save payload).
describe("Installed-app sync payload compatibility (e2e)", () => {
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

  type MobileOp = {
    client_ref: string
    entity: "survey" | "attachment"
    action: "upsert" | "create" | "delete" | "visibility_update"
    survey_id?: string
    payload: Record<string, unknown>
  }

  // Mirrors the operation envelope built by mobile/src/storage/sync.ts:
  // client_ref = String(sync_queue row id); no extra envelope fields.
  function mobileOps(ops: MobileOp[]) {
    return { operations: ops }
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

  it("replays a fresh install's batch, resync, submit and pulled-survey shapes without rejection", async () => {
    const accessToken = await login(`e2e-mobile-compat-${Date.now()}@ibp.local`)
    const parcelId = await resolveParcel(accessToken, 45.1, 2.1)
    const surveyId = `e2e-mobile-compat-s-${Date.now()}`
    const secondSurveyId = `e2e-mobile-compat-t-${Date.now()}`
    const clientExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

    // (1) A fresh install would send this in one batch: local-save upsert of
    // S (mobile/src/storage/surveys.ts local save payload), an attachment
    // create for S, a visibility_update on S, an upsert of a second survey T
    // and a delete of T. Every result must be "synced".
    const firstBatch = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "1",
            entity: "survey",
            action: "upsert",
            payload: {
              id: surveyId,
              sync_version: 1,
              site_name: "Fresh Install Forest",
              status: "draft",
              visibility: "private",
              parcel_ids: [parcelId],
              region_version: "ACA",
              vegetation_stage: "collineen",
              factors: validFactors,
              expires_at: clientExpiresAt,
            },
          },
          {
            client_ref: "2",
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
          {
            client_ref: "3",
            entity: "survey",
            action: "visibility_update",
            survey_id: surveyId,
            payload: { visibility: "public" },
          },
          {
            client_ref: "4",
            entity: "survey",
            action: "upsert",
            payload: {
              id: secondSurveyId,
              sync_version: 1,
              site_name: "To Be Deleted",
              status: "draft",
              visibility: "private",
              parcel_ids: [parcelId],
              region_version: "ACA",
              vegetation_stage: "collineen",
              factors: validFactors,
            },
          },
          {
            client_ref: "5",
            entity: "survey",
            action: "delete",
            survey_id: secondSurveyId,
            payload: { id: secondSurveyId },
          },
        ]),
      )
      .expect(200)

    for (const result of firstBatch.body.results as Array<{ status: string }>) {
      expect(result.status).toBe("synced")
    }
    const attachmentId = firstBatch.body.results[1].data.attachment_id as string
    expect(attachmentId).toBeTruthy()

    const afterFirstBatch = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    expect(afterFirstBatch.body.status).toBe("draft")
    const createdAtMs = new Date(afterFirstBatch.body.created_at).getTime()
    const expiresAtMs = new Date(afterFirstBatch.body.expires_at).getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    // The client sent a 1-year expires_at; the server must have ignored it.
    expect(expiresAtMs).toBeGreaterThanOrEqual(createdAtMs + sevenDaysMs - 60_000)
    expect(expiresAtMs).toBeLessThanOrEqual(createdAtMs + sevenDaysMs + 60_000)
    expect(afterFirstBatch.body.parcel_ids).toContain(parcelId)

    // (2) attachment.delete of the created attachment.
    const secondBatch = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "6",
            entity: "attachment",
            action: "delete",
            survey_id: surveyId,
            payload: { attachment_id: attachmentId },
          },
        ]),
      )
      .expect(200)
    expect(secondBatch.body.results[0].status).toBe("synced")

    // (3) Upsert S at sync_version 2 with status "submitted": synced but
    // ignored, status stays draft, no 'submitted' event created (D-03).
    const thirdBatch = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "7",
            entity: "survey",
            action: "upsert",
            payload: {
              id: surveyId,
              sync_version: 2,
              site_name: "Fresh Install Forest",
              status: "submitted",
              visibility: "public",
              parcel_ids: [parcelId],
              region_version: "ACA",
              vegetation_stage: "collineen",
              factors: validFactors,
              expires_at: clientExpiresAt,
            },
          },
        ]),
      )
      .expect(200)
    expect(thirdBatch.body.results[0].status).toBe("synced")

    const afterThirdBatch = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    expect(afterThirdBatch.body.status).toBe("draft")

    const submittedEvents = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM survey_events
       WHERE survey_id = $1 AND event_type = 'submitted'`,
      [surveyId],
    )
    expect(submittedEvents.rows[0].count).toBe("0")

    // (4) Submit S through the dedicated endpoint. P is a fresh parcel, so
    // the server-derived version_number is the next one for it.
    const submit = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
    if (submit.status !== 201) {
      // Never loosen this assertion: print the body to diagnose the fixture.
      // eslint-disable-next-line no-console
      console.error("submit failed", submit.status, JSON.stringify(submit.body))
    }
    expect(submit.status).toBe(201)

    // (5) Pulled-survey replay, mirroring buildSurveyPayloadFromRemote
    // (mobile/src/storage/sync.ts:372-386): status "submitted", server
    // expires_at text, server scores, server factors, server parcel_ids.
    const changes = await request(app.getHttpServer())
      .get("/v1/sync/changes")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    const pulled = (changes.body.surveys as Array<Record<string, unknown>>).find(
      (survey) => survey.id === surveyId,
    )
    expect(pulled).toBeTruthy()
    const remoteSurvey = pulled as Record<string, unknown>
    expect(remoteSurvey.status).toBe("submitted")

    function buildRemotePayload(overrides: Record<string, unknown> = {}) {
      return {
        id: remoteSurvey.id,
        sync_version: remoteSurvey.sync_version,
        site_name: remoteSurvey.site_name,
        status: remoteSurvey.status,
        visibility: remoteSurvey.visibility,
        parcel_ids: remoteSurvey.parcel_ids,
        region_version: remoteSurvey.region_version,
        vegetation_stage: remoteSurvey.vegetation_stage,
        factors: remoteSurvey.factors,
        scores: remoteSurvey.scores,
        expires_at: remoteSurvey.expires_at,
        ...overrides,
      }
    }

    // (5a) Same sync_version -> synced (idempotent replay).
    const replaySame = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "8",
            entity: "survey",
            action: "upsert",
            payload: buildRemotePayload(),
          },
        ]),
      )
      .expect(200)
    expect(replaySame.body.results[0].status).toBe("synced")

    // (5b) sync_version + 1, identical values -> synced; nothing rewritten.
    const nextSyncVersion = (remoteSurvey.sync_version as number) + 1
    const replayBumped = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "9",
            entity: "survey",
            action: "upsert",
            payload: buildRemotePayload({ sync_version: nextSyncVersion }),
          },
        ]),
      )
      .expect(200)
    expect(replayBumped.body.results[0].status).toBe("synced")

    const afterReplayBumped = await db.query<{
      factors: Record<string, unknown>
      scores: Record<string, unknown>
      status: string
    }>(`SELECT factors, scores, status FROM surveys WHERE id = $1`, [surveyId])
    expect(afterReplayBumped.rows[0].factors).toEqual(remoteSurvey.factors)
    expect(afterReplayBumped.rows[0].scores).toEqual(remoteSurvey.scores)
    expect(afterReplayBumped.rows[0].status).toBe("submitted")
    const parcelsAfterReplay = await db.query<{ parcel_id: string }>(
      `SELECT parcel_id FROM survey_parcels WHERE survey_id = $1`,
      [surveyId],
    )
    expect(parcelsAfterReplay.rows.map((row) => row.parcel_id)).toContain(parcelId)

    // (5c) sync_version + 2 with scores: {} -> synced, scores excluded (D-13).
    const replayEmptyScores = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "10",
            entity: "survey",
            action: "upsert",
            payload: buildRemotePayload({ sync_version: nextSyncVersion + 1, scores: {} }),
          },
        ]),
      )
      .expect(200)
    expect(replayEmptyScores.body.results[0].status).toBe("synced")

    // (5d) sync_version + 3 with factors.A changed -> fatal_error,
    // survey_submitted_read_only, 409, details.fields contains "factors";
    // stored factors unchanged (D-04).
    const changedFactors = { ...(remoteSurvey.factors as Record<string, unknown>), A: 5 }
    const replayChangedFactors = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "11",
            entity: "survey",
            action: "upsert",
            payload: buildRemotePayload({
              sync_version: nextSyncVersion + 2,
              factors: changedFactors,
            }),
          },
        ]),
      )
      .expect(200)
    expect(replayChangedFactors.body.results[0].status).toBe("fatal_error")
    expect(replayChangedFactors.body.results[0].error.code).toBe("survey_submitted_read_only")
    expect(replayChangedFactors.body.results[0].error.http_status).toBe(409)
    expect(replayChangedFactors.body.results[0].error.details.fields).toContain("factors")

    const factorsAfterRejected = await db.query<{ factors: Record<string, unknown> }>(
      `SELECT factors FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(factorsAfterRejected.rows[0].factors).toEqual(remoteSurvey.factors)

    // (6) expires_at: "abc" on a draft upsert -> synced, ignored, never
    // rejected (D-03).
    const draftSurveyId = `e2e-mobile-compat-draft-${Date.now()}`
    const draftBatch = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        mobileOps([
          {
            client_ref: "12",
            entity: "survey",
            action: "upsert",
            payload: {
              id: draftSurveyId,
              sync_version: 1,
              site_name: "Bad Expiry Forest",
              status: "draft",
              visibility: "private",
              parcel_ids: [parcelId],
              region_version: "ACA",
              vegetation_stage: "collineen",
              factors: validFactors,
              expires_at: "abc",
            },
          },
        ]),
      )
      .expect(200)
    expect(draftBatch.body.results[0].status).toBe("synced")
  })
})
