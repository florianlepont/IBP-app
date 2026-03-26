import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { Request } from "express"
import * as jwt from "jsonwebtoken"
import jwksClient from "jwks-rsa"
import { DatabaseService } from "../database/database.service"
import { AuthenticatedUser } from "./auth.types"

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN ?? ""
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE ?? ""

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof jwksClient>

  constructor(private readonly db: DatabaseService) {
    this.jwks = jwksClient({
      jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
    })
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>()
    const header = request.headers.authorization

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token")
    }

    const token = header.slice(7)
    try {
      const payload = await this.verifyToken(token)
      const user = await this.getOrProvisionUser(payload, token)
      request.user = user
      return true
    } catch {
      throw new UnauthorizedException()
    }
  }

  private verifyToken(token: string): Promise<jwt.JwtPayload> {
    return new Promise((resolve, reject) => {
      const decoded = jwt.decode(token, { complete: true })
      if (!decoded?.header?.kid) {
        return reject(new Error("Missing kid in token header"))
      }

      this.jwks.getSigningKey(decoded.header.kid, (err, key) => {
        if (err || !key) return reject(err ?? new Error("No signing key found"))

        jwt.verify(
          token,
          key.getPublicKey(),
          {
            audience: AUTH0_AUDIENCE,
            issuer: `https://${AUTH0_DOMAIN}/`,
            algorithms: ["RS256"],
          },
          (verifyErr, verified) => {
            if (verifyErr) return reject(verifyErr)
            resolve(verified as jwt.JwtPayload)
          },
        )
      })
    })
  }

  private async getOrProvisionUser(
    payload: jwt.JwtPayload,
    rawToken: string,
  ): Promise<AuthenticatedUser> {
    const auth0Sub = payload.sub
    if (!auth0Sub) throw new Error("Missing sub claim")

    const existing = await this.db.query<AuthenticatedUser>(
      `SELECT id, email, role, first_name, last_name, display_name, profile_picture_url
       FROM users WHERE auth0_sub = $1`,
      [auth0Sub],
    )

    if (existing.rows.length > 0) {
      return existing.rows[0]
    }

    // First login: fetch user info from Auth0 and create DB record
    const userInfo = await this.fetchUserInfo(rawToken)
    const email = userInfo.email ?? `user+${auth0Sub.replace(/[^a-zA-Z0-9]/g, "")}@unknown`
    const displayName = userInfo.nickname ?? userInfo.name ?? email.split("@")[0]

    const inserted = await this.db.query<AuthenticatedUser>(
      `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
       VALUES (gen_random_uuid(), $1, $2, $3, '', '', 'contributor')
       RETURNING id, email, role, first_name, last_name, display_name, profile_picture_url`,
      [auth0Sub, email, displayName],
    )

    return inserted.rows[0]
  }

  private async fetchUserInfo(
    token: string,
  ): Promise<{ email?: string; name?: string; nickname?: string }> {
    const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error("Failed to fetch Auth0 userinfo")
    return response.json() as Promise<{ email?: string; name?: string; nickname?: string }>
  }
}
