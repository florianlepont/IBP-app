import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { randomUUID } from "crypto"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { AuthenticatedUser } from "../auth/auth.types"
import { extensionFromMime } from "../common/file.utils"
import { DatabaseService } from "../database/database.service"
import { EmailService } from "../email/email.service"

const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000
const PROFILE_PICTURE_MAX_BYTES = 10 * 1024 * 1024

type UserMeRow = AuthenticatedUser & {
  updated_at: string
  pending_email: string | null
  email_change_token: string | null
  email_change_expires_at: string | null
  profile_picture_storage_key: string | null
  profile_picture_mime_type: string | null
}

type UserPictureRow = {
  profile_picture_storage_key: string | null
  profile_picture_mime_type: string | null
}

export type MeResponse = AuthenticatedUser & {
  updated_at: string
  email_change_required: boolean
  email_change_pending_to: string | null
  email_change_token_dev?: string
}

export type PatchMeBody = {
  first_name?: string
  last_name?: string
  display_name?: string
  email?: string
  profile_picture_url?: string | null
}

@Injectable()
export class UsersService {
  private readonly uploadsRootDir: string

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
  ) {
    this.uploadsRootDir = process.env.ATTACHMENTS_UPLOAD_DIR ?? "/tmp/ibp-uploads"
  }

  async getMe(userId: string): Promise<MeResponse> {
    const row = await this.findUserMeRow(userId)
    if (!row) {
      throw new NotFoundException("User not found")
    }
    return this.toMeResponse(row)
  }

  async patchMe(user: AuthenticatedUser, body: PatchMeBody): Promise<MeResponse> {
    const nextEmail = body.email?.trim().toLowerCase()
    const emailChangeRequested = Boolean(nextEmail && nextEmail !== user.email)
    const emailChangeToken = emailChangeRequested ? randomUUID() : null
    const emailChangeExpiresAt = emailChangeRequested
      ? new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString()
      : null

    if (emailChangeRequested && nextEmail) {
      await this.ensureEmailIsAvailable(nextEmail, user.id)
    }

    const result = await this.db.query<UserMeRow>(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           display_name = COALESCE($4, display_name),
           profile_picture_url = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($6, profile_picture_url) END,
           pending_email = CASE WHEN $7::boolean THEN $8 ELSE pending_email END,
           email_change_token = CASE WHEN $7::boolean THEN $9 ELSE email_change_token END,
           email_change_expires_at = CASE WHEN $7::boolean THEN $10::timestamptz ELSE email_change_expires_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id,
                 email,
                 role,
                 first_name,
                 last_name,
                 display_name,
                 profile_picture_url,
                 updated_at::text,
                 pending_email,
                 email_change_token,
                 email_change_expires_at::text,
                 profile_picture_storage_key,
                 profile_picture_mime_type`,
      [
        user.id,
        body.first_name ?? null,
        body.last_name ?? null,
        body.display_name ?? null,
        body.profile_picture_url === null,
        body.profile_picture_url ?? null,
        emailChangeRequested,
        nextEmail ?? null,
        emailChangeToken,
        emailChangeExpiresAt,
      ],
    )

    const updated = result.rows[0]
    if (!updated) {
      throw new NotFoundException("User not found")
    }

    if (
      emailChangeRequested &&
      updated.pending_email &&
      updated.email_change_token &&
      updated.email_change_expires_at
    ) {
      try {
        await this.emailService.sendEmailChangeConfirmation({
          toEmail: updated.pending_email,
          displayName: updated.display_name,
          token: updated.email_change_token,
          expiresAtIso: updated.email_change_expires_at,
        })
      } catch (_error) {
        await this.clearPendingEmailChange(updated.id)
        throw new InternalServerErrorException(
          "Unable to send confirmation email. Please retry later.",
        )
      }
    }

    return this.toMeResponse(updated)
  }

  async confirmEmailChange(user: AuthenticatedUser, token: string): Promise<MeResponse> {
    const normalizedToken = token.trim()
    if (!normalizedToken) {
      throw new BadRequestException("token is required")
    }

    const current = await this.findUserMeRow(user.id)
    if (!current) {
      throw new NotFoundException("User not found")
    }

    if (!current.pending_email || !current.email_change_token) {
      throw new BadRequestException("No email change pending")
    }

    if (current.email_change_token !== normalizedToken) {
      throw new BadRequestException("Invalid email change token")
    }

    const expiresAtMs = current.email_change_expires_at
      ? Date.parse(current.email_change_expires_at)
      : NaN
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      await this.db.query(
        `UPDATE users
         SET pending_email = NULL,
             email_change_token = NULL,
             email_change_expires_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [user.id],
      )
      throw new BadRequestException("Email change token expired")
    }

    await this.ensureEmailIsAvailable(current.pending_email, user.id)

    const result = await this.db.query<UserMeRow>(
      `UPDATE users
       SET email = pending_email,
           pending_email = NULL,
           email_change_token = NULL,
           email_change_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id,
                 email,
                 role,
                 first_name,
                 last_name,
                 display_name,
                 profile_picture_url,
                 updated_at::text,
                 pending_email,
                 email_change_token,
                 email_change_expires_at::text,
                 profile_picture_storage_key,
                 profile_picture_mime_type`,
      [user.id],
    )

    const updated = result.rows[0]
    if (!updated) {
      throw new NotFoundException("User not found")
    }

    return this.toMeResponse(updated)
  }

  async uploadProfilePicture(
    user: AuthenticatedUser,
    file?: { buffer: Buffer; mimetype?: string; size?: number; originalname?: string },
  ): Promise<{ profile_picture_url: string; user: MeResponse }> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("file is required")
    }

    if (file.buffer.length > PROFILE_PICTURE_MAX_BYTES) {
      throw new BadRequestException("file exceeds V1 max size (10MB)")
    }

    const mimeType = (file.mimetype ?? "").trim().toLowerCase()
    if (!mimeType.startsWith("image/")) {
      throw new BadRequestException("profile picture must be an image")
    }

    const extension = extensionFromMime(mimeType)
    const storageKey = `profiles/${user.id}/avatar${extension}`
    const storagePath = this.storagePathForKey(storageKey)
    await mkdir(dirname(storagePath), { recursive: true })
    await writeFile(storagePath, file.buffer)

    const current = await this.findUserMeRow(user.id)
    if (!current) {
      throw new NotFoundException("User not found")
    }

    if (current.profile_picture_storage_key && current.profile_picture_storage_key !== storageKey) {
      await rm(this.storagePathForKey(current.profile_picture_storage_key), { force: true }).catch(
        () => undefined,
      )
    }

    const pictureUrl = `/me/profile-picture?v=${Date.now()}`
    const result = await this.db.query<UserMeRow>(
      `UPDATE users
       SET profile_picture_url = $2,
           profile_picture_storage_key = $3,
           profile_picture_mime_type = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id,
                 email,
                 role,
                 first_name,
                 last_name,
                 display_name,
                 profile_picture_url,
                 updated_at::text,
                 pending_email,
                 email_change_token,
                 email_change_expires_at::text,
                 profile_picture_storage_key,
                 profile_picture_mime_type`,
      [user.id, pictureUrl, storageKey, mimeType],
    )

    const updated = result.rows[0]
    if (!updated) {
      throw new NotFoundException("User not found")
    }

    return {
      profile_picture_url: pictureUrl,
      user: this.toMeResponse(updated),
    }
  }

  async getProfilePicture(user: AuthenticatedUser): Promise<{ buffer: Buffer; mimeType: string }> {
    const result = await this.db.query<UserPictureRow>(
      `SELECT profile_picture_storage_key, profile_picture_mime_type
       FROM users
       WHERE id = $1`,
      [user.id],
    )
    const row = result.rows[0]

    if (!row?.profile_picture_storage_key) {
      throw new NotFoundException("Profile picture not found")
    }

    const storagePath = this.storagePathForKey(row.profile_picture_storage_key)
    const buffer = await readFile(storagePath).catch(() => null)
    if (!buffer) {
      throw new NotFoundException("Profile picture file not found")
    }

    return {
      buffer,
      mimeType: row.profile_picture_mime_type ?? "application/octet-stream",
    }
  }

  async removeProfilePicture(user: AuthenticatedUser): Promise<MeResponse> {
    const current = await this.findUserMeRow(user.id)
    if (!current) {
      throw new NotFoundException("User not found")
    }

    if (current.profile_picture_storage_key) {
      await rm(this.storagePathForKey(current.profile_picture_storage_key), { force: true }).catch(
        () => undefined,
      )
    }

    const result = await this.db.query<UserMeRow>(
      `UPDATE users
       SET profile_picture_url = NULL,
           profile_picture_storage_key = NULL,
           profile_picture_mime_type = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id,
                 email,
                 role,
                 first_name,
                 last_name,
                 display_name,
                 profile_picture_url,
                 updated_at::text,
                 pending_email,
                 email_change_token,
                 email_change_expires_at::text,
                 profile_picture_storage_key,
                 profile_picture_mime_type`,
      [user.id],
    )

    const updated = result.rows[0]
    if (!updated) {
      throw new NotFoundException("User not found")
    }

    return this.toMeResponse(updated)
  }

  private async findUserMeRow(userId: string): Promise<UserMeRow | null> {
    const result = await this.db.query<UserMeRow>(
      `SELECT id,
              email,
              role,
              first_name,
              last_name,
              display_name,
              profile_picture_url,
              updated_at::text,
              pending_email,
              email_change_token,
              email_change_expires_at::text,
              profile_picture_storage_key,
              profile_picture_mime_type
       FROM users
       WHERE id = $1`,
      [userId],
    )

    return result.rows[0] ?? null
  }

  private async ensureEmailIsAvailable(nextEmail: string, currentUserId: string): Promise<void> {
    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM users
       WHERE id <> $2
         AND (email = $1 OR pending_email = $1)
       LIMIT 1`,
      [nextEmail, currentUserId],
    )

    if (existing.rowCount) {
      throw new BadRequestException("Email already in use")
    }
  }

  private storagePathForKey(storageKey: string): string {
    return join(this.uploadsRootDir, storageKey)
  }

  private async clearPendingEmailChange(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users
       SET pending_email = NULL,
           email_change_token = NULL,
           email_change_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId],
    )
  }

  private shouldExposeDevToken(): boolean {
    const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase()
    if (nodeEnv !== "development") {
      return false
    }
    return (process.env.AUTH_DEV_EXPOSE_EMAIL_TOKEN ?? "true").toLowerCase() !== "false"
  }

  private toMeResponse(row: UserMeRow): MeResponse {
    const response: MeResponse = {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      display_name: row.display_name,
      profile_picture_url: row.profile_picture_url,
      updated_at: row.updated_at,
      email_change_required: Boolean(row.pending_email),
      email_change_pending_to: row.pending_email ?? null,
    }

    if (this.shouldExposeDevToken() && row.email_change_token) {
      response.email_change_token_dev = row.email_change_token
    }

    return response
  }
}
