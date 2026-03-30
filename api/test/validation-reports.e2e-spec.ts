import "dotenv/config"
import { INestApplication, ValidationPipe } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { DatabaseService } from "../src/database/database.service"

describe("ValidationPipe + Reports CRUD + Token refresh (e2e)", () => {
  let app: INestApplication
  let db: DatabaseService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    db = moduleFixture.get(DatabaseService)
    app.setGlobalPrefix("v1")
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    )
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function loginAsNewUser(): Promise<{ accessToken: string; refreshToken: string }> {
    const email = `e2e-val-${Date.now()}-${Math.random().toString(36).slice(2)}@ibp.local`
    const res = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return {
      accessToken: res.body.access_token as string,
      refreshToken: res.body.refresh_token as string,
    }
  }

  // ─── ValidationPipe — invalid enum ────────────────────────────────────────

  describe("ValidationPipe", () => {
    it("rejects survey upsert with invalid status enum (400)", async () => {
      const { accessToken } = await loginAsNewUser()

      await request(app.getHttpServer())
        .post("/v1/surveys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          id: `e2e-val-${Date.now()}`,
          sync_version: 1,
          site_name: "Test",
          status: "INVALID_STATUS",
          visibility: "private",
          factors: {},
          scores: {},
        })
        .expect(400)
    })

    it("rejects survey upsert with invalid visibility enum (400)", async () => {
      const { accessToken } = await loginAsNewUser()

      await request(app.getHttpServer())
        .post("/v1/surveys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          id: `e2e-val-${Date.now()}`,
          sync_version: 1,
          site_name: "Test",
          status: "draft",
          visibility: "secret",
          factors: {},
          scores: {},
        })
        .expect(400)
    })

    it("strips unknown fields (whitelist: true) instead of rejecting", async () => {
      const { accessToken } = await loginAsNewUser()
      const surveyId = `e2e-whitelist-${Date.now()}`

      const res = await request(app.getHttpServer())
        .post("/v1/surveys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          id: surveyId,
          sync_version: 1,
          site_name: "Whitelist test",
          status: "draft",
          visibility: "private",
          factors: {},
          scores: {},
          __unknown_field__: "should be stripped",
        })
        .expect(201)

      expect(res.body.id).toBe(surveyId)
      expect(res.body).not.toHaveProperty("__unknown_field__")
    })

    it("rejects report create with non-string survey_id (400)", async () => {
      const { accessToken } = await loginAsNewUser()

      await request(app.getHttpServer())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ survey_id: 12345 })
        .expect(400)
    })
  })

  // ─── Token refresh ────────────────────────────────────────────────────────

  describe("POST /v1/auth/refresh", () => {
    it("returns new access_token and refresh_token", async () => {
      const { refreshToken } = await loginAsNewUser()

      const res = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({ refresh_token: refreshToken })
        .expect(201)

      expect(typeof res.body.access_token).toBe("string")
      expect(typeof res.body.refresh_token).toBe("string")
    })

    it("rejects an invalid refresh token (401)", async () => {
      await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({ refresh_token: "not-a-valid-token" })
        .expect(401)
    })

    it("rejects request with missing refresh_token field gracefully", async () => {
      const res = await request(app.getHttpServer()).post("/v1/auth/refresh").send({})

      // 401 or 400 — either is acceptable; just not 500
      expect(res.status).toBeLessThan(500)
    })
  })

  // ─── Reports CRUD ─────────────────────────────────────────────────────────

  describe("Reports CRUD", () => {
    it("creates a report and lists it", async () => {
      const { accessToken: ownerToken } = await loginAsNewUser()
      const { accessToken: moderatorToken } = await loginAsNewUser()

      // promote moderator user via DB
      const meRes = await request(app.getHttpServer())
        .get("/v1/me")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .expect(200)
      await db.query(`UPDATE users SET role = 'moderator' WHERE id = $1`, [meRes.body.id])

      // create a public survey as owner
      const surveyId = `e2e-report-survey-${Date.now()}`
      await request(app.getHttpServer())
        .post("/v1/surveys")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          id: surveyId,
          sync_version: 1,
          site_name: "Reportable site",
          status: "draft",
          visibility: "public",
          factors: {},
          scores: {},
        })
        .expect(201)

      // moderator creates a report on the public survey
      const createRes = await request(app.getHttpServer())
        .post("/v1/reports")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .send({ survey_id: surveyId, reason: "Test report reason" })
        .expect(201)

      expect(createRes.body.survey_id ?? createRes.body.surveyId ?? createRes.body.id).toBeTruthy()

      // moderator lists reports — should include our newly created one
      const listRes = await request(app.getHttpServer())
        .get("/v1/reports")
        .set("Authorization", `Bearer ${moderatorToken}`)
        .expect(200)

      const reports = Array.isArray(listRes.body) ? listRes.body : (listRes.body.items ?? [])
      expect(reports.length).toBeGreaterThanOrEqual(1)
    })

    it("rejects unauthenticated report creation (401)", async () => {
      await request(app.getHttpServer())
        .post("/v1/reports")
        .send({ survey_id: "some-survey", reason: "test" })
        .expect(401)
    })

    it("rejects unauthenticated report listing (401)", async () => {
      await request(app.getHttpServer()).get("/v1/reports").expect(401)
    })
  })

  // ─── Survey delete ────────────────────────────────────────────────────────

  describe("DELETE /v1/surveys/:id", () => {
    it("returns 204 when deleting an existing survey", async () => {
      const { accessToken } = await loginAsNewUser()
      const surveyId = `e2e-delete-${Date.now()}`

      await request(app.getHttpServer())
        .post("/v1/surveys")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          id: surveyId,
          sync_version: 1,
          site_name: "To delete",
          status: "draft",
          visibility: "private",
          factors: {},
          scores: {},
        })
        .expect(201)

      await request(app.getHttpServer())
        .delete(`/v1/surveys/${surveyId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204)
    })

    it("returns 204 even when survey does not exist (allowMissing)", async () => {
      const { accessToken } = await loginAsNewUser()

      await request(app.getHttpServer())
        .delete("/v1/surveys/non-existent-id")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(204)
    })
  })
})
