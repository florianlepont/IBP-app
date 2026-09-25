import { plainToInstance } from "class-transformer"
import { IsIn, IsOptional, IsString, validateSync } from "class-validator"
import { assertProductionSafety } from "./production-rules"

export const NODE_ENVS = ["development", "test", "production"] as const

/**
 * Environment schema (D-01: class-validator only). Every variable is
 * an optional string: booleans and numbers are parsed in `loadAppConfig` with
 * today's exact predicates, so no value that works today is rejected in
 * development or test (D-02). Production rules live in production-rules.ts and
 * run on top, only when NODE_ENV is production.
 *
 * ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, *_EXPIRES_IN and AUTH_* are
 * deliberately absent (D-04).
 */
export class EnvironmentVariables {
  @IsOptional() @IsIn([...NODE_ENVS]) NODE_ENV?: string

  // HTTP
  @IsOptional() @IsString() PORT?: string
  @IsOptional() @IsString() TRUST_PROXY?: string
  @IsOptional() @IsString() CORS_ORIGIN?: string

  // PostgreSQL (D-06 pool and timeouts)
  @IsOptional() @IsString() POSTGRES_HOST?: string
  @IsOptional() @IsString() POSTGRES_PORT?: string
  @IsOptional() @IsString() POSTGRES_USER?: string
  @IsOptional() @IsString() POSTGRES_PASSWORD?: string
  @IsOptional() @IsString() POSTGRES_DB?: string
  @IsOptional() @IsString() PG_POOL_MAX?: string
  @IsOptional() @IsString() PG_IDLE_TIMEOUT_MS?: string
  @IsOptional() @IsString() PG_CONNECTION_TIMEOUT_MS?: string
  @IsOptional() @IsString() PG_STATEMENT_TIMEOUT_MS?: string
  @IsOptional() @IsString() PG_IDLE_IN_TRANSACTION_TIMEOUT_MS?: string

  // Auth0
  @IsOptional() @IsString() AUTH0_DOMAIN?: string
  @IsOptional() @IsString() AUTH0_PUBLIC_DOMAIN?: string
  @IsOptional() @IsString() AUTH0_AUDIENCE?: string
  @IsOptional() @IsString() AUTH0_MGMT_CLIENT_ID?: string
  @IsOptional() @IsString() AUTH0_MGMT_CLIENT_SECRET?: string
  @IsOptional() @IsString() AUTH0_APP_CLIENT_ID?: string
  @IsOptional() @IsString() AUTH0_HTTP_TIMEOUT_MS?: string

  // Object storage
  @IsOptional() @IsString() OBJECT_STORAGE_MODE?: string
  @IsOptional() @IsString() OBJECT_STORAGE_BUCKET?: string
  @IsOptional() @IsString() ATTACHMENTS_UPLOAD_DIR?: string
  @IsOptional() @IsString() OBJECT_STORAGE_ENDPOINT?: string
  @IsOptional() @IsString() OBJECT_STORAGE_REGION?: string
  @IsOptional() @IsString() OBJECT_STORAGE_ACCESS_KEY?: string
  @IsOptional() @IsString() OBJECT_STORAGE_SECRET_KEY?: string

  // Cadastre
  @IsOptional() @IsString() CADASTRE_PROVIDER?: string
  @IsOptional() @IsString() CADASTRE_PROVIDER_ALLOW_FALLBACK?: string
  @IsOptional() @IsString() CADASTRE_PROVIDER_TIMEOUT_MS?: string
  @IsOptional() @IsString() CADASTRE_IGN_REVERSE_URL?: string
  @IsOptional() @IsString() CADASTRE_IGN_APICARTO_PARCEL_URL?: string
  @IsOptional() @IsString() CADASTRE_IGN_WFS_URL?: string
  @IsOptional() @IsString() CADASTRE_IGN_WFS_TYPENAME?: string
  @IsOptional() @IsString() CADASTRE_IGN_WFS_COUNT?: string

  // SMTP
  @IsOptional() @IsString() SMTP_ENABLED?: string
  @IsOptional() @IsString() SMTP_HOST?: string
  @IsOptional() @IsString() SMTP_PORT?: string
  @IsOptional() @IsString() SMTP_SECURE?: string
  @IsOptional() @IsString() SMTP_USER?: string
  @IsOptional() @IsString() SMTP_PASSWORD?: string
  @IsOptional() @IsString() SMTP_FROM?: string
  @IsOptional() @IsString() EMAIL_CHANGE_CONFIRM_URL_TEMPLATE?: string

  // Debug
  @IsOptional() @IsString() DEBUG_DATA_RESET_ENABLED?: string
}

/**
 * Type-checks the raw env and returns the converted instance plus the names of
 * the invalid variables (names only: values may be secrets).
 */
export function checkEnvSchema(raw: Record<string, unknown>): {
  env: EnvironmentVariables
  invalidVariables: string[]
} {
  const env = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true })
  const errors = validateSync(env, { skipMissingProperties: false })
  return { env, invalidVariables: errors.map((error) => error.property) }
}

/**
 * The `validate` hook of ConfigModule.forRoot (D-01). Throws with variable
 * names only, then applies the production rules (D-02, D-03, D-18) when
 * NODE_ENV is production.
 */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const { env, invalidVariables } = checkEnvSchema(raw)
  if (invalidVariables.length > 0) {
    throw new Error(`Configuration invalide : ${invalidVariables.join(", ")}`)
  }
  if (env.NODE_ENV === "production") {
    assertProductionSafety(env as Record<string, string | undefined>)
  }
  return env
}
