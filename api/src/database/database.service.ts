import { Injectable, OnModuleDestroy } from "@nestjs/common"
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg"

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? "ibp",
      password: process.env.POSTGRES_PASSWORD ?? "ibp",
      database: process.env.POSTGRES_DB ?? "ibp",
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
