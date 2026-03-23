import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { UsersService } from "../src/users/users.service"

const AUTH_USER = {
  id: "user-1",
  email: "user@example.com",
  role: "contributor" as const,
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

function buildUserRow(overrides: Record<string, unknown> = {}) {
  return {
    ...AUTH_USER,
    updated_at: "2026-03-23T00:00:00.000Z",
    pending_email: null,
    email_change_token: null,
    email_change_expires_at: null,
    profile_picture_storage_key: null,
    profile_picture_mime_type: null,
    ...overrides,
  }
}

function buildService() {
  const db = {
    query: jest.fn(),
  }
  const emailService = {
    sendEmailChangeConfirmation: jest.fn(),
  }

  return {
    service: new UsersService(db as never, emailService as never),
    db,
    emailService,
  }
}

describe("UsersService", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      AUTH_DEV_EXPOSE_EMAIL_TOKEN: "true",
    }
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("returns the current profile and exposes the dev email-change token in development", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({
      rows: [
        buildUserRow({
          pending_email: "next@example.com",
          email_change_token: "change-token",
        }),
      ],
    })

    const result = await service.getMe(AUTH_USER.id)

    expect(result).toEqual(
      expect.objectContaining({
        email: AUTH_USER.email,
        email_change_required: true,
        email_change_pending_to: "next@example.com",
        email_change_token_dev: "change-token",
      }),
    )
  })

  it("throws when getMe cannot find the user", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [] })

    await expect(service.getMe(AUTH_USER.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("patches profile fields and sends an email change confirmation when needed", async () => {
    const { service, db, emailService } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          buildUserRow({
            display_name: "Algernon",
            pending_email: "next@example.com",
            email_change_token: "change-token",
            email_change_expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ],
      })

    const result = await service.patchMe(AUTH_USER, {
      display_name: "Algernon",
      email: "Next@example.com",
    })

    expect(result).toEqual(
      expect.objectContaining({
        display_name: "Algernon",
        email_change_required: true,
        email_change_pending_to: "next@example.com",
        email_change_token_dev: "change-token",
      }),
    )
    expect(emailService.sendEmailChangeConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: "next@example.com",
        displayName: "Algernon",
        token: "change-token",
      }),
    )
  })

  it("clears a pending email change and throws when email delivery fails", async () => {
    const { service, db, emailService } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          buildUserRow({
            pending_email: "next@example.com",
            email_change_token: "change-token",
            email_change_expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    emailService.sendEmailChangeConfirmation.mockRejectedValueOnce(new Error("smtp failed"))

    await expect(service.patchMe(AUTH_USER, { email: "next@example.com" })).rejects.toBeInstanceOf(
      InternalServerErrorException,
    )
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SET pending_email = NULL"),
      [AUTH_USER.id],
    )
  })

  it("confirms a valid email change and clears the pending fields", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({
        rows: [
          buildUserRow({
            pending_email: "next@example.com",
            email_change_token: "valid-token",
            email_change_expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          buildUserRow({
            email: "next@example.com",
            pending_email: null,
            email_change_token: null,
            email_change_expires_at: null,
          }),
        ],
      })

    const result = await service.confirmEmailChange(AUTH_USER, "valid-token")

    expect(result).toEqual(
      expect.objectContaining({
        email: "next@example.com",
        email_change_required: false,
        email_change_pending_to: null,
      }),
    )
  })

  it("rejects expired email change tokens and clears the pending state", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({
        rows: [
          buildUserRow({
            pending_email: "next@example.com",
            email_change_token: "expired-token",
            email_change_expires_at: new Date(Date.now() - 60_000).toISOString(),
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })

    await expect(service.confirmEmailChange(AUTH_USER, "expired-token")).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET pending_email = NULL"),
      [AUTH_USER.id],
    )
  })

  it("rejects email changes when another account already uses the target email", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [{ id: "other-user" }], rowCount: 1 })

    await expect(service.patchMe(AUTH_USER, { email: "taken@example.com" })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
