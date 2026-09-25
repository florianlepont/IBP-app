import { Logger, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import "reflect-metadata"
import * as jwt from "jsonwebtoken"
import { AuthGuard } from "../src/auth/auth.guard"
import { getTestTokenSecret } from "../src/debug/test-token-secret"
import { buildTestConfig } from "./config-helper"
import { isDebugSurfaceEnabled } from "../src/debug/debug-gating"

describe("isDebugSurfaceEnabled", () => {
  it("is false when NODE_ENV is production", () => {
    expect(isDebugSurfaceEnabled({ NODE_ENV: "production" })).toBe(false)
  })

  it("is true when NODE_ENV is test", () => {
    expect(isDebugSurfaceEnabled({ NODE_ENV: "test" })).toBe(true)
  })

  it("is true when NODE_ENV is development", () => {
    expect(isDebugSurfaceEnabled({ NODE_ENV: "development" })).toBe(true)
  })

  it("is true when NODE_ENV is unset", () => {
    expect(isDebugSurfaceEnabled({})).toBe(true)
  })
})

describe("AppModule DebugModule gating by NODE_ENV", () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it("does not include DebugModule in imports when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production"

    await jest.isolateModulesAsync(async () => {
      const { AppModule } = await import("../src/app.module")
      const { DebugModule } = await import("../src/debug/debug.module")

      const imports = Reflect.getMetadata("imports", AppModule) as unknown[]
      expect(imports).not.toContain(DebugModule)
    })
  })

  it("includes DebugModule in imports when NODE_ENV=test", async () => {
    process.env.NODE_ENV = "test"

    await jest.isolateModulesAsync(async () => {
      const { AppModule } = await import("../src/app.module")
      const { DebugModule } = await import("../src/debug/debug.module")

      const imports = Reflect.getMetadata("imports", AppModule) as unknown[]
      expect(imports).toContain(DebugModule)
    })
  })
})

describe("AuthGuard HS256 branch stays closed in production", () => {
  it("rejects an HS256 token signed with the test secret and never queries the DB", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const db = { query: jest.fn() }
    const config = new ConfigService({
      app: { ...buildTestConfig(), nodeEnv: "production", isProduction: true },
    })
    const guard = new AuthGuard(db as never, config)
    const token = jwt.sign({ sub: "user-1" }, getTestTokenSecret("test") as string, {
      algorithm: "HS256",
    })
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: `Bearer ${token}` },
    }
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(db.query).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})
