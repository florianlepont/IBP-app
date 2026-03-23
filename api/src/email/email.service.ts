import { Injectable, Logger } from "@nestjs/common"
import * as nodemailer from "nodemailer"

type EmailChangeMessage = {
  toEmail: string
  displayName: string
  token: string
  expiresAtIso: string
}

type EmailVerificationMessage = {
  toEmail: string
  displayName: string
  token: string
  expiresAtIso: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly smtpEnabled: boolean
  private readonly transporter: nodemailer.Transporter | null
  private readonly fromAddress: string

  constructor() {
    const isTestEnv = (process.env.NODE_ENV ?? "").toLowerCase() === "test"
    this.smtpEnabled = !isTestEnv && (process.env.SMTP_ENABLED ?? "false").toLowerCase() === "true"
    this.fromAddress = process.env.SMTP_FROM ?? "noreply@ibp.local"

    if (!this.smtpEnabled) {
      this.transporter = null
      return
    }

    const host = process.env.SMTP_HOST?.trim()
    const port = Number(process.env.SMTP_PORT ?? 587)
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASSWORD ?? ""
    const secure = (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"

    if (!host || !user || !pass || !Number.isFinite(port)) {
      throw new Error("SMTP_ENABLED=true requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD")
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    })
  }

  async sendEmailVerification(message: EmailVerificationMessage): Promise<void> {
    const confirmUrl = this.buildVerifyUrl(message.token)
    const expiresAtDate = new Date(message.expiresAtIso)
    const expiresAtText = Number.isNaN(expiresAtDate.getTime())
      ? message.expiresAtIso
      : expiresAtDate.toUTCString()
    const subject = "Verify your IBP account email"
    const greetingName = message.displayName?.trim() || "IBP user"
    const lines = [
      `Hello ${greetingName},`,
      "",
      "Welcome to IBP! Please verify your email address to activate your account.",
      `Verification token: ${message.token}`,
      `Token expires at: ${expiresAtText}`,
    ]

    if (confirmUrl) {
      lines.push(`Verification link: ${confirmUrl}`)
    }

    lines.push("", "If you did not create an IBP account, please ignore this email.")
    const text = lines.join("\n")

    if (!this.smtpEnabled || !this.transporter) {
      this.logger.log(
        `[DEV EMAIL] to=${message.toEmail} subject="${subject}" token=${message.token}`,
      )
      return
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: message.toEmail,
      subject,
      text,
    })
  }

  async sendEmailChangeConfirmation(message: EmailChangeMessage): Promise<void> {
    const confirmUrl = this.buildConfirmUrl(message.token)
    const expiresAtDate = new Date(message.expiresAtIso)
    const expiresAtText = Number.isNaN(expiresAtDate.getTime())
      ? message.expiresAtIso
      : expiresAtDate.toUTCString()
    const subject = "Confirm your IBP email change"
    const greetingName = message.displayName?.trim() || "IBP user"
    const lines = [
      `Hello ${greetingName},`,
      "",
      "We received a request to change your IBP account email address.",
      `Confirmation token: ${message.token}`,
      `Token expires at: ${expiresAtText}`,
    ]

    if (confirmUrl) {
      lines.push(`Confirmation link: ${confirmUrl}`)
    }

    lines.push("", "If this request was not from you, please ignore this email.")
    const text = lines.join("\n")

    if (!this.smtpEnabled || !this.transporter) {
      this.logger.log(
        `[DEV EMAIL] to=${message.toEmail} subject="${subject}" token=${message.token}`,
      )
      return
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: message.toEmail,
      subject,
      text,
    })
  }

  private buildVerifyUrl(token: string): string | null {
    const template = process.env.EMAIL_VERIFY_URL_TEMPLATE?.trim()
    if (!template) return null
    return template.replace("{token}", encodeURIComponent(token))
  }

  private buildConfirmUrl(token: string): string | null {
    const template = process.env.EMAIL_CHANGE_CONFIRM_URL_TEMPLATE?.trim()
    if (!template) return null
    return template.replace("{token}", encodeURIComponent(token))
  }
}
