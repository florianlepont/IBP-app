import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { Request } from "express"
import * as jwt from "jsonwebtoken"
import { JwksClient } from "jwks-rsa"
import { DatabaseService } from "../database/database.service"
import { AuthenticatedUser } from "./auth.types"

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? ""
const AUTH0_PUBLIC_DOMAIN = process.env.AUTH0_PUBLIC_DOMAIN?.trim() || AUTH0_DOMAIN
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE ?? ""
const AUTH0_JWKS_DOMAINS = Array.from(new Set([AUTH0_PUBLIC_DOMAIN, AUTH0_DOMAIN].filter(Boolean)))
const AUTH0_ACCEPTED_ISSUERS = Array.from(
  new Set(AUTH0_JWKS_DOMAINS.map((domain) => `https://${domain}/`)),
)

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwksClients: JwksClient[]

  constructor(private readonly db: DatabaseService) {
    this.jwksClients = AUTH0_JWKS_DOMAINS.map(
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
      if (process.env.NODE_ENV === "test") {
        const user = await this.verifyTestToken(token)
        request.user = user
        return true
      }
      const payload = await this.verifyToken(token)
      const user = await this.getOrProvisionUser(payload, token)
      request.user = user
      return true
    } catch (err) {
      console.error("[AuthGuard] Token validation failed:", err)
      throw new UnauthorizedException()
    }
  }

  private async verifyTestToken(token: string): Promise<AuthenticatedUser> {
    const secret = process.env.ACCESS_TOKEN_SECRET
    if (!secret) throw new Error("ACCESS_TOKEN_SECRET not set")
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
              audience: AUTH0_AUDIENCE,
              issuer: AUTH0_ACCEPTED_ISSUERS,
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

    // Check if a user with this email already exists (migration case)
    const byEmail = await this.db.query<AuthenticatedUser>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users WHERE email = $1`,
      [email],
    )

    if (byEmail.rows.length > 0) {
      // Link existing user to Auth0
      await this.db.query(`UPDATE users SET auth0_sub = $1 WHERE email = $2`, [auth0Sub, email])
      return byEmail.rows[0]
    }

    const inserted = await this.db.query<AuthenticatedUser>(
      `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
       VALUES (gen_random_uuid(), $1, $2, $3, '', '', 'contributor')
       RETURNING id, auth0_sub, email, role, first_name, last_name, display_name, profile_picture_url`,
      [auth0Sub, email, displayName],
    )

    return inserted.rows[0]
  }

  private async fetchUserInfo(
    token: string,
  ): Promise<{ email?: string; name?: string; nickname?: string }> {
    const response = await fetch(`https://${AUTH0_PUBLIC_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error("Failed to fetch Auth0 userinfo")
    return response.json() as Promise<{ email?: string; name?: string; nickname?: string }>
  }
}
