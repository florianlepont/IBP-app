const { loadE2eEnv, resolveDbConfig } = require("./e2e-env")

// Runs before each E2E spec file (setupFiles, before the spec's own
// `import "dotenv/config"`). Loading the E2E env here first means dotenv's
// non-override load inside the spec cannot switch process.env back to
// api/.env's dev database. This does not rely on globalSetup's process.env
// mutations propagating into the test context — it reloads independently.
loadE2eEnv()

const { database } = resolveDbConfig(process.env)
if (!/^[A-Za-z0-9_]+_test$/.test(database)) {
  throw new Error(
    `Refusing to run E2E specs against database "${database}": name does not end in _test. See api/.env.test.example.`,
  )
}
