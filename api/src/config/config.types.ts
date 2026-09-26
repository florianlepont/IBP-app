/**
 * Typed application configuration (D-01). Built once by `loadAppConfig` from the
 * validated environment and exposed through `ConfigService` under the "app" key
 * (`appConfigOf(config)`). Services read these fields instead of `process.env`.
 */
export type NodeEnv = "development" | "test" | "production"

export type CorsMode = "any" | "none" | "list"

export type StorageMode = "local" | "minio"

export type AppConfig = {
  nodeEnv: NodeEnv
  isProduction: boolean
  http: {
    port: number
    trustProxy: string
  }
  /**
   * D-03: "none" disables CORS, "list" allows the listed origins only, "any"
   * (reflect every origin) is only reachable outside production.
   */
  cors: {
    mode: CorsMode
    origins: string[]
  }
  database: {
    host: string
    port: number
    user: string
    password: string
    database: string
    poolMax: number
    idleTimeoutMs: number
    connectionTimeoutMs: number
    statementTimeoutMs: number
    idleInTransactionTimeoutMs: number
    applicationName: string
  }
  auth0: {
    domain: string
    publicDomain: string
    audience: string
    mgmtClientId: string
    mgmtClientSecret: string
    appClientId: string
    httpTimeoutMs: number
  }
  storage: {
    mode: StorageMode
    bucket: string
    uploadsDir: string
    endpoint: string
    region: string
    accessKey: string
    secretKey: string
  }
  cadastre: {
    provider: string
    allowFallback: boolean
    timeoutMs: number
    reverseUrl: string
    apiCartoParcelUrl: string
    wfsUrl: string
    wfsTypename: string
    wfsCount: number
  }
  smtp: {
    enabled: boolean
    host: string
    port: number
    secure: boolean
    user: string
    password: string
    from: string
    emailChangeConfirmUrlTemplate: string
  }
  debug: {
    dataResetEnabled: boolean
  }
}
