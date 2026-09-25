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

// Migration 015 (D-13): globalSetup migrates an empty schema, so the generated centroid
// columns never meet bad data there. This spec builds the pre-015 shape in a scratch schema
// (migrations 001-014), seeds parcels with malformed centroids, then runs 015 the way
// scripts/migrate.js does (one query inside BEGIN/COMMIT) and checks that it neither fails
// nor keeps a bad value.
const SCRATCH_SCHEMA = "mig015_scratch"
const MIGRATIONS_DIR = join(__dirname, "..", "migrations")
const MIGRATION_015 = "015_public_indexes_centroid_columns.sql"

const readMigration = (file: string): string => readFileSync(join(MIGRATIONS_DIR, file), "utf8")

// Seeded centroids, in parcel_id order, with the expected generated values.
const SEEDED_CENTROIDS: Array<{ centroid: string; lat: number | null; lng: number | null }> = [
  { centroid: '{"lat":"abc","lng":2}', lat: null, lng: 2 },
  { centroid: "{}", lat: null, lng: null },
  { centroid: '{"lat":95,"lng":2}', lat: null, lng: 2 },
  { centroid: '{"lat":" 48.5 ","lng":" 2.25 "}', lat: 48.5, lng: 2.25 },
  { centroid: '{"lat":48.1,"lng":-1.7}', lat: 48.1, lng: -1.7 },
  // Exponent form would overflow double precision if the guard let it reach the cast.
  { centroid: '{"lat":"1e400","lng":"1e400"}', lat: null, lng: null },
  { centroid: JSON.stringify({ lat: "9".repeat(400), lng: 2 }), lat: null, lng: 2 },
]

const parcelIdAt = (index: number): string => `75056000AB${String(index).padStart(4, "0")}`

describe("migration 015: public indexes and centroid columns (e2e)", () => {
  let app: NestExpressApplication
  let db: DatabaseService
  let client: PoolClient

  const applyMigration015 = async () => {
    await client.query("BEGIN")
    await client.query(readMigration(MIGRATION_015))
    await client.query("COMMIT")
  }

  const indexNames = async (): Promise<string[]> => {
    const result = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname`,
      [SCRATCH_SCHEMA],
    )
    return result.rows.map((row) => row.indexname)
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
      .filter((file) => file.endsWith(".sql") && file < MIGRATION_015)
      .sort()
    expect(preMigrations[0]).toBe("001_init.sql")
    expect(preMigrations[preMigrations.length - 1]).toBe("014_survey_events_seq_xid8.sql")
    for (const file of preMigrations) {
      await client.query("BEGIN")
      await client.query(readMigration(file))
      await client.query("COMMIT")
    }

    for (const [index, seed] of SEEDED_CENTROIDS.entries()) {
      await client.query(
        `INSERT INTO parcels (id, parcel_id, commune_code, section, number, centroid)
         VALUES ($1, $2, '75056', 'AB', $3, $4::jsonb)`,
        [randomUUID(), parcelIdAt(index), String(index), seed.centroid],
      )
    }

    const started = Date.now()
    await applyMigration015()
    console.warn(`Migration 015 on seeded scratch schema took ${Date.now() - started} ms`)
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

  it("turns missing, non-numeric, exponent-form and out-of-range centroids into NULL", async () => {
    const result = await client.query<{ centroid_lat: number | null; centroid_lng: number | null }>(
      `SELECT centroid_lat, centroid_lng FROM parcels ORDER BY parcel_id`,
    )
    expect(result.rows).toEqual(
      SEEDED_CENTROIDS.map((seed) => ({ centroid_lat: seed.lat, centroid_lng: seed.lng })),
    )
  })

  it("declares both centroid columns as generated", async () => {
    const result = await client.query<{ column_name: string; is_generated: string }>(
      `SELECT column_name, is_generated FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'parcels'
         AND column_name IN ('centroid_lat', 'centroid_lng')
       ORDER BY column_name`,
      [SCRATCH_SCHEMA],
    )
    expect(result.rows).toEqual([
      { column_name: "centroid_lat", is_generated: "ALWAYS" },
      { column_name: "centroid_lng", is_generated: "ALWAYS" },
    ])
  })

  it("recomputes the columns when the centroid changes", async () => {
    await client.query(`UPDATE parcels SET centroid = '{"lat":47,"lng":3}' WHERE parcel_id = $1`, [
      parcelIdAt(0),
    ])
    const result = await client.query<{ centroid_lat: number; centroid_lng: number }>(
      `SELECT centroid_lat, centroid_lng FROM parcels WHERE parcel_id = $1`,
      [parcelIdAt(0)],
    )
    expect(result.rows).toEqual([{ centroid_lat: 47, centroid_lng: 3 }])
  })

  it("creates the partial public index with its predicate", async () => {
    const result = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = 'idx_surveys_public_submitted'`,
      [SCRATCH_SCHEMA],
    )
    expect(result.rowCount).toBe(1)
    const definition = result.rows[0].indexdef
    expect(definition).toContain("submitted_at DESC")
    expect(definition).toMatch(/WHERE .*status = 'submitted'/)
    expect(definition).toMatch(/visibility = 'public'/)
    expect(definition).toMatch(/deleted_at IS NULL/)
  })

  it("creates the centroid, actor and reports keyset indexes", async () => {
    const names = await indexNames()
    expect(names).toEqual(
      expect.arrayContaining([
        "idx_parcels_centroid_lat_lng",
        "idx_survey_events_actor_id",
        "idx_reports_created_id",
      ]),
    )

    const reports = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = 'idx_reports_created_id'`,
      [SCRATCH_SCHEMA],
    )
    expect(reports.rows[0].indexdef).toContain("(created_at DESC, id DESC)")
  })

  it("drops the three redundant indexes and keeps the indexes that cover them", async () => {
    const names = await indexNames()
    expect(names).not.toContain("idx_users_auth0_sub")
    expect(names).not.toContain("idx_surveys_parcel_id")
    expect(names).not.toContain("idx_survey_parcels_survey_id")
    expect(names).toEqual(
      expect.arrayContaining([
        "users_auth0_sub_key",
        "idx_surveys_parcel_year_version",
        "survey_parcels_pkey",
      ]),
    )
  })

  it("leaves no auth_sessions table", async () => {
    const result = await client.query<{ reg: string | null }>(
      `SELECT to_regclass('auth_sessions')::text AS reg`,
    )
    expect(result.rows).toEqual([{ reg: null }])
  })

  it("can be applied a second time", async () => {
    await expect(applyMigration015()).resolves.toBeUndefined()
  })

  it("was applied to the public schema by globalSetup", async () => {
    await expect(
      db.query(`SELECT centroid_lat, centroid_lng FROM public.parcels LIMIT 0`),
    ).resolves.toBeDefined()
  })
})
