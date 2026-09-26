import { ConfigService, registerAs } from "@nestjs/config"
import { AppConfig, CorsMode, NodeEnv } from "./config.types"
import { validateEnv } from "./env.schema"

/** Shown in pg_stat_activity (D-06). */
export const DATABASE_APPLICATION_NAME = "cortege-api"

/** Cap applied to CADASTRE_IGN_WFS_COUNT, as in surveys.service.ts before this phase. */
const MAX_WFS_COUNT = 3000

/**
 * NODE_ENV only, without validation. Used at decorator time (AppModule imports),
 * so an invalid configuration fails inside ConfigModule with a clear message
 * instead of at import.
 */
export function currentNodeEnv(env: NodeJS.ProcessEnv = process.env): NodeEnv {
  const value = env.NODE_ENV
  return value === "production" || value === "test" ? value : "development"
}

/**
 * Today's number predicate: use the value only when it is a non-empty string
 * whose Number() is finite and positive; otherwise the default. Never throws.
 */
function positiveNumber(value: string | undefined, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = positiveNumber(value, fallback)
  const truncated = Math.trunc(parsed)
  return truncated > 0 ? truncated : fallback
}

/** `(value ?? "false").toLowerCase() === "true"` (email.service.ts, debug.service.ts). */
function isTrue(value: string | undefined): boolean {
  return (value ?? "false").toLowerCase() === "true"
}

function parseCors(value: string | undefined): { mode: CorsMode; origins: string[] } {
  const trimmed = (value ?? "").trim()
  if (!trimmed) {
    return { mode: "any", origins: [] }
  }
  if (trimmed.toLowerCase() === "none") {
    return { mode: "none", origins: [] }
  }
  const origins = trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
  return origins.length > 0 ? { mode: "list", origins } : { mode: "any", origins: [] }
}

/**
 * The only place (with main.ts) that reads process.env (D-01). Validates the
 * env (and, in production, applies the production rules), then maps it to the
 * typed AppConfig with today's defaults and parsing.
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const v = validateEnv(env)
  const nodeEnv = currentNodeEnv({ NODE_ENV: v.NODE_ENV })
  const auth0Domain = v.AUTH0_DOMAIN ?? ""

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    http: {
      port: positiveInteger(v.PORT, 3000),
      trustProxy: v.TRUST_PROXY?.trim() || "loopback,uniquelocal",
    },
    cors: parseCors(v.CORS_ORIGIN),
    database: {
      host: v.POSTGRES_HOST ?? "localhost",
      port: positiveInteger(v.POSTGRES_PORT, 5432),
      user: v.POSTGRES_USER ?? "ibp",
      password: v.POSTGRES_PASSWORD ?? "ibp",
      database: v.POSTGRES_DB ?? "ibp",
      poolMax: positiveInteger(v.PG_POOL_MAX, 10),
      idleTimeoutMs: positiveInteger(v.PG_IDLE_TIMEOUT_MS, 30000),
      connectionTimeoutMs: positiveInteger(v.PG_CONNECTION_TIMEOUT_MS, 5000),
      statementTimeoutMs: positiveInteger(v.PG_STATEMENT_TIMEOUT_MS, 10000),
      idleInTransactionTimeoutMs: positiveInteger(v.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS, 60000),
      applicationName: DATABASE_APPLICATION_NAME,
    },
    auth0: {
      domain: auth0Domain,
      publicDomain: v.AUTH0_PUBLIC_DOMAIN?.trim() || auth0Domain,
      audience: v.AUTH0_AUDIENCE ?? "",
      mgmtClientId: v.AUTH0_MGMT_CLIENT_ID ?? "",
      mgmtClientSecret: v.AUTH0_MGMT_CLIENT_SECRET ?? "",
      appClientId: v.AUTH0_APP_CLIENT_ID ?? "",
      httpTimeoutMs: positiveInteger(v.AUTH0_HTTP_TIMEOUT_MS, 5000),
    },
    storage: {
      mode: v.OBJECT_STORAGE_MODE === "minio" ? "minio" : "local",
      bucket: v.OBJECT_STORAGE_BUCKET ?? "ibp-media",
      uploadsDir: v.ATTACHMENTS_UPLOAD_DIR ?? "/tmp/ibp-uploads",
      endpoint: v.OBJECT_STORAGE_ENDPOINT ?? "http://localhost:9000",
      region: v.OBJECT_STORAGE_REGION ?? "us-east-1",
      accessKey: v.OBJECT_STORAGE_ACCESS_KEY ?? "minio",
      secretKey: v.OBJECT_STORAGE_SECRET_KEY ?? "minio123",
    },
    cadastre: {
      provider: (v.CADASTRE_PROVIDER ?? "synthetic").trim().toLowerCase(),
      allowFallback:
        (v.CADASTRE_PROVIDER_ALLOW_FALLBACK ?? "true").trim().toLowerCase() !== "false",
      timeoutMs: positiveInteger(v.CADASTRE_PROVIDER_TIMEOUT_MS, 2500),
      reverseUrl: v.CADASTRE_IGN_REVERSE_URL ?? "https://data.geopf.fr/geocodage/reverse",
      apiCartoParcelUrl:
        v.CADASTRE_IGN_APICARTO_PARCEL_URL ?? "https://apicarto.ign.fr/api/cadastre/parcelle",
      wfsUrl: v.CADASTRE_IGN_WFS_URL ?? "https://data.geopf.fr/wfs/ows",
      wfsTypename: v.CADASTRE_IGN_WFS_TYPENAME ?? "CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle",
      wfsCount: Math.min(MAX_WFS_COUNT, positiveInteger(v.CADASTRE_IGN_WFS_COUNT, 1200)),
    },
    smtp: {
      // EmailService keeps its own "disabled when NODE_ENV is test" rule on top.
      enabled: isTrue(v.SMTP_ENABLED),
      host: v.SMTP_HOST?.trim() ?? "",
      port: positiveInteger(v.SMTP_PORT, 587),
      secure: isTrue(v.SMTP_SECURE),
      user: v.SMTP_USER?.trim() ?? "",
      password: v.SMTP_PASSWORD ?? "",
      from: v.SMTP_FROM ?? "noreply@ibp.local",
      emailChangeConfirmUrlTemplate: v.EMAIL_CHANGE_CONFIRM_URL_TEMPLATE?.trim() ?? "",
    },
    debug: {
      dataResetEnabled: isTrue(v.DEBUG_DATA_RESET_ENABLED),
    },
  }
}

/** Registered through ConfigModule.forRoot({ load: [appConfig] }) (D-01). */
export const appConfig = registerAs("app", () => loadAppConfig())

export function appConfigOf(config: ConfigService): AppConfig {
  return config.getOrThrow<AppConfig>("app")
}
