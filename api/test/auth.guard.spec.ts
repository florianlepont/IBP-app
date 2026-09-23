import { ForbiddenException, UnauthorizedException } from "@nestjs/common"
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
    expect((context as unknown as { request: { user: unknown } }).request.user).toEqual(AUTH_USER)
  })

  it("throws UnauthorizedException when user is not found in DB", async () => {
    const { guard, db } = buildGuard()
    db.query.mockResolvedValueOnce({ rows: [] })
    const token = makeToken("unknown-id")

    await expect(guard.canActivate(makeContext(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it("throws UnauthorizedException when token is signed with wrong secret", async () => {
    const { guard } = buildGuard()
    const token = makeToken(AUTH_USER.id, "wrong-secret")

    await expect(guard.canActivate(makeContext(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it("throws UnauthorizedException when ACCESS_TOKEN_SECRET is not set", async () => {
    delete process.env.ACCESS_TOKEN_SECRET
    const { guard } = buildGuard()
    const token = makeToken(AUTH_USER.id)

    await expect(guard.canActivate(makeContext(token))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})

describe("canActivate with Auth0 tokens (WR-04)", () => {
  let originalNodeEnv: string | undefined

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
  })

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    jest.restoreAllMocks()
  })

  it("refusing to link an email returns 403 email_already_linked, not 401", async () => {
    const { guard, db } = buildGuard()
    jest
      .spyOn(guard as unknown as { verifyToken: () => Promise<unknown> }, "verifyToken")
      .mockResolvedValue({ sub: "auth0|attacker" })
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ email: AUTH_USER.email, email_verified: false }),
    } as Response)
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" })) // INSERT
      .mockResolvedValueOnce({ rows: [] }) // re-SELECT by auth0_sub

    const error = await guard.canActivate(makeContext("rs256-token")).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ForbiddenException)
    expect((error as ForbiddenException).getStatus()).toBe(403)
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: "email_already_linked",
    })
  })

  it("an invalid token is still a 401", async () => {
    const { guard } = buildGuard()
    jest
      .spyOn(guard as unknown as { verifyToken: () => Promise<unknown> }, "verifyToken")
      .mockRejectedValue(new Error("jwt expired"))

    await expect(guard.canActivate(makeContext("rs256-token"))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })
})

describe("getOrProvisionUser", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function invoke(guard: AuthGuard, payload: Record<string, unknown>, rawToken = "raw-token") {
    return (
      guard as unknown as {
        getOrProvisionUser: (payload: Record<string, unknown>, rawToken: string) => Promise<unknown>
      }
    ).getOrProvisionUser(payload, rawToken)
  }

  function mockFetchUserInfo(userInfo: Record<string, unknown>) {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => userInfo,
    } as Response)
  }

  it("returns the existing row and never calls fetch when the sub is already known", async () => {
    const { guard, db } = buildGuard()
    const fetchSpy = jest.spyOn(global, "fetch")
    db.query.mockResolvedValueOnce({ rows: [AUTH_USER] })

    const result = await invoke(guard, { sub: AUTH_USER.auth0_sub })

    expect(result).toEqual(AUTH_USER)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("links to the existing email row when email_verified is true", async () => {
    const { guard, db } = buildGuard()
    mockFetchUserInfo({ email: AUTH_USER.email, email_verified: true })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub
      .mockResolvedValueOnce({ rows: [AUTH_USER] }) // UPDATE ... RETURNING

    const result = await invoke(guard, { sub: "auth0|new-sub" })

    expect(result).toEqual(AUTH_USER)
    const updateCall = db.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("UPDATE users"),
    )
    expect(updateCall).toBeDefined()
    expect(updateCall?.[0]).toContain("SET auth0_sub = $1 WHERE email = $2 AND auth0_sub IS NULL")
    expect(updateCall?.[1]).toEqual(["auth0|new-sub", AUTH_USER.email])
  })

  const emailTaken = () => Object.assign(new Error("duplicate key (email)"), { code: "23505" })

  it("rejects linking when email_verified is false and the email already exists", async () => {
    const { guard, db } = buildGuard()
    mockFetchUserInfo({ email: AUTH_USER.email, email_verified: false })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub
      .mockRejectedValueOnce(emailTaken()) // INSERT trips the email UNIQUE index
      .mockResolvedValueOnce({ rows: [] }) // re-SELECT by auth0_sub: not our row

    await expect(invoke(guard, { sub: "auth0|new-sub" })).rejects.toThrow()
    const updateCall = db.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("UPDATE users"),
    )
    expect(updateCall).toBeUndefined()
  })

  it("rejects linking when email_verified is absent and the email already exists", async () => {
    const { guard, db } = buildGuard()
    mockFetchUserInfo({ email: AUTH_USER.email })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub
      .mockRejectedValueOnce(emailTaken()) // INSERT trips the email UNIQUE index
      .mockResolvedValueOnce({ rows: [] }) // re-SELECT by auth0_sub: not our row

    await expect(invoke(guard, { sub: "auth0|new-sub" })).rejects.toThrow()
    const updateCall = db.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("UPDATE users"),
    )
    expect(updateCall).toBeUndefined()
  })

  it("inserts a new user via ON CONFLICT (auth0_sub) when no row exists with that email", async () => {
    const { guard, db } = buildGuard()
    mockFetchUserInfo({ email: "brand-new@example.com", email_verified: true })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub
      .mockResolvedValueOnce({ rows: [] }) // no email match branch is skipped for verified+no-row... see INSERT
      .mockResolvedValueOnce({ rows: [AUTH_USER] }) // INSERT ... RETURNING

    const result = await invoke(guard, { sub: "auth0|brand-new" })

    expect(result).toEqual(AUTH_USER)
    const insertCall = db.query.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes("ON CONFLICT (auth0_sub)"),
    )
    expect(insertCall).toBeDefined()
  })

  it("re-selects by auth0_sub when INSERT raises 23505 from a concurrent insert, and resolves", async () => {
    const { guard, db } = buildGuard()
    mockFetchUserInfo({ email: "racer@example.com", email_verified: true })
    const conflictError = Object.assign(new Error("duplicate key"), { code: "23505" })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub (first)
      .mockResolvedValueOnce({ rows: [] }) // UPDATE ... RETURNING (no matching email row)
      .mockRejectedValueOnce(conflictError) // INSERT ... ON CONFLICT (auth0_sub) races with another insert
      .mockResolvedValueOnce({ rows: [AUTH_USER] }) // re-SELECT by auth0_sub

    const result = await invoke(guard, { sub: "auth0|racer" })

    expect(result).toEqual(AUTH_USER)
  })

  it("WR-02: an unverified first login racing its twin for the same sub returns the twin's row", async () => {
    const { guard, db } = buildGuard()
    const ownRow = { ...AUTH_USER, auth0_sub: "auth0|twin" }
    mockFetchUserInfo({ email: AUTH_USER.email, email_verified: false })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub (before the twin inserted)
      .mockRejectedValueOnce(emailTaken()) // INSERT: the twin's row now holds the email
      .mockResolvedValueOnce({ rows: [ownRow] }) // re-SELECT by auth0_sub finds the twin's row

    await expect(invoke(guard, { sub: "auth0|twin" })).resolves.toEqual(ownRow)
    const emailLookup = db.query.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && /WHERE email = \$1/.test(call[0]),
    )
    expect(emailLookup).toBeUndefined()
  })

  it("rejects when INSERT raises 23505 and the re-select finds no row", async () => {
    const { guard, db } = buildGuard()
    mockFetchUserInfo({ email: "racer2@example.com", email_verified: true })
    const conflictError = Object.assign(new Error("duplicate key"), { code: "23505" })
    db.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT by auth0_sub (first)
      .mockResolvedValueOnce({ rows: [] }) // UPDATE ... RETURNING (no matching email row)
      .mockRejectedValueOnce(conflictError) // INSERT ... ON CONFLICT (auth0_sub)
      .mockResolvedValueOnce({ rows: [] }) // re-SELECT by auth0_sub finds nothing

    await expect(invoke(guard, { sub: "auth0|racer2" })).rejects.toThrow()
  })
})
