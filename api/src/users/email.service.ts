import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import * as nodemailer from "nodemailer"
import { appConfigOf } from "../config/app-config"

type EmailChangeMessage = {
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
  private readonly confirmUrlTemplate: string

  constructor(config: ConfigService) {
    const app = appConfigOf(config)
    const smtp = app.smtp
    // SMTP stays off under NODE_ENV=test whatever SMTP_ENABLED says.
    this.smtpEnabled = app.nodeEnv !== "test" && smtp.enabled
    this.fromAddress = smtp.from
    this.confirmUrlTemplate = smtp.emailChangeConfirmUrlTemplate

    if (!this.smtpEnabled) {
      this.transporter = null
      return
    }

    const { host, port, user, secure } = smtp
    const pass = smtp.password

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

  private buildConfirmUrl(token: string): string | null {
    const template = this.confirmUrlTemplate
    if (!template) {
      return null
    }

    return template.replace("{token}", encodeURIComponent(token))
  }
}
