import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import helmet from "helmet"
import { appConfigOf } from "./config/app-config"
import { AppConfig } from "./config/config.types"

/**
 * D-03: `none` disables CORS (no Access-Control-Allow-Origin for any browser
 * origin), `list` allows exactly the listed origins, and `any` reflects every
 * origin; `any` is only reachable outside production, where CORS_ORIGIN is
 * required. The mobile app is native and needs no CORS.
 */
function corsOrigin(cors: AppConfig["cors"]): boolean | string[] {
  if (cors.mode === "none") return false
  if (cors.mode === "list") return cors.origins
  return true
}

/**
 * Shared bootstrap configuration, used by both the real server (main.ts) and
 * the rate-limit E2E spec so trust proxy and the /v1 prefix always match
 * production.
 */
export function configureApp(app: NestExpressApplication): void {
  const cfg = appConfigOf(app.get(ConfigService))

  // Caddy (on the VPS host) is the only proxy in front of the API, reaching the
  // container through its loopback-published port (127.0.0.1:3000). With
  // Docker's default userland proxy, docker-proxy relays that port, so the
  // container sees the Docker bridge gateway (172.x.0.1, a private address) as
  // the peer — not 127.0.0.1. Trusting only "loopback" would then ignore
  // X-Forwarded-For and key every client's rate limit on the gateway IP.
  // "uniquelocal" trusts private ranges too; public peers are never trusted,
  // and the container is not reachable from outside except through Caddy,
  // which overwrites X-Forwarded-For. TRUST_PROXY overrides this default
  // (resolved in src/config/app-config.ts).
  app.set("trust proxy", cfg.http.trustProxy)

  app.use(helmet())
  app.setGlobalPrefix("v1")
  app.enableCors({
    origin: corsOrigin(cfg.cors),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Bearer tokens only, no cookies anywhere: never allow credentialed requests.
    credentials: false,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
}
