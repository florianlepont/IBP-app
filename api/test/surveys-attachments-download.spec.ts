import { ConflictException, NotFoundException } from "@nestjs/common"
import { readFile } from "fs/promises"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { SurveysAttachmentsService } from "../src/surveys/surveys-attachments.service"

jest.mock("fs/promises", () => {
  const actual = jest.requireActual("fs/promises")
  return {
    ...actual,
    readFile: jest.fn(),
  }
})

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}))

const mockS3Send = jest.fn().mockResolvedValue({})

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3")
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  }
})

const mockGetSignedUrl = getSignedUrl as jest.Mock

const AUTH_USER = {
  id: "user-1",
  auth0_sub: "auth0|user-1",
  email: "user@example.com",
  role: "contributor" as const,
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

const SURVEY_ID = "survey-1"
const ATTACHMENT_ID = "attachment-1"

function buildSurveyRow() {
  return { id: SURVEY_ID, user_id: AUTH_USER.id, deleted_at: null }
}

function buildAttachmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    storage_key: "surveys/survey-1/attachment-1.jpg",
    mime_type: "image/jpeg",
    uploaded_at: "2026-03-09T09:12:00.000Z",
    ...overrides,
  }
}

function buildService(objectStorageMode: "local" | "minio") {
  const previousMode = process.env.OBJECT_STORAGE_MODE
  process.env.OBJECT_STORAGE_MODE = objectStorageMode
  process.env.ATTACHMENTS_UPLOAD_DIR = "/tmp/ibp-uploads-test"

  const db = { query: jest.fn() }
  const service = new SurveysAttachmentsService(db as never)

  process.env.OBJECT_STORAGE_MODE = previousMode

  return { service, db }
}

describe("SurveysAttachmentsService download", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockS3Send.mockResolvedValue({})
  })

  describe("getAttachmentDownload", () => {
    it("minio mode: returns a presigned GET url with a 300s TTL and requires_auth false", async () => {
      const { service, db } = buildService("minio")
      mockGetSignedUrl.mockResolvedValue("https://minio.local/signed-get-url")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })

      const before = Date.now()
      const result = await service.getAttachmentDownload(
        AUTH_USER as never,
        SURVEY_ID,
        ATTACHMENT_ID,
      )
      const after = Date.now()

      expect(result.url).toBe("https://minio.local/signed-get-url")
      expect(result.requires_auth).toBe(false)
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({ Key: "surveys/survey-1/attachment-1.jpg" }),
        }),
        { expiresIn: 300 },
      )
      const expiresAtMs = new Date(result.expires_at).getTime()
      expect(expiresAtMs).toBeGreaterThanOrEqual(before + 299 * 1000)
      expect(expiresAtMs).toBeLessThanOrEqual(after + 301 * 1000)
    })

    it("local mode: returns the authenticated content route and requires_auth true, without calling getSignedUrl", async () => {
      const { service, db } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })

      const result = await service.getAttachmentDownload(
        AUTH_USER as never,
        SURVEY_ID,
        ATTACHMENT_ID,
      )

      expect(result.url).toBe(`/surveys/${SURVEY_ID}/attachments/${ATTACHMENT_ID}/content`)
      expect(result.requires_auth).toBe(true)
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it("survey not owned: throws NotFoundException without querying the attachment", async () => {
      const { service, db } = buildService("local")
      db.query.mockResolvedValueOnce({ rows: [] })

      await expect(
        service.getAttachmentDownload(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException)
      expect(db.query).toHaveBeenCalledTimes(1)
    })

    it("attachment missing or deleted: throws NotFoundException", async () => {
      const { service, db } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [] })

      await expect(
        service.getAttachmentDownload(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(new NotFoundException("Attachment not found"))
    })

    it("attachment not uploaded yet: throws ConflictException with code attachment_not_uploaded", async () => {
      const { service, db } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow({ uploaded_at: null })] })

      let caught: unknown
      try {
        await service.getAttachmentDownload(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID)
      } catch (error) {
        caught = error
      }

      expect(caught).toBeInstanceOf(ConflictException)
      expect((caught as ConflictException).getResponse()).toMatchObject({
        code: "attachment_not_uploaded",
      })
    })
  })

  describe("getAttachmentContent", () => {
    it("local mode: reads the file and returns buffer/mimeType", async () => {
      const { service, db } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })
      ;(readFile as jest.Mock).mockResolvedValueOnce(Buffer.from("fake-jpeg-binary"))

      const result = await service.getAttachmentContent(
        AUTH_USER as never,
        SURVEY_ID,
        ATTACHMENT_ID,
      )

      expect(result.mimeType).toBe("image/jpeg")
      expect(result.buffer.toString()).toBe("fake-jpeg-binary")
      expect(readFile).toHaveBeenCalledWith(
        "/tmp/ibp-uploads-test/surveys/survey-1/attachment-1.jpg",
      )
    })

    it("path traversal in storage_key: throws NotFoundException without reading the file", async () => {
      const { service, db } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow({ storage_key: "../../etc/passwd" })] })

      await expect(
        service.getAttachmentContent(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException)
      expect(readFile).not.toHaveBeenCalled()
    })

    it("file gone from disk: readFile rejects, throws NotFoundException", async () => {
      const { service, db } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })
      ;(readFile as jest.Mock).mockRejectedValueOnce(new Error("ENOENT"))

      await expect(
        service.getAttachmentContent(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException)
    })

    it("minio mode: throws NotFoundException (content route is local-mode only)", async () => {
      const { service, db } = buildService("minio")
      db.query.mockResolvedValueOnce({ rows: [buildSurveyRow()] })

      await expect(
        service.getAttachmentContent(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
