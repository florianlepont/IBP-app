import { ValidationPipe } from "@nestjs/common"
import { NestExpressApplication } from "@nestjs/platform-express"
import helmet from "helmet"

/**
 * Shared bootstrap configuration, used by both the real server (main.ts) and
 * the rate-limit E2E spec so trust proxy and the /v1 prefix always match
 * production.
 */
export function configureApp(app: NestExpressApplication): void {
  // Caddy (on the VPS host) is the only proxy in front of the API, reaching the
  // container through its loopback-published port (127.0.0.1:3000). With
  // Docker's default userland proxy, docker-proxy relays that port, so the
  // container sees the Docker bridge gateway (172.x.0.1, a private address) as
  // the peer — not 127.0.0.1. Trusting only "loopback" would then ignore
  // X-Forwarded-For and key every client's rate limit on the gateway IP.
  // "uniquelocal" trusts private ranges too; public peers are never trusted,
  // and the container is not reachable from outside except through Caddy,
  // which overwrites X-Forwarded-For. TRUST_PROXY overrides this default.
  app.set("trust proxy", process.env.TRUST_PROXY?.trim() || "loopback,uniquelocal")

  app.use(helmet())
  app.setGlobalPrefix("v1")
  const corsOrigin = process.env.CORS_ORIGIN
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(",").map((o) => o.trim()) : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
}
