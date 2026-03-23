const mockSendMail = jest.fn()
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }))

jest.mock("nodemailer", () => ({
  createTransport: mockCreateTransport,
}))

import { Logger } from "@nestjs/common"
import { EmailService } from "../src/email/email.service"

describe("EmailService", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("logs verification emails in dev mode when SMTP is disabled", async () => {
    process.env.NODE_ENV = "test"
    process.env.SMTP_ENABLED = "false"
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined)
    const service = new EmailService()

    await service.sendEmailVerification({
      toEmail: "user@example.com",
      displayName: "User",
      token: "dev-token",
      expiresAtIso: "2026-03-23T00:00:00.000Z",
    })

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[DEV EMAIL] to=user@example.com subject="Verify your IBP account email" token=dev-token',
      ),
    )
    expect(mockCreateTransport).not.toHaveBeenCalled()
  })

  it("requires complete SMTP configuration when SMTP is enabled", () => {
    process.env.NODE_ENV = "development"
    process.env.SMTP_ENABLED = "true"
    process.env.SMTP_HOST = ""
    process.env.SMTP_USER = ""
    process.env.SMTP_PASSWORD = ""

    expect(() => new EmailService()).toThrow(
      "SMTP_ENABLED=true requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD",
    )
  })

  it("sends verification emails through nodemailer when SMTP is enabled", async () => {
    process.env.NODE_ENV = "development"
    process.env.SMTP_ENABLED = "true"
    process.env.SMTP_HOST = "smtp.example.com"
    process.env.SMTP_PORT = "587"
    process.env.SMTP_SECURE = "false"
    process.env.SMTP_USER = "mailer"
    process.env.SMTP_PASSWORD = "secret"
    process.env.SMTP_FROM = "noreply@example.com"
    process.env.EMAIL_VERIFY_URL_TEMPLATE = "https://example.com/verify?token={token}"

    const service = new EmailService()
    await service.sendEmailVerification({
      toEmail: "user@example.com",
      displayName: "User",
      token: "abc 123",
      expiresAtIso: "2026-03-23T00:00:00.000Z",
    })

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "mailer", pass: "secret" },
    })
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "user@example.com",
        subject: "Verify your IBP account email",
        text: expect.stringContaining("https://example.com/verify?token=abc%20123"),
      }),
    )
  })

  it("sends email change confirmations with the configured confirmation link", async () => {
    process.env.NODE_ENV = "development"
    process.env.SMTP_ENABLED = "true"
    process.env.SMTP_HOST = "smtp.example.com"
    process.env.SMTP_PORT = "465"
    process.env.SMTP_SECURE = "true"
    process.env.SMTP_USER = "mailer"
    process.env.SMTP_PASSWORD = "secret"
    process.env.SMTP_FROM = "noreply@example.com"
    process.env.EMAIL_CHANGE_CONFIRM_URL_TEMPLATE = "ibp://confirm-email?token={token}"

    const service = new EmailService()
    await service.sendEmailChangeConfirmation({
      toEmail: "next@example.com",
      displayName: "User",
      token: "change-token",
      expiresAtIso: "2026-03-23T00:00:00.000Z",
    })

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "next@example.com",
        subject: "Confirm your IBP email change",
        text: expect.stringContaining("ibp://confirm-email?token=change-token"),
      }),
    )
  })
})
