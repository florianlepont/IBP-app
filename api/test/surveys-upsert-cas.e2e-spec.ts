import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { SurveysRepository } from "../src/surveys/surveys.repository"

// D-09 / RESEARCH Pitfall 6: the upsert fast path reads the survey without a lock and writes
// with a CAS on xmin. submitSurvey and applyVisibilityChange change the row without bumping
// sync_version, so a write between the read and the CAS must make the CAS miss (0 rows) and
// hand the operation to the locked path, which decides on the fresh row. These cases inject
// that write right after the unlocked read returns.
describe("Upsert fast path CAS (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService

  const runToken = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()
    db = moduleFixture.get(DatabaseService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  async function login(label: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: `e2e-cas-${label}-${runToken}@ibp.local` })
      .expect(201)
    return response.body.access_token as string
  }

  async function createDraft(accessToken: string, surveyId: string): Promise<void> {
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "CAS Original",
        status: "draft",
        visibility: "private",
        parcel_ids: [`CAS${runToken}P1`.toUpperCase()],
        factors: {},
        scores: {},
      })
      .expect(201)
  }

  async function sync(
    accessToken: string,
    payload: Record<string, unknown>,
  ): Promise<{ status: string; error?: { code?: string } }> {
    const response = await request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        operations: [{ client_ref: "cas-1", entity: "survey", action: "upsert", payload }],
      })
      .expect(200)
    return response.body.results[0] as { status: string; error?: { code?: string } }
  }

  // Runs `write` on a separate pool connection after the unlocked read resolved, then hands the
  // stale row back to the service.
  function injectWriteAfterRead(surveyId: string, write: string): jest.SpyInstance {
    const original = SurveysRepository.prototype.readForUpsert
    return jest
      .spyOn(SurveysRepository.prototype, "readForUpsert")
      .mockImplementation(async function (this: SurveysRepository, ...args) {
        const row = await original.apply(this, args)
        if (args[1] === surveyId) {
          await db.query(write, [surveyId])
        }
        return row
      })
  }

  it("a survey submitted between the read and the write is not overwritten", async () => {
    const accessToken = await login("submit")
    const surveyId = `e2e-cas-submit-${runToken}`
    await createDraft(accessToken, surveyId)

    const spy = injectWriteAfterRead(
      surveyId,
      `UPDATE surveys SET status = 'submitted', submitted_at = now() WHERE id = $1`,
    )

    const result = await sync(accessToken, {
      id: surveyId,
      sync_version: 2,
      site_name: "CAS Overwrite Attempt",
      factors: {},
      scores: {},
    })

    expect(spy).toHaveBeenCalled()
    // The locked path sees the submitted row: a changed read-only field is a 409.
    expect(result.status).toBe("fatal_error")
    expect(result.error?.code).toBe("survey_submitted_read_only")

    const row = await db.query<{ status: string; site_name: string; sync_version: number }>(
      `SELECT status, site_name, sync_version FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(row.rows[0]).toEqual({
      status: "submitted",
      site_name: "CAS Original",
      sync_version: 1,
    })
  })

  it("a visibility change between the read and the write is not lost", async () => {
    const accessToken = await login("visibility")
    const surveyId = `e2e-cas-visibility-${runToken}`
    await createDraft(accessToken, surveyId)

    const spy = injectWriteAfterRead(
      surveyId,
      `UPDATE surveys SET visibility = 'public', updated_at = NOW() WHERE id = $1`,
    )

    // No visibility in the body: the stale row said private, so a blind write would reset it.
    const result = await sync(accessToken, {
      id: surveyId,
      sync_version: 2,
      site_name: "CAS Updated",
      factors: {},
      scores: {},
    })

    expect(spy).toHaveBeenCalled()
    expect(result.status).toBe("synced")

    const row = await db.query<{ visibility: string; site_name: string; sync_version: number }>(
      `SELECT visibility, site_name, sync_version FROM surveys WHERE id = $1`,
      [surveyId],
    )
    expect(row.rows[0]).toEqual({
      visibility: "public",
      site_name: "CAS Updated",
      sync_version: 2,
    })

    const events = await db.query<{ event_type: string }>(
      `SELECT event_type FROM survey_events WHERE survey_id = $1 ORDER BY seq`,
      [surveyId],
    )
    expect(events.rows.map((event) => event.event_type)).toEqual(["created", "updated"])
  })

  it("a create on another user's id answers survey_id_conflict and registers no parcel", async () => {
    const ownerToken = await login("owner")
    const otherToken = await login("other")
    const surveyId = `e2e-cas-foreign-${runToken}`
    await createDraft(ownerToken, surveyId)

    const freshParcel = `CAS${runToken}FOREIGN`.toUpperCase()
    const before = await db.query(`SELECT 1 FROM parcels WHERE parcel_id = $1`, [freshParcel])
    expect(before.rows).toHaveLength(0)

    const result = await sync(otherToken, {
      id: surveyId,
      sync_version: 1,
      site_name: "Foreign Create",
      parcel_ids: [freshParcel],
      factors: {},
      scores: {},
    })

    expect(result.status).toBe("fatal_error")
    expect(result.error?.code).toBe("survey_id_conflict")

    const after = await db.query(`SELECT 1 FROM parcels WHERE parcel_id = $1`, [freshParcel])
    expect(after.rows).toHaveLength(0)
    const links = await db.query<{ parcel_id: string }>(
      `SELECT parcel_id FROM survey_parcels WHERE survey_id = $1`,
      [surveyId],
    )
    expect(links.rows.map((link) => link.parcel_id)).toEqual([`CAS${runToken}P1`.toUpperCase()])
  })
})
