import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { getOptionsToken } from "@nestjs/throttler"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { buildThrottlerOptions } from "../src/common/rate-limit.config"

// A-C1: the global ThrottlerGuard used to key every request on req.ip, which
// behind Caddy is the proxy address — one syncing device could 429 every
// user. These specs prove independent per-token buckets, XFF keying from the
// trusted (loopback) proxy, and that rotating fake bearer tokens still hits a
// per-IP ceiling. Each describe block builds its own app with its own
// in-memory throttler storage, so the two blocks are fully isolated from
// each other and from the rest of the E2E suite.

describe("Rate limiting (e2e) - per-token buckets and XFF keying", () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getOptionsToken())
      .useValue(buildThrottlerOptions({ defaultLimit: 3, ipCeilingLimit: 1000 }))
      .compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("gives two different bearer tokens independent buckets", async () => {
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("Authorization", "Bearer token-a")
      .expect(200)
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("Authorization", "Bearer token-a")
      .expect(200)
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("Authorization", "Bearer token-a")
      .expect(200)
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("Authorization", "Bearer token-a")
      .expect(429)

    await request(app.getHttpServer())
      .get("/v1/health")
      .set("Authorization", "Bearer token-b")
      .expect(200)
  })

  it("keys unauthenticated requests on X-Forwarded-For from the trusted loopback proxy", async () => {
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("X-Forwarded-For", "203.0.113.10")
      .expect(200)
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("X-Forwarded-For", "203.0.113.10")
      .expect(200)
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("X-Forwarded-For", "203.0.113.10")
      .expect(200)
    await request(app.getHttpServer())
      .get("/v1/health")
      .set("X-Forwarded-For", "203.0.113.10")
      .expect(429)

    await request(app.getHttpServer())
      .get("/v1/health")
      .set("X-Forwarded-For", "203.0.113.11")
      .expect(200)
  })
})

describe("Rate limiting (e2e) - IP ceiling stops fake-token rotation", () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getOptionsToken())
      .useValue(buildThrottlerOptions({ defaultLimit: 1000, ipCeilingLimit: 5 }))
      .compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("429s the sixth request from the same IP even when each uses a different bearer token", async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .get("/v1/health")
        .set("X-Forwarded-For", "203.0.113.20")
        .set("Authorization", `Bearer rotated-token-${i}`)
        .expect(200)
    }

    await request(app.getHttpServer())
      .get("/v1/health")
      .set("X-Forwarded-For", "203.0.113.20")
      .set("Authorization", "Bearer rotated-token-5")
      .expect(429)
  })
})
