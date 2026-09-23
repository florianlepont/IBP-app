import "dotenv/config"
import { AuthGuard } from "../src/auth/auth.guard"
import { DatabaseService } from "../src/database/database.service"

/**
 * First-login provisioning against a real PostgreSQL (D-08 / D-09).
 *
 * getOrProvisionUser is private; it is invoked directly because the E2E app
 * runs with NODE_ENV=test, where canActivate takes the HS256 test-token path.
 * Auth0 /userinfo is mocked through global fetch.
 */
type ProvisionedUser = { id: string; auth0_sub: string | null; email: string }

function provision(guard: AuthGuard, sub: string): Promise<ProvisionedUser> {
  return (
    guard as unknown as {
      getOrProvisionUser: (payload: { sub: string }, rawToken: string) => Promise<ProvisionedUser>
    }
  ).getOrProvisionUser({ sub }, `raw-token-${sub}`)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("Auth0 first-login provisioning (e2e, real DB)", () => {
  const db = new DatabaseService()
  const guard = new AuthGuard(db)
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const createdEmails: string[] = []

  function uniqueEmail(label: string): string {
    const email = `prov-${label}-${runId}@ibp.local`
    createdEmails.push(email)
    return email
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await db.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [createdEmails])
    await db.onModuleDestroy()
  })

  it("WR-02: two concurrent first logins for the same sub with an unverified email both resolve to the same user", async () => {
    const email = uniqueEmail("race-unverified")
    const sub = `auth0|race-unverified-${runId}`
    let userInfoCalls = 0
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      userInfoCalls += 1
      // The second request's /userinfo answers after the first request has
      // already inserted the row, so it then sees "its own" row by email.
      if (userInfoCalls > 1) {
        await delay(150)
      }
      return {
        ok: true,
        json: async () => ({ email, email_verified: false }),
      } as Response
    })

    const [first, second] = await Promise.all([provision(guard, sub), provision(guard, sub)])

    expect(first.auth0_sub).toBe(sub)
    expect(second.id).toBe(first.id)
    const rows = await db.query(`SELECT id FROM users WHERE email = $1`, [email])
    expect(rows.rows).toHaveLength(1)
  })

  it("WR-02: a user with no email claim is provisioned with a synthetic email, concurrently", async () => {
    const sub = `auth0|no-email-${runId}`
    createdEmails.push(`user+${sub.replace(/[^a-zA-Z0-9]/g, "")}@unknown`)
    let userInfoCalls = 0
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      userInfoCalls += 1
      if (userInfoCalls > 1) {
        await delay(150)
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    const [first, second] = await Promise.all([provision(guard, sub), provision(guard, sub)])

    expect(second.id).toBe(first.id)
  })

  it("WR-03: a verified email links a pre-Auth0 (unlinked) account", async () => {
    const email = uniqueEmail("verified-unlinked")
    const legacy = await db.query<{ id: string }>(
      `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
       VALUES (gen_random_uuid(), NULL, $1, 'legacy', '', '', 'contributor') RETURNING id`,
      [email],
    )
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ email, email_verified: true }),
    } as Response)
    const sub = `google-oauth2|${runId}`

    const user = await provision(guard, sub)

    expect(user.id).toBe(legacy.rows[0].id)
    expect(user.auth0_sub).toBe(sub)
  })

  it("WR-03: a verified email never re-points an account already linked to another sub", async () => {
    const email = uniqueEmail("verified-linked")
    const originalSub = `auth0|original-${runId}`
    const owner = await db.query<{ id: string }>(
      `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
       VALUES (gen_random_uuid(), $1, $2, 'owner', '', '', 'contributor') RETURNING id`,
      [originalSub, email],
    )
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ email, email_verified: true }),
    } as Response)

    await expect(provision(guard, `google-oauth2|other-${runId}`)).rejects.toThrow()

    const row = await db.query<{ auth0_sub: string | null }>(
      `SELECT auth0_sub FROM users WHERE id = $1`,
      [owner.rows[0].id],
    )
    expect(row.rows[0].auth0_sub).toBe(originalSub)
    // The original identity still resolves to its account.
    await expect(provision(guard, originalSub)).resolves.toMatchObject({ id: owner.rows[0].id })
  })

  it("WR-03: concurrent verified first logins for the same sub both resolve to the same user", async () => {
    const email = uniqueEmail("race-verified")
    const sub = `google-oauth2|race-${runId}`
    let userInfoCalls = 0
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      userInfoCalls += 1
      if (userInfoCalls > 1) {
        await delay(150)
      }
      return { ok: true, json: async () => ({ email, email_verified: true }) } as Response
    })

    const [first, second] = await Promise.all([provision(guard, sub), provision(guard, sub)])

    expect(second.id).toBe(first.id)
  })

  it("never links an unverified email to an existing account", async () => {
    const email = uniqueEmail("unverified-existing")
    const owner = await db.query<{ id: string }>(
      `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
       VALUES (gen_random_uuid(), NULL, $1, 'owner', '', '', 'contributor') RETURNING id`,
      [email],
    )
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ email, email_verified: false }),
    } as Response)

    await expect(provision(guard, `auth0|attacker-${runId}`)).rejects.toThrow()

    const row = await db.query<{ auth0_sub: string | null }>(
      `SELECT auth0_sub FROM users WHERE id = $1`,
      [owner.rows[0].id],
    )
    expect(row.rows[0].auth0_sub).toBeNull()
  })
})
