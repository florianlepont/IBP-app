import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
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

export type MeResponse = AuthenticatedUser & {
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
  private readonly uploadsRootDir: string

  constructor(
    private readonly db: DatabaseService,
    private readonly auth0Management: Auth0ManagementService,
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

  async changeEmail(user: AuthenticatedUser, newEmail: string): Promise<void> {
    if (newEmail === user.email) {
      throw new BadRequestException("New email is the same as current email")
    }

    // Update on Auth0 first (sends verification email)
    await this.auth0Management.updateEmail(user.auth0_sub, newEmail)

    // Update in our DB
    await this.db.query(`UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2`, [
      newEmail,
      user.id,
    ])
  }

  private storagePathForKey(storageKey: string): string {
    return join(this.uploadsRootDir, storageKey)
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
