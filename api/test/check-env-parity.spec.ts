import { spawnSync } from "child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join, resolve } from "path"
import { runConfigCheck } from "../src/config/check-config"

/**
 * Parity between infra/vps/check-env.sh (dependency-free, run by the owner on
 * the VPS before merging) and the API's own production check (phase 01.7
 * D-05, D-18). Both must reach the same verdict and name the same variables
 * for every fixture.
 */

const REPO_ROOT = resolve(__dirname, "../..")
const CHECK_ENV = join(REPO_ROOT, "infra/vps/check-env.sh")
const VPS_ENV_EXAMPLE = join(REPO_ROOT, "infra/vps/env.example")

const bashAvailable = spawnSync("bash", ["-c", "true"]).status === 0
const describeIfBash = bashAvailable ? describe : describe.skip
if (!bashAvailable) {
  process.stderr.write("check-env-parity.spec: bash is not available, the suite is skipped\n")
}

/** Secret values used by the fixtures; none may ever appear in the output. */
const DB_SECRET = "Pq7-db-secret-parity-marker"
const STORAGE_SECRET = "Zx9-storage-secret-parity-marker"
const MGMT_SECRET = "Mg3-mgmt-secret-parity-marker"
const SMTP_SECRET = "Sm5-smtp-secret-parity-marker"

const VALID_LINES: Record<string, string> = {
  POSTGRES_DB: "cortege",
  POSTGRES_USER: "cortege",
  POSTGRES_PASSWORD: DB_SECRET,
  MINIO_ACCESS_KEY: "cortege",
  MINIO_SECRET_KEY: STORAGE_SECRET,
  OBJECT_STORAGE_BUCKET: "cortege-media",
  OBJECT_STORAGE_REGION: "us-east-1",
  OBJECT_STORAGE_ENDPOINT: "https://files.example.org",
  AUTH0_DOMAIN: "tenant.eu.auth0.com",
  AUTH0_AUDIENCE: "https://api.example.org",
  AUTH0_MGMT_CLIENT_ID: "mgmt-client",
  AUTH0_MGMT_CLIENT_SECRET: MGMT_SECRET,
  CORS_ORIGIN: "none",
}

function render(lines: Record<string, string | null>): string {
  return Object.entries(lines)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
}

function withChanges(changes: Record<string, string | null>): string {
  return render({ ...VALID_LINES, ...changes })
}

/** Same line semantics as check-env.sh (and docker compose env files). */
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }
    const withoutExport = line.startsWith("export ") ? line.slice(7).trimStart() : line
    const eq = withoutExport.indexOf("=")
    if (eq <= 0) {
      continue
    }
    const key = withoutExport.slice(0, eq).trim()
    let value = withoutExport.slice(eq + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

/** The `environment:` block of infra/docker-compose.vps.yml, applied over env_file. */
function composeMapped(raw: Record<string, string>): Record<string, string | undefined> {
  const orDefault = (value: string | undefined, fallback: string) =>
    value === undefined || value === "" ? fallback : value
  return {
    ...raw,
    NODE_ENV: "production",
    PORT: "3000",
    POSTGRES_HOST: "postgres",
    POSTGRES_PORT: "5432",
    OBJECT_STORAGE_MODE: "minio",
    OBJECT_STORAGE_BUCKET: orDefault(raw.OBJECT_STORAGE_BUCKET, "cortege-media"),
    OBJECT_STORAGE_ENDPOINT: raw.OBJECT_STORAGE_ENDPOINT,
    OBJECT_STORAGE_REGION: orDefault(raw.OBJECT_STORAGE_REGION, "us-east-1"),
    OBJECT_STORAGE_ACCESS_KEY: orDefault(raw.MINIO_ACCESS_KEY, "minio"),
    OBJECT_STORAGE_SECRET_KEY: raw.MINIO_SECRET_KEY,
  }
}

/**
 * check-env.sh names the variable the owner edits in the file; the API sees
 * it under its compose name.
 */
const FILE_TO_API_NAME: Record<string, string> = {
  MINIO_SECRET_KEY: "OBJECT_STORAGE_SECRET_KEY",
}

function erreurVariables(lines: string[]): string[] {
  const names = lines
    .map((line) => /^ERREUR : ([A-Z0-9_]+) :/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => FILE_TO_API_NAME[match[1]] ?? match[1])
  return [...new Set(names)].sort()
}

let workDir: string

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "p17-check-env-"))
})

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true })
})

let fixtureCount = 0

function runBoth(content: string) {
  fixtureCount += 1
  const file = join(workDir, `fixture-${fixtureCount}.env`)
  writeFileSync(file, `${content}\n`)
  const shell = spawnSync("bash", [CHECK_ENV, file], { encoding: "utf8", timeout: 10_000 })
  const shellOutput = `${shell.stdout}${shell.stderr}`
  const api = runConfigCheck(composeMapped(parseEnvFile(content)), ["--production"])
  return {
    shell: {
      status: shell.status,
      output: shellOutput,
      variables: erreurVariables(shellOutput.split("\n")),
    },
    api: { status: api.exitCode, variables: erreurVariables(api.lines) },
  }
}

const FIXTURES: Array<[string, string]> = [
  ["valid VPS env", withChanges({})],
  ["POSTGRES_USER absent", withChanges({ POSTGRES_USER: null })],
  ["POSTGRES_DB empty", withChanges({ POSTGRES_DB: "" })],
  [
    "POSTGRES_PASSWORD placeholder",
    withChanges({ POSTGRES_PASSWORD: "CHANGE_ME_STRONG_PASSWORD" }),
  ],
  ["POSTGRES_PASSWORD dev default in upper case", withChanges({ POSTGRES_PASSWORD: "IBP" })],
  ["MINIO_SECRET_KEY dev default", withChanges({ MINIO_SECRET_KEY: "minio123" })],
  ["MINIO_SECRET_KEY absent", withChanges({ MINIO_SECRET_KEY: null })],
  ["OBJECT_STORAGE_ENDPOINT absent", withChanges({ OBJECT_STORAGE_ENDPOINT: null })],
  ["AUTH0_AUDIENCE empty", withChanges({ AUTH0_AUDIENCE: "" })],
  ["AUTH0_DOMAIN blank", withChanges({ AUTH0_DOMAIN: "   " })],
  ["CORS_ORIGIN empty", withChanges({ CORS_ORIGIN: "" })],
  ["CORS_ORIGIN absent", withChanges({ CORS_ORIGIN: null })],
  ["CORS_ORIGIN placeholder", withChanges({ CORS_ORIGIN: "https://CHANGE_ME_YOUR_DOMAIN" })],
  ["CORS_ORIGIN NONE upper case", withChanges({ CORS_ORIGIN: "NONE" })],
  [
    "CORS_ORIGIN list of origins",
    withChanges({ CORS_ORIGIN: "https://a.example.org, http://localhost:8081" }),
  ],
  ["CORS_ORIGIN with a path", withChanges({ CORS_ORIGIN: "https://a.example.org/app" })],
  ["CORS_ORIGIN only commas", withChanges({ CORS_ORIGIN: " , ," })],
  ["quoted values", withChanges({ POSTGRES_PASSWORD: `"${DB_SECRET}"`, CORS_ORIGIN: "'none'" })],
  ["quoted placeholder", withChanges({ POSTGRES_PASSWORD: '"change-me"' })],
  [
    "comment lines and blank lines",
    `# Runtime environment\n\n${withChanges({})}\n# POSTGRES_PASSWORD=ibp\n`,
  ],
  ["MINIO_ACCESS_KEY=minio passes", withChanges({ MINIO_ACCESS_KEY: "minio" })],
  [
    "compose values in the file are overridden by the environment block",
    withChanges({ OBJECT_STORAGE_MODE: "local", POSTGRES_HOST: "", NODE_ENV: "development" }),
  ],
  [
    "dead variables are harmless",
    `${withChanges({})}\nACCESS_TOKEN_SECRET=CHANGE_ME_64_CHAR_HEX\nREFRESH_TOKEN_SECRET=x\nAUTH_DEV_EXPOSE_EMAIL_TOKEN=false`,
  ],
  [
    "leftover SMTP lines are harmless (phase 01.9 D-09)",
    `${withChanges({})}\nSMTP_ENABLED=true\nSMTP_HOST=smtp.example.org\nSMTP_PASSWORD=${SMTP_SECRET}\nEMAIL_CHANGE_CONFIRM_URL_TEMPLATE=https://example.org/confirm`,
  ],
  [
    "several faults at once",
    withChanges({
      POSTGRES_PASSWORD: "ibp",
      MINIO_SECRET_KEY: "",
      CORS_ORIGIN: "",
      AUTH0_DOMAIN: "",
    }),
  ],
  ["empty file", ""],
]

describeIfBash("check-env.sh agrees with the API production check", () => {
  it.each(FIXTURES)("%s", (_name, content) => {
    const { shell, api } = runBoth(content)

    expect(shell.status).toBe(api.status)
    expect(shell.variables).toEqual(api.variables)
    if (api.status === 0) {
      expect(shell.output).toMatch(/^OK : /m)
    } else {
      expect(shell.output).toContain("À corriger avant la fusion :")
    }
    for (const secret of [DB_SECRET, STORAGE_SECRET, MGMT_SECRET, SMTP_SECRET]) {
      expect(shell.output).not.toContain(secret)
    }
  })

  it("the valid fixture really passes (guards against two checks that always fail)", () => {
    const { shell, api } = runBoth(withChanges({}))
    expect(api.status).toBe(0)
    expect(shell.status).toBe(0)
  })

  it("warns about Auth0 management placeholders without failing", () => {
    const { shell } = runBoth(withChanges({ AUTH0_MGMT_CLIENT_ID: "CHANGE_ME" }))
    expect(shell.status).toBe(0)
    expect(shell.output).toContain("ATTENTION : AUTH0_MGMT_CLIENT_ID :")
  })

  it("flags dead variables as removable lines, never as errors", () => {
    const { shell } = runBoth(`${withChanges({})}\nACCESS_TOKEN_SECRET=${DB_SECRET}`)
    expect(shell.status).toBe(0)
    expect(shell.output).toContain(
      "INFO : ACCESS_TOKEN_SECRET : ligne inutile, peut être supprimée",
    )
    expect(shell.output).not.toContain(DB_SECRET)
  })

  it("flags leftover SMTP lines as obsolete and never echoes their values (D-09)", () => {
    const { shell } = runBoth(
      `${withChanges({})}\nSMTP_ENABLED=true\nSMTP_PASSWORD=${SMTP_SECRET}\nEMAIL_CHANGE_CONFIRM_URL_TEMPLATE=https://example.org/confirm`,
    )
    expect(shell.status).toBe(0)
    expect(shell.output).toContain("INFO : SMTP_PASSWORD : ligne inutile, peut être supprimée.")
    expect(shell.output).toContain("INFO : SMTP_ENABLED : ligne inutile, peut être supprimée.")
    expect(shell.output).toContain(
      "INFO : EMAIL_CHANGE_CONFIRM_URL_TEMPLATE : ligne inutile, peut être supprimée.",
    )
    expect(shell.output).not.toContain(SMTP_SECRET)
    expect(shell.output).not.toContain("ERREUR")
  })

  it("works when piped into `bash -s --` (the owner command)", () => {
    const file = join(workDir, "piped.env")
    writeFileSync(file, `${withChanges({ POSTGRES_PASSWORD: "ibp" })}\n`)
    const result = spawnSync("bash", ["-s", "--", file], {
      input: readFileSync(CHECK_ENV, "utf8"),
      encoding: "utf8",
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("ERREUR : POSTGRES_PASSWORD :")
    expect(result.stdout).toContain("À corriger avant la fusion : 1 problème(s).")
  })

  it("reports a missing file", () => {
    const missing = join(workDir, "does-not-exist.env")
    const result = spawnSync("bash", [CHECK_ENV, missing], { encoding: "utf8" })
    expect(result.status).toBe(1)
    expect(`${result.stdout}${result.stderr}`).toContain("ERREUR :")
  })

  it("never sources or evaluates the env file", () => {
    const marker = join(workDir, "executed-marker")
    const content = `${withChanges({})}\n$(touch ${marker})\nPOSTGRES_DB=$(touch ${marker})\n\`touch ${marker}\``
    const { shell } = runBoth(content)
    expect(shell.status).toBe(0)
    expect(spawnSync("test", ["-e", marker]).status).not.toBe(0)
  })

  describe("infra/vps/env.example", () => {
    const example = readFileSync(VPS_ENV_EXAMPLE, "utf8")

    it("as committed (CHANGE_ME placeholders) is refused by both checks", () => {
      const { shell, api } = runBoth(example)
      expect(api.status).toBe(1)
      expect(shell.status).toBe(1)
      expect(shell.variables).toEqual(api.variables)
      expect(shell.variables).toEqual(
        expect.arrayContaining(["POSTGRES_PASSWORD", "OBJECT_STORAGE_SECRET_KEY"]),
      )
    })

    it("with only its CHANGE_ME placeholders replaced passes both checks", () => {
      let counter = 0
      const filled = example.replace(/=CHANGE_ME[A-Za-z0-9_-]*/g, () => {
        counter += 1
        return `=filled-value-${counter}-not-a-default`
      })
      expect(counter).toBeGreaterThan(0)

      const api = runConfigCheck(composeMapped(parseEnvFile(filled)), ["--production"])
      expect(api.lines.filter((line) => line.startsWith("ERREUR"))).toEqual([])
      expect(api.exitCode).toBe(0)

      const { shell } = runBoth(filled)
      expect(shell.status).toBe(0)
      expect(shell.output).toMatch(/^OK : /m)
    })
  })
})
