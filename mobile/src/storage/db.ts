import * as SQLite from "expo-sqlite"

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("ibp-local.db")
  }

  return dbPromise
}

export const MAX_RETRY_COUNT = 8
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

export async function initLocalDb(): Promise<void> {
  const db = await getDb()

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

  // Run schema upgrades column-by-column so one duplicate-column error
  // does not prevent later columns from being added.
  await addColumnIfMissing(db, "local_surveys", "last_sync_error TEXT")
  await addColumnIfMissing(db, "local_surveys", "last_sync_error_code TEXT")
  await addColumnIfMissing(db, "local_surveys", "last_sync_error_at TEXT")
  await addColumnIfMissing(db, "local_surveys", "sync_blocked INTEGER NOT NULL DEFAULT 0")
  await addColumnIfMissing(db, "local_surveys", "payload_json TEXT")
  await addColumnIfMissing(db, "local_surveys", "created_at TEXT")
  await db.runAsync(
    `UPDATE local_surveys SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`,
  )
  await addColumnIfMissing(db, "local_surveys", `visibility TEXT NOT NULL DEFAULT 'private'`)
  await db.runAsync(
    `UPDATE local_surveys SET visibility = 'private' WHERE visibility IS NULL OR visibility = ''`,
  )
  await addColumnIfMissing(db, "sync_queue", "next_retry_at TEXT")
  await addColumnIfMissing(db, "local_attachments", "remote_attachment_id TEXT")
  await addColumnIfMissing(db, "local_attachments", "storage_key TEXT")
  await addColumnIfMissing(db, "local_attachments", "upload_url TEXT")
  await addColumnIfMissing(db, "local_attachments", "confirm_url TEXT")
  await addColumnIfMissing(db, "local_attachments", "last_sync_error TEXT")
  await addColumnIfMissing(db, "local_attachments", "last_sync_error_code TEXT")
  await addColumnIfMissing(db, "local_attachments", "last_sync_error_at TEXT")
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  columnDef: string,
): Promise<void> {
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`).catch(() => {
    // Column likely already exists; keep migration idempotent.
  })
}
