import * as SQLite from 'expo-sqlite';

export type LocalSurvey = {
  id: string;
  site_name: string;
  status: string;
  sync_version: number;
  sync_state: 'pending' | 'synced' | 'failed';
  updated_at: string;
};

type QueueRow = {
  id: number;
  survey_id: string;
  payload: string;
  status: 'pending' | 'failed';
  retry_count: number;
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
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      survey_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
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
    `INSERT INTO local_surveys (id, site_name, status, sync_version, sync_state, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, siteName, 'draft', 1, 'pending', now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, ?, ?)`,
    [id, JSON.stringify(payload), now, now]
  );

  return {
    id,
    site_name: siteName,
    status: 'draft',
    sync_version: 1,
    sync_state: 'pending',
    updated_at: now
  };
}

export async function listLocalSurveys(): Promise<LocalSurvey[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<LocalSurvey>(
    `SELECT id, site_name, status, sync_version, sync_state, updated_at
     FROM local_surveys
     ORDER BY updated_at DESC`
  );
  return rows;
}

export async function syncPending(apiUrl: string, accessToken: string): Promise<{ synced: number; failed: number }> {
  const db = await dbPromise;
  const queueRows = await db.getAllAsync<QueueRow>(
    `SELECT id, survey_id, payload, status, retry_count
     FROM sync_queue
     WHERE status IN ('pending', 'failed')
     ORDER BY id ASC`
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
         SET sync_state = 'synced', updated_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), row.survey_id]
      );
      synced += 1;
    } catch (_error) {
      failed += 1;
      const now = new Date().toISOString();

      await db.runAsync(
        `UPDATE sync_queue
         SET status = 'failed', retry_count = retry_count + 1, updated_at = ?
         WHERE id = ?`,
        [now, row.id]
      );

      await db.runAsync(
        `UPDATE local_surveys
         SET sync_state = 'failed', updated_at = ?
         WHERE id = ?`,
        [now, row.survey_id]
      );
    }
  }

  return { synced, failed };
}
