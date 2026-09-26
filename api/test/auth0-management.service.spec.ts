import { BadRequestException, InternalServerErrorException, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Auth0ManagementService } from "../src/auth/auth0-management.service"
import { buildTestConfig, buildTestConfigService } from "./config-helper"

const AUTH0_TEST_ENV = {
  AUTH0_DOMAIN: "tenant.example.auth0.com",
  AUTH0_MGMT_CLIENT_ID: "test-mgmt-client-id",
  AUTH0_MGMT_CLIENT_SECRET: "test-mgmt-client-secret",
  AUTH0_APP_CLIENT_ID: "test-app-client-id",
}

/** Same config as the tests, but with nodeEnv production (buildTestConfig forces test). */
function productionConfigService(overrides: Record<string, string | undefined>): ConfigService {
  const app = buildTestConfig({ ...AUTH0_TEST_ENV, ...overrides })
  return new ConfigService({ app: { ...app, nodeEnv: "production", isProduction: true } })
}

function buildService() {
  const service = new Auth0ManagementService(buildTestConfigService(AUTH0_TEST_ENV))
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
    jest.restoreAllMocks()
  })

  describe("startup warning (D-02)", () => {
    it("warns once in production when AUTH0_MGMT_CLIENT_SECRET is empty, without throwing", () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)

      expect(
        () => new Auth0ManagementService(productionConfigService({ AUTH0_MGMT_CLIENT_SECRET: "" })),
      ).not.toThrow()

      expect(warn).toHaveBeenCalledTimes(1)
      const message = String(warn.mock.calls[0][0])
      expect(message).toContain("AUTH0_MGMT_CLIENT_ID")
      expect(message).toContain("AUTH0_MGMT_CLIENT_SECRET")
    })

    it("warns in production when AUTH0_MGMT_CLIENT_ID is a placeholder", () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)

      new Auth0ManagementService(productionConfigService({ AUTH0_MGMT_CLIENT_ID: "change-me" }))

      expect(warn).toHaveBeenCalledTimes(1)
    })

    it("does not warn in production when both values are set", () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)

      new Auth0ManagementService(productionConfigService({}))

      expect(warn).not.toHaveBeenCalled()
    })

    it("does not warn outside production, even when the values are empty", () => {
      const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)

      new Auth0ManagementService(
        buildTestConfigService({ AUTH0_MGMT_CLIENT_ID: "", AUTH0_MGMT_CLIENT_SECRET: "" }),
      )

      expect(warn).not.toHaveBeenCalled()
    })
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
