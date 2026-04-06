import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { AuthenticatedUser } from "../auth/auth.types"
import { Auth0ManagementService } from "../auth/auth0-management.service"
import { extensionFromMime } from "../common/file.utils"
import { DatabaseService } from "../database/database.service"

const PROFILE_PICTURE_MAX_BYTES = 10 * 1024 * 1024

type UserMeRow = AuthenticatedUser & {
  updated_at: string
  profile_picture_storage_key: string | null
  profile_picture_mime_type: string | null
}

type UserPictureRow = {
  profile_picture_storage_key: string | null
  profile_picture_mime_type: string | null
}

type AttachmentStorageRow = {
  storage_key: string
}

export type MeResponse = {
  id: string
  email: string
  role: "contributor" | "moderator" | "admin"
  first_name: string
  last_name: string
  display_name: string
  profile_picture_url: string | null
  updated_at: string
}

export type PatchMeBody = {
  first_name?: string
  last_name?: string
  display_name?: string
  profile_picture_url?: string | null
}

@Injectable()
export class UsersService {
  private readonly objectStorageMode: "local" | "minio"
  private readonly s3Bucket: string
  private readonly s3Client?: S3Client
  private readonly uploadsRootDir: string

  constructor(
    private readonly db: DatabaseService,
    private readonly auth0Management: Auth0ManagementService,
  ) {
    this.objectStorageMode =
      (process.env.OBJECT_STORAGE_MODE ?? "local") === "minio" ? "minio" : "local"
    this.s3Bucket = process.env.OBJECT_STORAGE_BUCKET ?? "ibp-surveys"
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

  async getMe(userId: string): Promise<MeResponse> {
    const row = await this.findUserMeRow(userId)
    if (!row) {
      throw new NotFoundException("User not found")
    }
    return this.toMeResponse(row)
  }

  async patchMe(user: AuthenticatedUser, body: PatchMeBody): Promise<MeResponse> {
    const result = await this.db.query<UserMeRow>(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           display_name = COALESCE($4, display_name),
           profile_picture_url = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($6, profile_picture_url) END,
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
                 profile_picture_storage_key,
                 profile_picture_mime_type`,
      [
        user.id,
        body.first_name ?? null,
        body.last_name ?? null,
        body.display_name ?? null,
        body.profile_picture_url === null,
        body.profile_picture_url ?? null,
      ],
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

  async deleteAccount(user: AuthenticatedUser): Promise<void> {
    const current = await this.findUserMeRow(user.id)
    if (!current) {
      throw new NotFoundException("User not found")
    }

    await this.auth0Management.deleteUser(user.auth0_sub)

    const client = await this.db.connect()
    const storageKeysToDelete: string[] = []
    // Surveys to retain = submitted/synced (not soft-deleted).
    // Identified once at the start of the transaction so subsequent UPDATEs
    // (which nullify user_id) cannot affect the predicate.
    const retainedSurveySubquery = `
      SELECT id FROM surveys
      WHERE user_id = $1
        AND deleted_at IS NULL
        AND (status IN ('submitted', 'synced') OR submitted_at IS NOT NULL)
    `
    // Draft surveys = everything still owned by the user after retaining submitted ones.
    const draftSurveySubquery = `
      SELECT id FROM surveys WHERE user_id = $1
    `

    try {
      await client.query("BEGIN")

      // 1. Collect storage keys of draft attachments BEFORE any modification.
      const attachmentKeys = await client.query<AttachmentStorageRow>(
        `SELECT a.storage_key
         FROM attachments a
         WHERE a.survey_id IN (${draftSurveySubquery})`,
        [user.id],
      )
      storageKeysToDelete.push(...attachmentKeys.rows.map((row) => row.storage_key))

      // 2. Anonymise retained surveys: nullify actor on their events, then nullify user_id.
      await client.query(
        `UPDATE survey_events
         SET actor_id = NULL
         WHERE actor_id = $1
           AND survey_id IN (${retainedSurveySubquery})`,
        [user.id],
      )

      await client.query(
        `UPDATE surveys
         SET user_id = NULL
         WHERE id IN (${retainedSurveySubquery})`,
        [user.id],
      )

      // 3. Delete draft surveys and their dependents (user_id still set on drafts at this point).
      await client.query(
        `DELETE FROM attachments
         WHERE survey_id IN (${draftSurveySubquery})`,
        [user.id],
      )
      await client.query(
        `DELETE FROM survey_events
         WHERE survey_id IN (${draftSurveySubquery})`,
        [user.id],
      )
      await client.query(`DELETE FROM surveys WHERE user_id = $1`, [user.id])

      // 4. Delete the user row.
      await client.query(`DELETE FROM users WHERE id = $1`, [user.id])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    if (current.profile_picture_storage_key) {
      await rm(this.storagePathForKey(current.profile_picture_storage_key), { force: true }).catch(
        () => undefined,
      )
    }

    for (const storageKey of storageKeysToDelete) {
      await this.cleanupAttachmentStorage(storageKey)
    }
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
              profile_picture_storage_key,
              profile_picture_mime_type
       FROM users
       WHERE id = $1`,
      [userId],
    )

    return result.rows[0] ?? null
  }

  async sendPasswordReset(user: AuthenticatedUser): Promise<void> {
    await this.auth0Management.sendPasswordResetEmail(user.email)
  }

  async changeEmail(user: AuthenticatedUser, newEmail: string): Promise<void> {
    if (newEmail === user.email) {
      throw new BadRequestException("New email is the same as current email")
    }

    // Update on Auth0 first (sends verification email)
    await this.auth0Management.updateEmail(user.auth0_sub, newEmail)

    // Update in our DB
    try {
      await this.db.query(`UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2`, [
        newEmail,
        user.id,
      ])
    } catch (err: unknown) {
      const isUniqueViolation =
        typeof err === "object" && err !== null && (err as { code?: string }).code === "23505"
      if (isUniqueViolation) {
        // Rollback Auth0 email change
        await this.auth0Management.updateEmail(user.auth0_sub, user.email).catch(() => undefined)
        throw new BadRequestException("Email already taken")
      }
      throw err
    }
  }

  private storagePathForKey(storageKey: string): string {
    return join(this.uploadsRootDir, storageKey)
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

    await rm(this.storagePathForKey(storageKey), { force: true }).catch(() => undefined)
  }

  private toMeResponse(row: UserMeRow): MeResponse {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      display_name: row.display_name,
      profile_picture_url: row.profile_picture_url,
      updated_at: row.updated_at,
    }
  }
}
