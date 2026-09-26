import { appConfigOf } from "../src/config/app-config"
import { runConfigCheck } from "../src/config/check-config"
import { buildTestConfig, buildTestConfigService } from "./config-helper"

const validProdEnv: Record<string, string | undefined> = {
  NODE_ENV: "production",
  POSTGRES_HOST: "db",
  POSTGRES_PORT: "5432",
  POSTGRES_USER: "cortege",
  POSTGRES_DB: "cortege",
  POSTGRES_PASSWORD: "s3cure-db-password",
  AUTH0_DOMAIN: "tenant.example.auth0.com",
  AUTH0_AUDIENCE: "https://api.example",
  AUTH0_MGMT_CLIENT_ID: "mgmt-client",
  AUTH0_MGMT_CLIENT_SECRET: "mgmt-secret-value",
  CORS_ORIGIN: "none",
  OBJECT_STORAGE_MODE: "minio",
  OBJECT_STORAGE_ENDPOINT: "https://files.example",
  OBJECT_STORAGE_ACCESS_KEY: "minio",
  OBJECT_STORAGE_SECRET_KEY: "s3cure-s3-secret",
}

describe("runConfigCheck (D-05 pre-flight)", () => {
  it("prints a single OK line and exits 0 on a valid production env", () => {
    const result = runConfigCheck(validProdEnv, [])
    expect(result.exitCode).toBe(0)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toMatch(/^OK : /)
  })

  it("prints one ERREUR line per failing variable with --production on today's defaults", () => {
    const defaultsEnv = { POSTGRES_PASSWORD: "ibp", POSTGRES_USER: "ibp", POSTGRES_DB: "ibp" }
    const result = runConfigCheck(defaultsEnv, ["--production"])
    expect(result.exitCode).toBe(1)
    const errors = result.lines.filter((line) => line.startsWith("ERREUR : "))
    for (const variable of ["POSTGRES_PASSWORD", "AUTH0_DOMAIN", "AUTH0_AUDIENCE", "CORS_ORIGIN"]) {
      expect(errors.filter((line) => line.startsWith(`ERREUR : ${variable} : `))).toHaveLength(1)
    }
    for (const line of result.lines) {
      expect(line).not.toMatch(/\bibp\b/)
    }
    expect(result.lines.some((line) => line.startsWith("OK : "))).toBe(false)
  })

  it("exits 0 with ATTENTION lines when only AUTH0_MGMT_* is missing", () => {
    const result = runConfigCheck(
      { ...validProdEnv, AUTH0_MGMT_CLIENT_ID: undefined, AUTH0_MGMT_CLIENT_SECRET: "" },
      [],
    )
    expect(result.exitCode).toBe(0)
    expect(result.lines.filter((line) => line.startsWith("ATTENTION : "))).toEqual([
      expect.stringMatching(/^ATTENTION : AUTH0_MGMT_CLIENT_ID : /),
      expect.stringMatching(/^ATTENTION : AUTH0_MGMT_CLIENT_SECRET : /),
    ])
    expect(result.lines.filter((line) => line.startsWith("ERREUR : "))).toEqual([])
  })

  it("reports schema errors as ERREUR lines", () => {
    const result = runConfigCheck({ ...validProdEnv, NODE_ENV: "staging" }, ["--production"])
    expect(result.exitCode).toBe(1)
    expect(result.lines).toContainEqual(expect.stringMatching(/^ERREUR : NODE_ENV : /))
    expect(result.lines.join("\n")).not.toContain("staging")
  })

  it("only type-checks outside production and says so", () => {
    const result = runConfigCheck({ NODE_ENV: "development" }, [])
    expect(result.exitCode).toBe(0)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toMatch(/^OK : /)
  })
})

describe("test config helper", () => {
  it("builds a ConfigService whose app config is the test env", () => {
    const service = buildTestConfigService()
    expect(appConfigOf(service).nodeEnv).toBe("test")
    expect(appConfigOf(service).isProduction).toBe(false)
  })

  it("applies overrides on top of NODE_ENV=test", () => {
    expect(buildTestConfig({ PG_POOL_MAX: "3" }).database.poolMax).toBe(3)
    expect(appConfigOf(buildTestConfigService({ CORS_ORIGIN: "none" })).cors.mode).toBe("none")
  })
})
