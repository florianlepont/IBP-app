import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { createHash, randomUUID } from "crypto"
import * as bcrypt from "bcryptjs"
import * as jwt from "jsonwebtoken"
import { DatabaseService } from "../database/database.service"
import { AuthenticatedUser } from "./auth.types"

type UserRow = AuthenticatedUser & { password_hash: string | null }
type RefreshSessionRow = {
  id: string
  user_id: string
  refresh_token_hash: string
  expires_at: string
  revoked_at: string | null
}

type TokenKind = "access" | "refresh"
const developmentFallbackSecrets = new Map<string, string>()

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(
    email: string,
    password: string,
    options?: { createIfMissing?: boolean },
  ): Promise<{ access_token: string; refresh_token: string; user: AuthenticatedUser }> {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      throw new UnauthorizedException("Email and password are required")
    }

    const createIfMissing = options?.createIfMissing ?? this.isLoginOrCreateEnabled()
    let user = await this.findUserByEmail(normalizedEmail)
    if (!user) {
      if (!createIfMissing || !this.isLoginOrCreateEnabled()) {
        throw new UnauthorizedException("Invalid credentials")
      }
      user = await this.createUser(normalizedEmail, password)
    }

    const passwordOk = await this.verifyOrBootstrapPassword(user, password)

    if (!passwordOk) {
      throw new UnauthorizedException("Invalid credentials")
    }

    const refreshToken = await this.issueRefreshToken(user.id)

    return {
      access_token: this.signToken(user.id, "access"),
      refresh_token: refreshToken,
      user: this.toPublicUser(user),
    }
  }

  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ access_token: string; refresh_token: string; user: AuthenticatedUser }> {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedDisplayName = displayName.trim()

    if (!normalizedEmail || !password) {
      throw new BadRequestException("Email and password are required")
    }

    const existing = await this.findUserByEmail(normalizedEmail)
    if (existing) {
      throw new ConflictException("Account already exists")
    }

    const user = await this.createUser(normalizedEmail, password, normalizedDisplayName)
    const refreshToken = await this.issueRefreshToken(user.id)

    return {
      access_token: this.signToken(user.id, "access"),
      refresh_token: refreshToken,
      user: this.toPublicUser(user),
    }
  }

  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const { userId, sessionId } = this.verifyRefreshToken(refreshToken)
    await this.requireUserById(userId)

    const existing = await this.getActiveRefreshSession(userId, sessionId)
    if (!existing) {
      throw new UnauthorizedException("Invalid refresh session")
    }

    if (existing.expires_at && Date.parse(existing.expires_at) <= Date.now()) {
      await this.revokeSession(existing.id).catch(() => undefined)
      throw new UnauthorizedException("Refresh session expired")
    }

    if (existing.refresh_token_hash !== this.hashToken(refreshToken)) {
      await this.revokeSession(existing.id).catch(() => undefined)
      throw new UnauthorizedException("Invalid refresh token")
    }

    const nextSessionId = randomUUID()
    const nextRefreshToken = this.signToken(userId, "refresh", { sessionId: nextSessionId })
    const nextRefreshExpiresAt = this.extractTokenExpiry(nextRefreshToken)

    const client = await this.db.connect()
    try {
      await client.query("BEGIN")

      const revoked = await client.query(
        `UPDATE auth_sessions
         SET revoked_at = NOW(),
             replaced_by_session_id = $2,
             last_used_at = NOW()
         WHERE id = $1
           AND revoked_at IS NULL`,
        [existing.id, nextSessionId],
      )
      if (!revoked.rowCount) {
        throw new UnauthorizedException("Refresh session already used")
      }

      await client.query(
        `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [nextSessionId, userId, this.hashToken(nextRefreshToken), nextRefreshExpiresAt],
      )

      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }

    return {
      access_token: this.signToken(userId, "access"),
      refresh_token: nextRefreshToken,
    }
  }

  async getUserFromAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const userId = this.verifyAccessToken(accessToken)
    return this.requireUserById(userId)
  }

  async logout(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           last_used_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    )
  }

  private async requireUserById(userId: string): Promise<AuthenticatedUser> {
    const result = await this.db.query<AuthenticatedUser>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users
       WHERE id = $1`,
      [userId],
    )

    const user = result.rows[0]
    if (!user) {
      throw new UnauthorizedException("Invalid token")
    }

    return user
  }

  private async findUserByEmail(email: string): Promise<UserRow | null> {
    const existing = await this.db.query<UserRow>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url, password_hash
       FROM users
       WHERE email = $1`,
      [email],
    )

    return existing.rows[0] ?? null
  }

  private async createUser(
    email: string,
    password: string,
    displayNameOverride?: string,
  ): Promise<UserRow> {
    const id = randomUUID()
    const displayName = displayNameOverride?.trim() || email.split("@")[0] || "Contributor"
    const passwordHash = await bcrypt.hash(password, 10)

    let created
    try {
      created = await this.db.query<UserRow>(
        `INSERT INTO users (id, email, password_hash, role, first_name, last_name, display_name)
         VALUES ($1, $2, $3, 'contributor', '', '', $4)
         RETURNING id, email, role, first_name, last_name, display_name, profile_picture_url, password_hash`,
        [id, email, passwordHash, displayName],
      )
    } catch (error) {
      const errorCode = (error as { code?: string } | null)?.code
      if (errorCode === "23505") {
        throw new ConflictException("Account already exists")
      }
      throw error
    }

    return created.rows[0]
  }

  private async verifyOrBootstrapPassword(user: UserRow, password: string): Promise<boolean> {
    if (!user.password_hash) {
      const hash = await bcrypt.hash(password, 10)
      await this.db.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
        user.id,
        hash,
      ])
      return true
    }

    return bcrypt.compare(password, user.password_hash)
  }

  private signToken(userId: string, kind: TokenKind, options?: { sessionId?: string }): string {
    const secret =
      kind === "access"
        ? this.requireSecret("ACCESS_TOKEN_SECRET")
        : this.requireSecret("REFRESH_TOKEN_SECRET")

    const expiresIn = (
      kind === "access"
        ? (process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m")
        : (process.env.REFRESH_TOKEN_EXPIRES_IN ?? "7d")
    ) as jwt.SignOptions["expiresIn"]

    const payload =
      kind === "refresh"
        ? { sub: userId, typ: kind, sid: options?.sessionId }
        : { sub: userId, typ: kind }

    return jwt.sign(payload, secret, { expiresIn })
  }

  private verifyAccessToken(token: string): string {
    const secret = this.requireSecret("ACCESS_TOKEN_SECRET")

    try {
      const payload = jwt.verify(token, secret) as { sub?: string; typ?: string }
      if (!payload.sub || payload.typ !== "access") {
        throw new UnauthorizedException("Invalid token payload")
      }
      return payload.sub
    } catch (_error) {
      throw new UnauthorizedException("Invalid token")
    }
  }

  private verifyRefreshToken(token: string): { userId: string; sessionId: string } {
    const secret = this.requireSecret("REFRESH_TOKEN_SECRET")

    try {
      const payload = jwt.verify(token, secret) as { sub?: string; typ?: string; sid?: string }
      if (!payload.sub || payload.typ !== "refresh" || !payload.sid) {
        throw new UnauthorizedException("Invalid token payload")
      }

      return { userId: payload.sub, sessionId: payload.sid }
    } catch (_error) {
      throw new UnauthorizedException("Invalid token")
    }
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const sessionId = randomUUID()
    const refreshToken = this.signToken(userId, "refresh", { sessionId })
    const expiresAt = this.extractTokenExpiry(refreshToken)

    await this.db.query(
      `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, userId, this.hashToken(refreshToken), expiresAt],
    )

    return refreshToken
  }

  private async getActiveRefreshSession(
    userId: string,
    sessionId: string,
  ): Promise<RefreshSessionRow | null> {
    const result = await this.db.query<RefreshSessionRow>(
      `SELECT id, user_id, refresh_token_hash, expires_at::text, revoked_at::text
       FROM auth_sessions
       WHERE id = $1
         AND user_id = $2
         AND revoked_at IS NULL`,
      [sessionId, userId],
    )

    return result.rows[0] ?? null
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           last_used_at = NOW()
       WHERE id = $1`,
      [sessionId],
    )
  }

  private requireSecret(envKey: string): string {
    const value = process.env[envKey]
    if (value) return value
    if ((process.env.NODE_ENV ?? "development").toLowerCase() === "production") {
      throw new Error(`Missing required environment variable: ${envKey}`)
    }

    let runtimeSecret = developmentFallbackSecrets.get(envKey)
    if (!runtimeSecret) {
      runtimeSecret = createHash("sha256").update(`${envKey}:${randomUUID()}`).digest("hex")
      developmentFallbackSecrets.set(envKey, runtimeSecret)
    }

    return runtimeSecret
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex")
  }

  private extractTokenExpiry(token: string): string {
    const decoded = jwt.decode(token) as { exp?: unknown } | null
    if (!decoded || typeof decoded.exp !== "number") {
      throw new UnauthorizedException("Invalid token")
    }

    return new Date(decoded.exp * 1000).toISOString()
  }

  private isLoginOrCreateEnabled(): boolean {
    return (process.env.AUTH_LOGIN_OR_CREATE_ENABLED ?? "").toLowerCase() === "true"
  }

  private toPublicUser(user: UserRow): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      display_name: user.display_name,
      profile_picture_url: user.profile_picture_url,
    }
  }
}
