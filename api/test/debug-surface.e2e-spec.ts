/**
 * Production-mode proof for audit finding A-H4 (D-07): with NODE_ENV=production,
 * /v1/debug/* must not exist (404), while GET /v1/health stays reachable. Every
 * other E2E spec runs with NODE_ENV=test (test/setup-env.js) and keeps obtaining
 * bearer tokens from POST /v1/debug/test-token — this spec proves ROADMAP 1.2
 * criterion 4 without touching that shared behaviour.
 */
import "dotenv/config"
import { INestApplication } from "@nestjs/common"
import { NestExpressApplication } from "@nestjs/platform-express"
import request = require("supertest")

describe("Debug surface gating in production (e2e)", () => {
  let app: INestApplication

  // D-05 / Pitfall 3: production mode now validates the configuration at
  // startup, so boot with a production-valid fake env. GET /v1/health never
  // touches the database and pg.Pool connects lazily, so these values are never
  // used to connect. Every key set here is restored in afterAll.
  const productionEnv: Record<string, string> = {
    NODE_ENV: "production",
    POSTGRES_HOST: "localhost",
    POSTGRES_PORT: "5432",
    POSTGRES_USER: "e2e-user",
    POSTGRES_DB: "e2e-db",
    POSTGRES_PASSWORD: "e2e-not-a-default-password",
    AUTH0_DOMAIN: "e2e.example.auth0.com",
    AUTH0_AUDIENCE: "https://e2e.example/api",
    CORS_ORIGIN: "none",
    OBJECT_STORAGE_MODE: "local",
  }
  const snapshot: Record<string, string | undefined> = {}

  beforeAll(async () => {
    for (const [key, value] of Object.entries(productionEnv)) {
      snapshot[key] = process.env[key]
      process.env[key] = value
    }

    await jest.isolateModulesAsync(async () => {
      // AppModule's imports array and app.setup's configureApp must come from the
      // same isolated registry as @nestjs/testing so Nest's DI metadata (evaluated
      // at import time via isDebugSurfaceEnabled()) reflects NODE_ENV=production.
      const { Test } = await import("@nestjs/testing")
      const { AppModule } = await import("../src/app.module")
      const { configureApp } = await import("../src/app.setup")

      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile()

      app = moduleFixture.createNestApplication<NestExpressApplication>()
      configureApp(app as NestExpressApplication)
      await app.init()
    })
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it("returns 404 for POST /v1/debug/test-token", async () => {
    await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email: "x@x.com" })
      .expect(404)
  })

  it("returns 404 for POST /v1/debug/reset-ibp-data", async () => {
    await request(app.getHttpServer()).post("/v1/debug/reset-ibp-data").expect(404)
  })

  it("returns 404 for POST /v1/debug/reset-user-data", async () => {
    await request(app.getHttpServer()).post("/v1/debug/reset-user-data").expect(404)
  })

  it("still returns 200 for GET /v1/health", async () => {
    await request(app.getHttpServer()).get("/v1/health").expect(200)
  })
})
