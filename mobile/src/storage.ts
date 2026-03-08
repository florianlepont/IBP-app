import * as SQLite from 'expo-sqlite';

export type LocalSurvey = {
  id: string;
  site_name: string;
  status: string;
  sync_version: number;
  sync_state: 'pending' | 'synced' | 'failed';
  last_sync_error: string | null;
  updated_at: string;
};

type QueueRow = {
  id: number;
  survey_id: string;
  payload: string;
  status: 'pending' | 'failed';
  retry_count: number;
  next_retry_at: string | null;
};

const dbPromise = SQLite.openDatabaseAsync('ibp-local.db');

export async function initLocalDb(): Promise<void> {
  const db = await dbPromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_surveys (
      id TEXT PRIMARY KEY NOT NULL,
      site_name TEXT NOT NULL,
      status TEXT NOT NULL,
      sync_version INTEGER NOT NULL,
      sync_state TEXT NOT NULL,
      last_sync_error TEXT,
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

    ALTER TABLE local_surveys ADD COLUMN last_sync_error TEXT;
    ALTER TABLE sync_queue ADD COLUMN next_retry_at TEXT;
  `).catch(() => {
    // SQLite throws if ALTER COLUMN already applied; safe to ignore for idempotent init.
  });
}

export async function createLocalDraft(siteName: string): Promise<LocalSurvey> {
  const db = await dbPromise;

  const id = `survey-${Date.now()}`;
  const now = new Date().toISOString();
  const payload = {
    id,
    sync_version: 1,
    site_name: siteName,
    status: 'draft',
    visibility: 'private',
    factors: {},
    scores: {},
    location: {}
  };

  await db.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, sync_version, sync_state, last_sync_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, siteName, 'draft', 1, 'pending', null, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
    [id, JSON.stringify(payload), now, now]
  );

  return {
    id,
    site_name: siteName,
    status: 'draft',
    sync_version: 1,
    sync_state: 'pending',
    last_sync_error: null,
    updated_at: now
  };
}

export async function listLocalSurveys(): Promise<LocalSurvey[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<LocalSurvey>(
    `SELECT id, site_name, status, sync_version, sync_state, last_sync_error, updated_at
     FROM local_surveys
     ORDER BY updated_at DESC`
  );
  return rows;
}

export async function syncPending(apiUrl: string, accessToken: string): Promise<{ synced: number; failed: number }> {
  const db = await dbPromise;
  const nowIso = new Date().toISOString();

  const queueRows = await db.getAllAsync<QueueRow>(
    `SELECT id, survey_id, payload, status, retry_count, next_retry_at
     FROM sync_queue
     WHERE status IN ('pending', 'failed')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY id ASC`,
    [nowIso]
  );

  let synced = 0;
  let failed = 0;

  for (const row of queueRows) {
    try {
      const response = await fetch(`${apiUrl}/surveys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: row.payload
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
      await db.runAsync(
        `UPDATE local_surveys
         SET sync_state = 'synced', last_sync_error = NULL, updated_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), row.survey_id]
      );
      synced += 1;
    } catch (error) {
      failed += 1;
      const now = new Date();
      const message = (error as Error).message;
      const isConflictOrValidation = message.includes('HTTP 409') || message.includes('HTTP 422');

      if (isConflictOrValidation) {
        // Terminal failure: keep record for user visibility, remove from queue.
        await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
        await db.runAsync(
          `UPDATE local_surveys
           SET sync_state = 'failed', last_sync_error = ?, updated_at = ?
           WHERE id = ?`,
          [message, now.toISOString(), row.survey_id]
        );
        continue;
      }

      const nextRetry = computeNextRetryAt(now, row.retry_count + 1);
      await db.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', retry_count = retry_count + 1, next_retry_at = ?, updated_at = ?
         WHERE id = ?`,
        [nextRetry, now.toISOString(), row.id]
      );

      await db.runAsync(
        `UPDATE local_surveys
         SET sync_state = 'failed', last_sync_error = ?, updated_at = ?
         WHERE id = ?`,
        [message, now.toISOString(), row.survey_id]
      );
    }
  }

  return { synced, failed };
}

function computeNextRetryAt(now: Date, retryCount: number): string {
  const seconds = Math.min(300, Math.pow(2, Math.min(retryCount, 8)) * 5);
  return new Date(now.getTime() + seconds * 1000).toISOString();
}
