import * as SQLite from "expo-sqlite"
import { runInTransaction, TxHandle } from "./transaction"
import { deriveQueueOpType, safeParseJson } from "./utils"

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("cortege-local.db")
  }

  return dbPromise
}

export const MAX_RETRY_COUNT = 8
export const SYNC_BATCH_SIZE = 100
// PRAGMA user_version target. Bump this and push a new entry onto MIGRATIONS
// (below) whenever the schema changes; initLocalDb() migrates any existing
// install from its current version up to this one, one migration at a time.
export const SCHEMA_VERSION = 1

export const FACTOR_KEYS: Array<"A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J"> = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
]
export const LEGACY_DEFAULT_FACTOR_VALUES: Record<string, Record<string, number>> = {
  A: { native_genus_count: 2 },
  B: { strata_count: 2, covered_autochthonous_percent: 70 },
  C: { bmg_count: 0, bmm_count: 0, surface_ha: 1 },
  D: { bmg_count: 0, bmm_count: 0, surface_ha: 1 },
  E: { tgb_count: 0, gb_count: 0, surface_ha: 1 },
  F: { trees_per_ha: 2 },
  G: { open_flowering_percent: 2 },
  H: { class_score: 2 },
  I: { type_count: 1 },
  J: { type_count: 1 },
}

/**
 * Adds `columnName` to `table` via `ALTER TABLE ... ADD COLUMN` unless it
 * already exists (checked through `PRAGMA table_info`). Unlike the old
 * catch-all this lets a real ALTER failure propagate instead of being
 * swallowed (T-01.5-09): a half-migrated schema should surface, not hide.
 */
async function ensureColumn(
  tx: TxHandle,
  table: string,
  columnName: string,
  columnDef: string,
): Promise<void> {
  const columns = await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
  if (columns.some((column) => column.name === columnName)) {
    return
  }
  await tx.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`)
}

/**
 * Migration 1 (version 0 -> 1). Additive only: every step either adds a
 * column guarded by ensureColumn, or updates/backfills rows already in
 * place. Nothing is dropped or recreated, so a version-0 phone keeps every
 * survey, queue row, photo row and metadata row it had (D-08, T-01.5-08).
 */
async function migration1(tx: TxHandle): Promise<void> {
  await ensureColumn(tx, "local_surveys", "last_sync_error", "last_sync_error TEXT")
  await ensureColumn(tx, "local_surveys", "last_sync_error_code", "last_sync_error_code TEXT")
  await ensureColumn(tx, "local_surveys", "last_sync_error_at", "last_sync_error_at TEXT")
  await ensureColumn(tx, "local_surveys", "sync_blocked", "sync_blocked INTEGER NOT NULL DEFAULT 0")
  await ensureColumn(tx, "local_surveys", "payload_json", "payload_json TEXT")
  await ensureColumn(tx, "local_surveys", "created_at", "created_at TEXT")
  await tx.runAsync(
    `UPDATE local_surveys SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`,
  )
  await ensureColumn(
    tx,
    "local_surveys",
    "visibility",
    `visibility TEXT NOT NULL DEFAULT 'private'`,
  )
  await tx.runAsync(
    `UPDATE local_surveys SET visibility = 'private' WHERE visibility IS NULL OR visibility = ''`,
  )

  await ensureColumn(tx, "sync_queue", "next_retry_at", "next_retry_at TEXT")
  await ensureColumn(tx, "local_attachments", "remote_attachment_id", "remote_attachment_id TEXT")
  await ensureColumn(tx, "local_attachments", "storage_key", "storage_key TEXT")
  await ensureColumn(tx, "local_attachments", "upload_url", "upload_url TEXT")
  await ensureColumn(tx, "local_attachments", "confirm_url", "confirm_url TEXT")
  await ensureColumn(tx, "local_attachments", "last_sync_error", "last_sync_error TEXT")
  await ensureColumn(tx, "local_attachments", "last_sync_error_code", "last_sync_error_code TEXT")
  await ensureColumn(tx, "local_attachments", "last_sync_error_at", "last_sync_error_at TEXT")

  // Every queue row gets an explicit op_type, backfilled from its existing
  // payload guards; an unrecognised payload is tagged "unknown", never
  // guessed (REQ-AUD-local-storage, Pitfall 4).
  await ensureColumn(tx, "sync_queue", "op_type", "op_type TEXT")
  const queueRows = await tx.getAllAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue`,
  )
  for (const row of queueRows) {
    const opType = deriveQueueOpType(safeParseJson(row.payload))
    await tx.runAsync(`UPDATE sync_queue SET op_type = ? WHERE id = ?`, [opType, row.id])
  }

  // Reset every existing queue row's retry state (D-06, owner decision): rows
  // inflated by the old retry-cap bug get a fresh MAX_RETRY_COUNT attempts.
  await tx.runAsync(`UPDATE sync_queue SET retry_count = 0, next_retry_at = NULL`)

  await ensureColumn(
    tx,
    "local_attachments",
    "file_state",
    `file_state TEXT NOT NULL DEFAULT 'local'`,
  )
  await tx.runAsync(
    `UPDATE local_attachments SET file_state = 'remote' WHERE local_uri IS NULL OR local_uri = ''`,
  )

  await tx.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next_retry ON sync_queue(status, next_retry_at, id);`,
  )
  await tx.execAsync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_survey ON sync_queue(survey_id);`)
}

// Migration N lives at index N-1; MIGRATIONS[currentVersion] is the next one
// to run on the way up to SCHEMA_VERSION.
const MIGRATIONS: Array<(tx: TxHandle) => Promise<void>> = [migration1]

export async function initLocalDb(): Promise<void> {
  const db = await getDb()

  // SQLite refuses to change the journal mode inside a transaction, and
  // :memory: databases (the test double) always report "memory" regardless
  // (C9), so this runs once, outside runInTransaction, and is never asserted
  // on in tests.
  await db.execAsync(`PRAGMA journal_mode = WAL;`)

  // Fresh installs get this pre-phase baseline, then migrate through the
  // same steps as every other install (below).
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_surveys (
      id TEXT PRIMARY KEY NOT NULL,
      site_name TEXT NOT NULL,
      status TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      sync_version INTEGER NOT NULL,
      sync_state TEXT NOT NULL,
      last_sync_error TEXT,
      last_sync_error_code TEXT,
      last_sync_error_at TEXT,
      sync_blocked INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      survey_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sync_state TEXT NOT NULL,
      remote_attachment_id TEXT,
      storage_key TEXT,
      upload_url TEXT,
      confirm_url TEXT,
      last_sync_error TEXT,
      last_sync_error_code TEXT,
      last_sync_error_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_attachments_survey
      ON local_attachments(survey_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS local_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  const versionRow = await db.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`)
  const currentVersion = versionRow?.user_version ?? 0

  for (let version = currentVersion; version < SCHEMA_VERSION; version += 1) {
    const migration = MIGRATIONS[version]
    if (!migration) {
      throw new Error(`Missing migration for schema version ${version + 1}`)
    }
    const nextVersion = version + 1
    await runInTransaction(async (tx) => {
      await migration(tx)
      // SQLite allows PRAGMA user_version inside a transaction, so the
      // version bump commits atomically with the migration's own writes: a
      // crash mid-migration leaves the previous version intact and the
      // migration simply re-runs next launch (T-01.5-08).
      await tx.execAsync(`PRAGMA user_version = ${nextVersion};`)
    })
  }
}
