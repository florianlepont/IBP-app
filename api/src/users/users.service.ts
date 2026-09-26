import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { AuthenticatedUser } from "../auth/auth.types"
import { Auth0ManagementService } from "../auth/auth0-management.service"
import { isAllowedMimeType } from "../common/file.utils"
import { DatabaseService } from "../database/database.service"
import { StorageService } from "../storage/storage.service"

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
  private readonly logger = new Logger(UsersService.name)

  // D-05: profile pictures are read, written and deleted only through StorageService, so in
  // minio mode they live in the bucket and survive a container restart.
  constructor(
    private readonly db: DatabaseService,
    private readonly auth0Management: Auth0ManagementService,
    private readonly storage: StorageService,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const row = await this.findUserMeRow(userId)
    if (!row) {
      throw new NotFoundException("User not found")
    }
    const response = this.toMeResponse(row)
    const storageKey = row.profile_picture_storage_key
    if (storageKey && !(await this.pictureObjectExists(row.id, storageKey))) {
      // D-06: a stored picture that can no longer be found reads as "no picture".
      response.profile_picture_url = null
    }
    return response
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

    // D-09/D-15: own-property allow-list check, so image/gif or a prototype key such as
    // "constructor" answers 400 instead of reaching the key builder.
    const mimeType = (file.mimetype ?? "").trim().toLowerCase()
    if (!isAllowedMimeType(mimeType)) {
      throw new BadRequestException("Unsupported profile picture type")
    }

    const current = await this.findUserMeRow(user.id)
    if (!current) {
      throw new NotFoundException("User not found")
    }

    const storageKey = this.storage.buildProfilePictureKey(user.id, mimeType)
    await this.storage.putObject(storageKey, file.buffer, mimeType)

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

    // The previous object goes only after the row points at the new one.
    const previousKey = current.profile_picture_storage_key
    if (previousKey && previousKey !== storageKey) {
      await this.storage.deleteObject(previousKey)
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

    const storageKey = row.profile_picture_storage_key
    const buffer = await this.storage.getObject(storageKey)
    if (!buffer) {
      // D-06: the object is gone (e.g. a picture written to ephemeral disk before this
      // phase). Clear the stale columns so /me reports no picture from now on. The key
      // condition keeps a concurrent new upload intact.
      await this.db.query(
        `UPDATE users
         SET profile_picture_url = NULL,
             profile_picture_storage_key = NULL,
             profile_picture_mime_type = NULL,
             updated_at = NOW()
         WHERE id = $1
           AND profile_picture_storage_key = $2`,
        [user.id, storageKey],
      )
      throw new NotFoundException("Profile picture not found")
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

    // Storage cleanup runs only after the DB no longer references the object.
    if (current.profile_picture_storage_key) {
      await this.storage.deleteObject(current.profile_picture_storage_key)
    }

    return this.toMeResponse(updated)
  }

  async deleteAccount(user: AuthenticatedUser): Promise<void> {
    const current = await this.findUserMeRow(user.id)
    if (!current) {
      throw new NotFoundException("User not found")
    }

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

    // A-M9: the local account (surveys, events, attachments, user row) is
    // fully committed before Auth0 is ever touched, so a DB failure never
    // leaves an orphaned Auth0 user with no local account.
    const storageKeysToDelete = await this.db.transaction(async (db) => {
      const keysToDelete: string[] = []

      // 1. Collect storage keys of draft attachments BEFORE any modification.
      const attachmentKeys = await db.query<AttachmentStorageRow>(
        `SELECT a.storage_key
         FROM attachments a
         WHERE a.survey_id IN (${draftSurveySubquery})`,
        [user.id],
      )
      keysToDelete.push(...attachmentKeys.rows.map((row) => row.storage_key))

      // 2. Anonymise retained surveys: nullify actor on their events, then nullify user_id.
      await db.query(
        `UPDATE survey_events
         SET actor_id = NULL
         WHERE actor_id = $1
           AND survey_id IN (${retainedSurveySubquery})`,
        [user.id],
      )

      await db.query(
        `UPDATE surveys
         SET user_id = NULL
         WHERE id IN (${retainedSurveySubquery})`,
        [user.id],
      )

      // 3. Delete draft surveys and their dependents (user_id still set on drafts at this point).
      await db.query(
        `DELETE FROM attachments
         WHERE survey_id IN (${draftSurveySubquery})`,
        [user.id],
      )
      await db.query(
        `DELETE FROM survey_events
         WHERE survey_id IN (${draftSurveySubquery})`,
        [user.id],
      )
      await db.query(`DELETE FROM surveys WHERE user_id = $1`, [user.id])

      // 4. Delete the user row.
      await db.query(`DELETE FROM users WHERE id = $1`, [user.id])

      return keysToDelete
    })

    try {
      await this.auth0Management.deleteUser(user.auth0_sub)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Auth0 user deletion failed after local account deletion (user_id=${user.id}, auth0_sub=${user.auth0_sub}): ${message}`,
      )
    }

    // Best-effort storage cleanup, after the commit (deleteObject never throws).
    if (current.profile_picture_storage_key) {
      await this.storage.deleteObject(current.profile_picture_storage_key)
    }

    for (const storageKey of storageKeysToDelete) {
      await this.storage.deleteObject(storageKey)
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

  // One HEAD per /me. Only a confirmed missing object hides the picture: any other storage
  // error (store unreachable, 5xx) is logged and the stored URL is kept, so /me still
  // answers 200.
  private async pictureObjectExists(userId: string, storageKey: string): Promise<boolean> {
    try {
      return (await this.storage.headObject(storageKey)) !== null
    } catch (error) {
      const name = error instanceof Error ? error.name : typeof error
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `Profile picture check failed, keeping stored url (user_id=${userId}): ${name}: ${message}`,
      )
      return true
    }
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
