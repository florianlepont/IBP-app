const fs = require("fs")
const path = require("path")
const dotenv = require("dotenv")

// Loads the E2E environment used by both Jest's globalSetup and the specs
// themselves. api/.env.test (gitignored, developer-local) wins over the
// committed api/.env.test.example, and both are loaded BEFORE api/.env so
// that api/.env's dev-database POSTGRES_DB can never override the E2E
// database (dotenv's override defaults to false).
function loadE2eEnv() {
  const testEnvPath = path.resolve(__dirname, "../.env.test")
  const testEnvExamplePath = path.resolve(__dirname, "../.env.test.example")
  const e2ePath = fs.existsSync(testEnvPath) ? testEnvPath : testEnvExamplePath

  dotenv.config({ path: e2ePath, override: false })
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: false })
}

// Same defaults as api/scripts/migrate.js: the database default stays "ibp"
// so a missing POSTGRES_DB is refused by assertResettableDatabase, never
// silently accepted as a _test database.
function resolveDbConfig(env) {
  return {
    host: env.POSTGRES_HOST || "localhost",
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || "ibp",
    password: env.POSTGRES_PASSWORD || "ibp",
    database: env.POSTGRES_DB || "ibp",
  }
}

const TEST_DB_NAME_PATTERN = /^[A-Za-z0-9_]+_test$/
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function assertResettableDatabase(env) {
  const config = resolveDbConfig(env)
  const hint = "POSTGRES_DB must end in _test; see api/.env.test.example"

  if (env.NODE_ENV === "production") {
    throw new Error(
      `Refusing to reset the E2E database: NODE_ENV is production (host=${config.host}, database=${config.database}). ${hint}`,
    )
  }

  if (!TEST_DB_NAME_PATTERN.test(config.database)) {
    throw new Error(
      `Refusing to reset the E2E database "${config.database}" on host "${config.host}": name does not end in _test. ${hint}`,
    )
  }

  if (!LOCAL_HOSTS.has(config.host) && env.E2E_ALLOW_REMOTE_DB_RESET !== "true") {
    throw new Error(
      `Refusing to reset the E2E database on non-local host "${config.host}" (database=${config.database}). ${hint}`,
    )
  }
}

module.exports = { loadE2eEnv, resolveDbConfig, assertResettableDatabase }
