import "dotenv/config"
import { readdirSync } from "fs"
import { join } from "path"
import { Client, ClientConfig } from "pg"

// D-14: scripts/migrate.js holds a session-level advisory lock around its loop, so a deploy
// start and a manual run cannot apply the same file twice. Each case runs the real runner
// against a fresh, empty database: advisory locks are per database, and runMigrations creates
// schema_migrations in the connection's default schema.
type MigrateModule = {
  runMigrations: (config: ClientConfig) => Promise<void>
  MIGRATION_LOCK_KEY: number
}
type E2eEnvModule = {
  resolveDbConfig: (env: NodeJS.ProcessEnv) => ClientConfig & { database: string }
}

const { runMigrations, MIGRATION_LOCK_KEY } =
  jest.requireActual<MigrateModule>("../scripts/migrate")
const { resolveDbConfig } = jest.requireActual<E2eEnvModule>("./e2e-env")

const MIGRATION_FILES = readdirSync(join(__dirname, "..", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()

const baseConfig = resolveDbConfig(process.env)

const scratchDatabase = (suffix: string): string => {
  const name = baseConfig.database.replace(/_test$/, `_${suffix}_test`)
  if (name === baseConfig.database || !/^[A-Za-z0-9_]+_test$/.test(name)) {
    throw new Error(`Refusing to derive a lock-test database from "${baseConfig.database}"`)
  }
  return name
}

const LOCK_DB = scratchDatabase("lock")
const LOCK2_DB = scratchDatabase("lock2")

const configFor = (database: string): ClientConfig => ({
  ...baseConfig,
  password: baseConfig.password,
  database,
})

const withMaintenanceClient = async (work: (client: Client) => Promise<void>) => {
  const client = new Client(configFor("postgres"))
  await client.connect()
  try {
    await work(client)
  } finally {
    await client.end()
  }
}

const dropDatabase = async (client: Client, database: string) => {
  await client.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [database],
  )
  await client.query(`DROP DATABASE IF EXISTS "${database}"`)
}

const recreateDatabase = async (database: string) => {
  await withMaintenanceClient(async (client) => {
    await dropDatabase(client, database)
    await client.query(`CREATE DATABASE "${database}"`)
  })
}

const appliedMigrations = async (database: string) => {
  const client = new Client(configFor(database))
  await client.connect()
  try {
    const result = await client.query<{ filename: string; applied: number }>(
      `SELECT filename, COUNT(*)::int AS applied FROM schema_migrations
       GROUP BY filename ORDER BY filename`,
    )
    return result.rows
  } finally {
    await client.end()
  }
}

const advisoryLocksHeld = async (database: string): Promise<number> => {
  let count = -1
  await withMaintenanceClient(async (client) => {
    const result = await client.query<{ held: number }>(
      `SELECT COUNT(*)::int AS held FROM pg_locks
       WHERE locktype = 'advisory' AND granted
         AND database = (SELECT oid FROM pg_database WHERE datname = $1)
         AND classid = 0 AND objid = $2 AND objsubid = 1`,
      [database, MIGRATION_LOCK_KEY],
    )
    count = result.rows[0].held
  })
  return count
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("scripts/migrate.js advisory lock (e2e)", () => {
  jest.setTimeout(60000)

  beforeAll(() => {
    // The runner logs one line per applied file; keep the E2E output readable.
    jest.spyOn(console, "log").mockImplementation(() => undefined)
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await withMaintenanceClient(async (client) => {
      await dropDatabase(client, LOCK_DB)
      await dropDatabase(client, LOCK2_DB)
    })
  })

  it("exports a constant lock key", () => {
    expect(Number.isSafeInteger(MIGRATION_LOCK_KEY)).toBe(true)
  })

  it("lets two concurrent runs on an empty database both succeed, applying each file once", async () => {
    await recreateDatabase(LOCK_DB)
    const config = configFor(LOCK_DB)

    const outcomes = await Promise.allSettled([runMigrations(config), runMigrations(config)])

    // Comparing whole outcomes shows the rejection reason if a run fails.
    expect(outcomes).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ])
    expect(await appliedMigrations(LOCK_DB)).toEqual(
      MIGRATION_FILES.map((filename) => ({ filename, applied: 1 })),
    )
    expect(await advisoryLocksHeld(LOCK_DB)).toBe(0)
  })

  it("waits while another session on the same database holds the lock", async () => {
    await recreateDatabase(LOCK2_DB)
    const holder = new Client(configFor(LOCK2_DB))
    await holder.connect()
    try {
      await holder.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY])

      let settled = false
      const run = runMigrations(configFor(LOCK2_DB)).finally(() => {
        settled = true
      })

      await sleep(300)
      expect(settled).toBe(false)

      await holder.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY])
      await expect(run).resolves.toBeUndefined()
      expect(settled).toBe(true)
    } finally {
      await holder.end()
    }

    expect(await appliedMigrations(LOCK2_DB)).toEqual(
      MIGRATION_FILES.map((filename) => ({ filename, applied: 1 })),
    )
    expect(await advisoryLocksHeld(LOCK2_DB)).toBe(0)
  })
})
