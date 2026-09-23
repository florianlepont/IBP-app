import "dotenv/config"
import { INestApplication } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { AuthGuard } from "../src/auth/auth.guard"
import { DatabaseService } from "../src/database/database.service"

describe("Auth + profile (e2e)", () => {
  let app: INestApplication
  let db: DatabaseService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("v1")
    await app.init()
    db = app.get(DatabaseService)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("returns profile fields via GET /me after test login", async () => {
    const email = `e2e-profile-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)

    const accessToken = login.body.access_token as string
    const me = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    expect(me.body.email).toBe(email)
    expect(typeof me.body.display_name).toBe("string")
  })

  it("uploads, serves and deletes profile picture", async () => {
    const email = `e2e-avatar-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)

    const accessToken = login.body.access_token as string
    const pngStub = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

    const upload = await request(app.getHttpServer())
      .put("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pngStub, { filename: "avatar.png", contentType: "image/png" })
      .expect(200)

    expect(typeof upload.body.profile_picture_url).toBe("string")

    const me = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    expect(typeof me.body.profile_picture_url).toBe("string")

    const picture = await request(app.getHttpServer())
      .get("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    expect(String(picture.headers["content-type"] ?? "")).toContain("image/")
    expect(picture.body.length).toBeGreaterThan(0)

    await request(app.getHttpServer())
      .delete("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204)

    await request(app.getHttpServer())
      .get("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404)
  })

  it("deletes the account, anonymises submitted surveys, and rejects the old token afterwards", async () => {
    const email = `e2e-delete-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)

    const accessToken = login.body.access_token as string
    const user = await db
      .query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email])
      .then((result) => result.rows[0])

    const submittedSurveyId = `submitted-${Date.now()}`
    const draftSurveyId = `draft-${Date.now()}`
    const submittedEventId = `event-submitted-${Date.now()}`
    const draftEventId = `event-draft-${Date.now()}`

    await db.query(
      `INSERT INTO surveys (
         id, user_id, site_name, status, visibility, factors, factor_results, scores, location,
         created_at, updated_at, submitted_at, expires_at, sync_version
       )
       VALUES
         ($1, $2, 'Submitted survey', 'submitted', 'public', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW(), NOW(), NOW() + interval '7 days', 1),
         ($3, $2, 'Draft survey', 'draft', 'private', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW(), NULL, NOW() + interval '7 days', 1)`,
      [submittedSurveyId, user.id, draftSurveyId],
    )

    await db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES
         ($1, $2, $3, 'submitted', '{}'::jsonb),
         ($4, $5, $3, 'created', '{}'::jsonb)`,
      [submittedEventId, submittedSurveyId, user.id, draftEventId, draftSurveyId],
    )

    await request(app.getHttpServer())
      .delete("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204)

    const deletedUser = await db.query<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [
      user.id,
    ])
    expect(deletedUser.rows).toHaveLength(0)

    const retainedSurvey = await db.query<{ user_id: string | null }>(
      `SELECT user_id FROM surveys WHERE id = $1`,
      [submittedSurveyId],
    )
    expect(retainedSurvey.rows).toHaveLength(1)
    expect(retainedSurvey.rows[0].user_id).toBeNull()

    const retainedEvent = await db.query<{ actor_id: string | null }>(
      `SELECT actor_id FROM survey_events WHERE id = $1`,
      [submittedEventId],
    )
    expect(retainedEvent.rows).toHaveLength(1)
    expect(retainedEvent.rows[0].actor_id).toBeNull()

    const removedDraftSurvey = await db.query<{ id: string }>(
      `SELECT id FROM surveys WHERE id = $1`,
      [draftSurveyId],
    )
    expect(removedDraftSurvey.rows).toHaveLength(0)

    const removedDraftEvent = await db.query<{ id: string }>(
      `SELECT id FROM survey_events WHERE id = $1`,
      [draftEventId],
    )
    expect(removedDraftEvent.rows).toHaveLength(0)

    await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401)
  })
})

describe("first-login provisioning (e2e)", () => {
  let app: INestApplication
  let db: DatabaseService
  let guard: AuthGuard

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("v1")
    await app.init()
    db = app.get(DatabaseService)
    guard = new AuthGuard(db)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function invoke(payload: Record<string, unknown>, rawToken = "raw-token") {
    return (
      guard as unknown as {
        getOrProvisionUser: (
          payload: Record<string, unknown>,
          rawToken: string,
        ) => Promise<{ id: string; auth0_sub: string }>
      }
    ).getOrProvisionUser(payload, rawToken)
  }

  function mockFetchUserInfo(userInfo: Record<string, unknown>) {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => userInfo,
    } as Response)
  }

  it("converges 5 concurrent first logins for the same sub on exactly one user row", async () => {
    const sub = `auth0|race-${Date.now()}`
    const email = `e2e-race-${Date.now()}@ibp.local`
    mockFetchUserInfo({ email, email_verified: true })

    const results = await Promise.all(Array.from({ length: 5 }, () => invoke({ sub })))
    const ids = new Set(results.map((r) => r.id))
    expect(ids.size).toBe(1)

    const count = await db.query<{ count: string }>(
      `SELECT count(*)::text FROM users WHERE auth0_sub = $1`,
      [sub],
    )
    expect(count.rows[0].count).toBe("1")
  })

  it("refuses to link an unverified email to an existing account and leaves auth0_sub unchanged", async () => {
    const email = `e2e-unverified-${Date.now()}@ibp.local`
    await request(app.getHttpServer()).post("/v1/debug/test-token").send({ email }).expect(201)

    const before = await db.query<{ auth0_sub: string }>(
      `SELECT auth0_sub FROM users WHERE email = $1`,
      [email],
    )
    expect(before.rows[0].auth0_sub).toBe(`test|${email}`)

    mockFetchUserInfo({ email, email_verified: false })
    const newSub = `auth0|unverified-${Date.now()}`

    await expect(invoke({ sub: newSub })).rejects.toThrow()

    const after = await db.query<{ auth0_sub: string }>(
      `SELECT auth0_sub FROM users WHERE email = $1`,
      [email],
    )
    expect(after.rows[0].auth0_sub).toBe(`test|${email}`)
  })

  it("links a verified email to an existing unlinked (pre-Auth0) account and sets auth0_sub", async () => {
    const email = `e2e-verified-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    const existingUser = await db
      .query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email])
      .then((r) => r.rows[0])
    expect(login.status).toBe(201)
    // Only an account not yet linked to an Auth0 identity may be linked (WR-03).
    await db.query(`UPDATE users SET auth0_sub = NULL WHERE id = $1`, [existingUser.id])

    mockFetchUserInfo({ email, email_verified: true })
    const newSub = `auth0|verified-${Date.now()}`

    const result = await invoke({ sub: newSub })
    expect(result.id).toBe(existingUser.id)

    const after = await db.query<{ auth0_sub: string }>(
      `SELECT auth0_sub FROM users WHERE email = $1`,
      [email],
    )
    expect(after.rows[0].auth0_sub).toBe(newSub)
  })

  it("never re-points an account already linked to another sub, even with a verified email (WR-03)", async () => {
    const email = `e2e-verified-linked-${Date.now()}@ibp.local`
    await request(app.getHttpServer()).post("/v1/debug/test-token").send({ email }).expect(201)

    mockFetchUserInfo({ email, email_verified: true })
    const newSub = `google-oauth2|verified-${Date.now()}`

    await expect(invoke({ sub: newSub })).rejects.toMatchObject({
      status: 403,
      response: { code: "email_already_linked" },
    })

    const after = await db.query<{ auth0_sub: string }>(
      `SELECT auth0_sub FROM users WHERE email = $1`,
      [email],
    )
    expect(after.rows[0].auth0_sub).toBe(`test|${email}`)
  })
})
