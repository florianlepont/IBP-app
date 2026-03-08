import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER ?? 'ibp',
      password: process.env.POSTGRES_PASSWORD ?? 'ibp',
      database: process.env.POSTGRES_DB ?? 'ibp'
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
