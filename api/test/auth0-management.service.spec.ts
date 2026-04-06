import { BadRequestException, InternalServerErrorException } from "@nestjs/common"
import { Auth0ManagementService } from "../src/auth/auth0-management.service"

function buildService() {
  const service = new Auth0ManagementService()
  // Reset token cache
  ;(service as unknown as Record<string, unknown>).cachedToken = null
  ;(service as unknown as Record<string, unknown>).tokenExpiresAt = 0
  return service
}

function mockTokenFetch() {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ access_token: "mgmt-token", expires_in: 3600 }),
  }
}

describe("Auth0ManagementService", () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe("getManagementToken caching", () => {
    it("fetches a new token when cache is empty", async () => {
      const service = buildService()
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockTokenFetch())
        .mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn() })

      await service.updateEmail("auth0|user-1", "new@example.com")

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it("reuses cached token without re-fetching", async () => {
      const service = buildService()
      ;(service as unknown as Record<string, unknown>).cachedToken = "cached-token"
      ;(service as unknown as Record<string, unknown>).tokenExpiresAt = Date.now() + 100_000

      global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn() })

      await service.updateEmail("auth0|user-1", "new@example.com")

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect((global.fetch as jest.Mock).mock.calls[0][1]).toMatchObject({
        method: "PATCH",
      })
    })

    it("throws InternalServerErrorException when token endpoint fails", async () => {
      const service = buildService()
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 401 })

      await expect(service.updateEmail("auth0|user-1", "new@example.com")).rejects.toBeInstanceOf(
        InternalServerErrorException,
      )
    })
  })

  describe("updateEmail", () => {
    it("updates email on Auth0 successfully", async () => {
      const service = buildService()
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockTokenFetch())
        .mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn() })

      await expect(service.updateEmail("auth0|user-1", "new@example.com")).resolves.toBeUndefined()
    })

    it("throws BadRequestException on 409 conflict", async () => {
      const service = buildService()
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockTokenFetch())
        .mockResolvedValueOnce({ ok: false, status: 409, json: jest.fn().mockResolvedValue({}) })

      await expect(service.updateEmail("auth0|user-1", "taken@example.com")).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })

    it("throws InternalServerErrorException on other Auth0 errors", async () => {
      const service = buildService()
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockTokenFetch())
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: jest.fn().mockResolvedValue({ message: "unexpected error" }),
        })

      await expect(service.updateEmail("auth0|user-1", "new@example.com")).rejects.toBeInstanceOf(
        InternalServerErrorException,
      )
    })

    it("encodes the auth0_sub in the URL", async () => {
      const service = buildService()
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockTokenFetch())
        .mockResolvedValueOnce({ ok: true, status: 200, json: jest.fn() })

      await service.updateEmail("auth0|user-1", "new@example.com")

      const patchCall = (global.fetch as jest.Mock).mock.calls[1]
      expect(patchCall[0]).toContain("auth0%7Cuser-1")
    })
  })

  describe("sendPasswordResetEmail", () => {
    it("sends password reset email successfully", async () => {
      const service = buildService()
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200 })

      await expect(service.sendPasswordResetEmail("user@example.com")).resolves.toBeUndefined()
    })

    it("throws InternalServerErrorException on failure", async () => {
      const service = buildService()
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 400 })

      await expect(service.sendPasswordResetEmail("user@example.com")).rejects.toBeInstanceOf(
        InternalServerErrorException,
      )
    })

    it("sends the correct email in the request body", async () => {
      const service = buildService()
      global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200 })

      await service.sendPasswordResetEmail("user@example.com")

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string)
      expect(body.email).toBe("user@example.com")
      expect(body.connection).toBe("Username-Password-Authentication")
    })
  })
})
