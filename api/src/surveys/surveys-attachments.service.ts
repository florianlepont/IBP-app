import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { randomUUID } from "crypto"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { isAllowedMimeType } from "../common/file.utils"
import { DOWNLOAD_URL_TTL_SECONDS, StorageService } from "../storage/storage.service"
import { SurveyEventsService } from "./survey-events.service"
import { SurveysRepository } from "./surveys.repository"
import { AttachmentRow, CreateAttachmentBody } from "./surveys.types"

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

@Injectable()
export class SurveysAttachmentsService {
  // D-05: every read, write, delete and presign goes through StorageService.
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    // D-07: ownership checks read only the ownership columns; events use the single writer.
    private readonly repository: SurveysRepository,
    private readonly events: SurveyEventsService,
  ) {}

  private buildConfirmUrl(surveyId: string, attachmentId: string, uploadToken: string): string {
    const token = encodeURIComponent(uploadToken)
    return `/surveys/${surveyId}/attachments/${attachmentId}/upload?token=${token}`
  }

  // D-08: the refusal shared by both modes when the stored bytes differ from size_bytes.
  private sizeMismatch(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      code: "attachment_size_mismatch",
      message: "Uploaded file size does not match declared size",
    })
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

    if ((body.size_bytes ?? 0) > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException("size_bytes exceeds V1 max size (25MB)")
    }

    if (!isAllowedMimeType(body.mime_type)) {
      throw new BadRequestException(`Unsupported file type: ${body.mime_type}`)
    }

    const attachmentId = randomUUID()
    const uploadToken = randomUUID()
    // D-14: the key is built only by StorageService, from safe ids.
    const storageKey = this.storage.buildAttachmentKey(surveyId, attachmentId, body.mime_type)
    const confirmUrl = this.buildConfirmUrl(surveyId, attachmentId, uploadToken)
    // D-08: the presigned PUT signs Content-Length = size_bytes. Local mode uploads through
    // the API route, which checks the size itself.
    const uploadUrl =
      this.storage.mode === "minio"
        ? await this.storage.presignPut(storageKey, body.mime_type, body.size_bytes as number)
        : confirmUrl

    await this.db.transaction(async (db) => {
      await this.repository.findOwnedOrThrow(db, surveyId, user.id, {
        activeOnly: true,
        forUpdate: true,
        columns: "ownership",
      })

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

      await this.events.insert(db, surveyId, user.id, "attachment_created", {
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

    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

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

    const attachment = existing.rows[0]
    const declaredSize = Number(attachment.size_bytes)

    if (this.storage.mode === "minio") {
      // In MinIO mode, the file is uploaded directly via the presigned URL. Here we check the
      // stored object before marking it uploaded (D-08: its size must match size_bytes).
      const head = await this.storage.headObject(attachment.storage_key)
      if (!head) {
        throw new BadRequestException("uploaded object not found in storage")
      }
      if (head.contentLength !== declaredSize) {
        await this.storage.deleteObject(attachment.storage_key)
        throw this.sizeMismatch()
      }
    } else {
      if (!file?.buffer || file.buffer.length === 0) {
        throw new BadRequestException("file is required")
      }

      if (file.buffer.length > MAX_ATTACHMENT_BYTES) {
        throw new BadRequestException("file exceeds V1 max size (25MB)")
      }

      if (file.buffer.length !== declaredSize) {
        throw this.sizeMismatch()
      }

      await this.storage.putObject(
        attachment.storage_key,
        file.buffer,
        attachment.mime_type ?? "application/octet-stream",
      )
    }

    const updated = await this.db.transaction(async (db) => {
      const result = await db.query<{ id: string; uploaded_at: string }>(
        `UPDATE attachments
         SET uploaded_at = NOW()
         WHERE id = $1 AND survey_id = $2
         RETURNING id, uploaded_at::text`,
        [attachmentId, surveyId],
      )

      await this.events.insert(db, surveyId, user.id, "attachment_uploaded", {
        attachment_id: attachmentId,
        storage_key: attachment.storage_key,
        object_storage_mode: this.storage.mode,
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
    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

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

      await this.events.insert(db, surveyId, user.id, "attachment_deleted", {
        attachment_id: attachmentId,
        storage_key: existing.rows[0].storage_key,
      })
    })

    await this.storage.deleteObject(existing.rows[0].storage_key)

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
    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

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
    if (this.storage.mode === "minio") {
      return { url: await this.storage.presignGet(storageKey), requires_auth: false }
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
    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

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
    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

    if (this.storage.mode !== "local") {
      throw new NotFoundException("Attachment content not found")
    }

    const attachment = await this.getUploadedAttachmentOrThrow(surveyId, attachmentId)

    // D-07: StorageService refuses keys that resolve outside the upload root (400); the
    // content route keeps answering 404 for them, as for a missing file.
    const buffer = await this.storage.getObject(attachment.storage_key).catch((err: unknown) => {
      if (err instanceof BadRequestException) return null
      throw err
    })
    if (!buffer) {
      throw new NotFoundException("Attachment content not found")
    }

    return {
      buffer,
      mimeType: attachment.mime_type ?? "application/octet-stream",
    }
  }
}
