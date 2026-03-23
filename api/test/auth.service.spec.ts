import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common"
import { createHash } from "crypto"
import * as bcrypt from "bcryptjs"
import * as jwt from "jsonwebtoken"
import { Logger } from "@nestjs/common"
import { AuthService } from "../src/auth/auth.service"

type QueryResult<T> = {
  rows: T[]
  rowCount?: number
}

type MockClient = {
  query: jest.Mock
  release: jest.Mock
}

const AUTH_USER = {
  id: "user-1",
  email: "user@example.com",
  role: "contributor",
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

function buildService() {
  const db = {
    query: jest.fn(),
    connect: jest.fn(),
  }
  const emailService = {
    sendEmailVerification: jest.fn(),
  }

  return {
    service: new AuthService(db as never, emailService as never),
    db,
    emailService,
  }
}

describe("AuthService", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      ACCESS_TOKEN_SECRET: "test-access-secret",
      REFRESH_TOKEN_SECRET: "test-refresh-secret",
      AUTH_DEV_EXPOSE_EMAIL_TOKEN: "true",
      AUTH_LOGIN_OR_CREATE_ENABLED: "true",
    }
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("bootstraps a missing password hash during login and returns tokens", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            ...AUTH_USER,
            password_hash: null,
            email_verified: true,
          },
        ],
      } satisfies QueryResult<unknown>)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    const result = await service.login(" USER@EXAMPLE.COM ", "Secret123!")

    expect(result.user.email).toBe("user@example.com")
    expect(typeof result.access_token).toBe("string")
    expect(typeof result.refresh_token).toBe("string")
    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining("FROM users"), [
      "user@example.com",
    ])
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE users SET password_hash"),
      [AUTH_USER.id, expect.any(String)],
    )
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO auth_sessions"),
      expect.arrayContaining([AUTH_USER.id]),
    )
  })

  it("rejects login when the email is not verified", async () => {
    const { service, db } = buildService()
    const passwordHash = await bcrypt.hash("Secret123!", 4)
    db.query.mockResolvedValueOnce({
      rows: [
        {
          ...AUTH_USER,
          password_hash: passwordHash,
          email_verified: false,
        },
      ],
    } satisfies QueryResult<unknown>)

    await expect(service.login("user@example.com", "Secret123!")).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it("registers a new account, sends an email, and exposes the dev token in development", async () => {
    const { service, db, emailService } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...AUTH_USER,
            password_hash: "hashed-password",
            email: "new-user@example.com",
            display_name: "New User",
            email_verified: false,
          },
        ],
      } satisfies QueryResult<unknown>)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    const result = await service.register("new-user@example.com", "Secret123!", "New User")

    expect(result.user.email).toBe("new-user@example.com")
    expect(result.user.display_name).toBe("New User")
    expect(typeof result.email_verification_token_dev).toBe("string")
    expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "new-user@example.com",
        displayName: "New User",
        token: expect.any(String),
      }),
    )
  })

  it("maps unique constraint errors to an account-exists conflict during register", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce({ code: "23505" })

    await expect(service.register("dup@example.com", "Secret123!", "Dup")).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it("verifies a pending email token and clears verification metadata", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: AUTH_USER.id,
            email_verified: false,
            email_verification_expires_at: new Date(Date.now() + 60_000).toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    await expect(service.verifyEmail("verify-token")).resolves.toBeUndefined()
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET email_verified = TRUE"),
      [AUTH_USER.id],
    )
  })

  it("rejects expired verification tokens", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: AUTH_USER.id,
          email_verified: false,
          email_verification_expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    })

    await expect(service.verifyEmail("expired-token")).rejects.toBeInstanceOf(BadRequestException)
  })

  it("resends a verification email and returns the dev token for pending users", async () => {
    const { service, db, emailService } = buildService()
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: AUTH_USER.id,
            display_name: AUTH_USER.display_name,
            email_verified: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    const result = await service.resendVerification(" user@example.com ")

    expect(typeof result.email_verification_token_dev).toBe("string")
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET email_verification_token = $2"),
      [AUTH_USER.id, expect.any(String), expect.any(String)],
    )
    expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "user@example.com",
        displayName: AUTH_USER.display_name,
      }),
    )
  })

  it("refreshes a valid session by rotating the refresh token", async () => {
    const { service, db } = buildService()
    const sessionId = "session-1"
    const refreshToken = jwt.sign(
      { sub: AUTH_USER.id, typ: "refresh", sid: sessionId },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: "7d" },
    )
    const client: MockClient = {
      query: jest.fn(async (sql: string) => {
        if (sql === "BEGIN") return { rows: [], rowCount: 0 }
        if (sql.includes("INSERT INTO auth_sessions")) return { rows: [], rowCount: 1 }
        if (sql.includes("UPDATE auth_sessions")) return { rows: [], rowCount: 1 }
        if (sql === "COMMIT") return { rows: [], rowCount: 0 }
        if (sql === "ROLLBACK") return { rows: [], rowCount: 0 }
        return { rows: [], rowCount: 0 }
      }),
      release: jest.fn(),
    }
    db.query.mockResolvedValueOnce({ rows: [AUTH_USER] }).mockResolvedValueOnce({
      rows: [
        {
          id: sessionId,
          user_id: AUTH_USER.id,
          refresh_token_hash: createHash("sha256").update(refreshToken).digest("hex"),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          revoked_at: null,
        },
      ],
    })
    db.connect.mockResolvedValue(client)

    const result = await service.refresh(refreshToken)

    expect(typeof result.access_token).toBe("string")
    expect(typeof result.refresh_token).toBe("string")
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("INSERT INTO auth_sessions"),
      expect.stringContaining("UPDATE auth_sessions"),
      "COMMIT",
    ])
    expect(client.release).toHaveBeenCalledTimes(1)
  })

  it("returns a user from a valid access token and rejects missing users", async () => {
    const { service, db } = buildService()
    const accessToken = jwt.sign(
      { sub: AUTH_USER.id, typ: "access" },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "15m" },
    )
    db.query.mockResolvedValueOnce({ rows: [AUTH_USER] })

    await expect(service.getUserFromAccessToken(accessToken)).resolves.toEqual(AUTH_USER)

    db.query.mockResolvedValueOnce({ rows: [] })
    await expect(service.getUserFromAccessToken(accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it("revokes all active sessions on logout and logs cleanup of expired sessions", async () => {
    const { service, db } = buildService()
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined)
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 2 }).mockResolvedValueOnce({
      rows: [],
      rowCount: 3,
    })

    await service.logout(AUTH_USER.id)
    await service.cleanupExpiredSessions()

    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining("UPDATE auth_sessions"), [
      AUTH_USER.id,
    ])
    expect(logSpy).toHaveBeenCalledWith("Cleaned up 3 expired auth sessions")
  })
})
