import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { existsSync } from "fs"
import { join } from "path"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
import { StorageService } from "../src/storage/storage.service"

const itMinio = process.env.OBJECT_STORAGE_MODE === "minio" ? it : it.skip
const itLocal = process.env.OBJECT_STORAGE_MODE !== "minio" ? it : it.skip

// T-01.6-26 (D-08): the declared size_bytes is enforced. The presigned PUT signs
// Content-Length, and confirmation compares the stored size with size_bytes (422 and the
// object removed on a mismatch). MinIO-only cases run in the CI MinIO pass (D-10).
describe("Attachment upload size (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let storage: StorageService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    storage = moduleFixture.get(StorageService)
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0xff, 0xd9])

  async function loginAsNewUser(): Promise<string> {
    const email = `e2e-aus-${Date.now()}-${Math.random().toString(36).slice(2)}@ibp.local`
    const res = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    return res.body.access_token as string
  }

  async function createDraftSurvey(accessToken: string, surveyId: string): Promise<void> {
    await request(app.getHttpServer())
      .post("/v1/surveys")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        id: surveyId,
        sync_version: 1,
        site_name: "Attachment upload size fixture",
        status: "draft",
        visibility: "private",
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: {},
        scores: {},
      })
      .expect(201)
  }

  async function createAttachment(
    accessToken: string,
    surveyId: string,
    sizeBytes: number,
  ): Promise<{
    attachment_id: string
    storage_key: string
    upload_url: string
    confirm_url: string
  }> {
    const created = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ mime_type: "image/jpeg", size_bytes: sizeBytes })
      .expect(201)
    return created.body
  }

  async function uploadedAt(attachmentId: string): Promise<string | null> {
    const result = await db.query<{ uploaded_at: string | null }>(
      `SELECT uploaded_at::text FROM attachments WHERE id = $1`,
      [attachmentId],
    )
    return result.rows[0].uploaded_at
  }

  async function countUploadedEvents(surveyId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM survey_events
       WHERE survey_id = $1 AND event_type = 'attachment_uploaded'`,
      [surveyId],
    )
    return parseInt(result.rows[0]?.count ?? "0", 10)
  }

  it("accepts an upload of exactly the declared size", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-aus-exact-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const created = await createAttachment(accessToken, surveyId, JPEG_BYTES.length)

    if (created.upload_url.startsWith("http")) {
      const presignedUpload = await fetch(created.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: JPEG_BYTES,
      })
      expect(presignedUpload.status).toBe(200)

      await request(app.getHttpServer())
        .put(`/v1${created.confirm_url}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    } else {
      await request(app.getHttpServer())
        .put(`/v1${created.upload_url}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" })
        .expect(200)
    }

    expect(await uploadedAt(created.attachment_id)).not.toBeNull()

    const download = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${created.attachment_id}/download-url`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    if (download.body.requires_auth) {
      const content = await request(app.getHttpServer())
        .get(`/v1${download.body.url as string}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
      expect(Buffer.compare(content.body as Buffer, JPEG_BYTES)).toBe(0)
    } else {
      const directResponse = await fetch(download.body.url as string)
      expect(directResponse.ok).toBe(true)
      const bytes = Buffer.from(await directResponse.arrayBuffer())
      expect(Buffer.compare(bytes, JPEG_BYTES)).toBe(0)
    }
  })

  itLocal("rejects a local upload whose size differs from the declared size", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-aus-local-mismatch-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const created = await createAttachment(accessToken, surveyId, JPEG_BYTES.length + 10)

    const res = await request(app.getHttpServer())
      .put(`/v1${created.upload_url}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" })
      .expect(422)

    expect(res.body.code).toBe("attachment_size_mismatch")
    expect(await uploadedAt(created.attachment_id)).toBeNull()
    const uploadRoot = process.env.ATTACHMENTS_UPLOAD_DIR ?? "/tmp/ibp-uploads"
    expect(existsSync(join(uploadRoot, created.storage_key))).toBe(false)
    expect(await countUploadedEvents(surveyId)).toBe(0)
  })

  itMinio("presigned PUT enforces the signed Content-Length", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-aus-presign-length-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const created = await createAttachment(accessToken, surveyId, JPEG_BYTES.length)

    const presignedUpload = await fetch(created.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: Buffer.concat([JPEG_BYTES, Buffer.alloc(10)]),
    })

    expect(presignedUpload.status).toBe(403)
    expect(await storage.headObject(created.storage_key)).toBeNull()
  })

  itMinio("confirm rejects and deletes an object whose size differs", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-aus-confirm-mismatch-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const created = await createAttachment(accessToken, surveyId, JPEG_BYTES.length)

    await storage.putObject(created.storage_key, Buffer.alloc(JPEG_BYTES.length + 10), "image/jpeg")

    const res = await request(app.getHttpServer())
      .put(`/v1${created.confirm_url}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(422)

    expect(res.body.code).toBe("attachment_size_mismatch")
    expect(await storage.headObject(created.storage_key)).toBeNull()
    expect(await uploadedAt(created.attachment_id)).toBeNull()
    expect(await countUploadedEvents(surveyId)).toBe(0)
  })
})
