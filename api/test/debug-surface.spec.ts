import { UnauthorizedException } from "@nestjs/common"
import "reflect-metadata"
import * as jwt from "jsonwebtoken"
import { AuthGuard } from "../src/auth/auth.guard"
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
  const originalNodeEnv = process.env.NODE_ENV
  const originalSecret = process.env.ACCESS_TOKEN_SECRET
  const TEST_SECRET = "prod-gate-test-secret"

  beforeEach(() => {
    process.env.NODE_ENV = "production"
    process.env.ACCESS_TOKEN_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    process.env.ACCESS_TOKEN_SECRET = originalSecret
  })

  it("rejects an HS256 token signed with ACCESS_TOKEN_SECRET and never queries the DB", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
    const db = { query: jest.fn() }
    const guard = new AuthGuard(db as never)
    const token = jwt.sign({ sub: "user-1" }, TEST_SECRET, { algorithm: "HS256" })
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: `Bearer ${token}` },
    }
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(db.query).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})
