import { Module } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"
import { configureApp } from "../src/app.setup"

@Module({})
class EmptyModule {}

type TrustFn = (address: string, hop: number) => boolean

async function trustProxyFor(trustProxyEnv: string | undefined): Promise<TrustFn> {
  const original = process.env.TRUST_PROXY
  if (trustProxyEnv === undefined) delete process.env.TRUST_PROXY
  else process.env.TRUST_PROXY = trustProxyEnv

  const app = await NestFactory.create<NestExpressApplication>(EmptyModule, { logger: false })
  try {
    configureApp(app)
    return app.getHttpAdapter().getInstance().get("trust proxy fn") as TrustFn
  } finally {
    await app.close()
    if (original === undefined) delete process.env.TRUST_PROXY
    else process.env.TRUST_PROXY = original
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
