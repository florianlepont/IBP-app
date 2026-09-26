import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { randomUUID } from "crypto"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { StorageService } from "../src/storage/storage.service"

// D-04 / D-16 (amended 2026-09-25): an upsert carrying the sync_version the
// server already stored is an idempotent replay only when its content matches
// by value. A visibility-only difference is applied last-writer-wins like the
// visibility_update action; any read-only difference is a 409
// sync_version_conflict. D-05: survey deletion removes attachment objects
// through StorageService after commit.
describe("Same sync_version content rule (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let storage: StorageService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()
    db = moduleFixture.get(DatabaseService)
    storage = moduleFixture.get(StorageService)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  async function loginAsNewUser(): Promise<string> {
    const email = `e2e-samever-${Date.now()}-${Math.random().toString(36).slice(2)}@ibp.local`
    const res = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return res.body.access_token as string
  }

  function draftPayload(surveyId: string, overrides: Record<string, unknown> = {}) {
    return {
      id: surveyId,
      sync_version: 1,
      site_name: "Same version forest",
      status: "draft",
      visibility: "private",
      region_version: "ACA",
      vegetation_stage: "collineen",
      factors: { A: 1, B: 2, C: 1 },
      scores: {},
      ...overrides,
    }
  }

  function upsert(accessToken: string, payload: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload)
  }

  function syncUpsert(accessToken: string, operations: Array<Record<string, unknown>>) {
    return request(app.getHttpServer())
      .post("/v1/sync")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        operations: operations.map((payload, index) => ({
          client_ref: `op-${index}`,
          entity: "survey",
          action: "upsert",
          payload,
        })),
      })
      .expect(200)
  }

  async function readSurvey(surveyId: string) {
    const result = await db.query<{
      site_name: string
      visibility: string
      updated_at: string
      sync_version: number
      factors: Record<string, unknown>
    }>(
      `SELECT site_name, visibility, updated_at::text, sync_version, factors
       FROM surveys WHERE id = $1`,
      [surveyId],
    )
    return result.rows[0]
  }

  async function countVisibilityEvents(surveyId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM survey_events
       WHERE survey_id = $1 AND event_type = 'visibility_changed'`,
      [surveyId],
    )
    return Number(result.rows[0]?.count ?? 0)
  }

  async function resolveParcel(accessToken: string, lat: number, lng: number): Promise<string> {
    const res = await request(app.getHttpServer())
      .get("/v1/parcels/resolve")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ lat: String(lat), lng: String(lng) })
      .expect(200)
    const parcelId = res.body.parcel?.parcel_id as string
    expect(parcelId).toBeTruthy()
    return parcelId
  }

  it("(1) identical same-version replay is answered synced", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()
    const payload = draftPayload(surveyId)

    await upsert(accessToken, payload).expect(201)
    const replay = await upsert(accessToken, payload).expect(201)

    expect(replay.body.id).toBe(surveyId)
    expect(replay.body.server_status).toBe("synced")
  })

  it("(2) same version with a different site_name is a 409 and nothing changes", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()

    await upsert(accessToken, draftPayload(surveyId)).expect(201)
    const conflict = await upsert(
      accessToken,
      draftPayload(surveyId, { site_name: "Racing writer" }),
    ).expect(409)

    expect(conflict.body.code).toBe("sync_version_conflict")
    expect(conflict.body.details).toMatchObject({
      survey_id: surveyId,
      server_sync_version: 1,
      client_sync_version: 1,
    })
    const row = await readSurvey(surveyId)
    expect(row.site_name).toBe("Same version forest")
  })

  it("(3) same version with only visibility changed is applied and answered synced", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()

    await upsert(accessToken, draftPayload(surveyId)).expect(201)
    const before = await readSurvey(surveyId)
    expect(await countVisibilityEvents(surveyId)).toBe(0)

    const res = await upsert(accessToken, draftPayload(surveyId, { visibility: "public" })).expect(
      201,
    )

    expect(res.body.server_status).toBe("synced")
    const after = await readSurvey(surveyId)
    expect(after.visibility).toBe("public")
    expect(after.sync_version).toBe(1)
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime(),
    )
    expect(new Date(res.body.updated_at as string).getTime()).toBe(
      new Date(after.updated_at).getTime(),
    )
    expect(await countVisibilityEvents(surveyId)).toBe(1)
  })

  it("(3b) installed-app retry: /v1/sync same version with rewritten visibility is synced", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()

    const first = await syncUpsert(accessToken, [draftPayload(surveyId, { sync_version: 3 })])
    expect(first.body.results[0].status).toBe("synced")

    // The response was lost; the user then switched visibility, and the app
    // rewrote the pending upsert without bumping sync_version.
    const retry = await syncUpsert(accessToken, [
      draftPayload(surveyId, { sync_version: 3, visibility: "public" }),
    ])
    expect(retry.body.results[0].status).toBe("synced")

    const row = await readSurvey(surveyId)
    expect(row.visibility).toBe("public")
    expect(row.sync_version).toBe(3)
    expect(await countVisibilityEvents(surveyId)).toBe(1)
  })

  it("(3c) same version with visibility and site_name changed is a 409, neither applied", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()

    await upsert(accessToken, draftPayload(surveyId)).expect(201)
    const conflict = await upsert(
      accessToken,
      draftPayload(surveyId, { visibility: "public", site_name: "Racing writer" }),
    ).expect(409)

    expect(conflict.body.code).toBe("sync_version_conflict")
    const row = await readSurvey(surveyId)
    expect(row.visibility).toBe("private")
    expect(row.site_name).toBe("Same version forest")
    expect(await countVisibilityEvents(surveyId)).toBe(0)
  })

  it("(3d) soft-deleted survey: visibility-only replay is synced with no write", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()

    await upsert(accessToken, draftPayload(surveyId)).expect(201)
    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204)
    const before = await readSurvey(surveyId)

    const res = await upsert(accessToken, draftPayload(surveyId, { visibility: "public" })).expect(
      201,
    )

    expect(res.body.server_status).toBe("synced")
    const after = await readSurvey(surveyId)
    expect(after.visibility).toBe("private")
    expect(after.updated_at).toBe(before.updated_at)
    expect(await countVisibilityEvents(surveyId)).toBe(0)
  })

  it("(4) re-ordered factor keys and parcel ids are an identical replay", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()
    const seed = Date.now() % 90000
    const parcelA = await resolveParcel(accessToken, 48.62 + seed / 100000, 1.62 + seed / 100000)
    const parcelB = await resolveParcel(accessToken, 48.63 + seed / 100000, 1.63 + seed / 100000)
    expect(parcelA).not.toBe(parcelB)

    await upsert(
      accessToken,
      draftPayload(surveyId, {
        parcel_ids: [parcelA, parcelB],
        factors: { A: 1, B: 2, C: 1 },
      }),
    ).expect(201)

    const replay = await upsert(
      accessToken,
      draftPayload(surveyId, {
        parcel_ids: [parcelB, parcelA],
        factors: { C: 1, B: 2, A: 1 },
      }),
    ).expect(201)

    expect(replay.body.server_status).toBe("synced")
    expect(await countVisibilityEvents(surveyId)).toBe(0)
  })

  it("(5) /v1/sync: different-content same version is fatal_error 409, the next op still syncs", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()
    const otherSurveyId = randomUUID()

    await upsert(accessToken, draftPayload(surveyId, { sync_version: 2 })).expect(201)

    const res = await syncUpsert(accessToken, [
      draftPayload(surveyId, { sync_version: 2, factors: { A: 2, B: 2, C: 1 } }),
      draftPayload(otherSurveyId),
    ])

    expect(res.body.results).toHaveLength(2)
    expect(res.body.results[0]).toMatchObject({
      client_ref: "op-0",
      entity: "survey",
      action: "upsert",
      status: "fatal_error",
    })
    expect(res.body.results[0].error.code).toBe("sync_version_conflict")
    expect(res.body.results[0].error.http_status).toBe(409)
    expect(res.body.results[0].error.details).toMatchObject({
      survey_id: surveyId,
      server_sync_version: 2,
      client_sync_version: 2,
    })
    expect(res.body.results[1]).toMatchObject({ client_ref: "op-1", status: "synced" })

    const row = await readSurvey(surveyId)
    expect(row.factors).toEqual({ A: 1, B: 2, C: 1 })
    expect(await readSurvey(otherSurveyId)).toBeDefined()
  })

  it("(6) submitted survey: same version with a changed factor is a 409, row unchanged", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()
    const seed = Date.now() % 90000
    const parcelId = await resolveParcel(accessToken, 48.64 + seed / 100000, 1.64 + seed / 100000)
    const versionResult = await db.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(s.version_number), 0) + 1 AS next_version
       FROM surveys s
       JOIN survey_parcels sp ON sp.survey_id = s.id
       WHERE sp.parcel_id = $1 AND s.deleted_at IS NULL AND s.status = 'submitted'`,
      [parcelId],
    )
    const validFactors = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 2, J: 2 }
    const payload = draftPayload(surveyId, {
      parcel_id: parcelId,
      observation_year: 2025,
      version_number: versionResult.rows[0]?.next_version ?? 1,
      factors: validFactors,
    })

    await upsert(accessToken, payload).expect(201)
    await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201)
    const before = await readSurvey(surveyId)

    const conflict = await upsert(accessToken, {
      ...payload,
      factors: { ...validFactors, A: 2 },
    }).expect(409)

    expect(["sync_version_conflict", "survey_submitted_read_only"]).toContain(conflict.body.code)
    const after = await readSurvey(surveyId)
    expect(after.factors).toEqual(validFactors)
    expect(after.updated_at).toBe(before.updated_at)
    expect(after.sync_version).toBe(before.sync_version)
  })

  it("(7) survey deletion removes attachment objects through StorageService", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = randomUUID()
    await upsert(accessToken, draftPayload(surveyId)).expect(201)

    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    const created = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ mime_type: "image/jpeg", size_bytes: jpegBytes.length })
      .expect(201)

    const attachmentId = created.body.attachment_id as string
    const uploadUrl = created.body.upload_url as string

    if (uploadUrl.startsWith("http")) {
      const presignedUpload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: jpegBytes,
      })
      if (!presignedUpload.ok) {
        throw new Error(`presigned upload failed: ${presignedUpload.status}`)
      }

      await request(app.getHttpServer())
        .put(`/v1${created.body.confirm_url as string}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    } else {
      await request(app.getHttpServer())
        .put(`/v1${uploadUrl}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", jpegBytes, { filename: "photo.jpg", contentType: "image/jpeg" })
        .expect(200)
    }

    const keyResult = await db.query<{ storage_key: string }>(
      `SELECT storage_key FROM attachments WHERE id = $1`,
      [attachmentId],
    )
    const storageKey = keyResult.rows[0]?.storage_key
    expect(storageKey).toBeTruthy()
    expect(await storage.headObject(storageKey as string)).not.toBeNull()

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204)

    expect(await storage.headObject(storageKey as string)).toBeNull()
  })
})
