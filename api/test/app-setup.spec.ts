import { Controller, Get, Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import request = require("supertest")
import { configureApp } from "../src/app.setup"
import { buildTestConfig } from "./config-helper"

@Controller("ping")
class PingController {
  @Get()
  ping(): { ok: true } {
    return { ok: true }
  }
}

type Overrides = Record<string, string | undefined>

/** A minimal app whose ConfigService carries buildTestConfig(overrides) under "app". */
async function buildApp(overrides: Overrides): Promise<NestExpressApplication> {
  @Module({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ app: buildTestConfig(overrides) })],
      }),
    ],
    controllers: [PingController],
  })
  class TestAppModule {}

  const app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false })
  configureApp(app)
  await app.init()
  return app
}

type TrustFn = (address: string, hop: number) => boolean

async function trustProxyFor(trustProxy: string | undefined): Promise<TrustFn> {
  const app = await buildApp({ TRUST_PROXY: trustProxy })
  try {
    return app.getHttpAdapter().getInstance().get("trust proxy fn") as TrustFn
  } finally {
    await app.close()
  }
}

describe("configureApp trust proxy (WR-05)", () => {
  it("by default trusts Caddy seen from the Docker bridge gateway (userland proxy)", async () => {
    const trust = await trustProxyFor(undefined)

    // docker-proxy relays the loopback-published port, so the container sees
    // the bridge gateway (172.x.0.1), not 127.0.0.1, as the peer.
    expect(trust("172.18.0.1", 0)).toBe(true)
    expect(trust("127.0.0.1", 0)).toBe(true)
    expect(trust("::1", 0)).toBe(true)
  })

  it("by default never trusts a public peer's X-Forwarded-For", async () => {
    const trust = await trustProxyFor(undefined)

    expect(trust("203.0.113.10", 0)).toBe(false)
  })

  it("TRUST_PROXY still overrides the default", async () => {
    const trust = await trustProxyFor("loopback")

    expect(trust("127.0.0.1", 0)).toBe(true)
    expect(trust("172.18.0.1", 0)).toBe(false)
  })
})

describe("configureApp CORS (D-03)", () => {
  let app: NestExpressApplication | undefined

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  function preflight(target: NestExpressApplication, origin: string) {
    return request(target.getHttpServer())
      .options("/v1/ping")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
  }

  it("CORS_ORIGIN=none sends no Access-Control-Allow-Origin, on GET or preflight", async () => {
    app = await buildApp({ CORS_ORIGIN: "none" })

    const get = await request(app.getHttpServer())
      .get("/v1/ping")
      .set("Origin", "https://evil.example")
    expect(get.status).toBe(200)
    expect(get.headers["access-control-allow-origin"]).toBeUndefined()
    expect(get.headers["access-control-allow-credentials"]).toBeUndefined()

    const options = await preflight(app, "https://evil.example")
    expect(options.headers["access-control-allow-origin"]).toBeUndefined()
    expect(options.headers["access-control-allow-credentials"]).toBeUndefined()
  })

  it("an explicit list allows exactly the listed origins", async () => {
    app = await buildApp({ CORS_ORIGIN: "https://a.example" })

    const allowed = await request(app.getHttpServer())
      .get("/v1/ping")
      .set("Origin", "https://a.example")
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://a.example")
    expect(allowed.headers["access-control-allow-credentials"]).toBeUndefined()

    const allowedPreflight = await preflight(app, "https://a.example")
    expect(allowedPreflight.headers["access-control-allow-origin"]).toBe("https://a.example")

    const refused = await request(app.getHttpServer())
      .get("/v1/ping")
      .set("Origin", "https://b.example")
    expect(refused.headers["access-control-allow-origin"]).toBeUndefined()

    const refusedPreflight = await preflight(app, "https://b.example")
    expect(refusedPreflight.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("outside production with no CORS_ORIGIN, the origin is reflected without credentials", async () => {
    app = await buildApp({ CORS_ORIGIN: undefined })

    const get = await request(app.getHttpServer())
      .get("/v1/ping")
      .set("Origin", "https://dev.example")
    expect(get.headers["access-control-allow-origin"]).toBe("https://dev.example")
    expect(get.headers["access-control-allow-credentials"]).toBeUndefined()

    const options = await preflight(app, "https://dev.example")
    expect(options.headers["access-control-allow-origin"]).toBe("https://dev.example")
    expect(options.headers["access-control-allow-credentials"]).toBeUndefined()
  })
})
