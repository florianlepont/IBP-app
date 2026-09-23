import { createHash } from "crypto"
import { ClientAwareThrottlerGuard, clientTracker, ipTracker } from "../src/auth/throttler.guard"

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

describe("throttler.guard", () => {
  describe("clientTracker", () => {
    it("keys on a hash of the bearer token when present", () => {
      const tracker = clientTracker({ headers: { authorization: "Bearer abc" }, ip: "1.2.3.4" })
      expect(tracker).toBe(`token:${sha256hex("abc")}`)
    })

    it("produces different tracker strings for different tokens, and stable ones for the same token", () => {
      const a1 = clientTracker({ headers: { authorization: "Bearer token-a" }, ip: "1.2.3.4" })
      const a2 = clientTracker({ headers: { authorization: "Bearer token-a" }, ip: "9.9.9.9" })
      const b = clientTracker({ headers: { authorization: "Bearer token-b" }, ip: "1.2.3.4" })

      expect(a1).toBe(a2)
      expect(a1).not.toBe(b)
    })

    it("falls back to the ip form when there is no authorization header", () => {
      expect(clientTracker({ headers: {}, ip: "1.2.3.4" })).toBe("ip:1.2.3.4")
    })

    it("falls back to the ip form for non-bearer or empty-token authorization headers", () => {
      expect(clientTracker({ headers: { authorization: "Basic xyz" }, ip: "1.2.3.4" })).toBe(
        "ip:1.2.3.4",
      )
      expect(clientTracker({ headers: { authorization: "Bearer " }, ip: "1.2.3.4" })).toBe(
        "ip:1.2.3.4",
      )
    })

    it("returns ip:unknown when there is no ip property", () => {
      expect(clientTracker({ headers: {} })).toBe("ip:unknown")
    })
  })

  describe("ipTracker", () => {
    it("always keys on the client ip, ignoring any bearer token", () => {
      const tracker = ipTracker({ headers: { authorization: "Bearer abc" }, ip: "1.2.3.4" })
      expect(tracker).toBe("ip:1.2.3.4")
    })

    it("returns ip:unknown when there is no ip property", () => {
      expect(ipTracker({ headers: {} })).toBe("ip:unknown")
    })
  })

  describe("ClientAwareThrottlerGuard", () => {
    it("delegates getTracker to clientTracker", async () => {
      const guard = Object.create(ClientAwareThrottlerGuard.prototype) as ClientAwareThrottlerGuard
      const req = { headers: { authorization: "Bearer abc" }, ip: "1.2.3.4" }

      const tracker = await (
        guard as unknown as { getTracker(r: Record<string, unknown>): Promise<string> }
      ).getTracker(req)

      expect(tracker).toBe(clientTracker(req))
    })
  })
})
