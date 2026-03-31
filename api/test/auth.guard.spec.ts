import { UnauthorizedException } from "@nestjs/common"
import * as jwt from "jsonwebtoken"
import { AuthGuard } from "../src/auth/auth.guard"

const TEST_SECRET = "test-secret-for-unit"

const AUTH_USER = {
  id: "user-1",
  auth0_sub: "auth0|user-1",
  email: "user@example.com",
  role: "contributor",
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

function buildGuard() {
  const db = { query: jest.fn() }
  const guard = new AuthGuard(db as never)
  return { guard, db }
}

function makeToken(userId: string, secret = TEST_SECRET) {
  return jwt.sign({ sub: userId }, secret, { algorithm: "HS256" })
}

function makeContext(token?: string) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: { authorization: token ? `Bearer ${token}` : undefined },
  }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  } as never
}

describe("AuthGuard", () => {
  let originalSecret: string | undefined

  beforeEach(() => {
    originalSecret = process.env.ACCESS_TOKEN_SECRET
    process.env.ACCESS_TOKEN_SECRET = TEST_SECRET
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env.ACCESS_TOKEN_SECRET = originalSecret
  })

  it("throws UnauthorizedException when Authorization header is missing", async () => {
    const { guard } = buildGuard()
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("throws UnauthorizedException when header does not start with Bearer", async () => {
    const { guard } = buildGuard()
    const context = makeContext()
    ;(context as unknown as { request: { headers: Record<string, string> } }).request.headers[
      "authorization"
    ] = "Basic abc123"
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("returns true and attaches user to request when token is valid", async () => {
    const { guard, db } = buildGuard()
    db.query.mockResolvedValueOnce({ rows: [AUTH_USER] })
    const token = makeToken(AUTH_USER.id)
    const context = makeContext(token)

    const result = await guard.canActivate(context)

    expect(result).toBe(true)
    expect(
      (context as unknown as { request: { user: unknown } }).request.user,
    ).toEqual(AUTH_USER)
  })

  it("throws UnauthorizedException when user is not found in DB", async () => {
    const { guard, db } = buildGuard()
    db.query.mockResolvedValueOnce({ rows: [] })
    const token = makeToken("unknown-id")

    await expect(guard.canActivate(makeContext(token))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("throws UnauthorizedException when token is signed with wrong secret", async () => {
    const { guard } = buildGuard()
    const token = makeToken(AUTH_USER.id, "wrong-secret")

    await expect(guard.canActivate(makeContext(token))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("throws UnauthorizedException when ACCESS_TOKEN_SECRET is not set", async () => {
    delete process.env.ACCESS_TOKEN_SECRET
    const { guard } = buildGuard()
    const token = makeToken(AUTH_USER.id)

    await expect(guard.canActivate(makeContext(token))).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
