import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Request } from "express"
import * as jwt from "jsonwebtoken"
import { JwksClient } from "jwks-rsa"
import { appConfigOf } from "../config/app-config"
import { NodeEnv } from "../config/config.types"
import { DatabaseService } from "../database/database.service"
import { getTestTokenSecret } from "../debug/test-token-secret"
import { AuthenticatedUser } from "./auth.types"

/**
 * Stable error code returned (HTTP 403) when first-login provisioning refuses
 * to attach an Auth0 identity to an email that already belongs to another
 * account (D-08). It is a policy refusal, not an invalid token: clients must
 * not refresh and retry.
 */
export const EMAIL_ALREADY_LINKED_CODE = "email_already_linked"

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505"
}

/** Reads a string or number property from an unknown error without trusting its shape. */
function errorField(err: unknown, key: "name" | "message" | "code"): string | undefined {
  if (typeof err !== "object" || err === null || !(key in err)) {
    return undefined
  }
  const value = (err as Record<string, unknown>)[key]
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined
}

/**
 * D-06: the failure log carries the error name, message and code only. The
 * token, the Authorization header, the stack and the error object itself are
 * never passed to the logger.
 */
function describeAuthFailure(err: unknown): string {
  const name = errorField(err, "name")
  const message = errorField(err, "message")
  const code = errorField(err, "code")
  return `Token validation failed: ${name ?? "Error"}: ${message ?? "unknown"}${code ? ` (code=${code})` : ""}`
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name)
  private readonly jwksClients: JwksClient[]
  private readonly nodeEnv: NodeEnv
  private readonly publicDomain: string
  private readonly audience: string
  private readonly acceptedIssuers: string[]
  private readonly httpTimeoutMs: number

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    // D-01: every Auth0 setting comes from the validated configuration.
    const cfg = appConfigOf(config)
    this.nodeEnv = cfg.nodeEnv
    this.publicDomain = cfg.auth0.publicDomain
    this.audience = cfg.auth0.audience
    this.httpTimeoutMs = cfg.auth0.httpTimeoutMs
    const jwksDomains = Array.from(
      new Set([cfg.auth0.publicDomain, cfg.auth0.domain].filter(Boolean)),
    )
    this.acceptedIssuers = Array.from(new Set(jwksDomains.map((domain) => `https://${domain}/`)))
    this.jwksClients = jwksDomains.map(
      (domain) =>
        new JwksClient({
          jwksUri: `https://${domain}/.well-known/jwks.json`,
          cache: true,
          cacheMaxAge: 10 * 60 * 1000,
          rateLimit: true,
        }),
    )
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>()
    const header = request.headers.authorization

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token")
    }

    const token = header.slice(7)
    try {
      if (this.nodeEnv === "test") {
        const user = await this.verifyTestToken(token)
        request.user = user
        return true
      }
      const payload = await this.verifyToken(token)
      const user = await this.getOrProvisionUser(payload, token)
      request.user = user
      return true
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err
      }
      this.logger.warn(describeAuthFailure(err))
      throw new UnauthorizedException()
    }
  }

  private async verifyTestToken(token: string): Promise<AuthenticatedUser> {
    // D-04: per-process random secret, shared with POST /v1/debug/test-token.
    const secret = getTestTokenSecret(this.nodeEnv)
    if (!secret) throw new Error("test token secret unavailable")
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload
    const userId = payload.sub
    if (!userId) throw new Error("Missing sub in test token")
    const result = await this.db.query<AuthenticatedUser>(
      `SELECT id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users WHERE id = $1`,
      [userId],
    )
    if (result.rows.length === 0) throw new Error("Test user not found")
    return result.rows[0]
  }

  private verifyToken(token: string): Promise<jwt.JwtPayload> {
    return new Promise((resolve, reject) => {
      const decoded = jwt.decode(token, { complete: true })
      if (!decoded?.header?.kid) {
        return reject(new Error("Missing kid in token header"))
      }

      void this.getSigningKey(decoded.header.kid)
        .then((publicKey) => {
          jwt.verify(
            token,
            publicKey,
            {
              audience: this.audience,
              issuer: this.acceptedIssuers as [string, ...string[]],
              algorithms: ["RS256"],
            },
            (verifyErr, verified) => {
              if (verifyErr) return reject(verifyErr)
              resolve(verified as jwt.JwtPayload)
            },
          )
        })
        .catch(reject)
    })
  }

  private async getSigningKey(kid: string): Promise<string> {
    if (this.jwksClients.length === 0) {
      throw new Error("Auth0 JWKS domain is not configured")
    }

    let lastError: unknown = null
    for (const client of this.jwksClients) {
      try {
        const key = await client.getSigningKey(kid)
        return key.getPublicKey()
      } catch (error) {
        lastError = error
      }
    }

    throw lastError ?? new Error("No signing key found")
  }

  private async getOrProvisionUser(
    payload: jwt.JwtPayload,
    rawToken: string,
  ): Promise<AuthenticatedUser> {
    const auth0Sub = payload.sub
    if (!auth0Sub) throw new Error("Missing sub claim")

    const existing = await this.db.query<AuthenticatedUser>(
      `SELECT id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users WHERE auth0_sub = $1`,
      [auth0Sub],
    )

    if (existing.rows.length > 0) {
      return existing.rows[0]
    }

    // First login: fetch user info from Auth0 and create or link DB record
    const userInfo = await this.fetchUserInfo(rawToken)
    const email = userInfo.email ?? `user+${auth0Sub.replace(/[^a-zA-Z0-9]/g, "")}@unknown`
    const displayName = email.split("@")[0]

    if (userInfo.email_verified === true) {
      // Verified email: safe to link this Auth0 identity to an existing account
      // (needed for Google/Apple social login, REQ-A-social-login) — but only
      // to a pre-Auth0/unlinked row. An account already linked to another sub
      // is never re-pointed (D-08): the INSERT below then trips the email index
      // and the request is refused.
      const linked = await this.db.query<AuthenticatedUser>(
        `UPDATE users SET auth0_sub = $1 WHERE email = $2 AND auth0_sub IS NULL
         RETURNING id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url`,
        [auth0Sub, email],
      )
      if (linked.rows.length > 0) {
        return linked.rows[0]
      }
    }

    // Insert first, then classify a conflict (D-09). No SELECT-by-email guard
    // runs before the insert: a concurrent first login for the same sub would
    // otherwise find the row its twin just created and be refused.
    try {
      const inserted = await this.db.query<AuthenticatedUser>(
        `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
         VALUES (gen_random_uuid(), $1, $2, $3, '', '', 'contributor')
         ON CONFLICT (auth0_sub) DO UPDATE SET auth0_sub = EXCLUDED.auth0_sub
         RETURNING id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url`,
        [auth0Sub, email, displayName],
      )
      return inserted.rows[0]
    } catch (err) {
      if (!isUniqueViolation(err)) {
        throw err
      }

      // The email UNIQUE index tripped. Either a concurrent first login for the
      // same sub created the row first (return it), or the email belongs to a
      // different account: an unverified (or unknown) email is never linked to
      // it — that would be an account takeover path.
      const retry = await this.db.query<AuthenticatedUser>(
        `SELECT id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url
         FROM users WHERE auth0_sub = $1`,
        [auth0Sub],
      )
      if (retry.rows.length > 0) {
        return retry.rows[0]
      }
      throw new ForbiddenException({
        statusCode: 403,
        error: "Forbidden",
        code: EMAIL_ALREADY_LINKED_CODE,
        message: "This email address already belongs to another account",
      })
    }
  }

  private async fetchUserInfo(
    token: string,
  ): Promise<{ email?: string; name?: string; nickname?: string; email_verified?: boolean }> {
    // D-06: one timeout covers the headers and the body, which is awaited here
    // while the same signal is still armed.
    const response = await fetch(`https://${this.publicDomain}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(this.httpTimeoutMs),
    })
    if (!response.ok) throw new Error("Failed to fetch Auth0 userinfo")
    return (await response.json()) as {
      email?: string
      name?: string
      nickname?: string
      email_verified?: boolean
    }
  }
}
