import { ThrottlerModuleOptions } from "@nestjs/throttler"
import { ipTracker } from "../auth/throttler.guard"
import { currentNodeEnv } from "../config/app-config"

/** Shared window for every named throttler in this module (D-06). */
export const THROTTLE_TTL_MS = 60_000

/**
 * Production per-client request ceilings, sized for a full offline field day:
 * one POST /sync batch per drain with a 15s auto-sync cooldown, at most two
 * upload-route calls per photo (uploads are bandwidth-bound, well below 240/min).
 */
export const PRODUCTION_THROTTLE_LIMITS = {
  default: 600,
  ipCeiling: 3000,
  sync: 60,
  upload: 240,
} as const

/** Outside production every limit resolves to this so existing E2E suites are unaffected. */
export const NON_PRODUCTION_THROTTLE_LIMIT = 10_000

export type ThrottleKind = keyof typeof PRODUCTION_THROTTLE_LIMITS

/**
 * Evaluated lazily, per request, from the throttler options below (they are
 * built at decorator time, before ConfigService exists), so the default reads
 * NODE_ENV through `currentNodeEnv()` (D-01).
 */
export function resolveThrottleLimit(
  kind: ThrottleKind,
  nodeEnv: string = currentNodeEnv(),
): number {
  if (nodeEnv === "production") {
    return PRODUCTION_THROTTLE_LIMITS[kind]
  }
  return NON_PRODUCTION_THROTTLE_LIMIT
}

export function buildThrottlerOptions(overrides?: {
  defaultLimit?: number
  ipCeilingLimit?: number
}): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: "default",
        ttl: THROTTLE_TTL_MS,
        limit: overrides?.defaultLimit ?? (() => resolveThrottleLimit("default")),
      },
      {
        name: "ip",
        ttl: THROTTLE_TTL_MS,
        limit: overrides?.ipCeilingLimit ?? (() => resolveThrottleLimit("ipCeiling")),
        getTracker: ipTracker,
      },
    ],
  }
}

/** Overrides only the "default" throttler on /sync POST; the "ip" ceiling still applies. */
export const SYNC_THROTTLE = {
  default: { ttl: THROTTLE_TTL_MS, limit: () => resolveThrottleLimit("sync") },
}

/** Overrides only the "default" throttler on upload routes; the "ip" ceiling still applies. */
export const UPLOAD_THROTTLE = {
  default: { ttl: THROTTLE_TTL_MS, limit: () => resolveThrottleLimit("upload") },
}
