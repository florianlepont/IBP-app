import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { SurveysAttachmentsService } from "../src/surveys/surveys-attachments.service"

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
const STORAGE_KEY = "surveys/survey-1/attachment-1.jpg"
const UPLOAD_TOKEN = "token-1"

function buildSurveyRow() {
  return { id: SURVEY_ID, user_id: AUTH_USER.id, deleted_at: null }
}

function buildAttachmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    survey_id: SURVEY_ID,
    storage_key: STORAGE_KEY,
    mime_type: "image/jpeg",
    size_bytes: 2048,
    upload_token: UPLOAD_TOKEN,
    uploaded_at: "2026-03-09T09:12:00.000Z",
    ...overrides,
  }
}

function buildStorage(mode: "local" | "minio") {
  return {
    mode,
    buildAttachmentKey: jest.fn(
      (surveyId: string, attachmentId: string) => `surveys/${surveyId}/${attachmentId}.jpg`,
    ),
    putObject: jest.fn().mockResolvedValue(undefined),
    presignPut: jest.fn().mockResolvedValue("https://minio.local/signed-put-url"),
    presignGet: jest.fn().mockResolvedValue("https://minio.local/signed-get-url"),
    headObject: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    resolveLocalPath: jest.fn(),
  }
}

function buildService(mode: "local" | "minio") {
  const tx = { query: jest.fn() }
  const db = {
    query: jest.fn(),
    transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  const storage = buildStorage(mode)
  const service = new SurveysAttachmentsService(db as never, storage as never)
  return { service, db, tx, storage }
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("expected the promise to reject")
}

describe("SurveysAttachmentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createAttachment", () => {
    function mockCreateTransaction(tx: { query: jest.Mock }) {
      tx.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })
        .mockResolvedValue({ rows: [] })
    }

    it("minio mode: presigns the PUT with the declared size and a key from buildAttachmentKey", async () => {
      const { service, tx, storage } = buildService("minio")
      mockCreateTransaction(tx)

      const result = await service.createAttachment(AUTH_USER as never, SURVEY_ID, {
        mime_type: "image/jpeg",
        size_bytes: 2048,
      } as never)

      expect(storage.buildAttachmentKey).toHaveBeenCalledWith(
        SURVEY_ID,
        result.attachment_id,
        "image/jpeg",
      )
      expect(result.storage_key).toBe(`surveys/${SURVEY_ID}/${result.attachment_id}.jpg`)
      expect(storage.presignPut).toHaveBeenCalledWith(result.storage_key, "image/jpeg", 2048)
      expect(result.upload_url).toBe("https://minio.local/signed-put-url")
      expect(result.confirm_url).toMatch(
        new RegExp(`^/surveys/${SURVEY_ID}/attachments/${result.attachment_id}/upload\\?token=`),
      )
    })

    it("local mode: returns the relative upload route and does not presign", async () => {
      const { service, tx, storage } = buildService("local")
      mockCreateTransaction(tx)

      const result = await service.createAttachment(AUTH_USER as never, SURVEY_ID, {
        mime_type: "image/jpeg",
        size_bytes: 2048,
      } as never)

      expect(storage.presignPut).not.toHaveBeenCalled()
      expect(result.upload_url).toBe(result.confirm_url)
      expect(result.upload_url).toMatch(
        new RegExp(`^/surveys/${SURVEY_ID}/attachments/${result.attachment_id}/upload\\?token=`),
      )
    })
  })

  describe("uploadAttachment", () => {
    function mockUploadLookups(db: { query: jest.Mock }, sizeBytes: number | string) {
      db.query.mockResolvedValueOnce({ rows: [buildSurveyRow()] }).mockResolvedValueOnce({
        rows: [buildAttachmentRow({ uploaded_at: null, size_bytes: sizeBytes })],
      })
    }

    function mockUploadTransaction(tx: { query: jest.Mock }) {
      tx.query
        .mockResolvedValueOnce({
          rows: [{ id: ATTACHMENT_ID, uploaded_at: "2026-03-09T10:00:00.000Z" }],
        })
        .mockResolvedValue({ rows: [] })
    }

    it("minio mode: marks the attachment uploaded when the stored size matches", async () => {
      const { service, db, tx, storage } = buildService("minio")
      mockUploadLookups(db, 2048)
      mockUploadTransaction(tx)
      storage.headObject.mockResolvedValueOnce({ contentLength: 2048 })

      const result = await service.uploadAttachment(
        AUTH_USER as never,
        SURVEY_ID,
        ATTACHMENT_ID,
        UPLOAD_TOKEN,
      )

      expect(result).toEqual({
        attachment_id: ATTACHMENT_ID,
        uploaded_at: "2026-03-09T10:00:00.000Z",
      })
      expect(storage.headObject).toHaveBeenCalledWith(STORAGE_KEY)
      expect(storage.deleteObject).not.toHaveBeenCalled()
      const eventPayload = JSON.parse(tx.query.mock.calls[1][1][4])
      expect(eventPayload).toMatchObject({
        attachment_id: ATTACHMENT_ID,
        object_storage_mode: "minio",
      })
    })

    it("minio mode: compares numerically when the driver returns size_bytes as a string", async () => {
      const { service, db, tx, storage } = buildService("minio")
      mockUploadLookups(db, "2048")
      mockUploadTransaction(tx)
      storage.headObject.mockResolvedValueOnce({ contentLength: 2048 })

      await expect(
        service.uploadAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID, UPLOAD_TOKEN),
      ).resolves.toMatchObject({ attachment_id: ATTACHMENT_ID })
    })

    it("minio mode: a size mismatch answers 422, deletes the object and writes nothing", async () => {
      const { service, db, tx, storage } = buildService("minio")
      mockUploadLookups(db, 2048)
      storage.headObject.mockResolvedValueOnce({ contentLength: 16 })

      const error = await catchError(
        service.uploadAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID, UPLOAD_TOKEN),
      )

      expect(error).toBeInstanceOf(UnprocessableEntityException)
      expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
        code: "attachment_size_mismatch",
        message: "Uploaded file size does not match declared size",
      })
      expect(storage.deleteObject).toHaveBeenCalledWith(STORAGE_KEY)
      expect(db.transaction).not.toHaveBeenCalled()
      expect(tx.query).not.toHaveBeenCalled()
    })

    it("minio mode: a missing object answers 400", async () => {
      const { service, db, storage } = buildService("minio")
      mockUploadLookups(db, 2048)
      storage.headObject.mockResolvedValueOnce(null)

      await expect(
        service.uploadAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID, UPLOAD_TOKEN),
      ).rejects.toThrow(new BadRequestException("uploaded object not found in storage"))
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("local mode: writes the file through storage when the size matches", async () => {
      const { service, db, tx, storage } = buildService("local")
      const buffer = Buffer.from("fake-jpeg-binary")
      mockUploadLookups(db, buffer.length)
      mockUploadTransaction(tx)

      const result = await service.uploadAttachment(
        AUTH_USER as never,
        SURVEY_ID,
        ATTACHMENT_ID,
        UPLOAD_TOKEN,
        { buffer },
      )

      expect(result.attachment_id).toBe(ATTACHMENT_ID)
      expect(storage.putObject).toHaveBeenCalledWith(STORAGE_KEY, buffer, "image/jpeg")
      expect(storage.headObject).not.toHaveBeenCalled()
      const eventPayload = JSON.parse(tx.query.mock.calls[1][1][4])
      expect(eventPayload).toMatchObject({
        object_storage_mode: "local",
        bytes_written: buffer.length,
      })
    })

    it("local mode: a size mismatch answers 422 without writing the file", async () => {
      const { service, db, storage } = buildService("local")
      mockUploadLookups(db, 2048)

      const error = await catchError(
        service.uploadAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID, UPLOAD_TOKEN, {
          buffer: Buffer.from("fake-jpeg-binary"),
        }),
      )

      expect(error).toBeInstanceOf(UnprocessableEntityException)
      expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
        code: "attachment_size_mismatch",
      })
      expect(storage.putObject).not.toHaveBeenCalled()
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("local mode: a missing file answers 400", async () => {
      const { service, db, storage } = buildService("local")
      mockUploadLookups(db, 2048)

      await expect(
        service.uploadAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID, UPLOAD_TOKEN),
      ).rejects.toThrow(new BadRequestException("file is required"))
      expect(storage.putObject).not.toHaveBeenCalled()
    })

    it("already uploaded: returns the existing upload without touching storage", async () => {
      const { service, db, storage } = buildService("minio")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })

      await expect(
        service.uploadAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID, UPLOAD_TOKEN),
      ).resolves.toEqual({
        attachment_id: ATTACHMENT_ID,
        uploaded_at: "2026-03-09T09:12:00.000Z",
      })
      expect(storage.headObject).not.toHaveBeenCalled()
    })
  })

  describe("deleteAttachment", () => {
    it("deletes the stored object after the transaction commits", async () => {
      const { service, db, tx, storage } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })
      tx.query.mockResolvedValue({ rows: [] })
      db.transaction.mockImplementationOnce(async (fn) => {
        const result = await fn(tx)
        expect(storage.deleteObject).not.toHaveBeenCalled()
        return result
      })

      const result = await service.deleteAttachment(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID)

      expect(result).toMatchObject({ deleted: true, missing: false })
      expect(storage.deleteObject).toHaveBeenCalledWith(STORAGE_KEY)
    })
  })

  describe("getAttachmentDownload", () => {
    it("minio mode: returns a presigned GET url with a 300s TTL and requires_auth false", async () => {
      const { service, db, storage } = buildService("minio")
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
      expect(storage.presignGet).toHaveBeenCalledWith(STORAGE_KEY)
      const expiresAtMs = new Date(result.expires_at).getTime()
      expect(expiresAtMs).toBeGreaterThanOrEqual(before + 299 * 1000)
      expect(expiresAtMs).toBeLessThanOrEqual(after + 301 * 1000)
    })

    it("local mode: returns the authenticated content route and requires_auth true, without presigning", async () => {
      const { service, db, storage } = buildService("local")
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
      expect(storage.presignGet).not.toHaveBeenCalled()
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

      const error = await catchError(
        service.getAttachmentDownload(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      )

      expect(error).toBeInstanceOf(ConflictException)
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: "attachment_not_uploaded",
      })
    })
  })

  describe("getAttachmentContent", () => {
    it("local mode: reads the object through storage and returns buffer/mimeType", async () => {
      const { service, db, storage } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })
      storage.getObject.mockResolvedValueOnce(Buffer.from("fake-jpeg-binary"))

      const result = await service.getAttachmentContent(
        AUTH_USER as never,
        SURVEY_ID,
        ATTACHMENT_ID,
      )

      expect(result.mimeType).toBe("image/jpeg")
      expect(result.buffer.toString()).toBe("fake-jpeg-binary")
      expect(storage.getObject).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it("storage key outside the upload root: throws NotFoundException", async () => {
      const { service, db, storage } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow({ storage_key: "../../etc/passwd" })] })
      storage.getObject.mockRejectedValueOnce(new BadRequestException("Invalid storage key"))

      await expect(
        service.getAttachmentContent(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException)
    })

    it("object gone from storage: throws NotFoundException", async () => {
      const { service, db, storage } = buildService("local")
      db.query
        .mockResolvedValueOnce({ rows: [buildSurveyRow()] })
        .mockResolvedValueOnce({ rows: [buildAttachmentRow()] })
      storage.getObject.mockResolvedValueOnce(null)

      await expect(
        service.getAttachmentContent(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(new NotFoundException("Attachment content not found"))
    })

    it("minio mode: throws NotFoundException (content route is local-mode only)", async () => {
      const { service, db, storage } = buildService("minio")
      db.query.mockResolvedValueOnce({ rows: [buildSurveyRow()] })

      await expect(
        service.getAttachmentContent(AUTH_USER as never, SURVEY_ID, ATTACHMENT_ID),
      ).rejects.toThrow(NotFoundException)
      expect(storage.getObject).not.toHaveBeenCalled()
    })
  })
})
