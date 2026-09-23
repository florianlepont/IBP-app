import { createHash } from "crypto"
import { Injectable } from "@nestjs/common"
import { ThrottlerGuard } from "@nestjs/throttler"

// The global APP_GUARD throttler runs BEFORE the controller-scoped AuthGuard, so
// req.user is never available here (RESEARCH Pitfall 2). The bearer token is
// hashed only to bucket requests, never decoded or verified (D-05) — the "ip"
// ceiling throttler (see rate-limit.config.ts) is what stops fake-token rotation.

export function clientTracker(req: Record<string, unknown>): string {
  const headers = req.headers as Record<string, unknown> | undefined
  const authHeader = headers?.authorization
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token.length > 0) {
      return `token:${createHash("sha256").update(token).digest("hex")}`
    }
  }
  const ip = typeof req.ip === "string" ? req.ip : "unknown"
  return `ip:${ip}`
}

export function ipTracker(req: Record<string, unknown>): string {
  const ip = typeof req.ip === "string" ? req.ip : "unknown"
  return `ip:${ip}`
}

@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientTracker(req)
  }
}
