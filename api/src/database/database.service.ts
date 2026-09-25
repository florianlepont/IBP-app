import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg"
import { appConfigOf } from "../config/app-config"

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private readonly pool: Pool

  constructor(config: ConfigService) {
    const db = appConfigOf(config).database
    // D-06: every limit is explicit. pg's connectionTimeoutMillis defaults to 0,
    // which waits forever for a free client once the pool is exhausted, so every
    // request would hang instead of failing. statement_timeout and
    // idle_in_transaction_session_timeout make the server cut runaway statements
    // and leaked transactions. A cut statement fails with SQLSTATE 57014, which
    // mapSyncError classifies as retryable (not class 22/23), so sync retries it.
    this.pool = new Pool({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
      max: db.poolMax,
      idleTimeoutMillis: db.idleTimeoutMs,
      connectionTimeoutMillis: db.connectionTimeoutMs,
      statement_timeout: db.statementTimeoutMs,
      idle_in_transaction_session_timeout: db.idleInTransactionTimeoutMs,
      application_name: db.applicationName,
    })
    // Without a listener, an error on an idle client (server restart, network
    // drop) is an unhandled "error" event and crashes the process. Only the
    // message and the code are logged, never the connection options.
    this.pool.on("error", (err: Error & { code?: string }) => {
      const code = err.code
      this.logger.error(`idle client error: ${err.message}${code ? ` (code=${code})` : ""}`)
    })
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end()
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values)
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect()
  }

  async transaction<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    const adapter: Queryable = {
      query: (text, values) => client.query(text, values),
    }

    try {
      await client.query("BEGIN")
      const result = await fn(adapter)
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}
