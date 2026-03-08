import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
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

  async onModuleInit(): Promise<void> {
    await this.initializeSchema();
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

  private async initializeSchema(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'contributor',
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT 'Contributor',
        profile_picture_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS surveys (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id),
        site_name TEXT NOT NULL,
        status TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'private',
        region_version TEXT,
        vegetation_stage TEXT,
        factors JSONB NOT NULL DEFAULT '{}'::jsonb,
        scores JSONB NOT NULL DEFAULT '{}'::jsonb,
        location JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        submitted_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        sync_version INTEGER NOT NULL,
        last_sync_error TEXT,
        deleted_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_surveys_user_updated ON surveys(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_surveys_user_status ON surveys(user_id, status);

      CREATE TABLE IF NOT EXISTS survey_events (
        id TEXT PRIMARY KEY,
        survey_id TEXT NOT NULL REFERENCES surveys(id),
        actor_id UUID,
        event_type TEXT NOT NULL,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_survey_events_survey ON survey_events(survey_id, created_at DESC);
    `);
  }
}
