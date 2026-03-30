import "dotenv/config"
import { INestApplication } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { DatabaseService } from "../src/database/database.service"

describe("Epic E - Search and Reports (e2e)", () => {
  let app: INestApplication
  let db: DatabaseService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    db = moduleFixture.get(DatabaseService)
    app.setGlobalPrefix("v1")
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("filters my surveys by query/date/status via GET /v1/surveys", async () => {
    const email = `e2e-epic-e2-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)

    const accessToken = login.body.access_token as string
    const surveyA = `e2e-epic-e2-a-${Date.now()}`
    const surveyB = `e2e-epic-e2-b-${Date.now()}`
    const surveyC = `e2e-epic-e2-c-${Date.now()}`

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyA,
        sync_version: 1,
        site_name: "Oak Ridge",
        status: "draft",
        visibility: "private",
        factors: {},
        scores: {},
        location: { source: "gps", lat: 48.643, lng: 1.829 },
      })
      .expect(201)

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyB,
        sync_version: 1,
        site_name: "Pine Valley",
        status: "submitted",
        visibility: "private",
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: {
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
        },
        scores: {},
        location: { source: "gps", lat: 48.643, lng: 1.829 },
      })
      .expect(201)

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyC,
        sync_version: 1,
        site_name: "Oak Meadows",
        status: "draft",
        visibility: "private",
        factors: {},
        scores: {},
        location: { source: "gps", lat: 48.643, lng: 1.829 },
      })
      .expect(201)

    await db.query(
      `UPDATE surveys SET updated_at = '2026-03-01T10:00:00Z'::timestamptz WHERE id = $1`,
      [surveyA],
    )
    await db.query(
      `UPDATE surveys SET updated_at = '2026-03-06T10:00:00Z'::timestamptz WHERE id = $1`,
      [surveyB],
    )
    await db.query(
      `UPDATE surveys SET updated_at = '2026-03-10T10:00:00Z'::timestamptz WHERE id = $1`,
      [surveyC],
    )

    const filtered = await request(app.getHttpServer())
      .get("/v1/surveys")
      .query({
        q: "oak",
        from: "2026-03-05",
        to: "2026-03-12",
        status: "draft",
      })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    const filteredIds = (filtered.body.items as Array<{ id: string }>).map((item) => item.id)
    expect(filteredIds).toContain(surveyC)
    expect(filteredIds).not.toContain(surveyA)
    expect(filteredIds).not.toContain(surveyB)

    const invalidDateIgnored = await request(app.getHttpServer())
      .get("/v1/surveys")
      .query({
        q: "oak",
        from: "invalid-date",
        status: "draft",
      })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    const invalidDateIds = (invalidDateIgnored.body.items as Array<{ id: string }>).map(
      (item) => item.id,
    )
    expect(invalidDateIds).toContain(surveyA)
    expect(invalidDateIds).toContain(surveyC)
  })

  it("supports reporting and moderator review workflow via /v1/reports", async () => {
    const ownerEmail = `e2e-epic-e3-owner-${Date.now()}@ibp.local`
    const ownerLogin = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: ownerEmail, password: "demo1234" })
      .expect(201)
    const ownerToken = ownerLogin.body.access_token as string

    const ownerMe = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
    const ownerId = ownerMe.body.id as string

    const reporterEmail = `e2e-epic-e3-reporter-${Date.now()}@ibp.local`
    const reporterLogin = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: reporterEmail, password: "demo1234" })
      .expect(201)
    const reporterToken = reporterLogin.body.access_token as string

    const moderatorEmail = `e2e-epic-e3-moderator-${Date.now()}@ibp.local`
    const moderatorLogin = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: moderatorEmail, password: "demo1234" })
      .expect(201)
    const moderatorToken = moderatorLogin.body.access_token as string

    const moderatorMe = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${moderatorToken}`)
      .expect(200)
    const moderatorId = moderatorMe.body.id as string
    await db.query(`UPDATE users SET role = 'moderator' WHERE id = $1`, [moderatorId])

    const publicSurveyId = `e2e-epic-e3-public-${Date.now()}`
    const privateSurveyId = `e2e-epic-e3-private-${Date.now()}`
    const requiredFactors = {
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

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        id: publicSurveyId,
        sync_version: 1,
        site_name: "Public Forest",
        status: "submitted",
        visibility: "public",
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: requiredFactors,
        scores: {},
        location: { source: "gps", lat: 48.643, lng: 1.829 },
      })
      .expect(201)

    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        id: privateSurveyId,
        sync_version: 1,
        site_name: "Private Forest",
        status: "submitted",
        visibility: "private",
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: requiredFactors,
        scores: {},
        location: { source: "gps", lat: 48.643, lng: 1.829 },
      })
      .expect(201)

    await request(app.getHttpServer())
      .post("/v1/reports")
      .set("Authorization", `Bearer ${reporterToken}`)
      .send({ survey_id: publicSurveyId, reason: "" })
      .expect(400)

    await request(app.getHttpServer())
      .post("/v1/reports")
      .set("Authorization", `Bearer ${reporterToken}`)
      .send({ survey_id: privateSurveyId, reason: "Suspicious values" })
      .expect(403)

    const created = await request(app.getHttpServer())
      .post("/v1/reports")
      .set("Authorization", `Bearer ${reporterToken}`)
      .send({ survey_id: publicSurveyId, reason: "Suspicious values and duplicate pattern" })
      .expect(201)
    expect(created.body.status).toBe("open")
    const reportId = created.body.id as string

    const reportedEvent = await db.query<{ event_type: string }>(
      `SELECT event_type
       FROM survey_events
       WHERE survey_id = $1
         AND event_type = 'reported'
       ORDER BY created_at DESC
       LIMIT 1`,
      [publicSurveyId],
    )
    expect(reportedEvent.rows[0]?.event_type).toBe("reported")

    await request(app.getHttpServer())
      .get("/v1/reports")
      .set("Authorization", `Bearer ${reporterToken}`)
      .expect(403)

    const openReports = await request(app.getHttpServer())
      .get("/v1/reports")
      .query({ status: "open" })
      .set("Authorization", `Bearer ${moderatorToken}`)
      .expect(200)
    expect(
      (openReports.body.items as Array<{ id: string }>).some((item) => item.id === reportId),
    ).toBe(true)

    const reviewed = await request(app.getHttpServer())
      .patch(`/v1/reports/${reportId}`)
      .set("Authorization", `Bearer ${moderatorToken}`)
      .send({ status: "reviewed" })
      .expect(200)
    expect(reviewed.body.status).toBe("reviewed")
    expect(typeof reviewed.body.reviewed_at).toBe("string")

    const reviewedReports = await request(app.getHttpServer())
      .get("/v1/reports")
      .query({ status: "reviewed" })
      .set("Authorization", `Bearer ${moderatorToken}`)
      .expect(200)
    const reviewedRow = (
      reviewedReports.body.items as Array<{ id: string; reviewed_by: string | null }>
    ).find((item) => item.id === reportId)
    expect(reviewedRow).toBeTruthy()
    expect(reviewedRow?.reviewed_by).toBe(moderatorId)

    await request(app.getHttpServer())
      .post("/v1/reports")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ survey_id: privateSurveyId, reason: "Owner can still flag own survey for review" })
      .expect(403)
    expect(ownerId).toBeTruthy()
  })
})
