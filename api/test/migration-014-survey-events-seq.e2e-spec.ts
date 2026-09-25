import "dotenv/config"
import { randomUUID } from "crypto"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { PoolClient } from "pg"
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"

// Migration 014 (D-01, D-03, D-12, D-13): globalSetup migrates an empty schema, so the
// backfill never meets data there (PATTERNS C-10). This spec builds the pre-014 shape in a
// scratch schema by running migrations 001-013, seeds rows, then runs 014 the way
// scripts/migrate.js does (one query inside BEGIN/COMMIT) and checks the result.
const SCRATCH_SCHEMA = "mig014_scratch"
const MIGRATIONS_DIR = join(__dirname, "..", "migrations")
const MIGRATION_014 = "014_survey_events_seq_xid8.sql"

const readMigration = (file: string): string => readFileSync(join(MIGRATIONS_DIR, file), "utf8")

describe("migration 014: survey_events seq and xid8 (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let client: PoolClient

  const userId = randomUUID()
  const t0 = "2026-03-01T10:00:00.000Z"
  const t1 = "2026-03-02T10:00:00.000Z"
  const t2 = "2026-03-03T10:00:00.000Z"

  const insertSurvey = async (id: string, ownerId: string | null) => {
    await client.query(
      `INSERT INTO surveys (id, user_id, site_name, status, created_at, updated_at, expires_at, sync_version)
       VALUES ($1, $2, $3, 'draft', NOW(), NOW(), NOW() + INTERVAL '30 days', 1)`,
      [id, ownerId, `Site ${id}`],
    )
  }

  const insertEvent = async (id: string, surveyId: string, createdAt: string) => {
    await client.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload, created_at)
       VALUES ($1, $2, NULL, 'created', '{}'::jsonb, $3::timestamptz)`,
      [id, surveyId, createdAt],
    )
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestExpressApplication>()
    configureApp(app)
    db = moduleFixture.get(DatabaseService)
    await app.init()

    client = await db.connect()
    await client.query(`DROP SCHEMA IF EXISTS ${SCRATCH_SCHEMA} CASCADE`)
    await client.query(`CREATE SCHEMA ${SCRATCH_SCHEMA}`)
    await client.query(`SET search_path TO ${SCRATCH_SCHEMA}`)

    const preMigrations = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql") && file < MIGRATION_014)
      .sort()
    expect(preMigrations[0]).toBe("001_init.sql")
    expect(preMigrations[preMigrations.length - 1]).toBe("013_scrub_reported_event_identity.sql")
    for (const file of preMigrations) {
      await client.query("BEGIN")
      await client.query(readMigration(file))
      await client.query("COMMIT")
    }

    await client.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
      userId,
      `mig014-${userId}@example.test`,
    ])
    await insertSurvey("S1", userId)
    await insertSurvey("S2", userId)
    await insertSurvey("S3", null)
    // Physical insert order differs from (created_at, id) order on purpose.
    await insertEvent("z", "S1", t1)
    await insertEvent("a", "S1", t2)
    await insertEvent("m", "S1", t0)
    await insertEvent("b", "S1", t2)

    const started = Date.now()
    await client.query("BEGIN")
    await client.query(readMigration(MIGRATION_014))
    await client.query("COMMIT")
    console.warn(`Migration 014 on seeded scratch schema took ${Date.now() - started} ms`)
  })

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined)
      await client.query(`DROP SCHEMA IF EXISTS ${SCRATCH_SCHEMA} CASCADE`)
      await client.query("RESET search_path")
      client.release()
    }
    if (app) {
      await app.close()
    }
  })

  it("backfills seq in (created_at, id) order", async () => {
    const result = await client.query<{ id: string; seq: string }>(
      `SELECT id, seq FROM survey_events WHERE survey_id = 'S1' ORDER BY seq`,
    )
    expect(result.rows).toEqual([
      { id: "m", seq: "1" },
      { id: "z", seq: "2" },
      { id: "a", seq: "3" },
      { id: "b", seq: "4" },
    ])
  })

  it("inserts exactly one synthetic event per owned event-less survey, after the backfill", async () => {
    const s2 = await client.query<{ event_type: string; seq: string; actor_id: string | null }>(
      `SELECT event_type, seq, actor_id FROM survey_events WHERE survey_id = 'S2'`,
    )
    expect(s2.rows).toEqual([{ event_type: "backfilled", seq: "5", actor_id: null }])

    const s3 = await client.query(`SELECT 1 FROM survey_events WHERE survey_id = 'S3'`)
    expect(s3.rowCount).toBe(0)
  })

  it("stamps every migrated row with the migration transaction's xid8", async () => {
    const result = await client.query<{ distinct_xids: string; total: string }>(
      `SELECT COUNT(DISTINCT xid8)::text AS distinct_xids, COUNT(*)::text AS total FROM survey_events`,
    )
    expect(result.rows[0]).toEqual({ distinct_xids: "1", total: "5" })
  })

  it("makes seq a NOT NULL identity and xid8 NOT NULL, with the (xid8, seq) index", async () => {
    const columns = await client.query<{
      column_name: string
      is_nullable: string
      is_identity: string
      data_type: string
    }>(
      `SELECT column_name, is_nullable, is_identity, data_type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'survey_events' AND column_name IN ('seq', 'xid8')
       ORDER BY column_name`,
      [SCRATCH_SCHEMA],
    )
    expect(columns.rows).toEqual([
      { column_name: "seq", is_nullable: "NO", is_identity: "YES", data_type: "bigint" },
      { column_name: "xid8", is_nullable: "NO", is_identity: "NO", data_type: "xid8" },
    ])

    const indexes = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = $1 AND tablename = 'survey_events'
       ORDER BY indexname`,
      [SCRATCH_SCHEMA],
    )
    const names = indexes.rows.map((row) => row.indexname)
    expect(names).toContain("idx_survey_events_xid8_seq")
    expect(names).toContain("idx_survey_events_survey")
  })

  it("gives a later insert naming neither column the next seq and a newer xid8", async () => {
    await client.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ('after', 'S1', NULL, 'updated', '{}'::jsonb)`,
    )
    const result = await client.query<{ seq: string; newer: boolean }>(
      `SELECT e.seq,
              e.xid8 >= (SELECT MAX(xid8) FROM survey_events WHERE id <> 'after') AS newer
       FROM survey_events e WHERE e.id = 'after'`,
    )
    expect(result.rows).toEqual([{ seq: "6", newer: true }])
  })

  it("was applied to the public schema by globalSetup", async () => {
    await expect(
      db.query(`SELECT seq, xid8 FROM public.survey_events LIMIT 0`),
    ).resolves.toBeDefined()
  })
})
