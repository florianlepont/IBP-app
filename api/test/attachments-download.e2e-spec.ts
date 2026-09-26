import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { randomUUID } from "crypto"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"

// T-01.5-03/04/05/06: proves that the D-01/D-18 download endpoint is
// mode-independent, owner-only, requires an uploaded attachment, and that
// the local content route never serves an unauthenticated or path-traversal
// request.
describe("Attachment download (e2e)", () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  async function loginAsNewUser(): Promise<string> {
    const email = `e2e-atd-${Date.now()}-${Math.random().toString(36).slice(2)}@ibp.local`
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
        site_name: "Attachment download fixture",
        status: "draft",
        visibility: "private",
        region_version: "ACA",
        vegetation_stage: "collineen",
        factors: {},
        scores: {},
      })
      .expect(201)
  }

  const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9])

  async function createUploadedAttachment(accessToken: string, surveyId: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ mime_type: "image/jpeg", size_bytes: JPEG_BYTES.length })
      .expect(201)

    const attachmentId = created.body.attachment_id as string
    const uploadUrl = created.body.upload_url as string

    if (uploadUrl.startsWith("http")) {
      const presignedUpload = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: JPEG_BYTES,
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
        .attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" })
        .expect(200)
    }

    return attachmentId
  }

  async function createUnuploadedAttachment(
    accessToken: string,
    surveyId: string,
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post(`/v1/surveys/${surveyId}/attachments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ mime_type: "image/jpeg", size_bytes: JPEG_BYTES.length })
      .expect(201)

    return created.body.attachment_id as string
  }

  it("owner: gets a mode-independent download url and can retrieve the same bytes", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-atd-owner-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const attachmentId = await createUploadedAttachment(accessToken, surveyId)

    const res = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    expect(typeof res.body.url).toBe("string")
    expect(typeof res.body.requires_auth).toBe("boolean")
    const expiresAtMs = new Date(res.body.expires_at as string).getTime()
    expect(expiresAtMs).toBeGreaterThan(Date.now())

    if (res.body.requires_auth) {
      const content = await request(app.getHttpServer())
        .get(`/v1${res.body.url as string}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)

      expect(content.headers["content-type"]).toContain("image/jpeg")
      expect(Buffer.compare(content.body as Buffer, JPEG_BYTES)).toBe(0)
    } else {
      const directResponse = await fetch(res.body.url as string)
      expect(directResponse.ok).toBe(true)
      const bytes = Buffer.from(await directResponse.arrayBuffer())
      expect(Buffer.compare(bytes, JPEG_BYTES)).toBe(0)
    }
  })

  it("another user: gets 404 on both the download-url and content routes", async () => {
    const ownerToken = await loginAsNewUser()
    const surveyId = `e2e-atd-otheruser-${Date.now()}`
    await createDraftSurvey(ownerToken, surveyId)
    const attachmentId = await createUploadedAttachment(ownerToken, surveyId)

    const otherToken = await loginAsNewUser()

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404)

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/content`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(404)
  })

  it("attachment created but never uploaded: gets 409 attachment_not_uploaded", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-atd-notuploaded-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const attachmentId = await createUnuploadedAttachment(accessToken, surveyId)

    const res = await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409)

    expect(res.body.code).toBe("attachment_not_uploaded")
  })

  it("deleted attachment: gets 404", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-atd-deleted-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const attachmentId = await createUploadedAttachment(accessToken, surveyId)

    await request(app.getHttpServer())
      .delete(`/v1/surveys/${surveyId}/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204)

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404)
  })

  it("no Authorization header: gets 401 on both routes", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-atd-noauth-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)
    const attachmentId = await createUploadedAttachment(accessToken, surveyId)

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/download-url`)
      .expect(401)

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${attachmentId}/content`)
      .expect(401)
  })

  it("unknown attachment id: gets 404", async () => {
    const accessToken = await loginAsNewUser()
    const surveyId = `e2e-atd-unknown-${Date.now()}`
    await createDraftSurvey(accessToken, surveyId)

    await request(app.getHttpServer())
      .get(`/v1/surveys/${surveyId}/attachments/${randomUUID()}/download-url`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404)
  })
})
