const { Client } = require("pg")
const { loadE2eEnv, resolveDbConfig, assertResettableDatabase } = require("./e2e-env")

// D-08: each E2E run starts from a freshly migrated schema, replacing the
// Date.now()-uniqueness crutch previously used to dodge stale rows.
//
// The reset only ever targets a `*_test` database (default ibp_test from
// api/.env.test.example), never the dev database `ibp` from api/.env —
// assertResettableDatabase runs before any connection is opened.
//
// If the _test database does not exist yet (first run against a fresh
// docker-compose Postgres), it is created via a maintenance connection to
// the `postgres` database before the reset/migrate steps run.
async function globalSetup() {
  loadE2eEnv()
  assertResettableDatabase(process.env)
  const config = resolveDbConfig(process.env)

  const maintenanceClient = new Client({ ...config, database: "postgres" })
  await maintenanceClient.connect()
  try {
    const result = await maintenanceClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      config.database,
    ])
    if (result.rowCount === 0) {
      await maintenanceClient.query(`CREATE DATABASE "${config.database}"`)
    }
  } finally {
    await maintenanceClient.end()
  }

  const resetClient = new Client(config)
  await resetClient.connect()
  try {
    console.warn(`Resetting E2E database "${config.database}" on host "${config.host}"`)
    await resetClient.query("DROP SCHEMA IF EXISTS public CASCADE")
    await resetClient.query("CREATE SCHEMA public")
  } finally {
    await resetClient.end()
  }

  await require("../scripts/migrate").runMigrations(config)
}

module.exports = globalSetup
module.exports.assertResettableDatabase = assertResettableDatabase
