import {
  NON_PRODUCTION_THROTTLE_LIMIT,
  PRODUCTION_THROTTLE_LIMITS,
  THROTTLE_TTL_MS,
  buildThrottlerOptions,
  resolveThrottleLimit,
} from "../src/common/rate-limit.config"
import { ipTracker } from "../src/auth/throttler.guard"

describe("rate-limit.config", () => {
  describe("resolveThrottleLimit", () => {
    it("returns the production values in production", () => {
      expect(resolveThrottleLimit("default", { NODE_ENV: "production" })).toBe(600)
      expect(resolveThrottleLimit("ipCeiling", { NODE_ENV: "production" })).toBe(3000)
      expect(resolveThrottleLimit("sync", { NODE_ENV: "production" })).toBe(60)
      expect(resolveThrottleLimit("upload", { NODE_ENV: "production" })).toBe(240)
    })

    it("returns the non-production ceiling for every kind outside production", () => {
      const kinds: Array<keyof typeof PRODUCTION_THROTTLE_LIMITS> = [
        "default",
        "ipCeiling",
        "sync",
        "upload",
      ]
      for (const kind of kinds) {
        expect(resolveThrottleLimit(kind, { NODE_ENV: "test" })).toBe(NON_PRODUCTION_THROTTLE_LIMIT)
        expect(resolveThrottleLimit(kind, { NODE_ENV: "development" })).toBe(
          NON_PRODUCTION_THROTTLE_LIMIT,
        )
        expect(resolveThrottleLimit(kind, {})).toBe(NON_PRODUCTION_THROTTLE_LIMIT)
      }
    })
  })

  describe("buildThrottlerOptions", () => {
    it("returns exactly two named throttlers with the shared ttl", () => {
      const options = buildThrottlerOptions() as {
        throttlers: Array<{ name?: string; ttl: unknown; getTracker?: unknown }>
      }

      expect(options.throttlers).toHaveLength(2)
      const names = options.throttlers.map((t) => t.name)
      expect(names).toEqual(["default", "ip"])
      for (const throttler of options.throttlers) {
        expect(throttler.ttl).toBe(THROTTLE_TTL_MS)
      }
      const ipThrottler = options.throttlers.find((t) => t.name === "ip")
      expect(ipThrottler?.getTracker).toBe(ipTracker)
    })

    it("accepts numeric overrides for the default and ip-ceiling limits", () => {
      const options = buildThrottlerOptions({ defaultLimit: 3, ipCeilingLimit: 5 }) as {
        throttlers: Array<{ name?: string; limit: unknown }>
      }

      const defaultThrottler = options.throttlers.find((t) => t.name === "default")
      const ipThrottler = options.throttlers.find((t) => t.name === "ip")
      expect(defaultThrottler?.limit).toBe(3)
      expect(ipThrottler?.limit).toBe(5)
    })
  })
})
