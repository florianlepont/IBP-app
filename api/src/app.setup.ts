import { ValidationPipe } from "@nestjs/common"
import { NestExpressApplication } from "@nestjs/platform-express"
import helmet from "helmet"

/**
 * Shared bootstrap configuration, used by both the real server (main.ts) and
 * the rate-limit E2E spec so trust proxy and the /v1 prefix always match
 * production.
 */
export function configureApp(app: NestExpressApplication): void {
  // Caddy is the only proxy in front of the API (loopback-published container).
  // TRUST_PROXY lets ops widen this (e.g. "loopback,uniquelocal") if Docker's
  // userland proxy makes the container see Caddy from the bridge gateway
  // instead of 127.0.0.1 — see 01.2-VALIDATION.md for the manual check.
  app.set("trust proxy", process.env.TRUST_PROXY?.trim() || "loopback")

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
