import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { dirname, join, resolve, sep } from "path"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService, Queryable } from "../database/database.service"
import { extensionFromMime, isAllowedMimeType } from "../common/file.utils"
import { AttachmentRow, CreateAttachmentBody, SurveyRow } from "./surveys.types"

const DOWNLOAD_URL_TTL_SECONDS = 300

@Injectable()
export class SurveysAttachmentsService {
  private readonly objectStorageMode: "local" | "minio"
  private readonly s3Bucket: string
  private readonly s3Client?: S3Client
  private s3BucketReady = false
  private readonly uploadsRootDir: string

  constructor(private readonly db: DatabaseService) {
    this.objectStorageMode =
      (process.env.OBJECT_STORAGE_MODE ?? "local") === "minio" ? "minio" : "local"
    this.s3Bucket = process.env.OBJECT_STORAGE_BUCKET ?? "ibp-media"
    this.uploadsRootDir = process.env.ATTACHMENTS_UPLOAD_DIR ?? "/tmp/ibp-uploads"

    if (this.objectStorageMode === "minio") {
      const endpoint = process.env.OBJECT_STORAGE_ENDPOINT ?? "http://localhost:9000"
      const region = process.env.OBJECT_STORAGE_REGION ?? "us-east-1"
      const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY ?? "minio"
      const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_KEY ?? "minio123"

      this.s3Client = new S3Client({
        endpoint,
        region,
        forcePathStyle: true,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    }
  }

  private async getSurveyForUserOrThrow(
    db: Queryable,
    surveyId: string,
    userId: string,
    options?: { forUpdate?: boolean },
  ): Promise<SurveyRow> {
    const survey = await this.getSurveyForUser(db, surveyId, userId, true, options)
    if (!survey) {
      throw new NotFoundException("Survey not found")
    }
    return survey
  }

  private async getSurveyForUser(
    db: Queryable,
    surveyId: string,
    userId: string,
    activeOnly: boolean,
    options?: { forUpdate?: boolean },
  ): Promise<SurveyRow | null> {
    const where = activeOnly ? "AND deleted_at IS NULL" : ""
    const forUpdate = options?.forUpdate ? "FOR UPDATE" : ""
    const result = await db.query<SurveyRow>(
      `SELECT *
       FROM surveys
       WHERE id = $1 AND user_id = $2 ${where} ${forUpdate}`,
      [surveyId, userId],
    )
    return result.rows[0] ?? null
  }

  private async insertEvent(
    db: Queryable,
    surveyId: string,
    actorId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), surveyId, actorId, eventType, JSON.stringify(payload)],
    )
  }

  private buildConfirmUrl(surveyId: string, attachmentId: string, uploadToken: string): string {
    const token = encodeURIComponent(uploadToken)
    return `/surveys/${surveyId}/attachments/${attachmentId}/upload?token=${token}`
  }

  private async buildUploadUrl(
    storageKey: string,
    mimeType: string,
    fallbackUrl: string,
  ): Promise<string> {
    if (this.objectStorageMode !== "minio" || !this.s3Client) {
      return fallbackUrl
    }

    await this.ensureS3Bucket()

    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: storageKey,
      ContentType: mimeType,
    })

    return getSignedUrl(this.s3Client, command, { expiresIn: 15 * 60 })
  }

  private async cleanupAttachmentStorage(storageKey: string): Promise<void> {
    if (this.objectStorageMode === "minio") {
      if (this.s3Client) {
        await this.s3Client
          .send(
            new DeleteObjectCommand({
              Bucket: this.s3Bucket,
              Key: storageKey,
            }),
          )
          .catch(() => undefined)
      }
      return
    }

    const storagePath = join(this.uploadsRootDir, storageKey)
    await rm(storagePath, { force: true }).catch(() => undefined)
  }

  private async ensureS3Bucket(): Promise<void> {
    if (this.s3BucketReady || !this.s3Client) return

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }))
      this.s3BucketReady = true
      return
    } catch {
      // Bucket might not exist yet.
    }

    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.s3Bucket }))
      this.s3BucketReady = true
    } catch {
      // If created concurrently by another request/process, verify it exists now.
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }))
      this.s3BucketReady = true
    }
  }

  async createAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    body: CreateAttachmentBody,
  ): Promise<{
    attachment_id: string
    storage_key: string
    upload_url: string
    confirm_url: string
  }> {
    if (!body?.mime_type || typeof body.mime_type !== "string") {
      throw new BadRequestException("mime_type is required")
    }

    if (!Number.isInteger(body.size_bytes) || (body.size_bytes ?? 0) <= 0) {
      throw new BadRequestException("size_bytes must be a positive integer")
    }

    if ((body.size_bytes ?? 0) > 25 * 1024 * 1024) {
      throw new BadRequestException("size_bytes exceeds V1 max size (25MB)")
    }

    if (!isAllowedMimeType(body.mime_type)) {
      throw new BadRequestException(`Unsupported file type: ${body.mime_type}`)
    }

    const attachmentId = randomUUID()
    const uploadToken = randomUUID()
    const extension = extensionFromMime(body.mime_type)
    const storageKey = `surveys/${surveyId}/${attachmentId}${extension}`
    const confirmUrl = this.buildConfirmUrl(surveyId, attachmentId, uploadToken)
    const uploadUrl = await this.buildUploadUrl(storageKey, body.mime_type, confirmUrl)

    await this.db.transaction(async (db) => {
      await this.getSurveyForUserOrThrow(db, surveyId, user.id, { forUpdate: true })

      const countResult = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM attachments WHERE survey_id = $1 AND deleted_at IS NULL`,
        [surveyId],
      )
      const currentCount = parseInt(countResult.rows[0]?.count ?? "0", 10)
      if (currentCount >= 10) {
        throw new BadRequestException("Survey already has the maximum of 10 attachments")
      }

      await db.query(
        `INSERT INTO attachments (id, survey_id, storage_key, mime_type, size_bytes, captured_at, metadata, upload_token, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
        [
          attachmentId,
          surveyId,
          storageKey,
          body.mime_type,
          body.size_bytes,
          body.captured_at ?? null,
          JSON.stringify(body.metadata ?? {}),
          uploadToken,
        ],
      )

      await this.insertEvent(db, surveyId, user.id, "attachment_created", {
        attachment_id: attachmentId,
        storage_key: storageKey,
        mime_type: body.mime_type,
        size_bytes: body.size_bytes,
      })
    })

    return {
      attachment_id: attachmentId,
      storage_key: storageKey,
      upload_url: uploadUrl,
      confirm_url: confirmUrl,
    }
  }

  async uploadAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
    token?: string,
    file?: { buffer: Buffer; mimetype?: string; size?: number; originalname?: string },
  ): Promise<{ attachment_id: string; uploaded_at: string }> {
    if (!token) {
      throw new BadRequestException("upload token is required")
    }

    await this.getSurveyForUserOrThrow(this.db, surveyId, user.id)

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId],
    )

    if (!existing.rows[0]) {
      throw new NotFoundException("Attachment not found")
    }

    if (existing.rows[0].upload_token !== token) {
      throw new BadRequestException("invalid upload token")
    }

    if (existing.rows[0].uploaded_at) {
      return {
        attachment_id: existing.rows[0].id,
        uploaded_at: existing.rows[0].uploaded_at,
      }
    }

    if (this.objectStorageMode === "minio") {
      if (!this.s3Client) {
        throw new BadRequestException("object storage client is not configured")
      }
      // In MinIO mode, file upload is done directly via presigned URL.
      // Here we only confirm object existence before marking uploaded.
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.s3Bucket,
            Key: existing.rows[0].storage_key,
          }),
        )
      } catch {
        throw new BadRequestException("uploaded object not found in storage")
      }
    } else {
      if (!file?.buffer || file.buffer.length === 0) {
        throw new BadRequestException("file is required")
      }

      if (file.buffer.length > 25 * 1024 * 1024) {
        throw new BadRequestException("file exceeds V1 max size (25MB)")
      }

      const storagePath = join(this.uploadsRootDir, existing.rows[0].storage_key)
      await mkdir(dirname(storagePath), { recursive: true })
      await writeFile(storagePath, file.buffer)
    }

    const updated = await this.db.transaction(async (db) => {
      const result = await db.query<{ id: string; uploaded_at: string }>(
        `UPDATE attachments
         SET uploaded_at = NOW()
         WHERE id = $1 AND survey_id = $2
         RETURNING id, uploaded_at::text`,
        [attachmentId, surveyId],
      )

      await this.insertEvent(db, surveyId, user.id, "attachment_uploaded", {
        attachment_id: attachmentId,
        storage_key: existing.rows[0].storage_key,
        object_storage_mode: this.objectStorageMode,
        bytes_written: file?.buffer?.length ?? null,
      })

      return result
    })

    return {
      attachment_id: updated.rows[0].id,
      uploaded_at: updated.rows[0].uploaded_at,
    }
  }

  async deleteAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
    options?: { allowMissing?: boolean },
  ): Promise<{ survey_id: string; attachment_id: string; missing: boolean; deleted: boolean }> {
    await this.getSurveyForUserOrThrow(this.db, surveyId, user.id)

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId],
    )

    if (!existing.rows[0]) {
      if (options?.allowMissing) {
        return {
          survey_id: surveyId,
          attachment_id: attachmentId,
          missing: true,
          deleted: false,
        }
      }
      throw new NotFoundException("Attachment not found")
    }

    await this.db.transaction(async (db) => {
      await db.query(
        `UPDATE attachments
         SET deleted_at = NOW()
         WHERE id = $1 AND survey_id = $2`,
        [attachmentId, surveyId],
      )

      await this.insertEvent(db, surveyId, user.id, "attachment_deleted", {
        attachment_id: attachmentId,
        storage_key: existing.rows[0].storage_key,
      })
    })

    await this.cleanupAttachmentStorage(existing.rows[0].storage_key)

    return {
      survey_id: surveyId,
      attachment_id: attachmentId,
      missing: false,
      deleted: true,
    }
  }

  async listAttachments(
    user: AuthenticatedUser,
    surveyId: string,
  ): Promise<{
    items: Array<
      Pick<
        AttachmentRow,
        | "id"
        | "survey_id"
        | "storage_key"
        | "mime_type"
        | "size_bytes"
        | "created_at"
        | "uploaded_at"
      >
    >
  }> {
    await this.getSurveyForUserOrThrow(this.db, surveyId, user.id)

    const result = await this.db.query<
      Pick<
        AttachmentRow,
        | "id"
        | "survey_id"
        | "storage_key"
        | "mime_type"
        | "size_bytes"
        | "created_at"
        | "uploaded_at"
      >
    >(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, uploaded_at::text
       FROM attachments
       WHERE survey_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [surveyId],
    )

    return { items: result.rows }
  }

  private async getUploadedAttachmentOrThrow(
    surveyId: string,
    attachmentId: string,
  ): Promise<Pick<AttachmentRow, "id" | "storage_key" | "mime_type" | "uploaded_at">> {
    const result = await this.db.query<
      Pick<AttachmentRow, "id" | "storage_key" | "mime_type" | "uploaded_at">
    >(
      `SELECT id, storage_key, mime_type, uploaded_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId],
    )

    const attachment = result.rows[0]
    if (!attachment) {
      throw new NotFoundException("Attachment not found")
    }

    if (!attachment.uploaded_at) {
      throw new ConflictException({
        code: "attachment_not_uploaded",
        message: "Attachment has not been uploaded yet",
      })
    }

    return attachment
  }

  private async buildDownloadUrl(
    storageKey: string,
    surveyId: string,
    attachmentId: string,
  ): Promise<{ url: string; requires_auth: boolean }> {
    if (this.objectStorageMode === "minio" && this.s3Client) {
      await this.ensureS3Bucket()

      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: storageKey,
      })

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
      })

      return { url, requires_auth: false }
    }

    return {
      url: `/surveys/${surveyId}/attachments/${attachmentId}/content`,
      requires_auth: true,
    }
  }

  async getAttachmentDownload(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
  ): Promise<{ url: string; expires_at: string; requires_auth: boolean }> {
    await this.getSurveyForUserOrThrow(this.db, surveyId, user.id)

    const attachment = await this.getUploadedAttachmentOrThrow(surveyId, attachmentId)
    const { url, requires_auth } = await this.buildDownloadUrl(
      attachment.storage_key,
      surveyId,
      attachmentId,
    )

    return {
      url,
      expires_at: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      requires_auth,
    }
  }

  async getAttachmentContent(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    await this.getSurveyForUserOrThrow(this.db, surveyId, user.id)

    if (this.objectStorageMode !== "local") {
      throw new NotFoundException("Attachment content not found")
    }

    const attachment = await this.getUploadedAttachmentOrThrow(surveyId, attachmentId)

    const root = resolve(this.uploadsRootDir)
    const filePath = resolve(root, attachment.storage_key)
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      throw new NotFoundException("Attachment content not found")
    }

    const buffer = await readFile(filePath).catch(() => null)
    if (!buffer) {
      throw new NotFoundException("Attachment content not found")
    }

    return {
      buffer,
      mimeType: attachment.mime_type ?? "application/octet-stream",
    }
  }
}
