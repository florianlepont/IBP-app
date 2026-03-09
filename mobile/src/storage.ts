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

export type LocalAttachment = {
  id: string;
  survey_id: string;
  local_uri: string;
  mime_type: string;
  size_bytes: number;
  sync_state: 'pending' | 'synced' | 'failed';
  remote_attachment_id: string | null;
  storage_key: string | null;
  upload_url: string | null;
  confirm_url: string | null;
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

type AttachmentQueuePayload = {
  kind: 'attachment_upload';
  local_attachment_id: string;
  survey_id: string;
  local_uri: string;
  mime_type: string;
  size_bytes: number;
  captured_at?: string;
  metadata?: Record<string, unknown>;
};

type UploadTargetResponse = {
  attachment_id: string;
  storage_key: string;
  upload_url: string;
  confirm_url?: string;
};

export type DraftInput = {
  site_name: string;
  region_version: 'ACA' | 'M';
  vegetation_stage: string;
  factors: Record<string, unknown>;
};

export type LocalAttachmentInput = {
  survey_id: string;
  local_uri: string;
  mime_type: string;
  size_bytes: number;
  captured_at?: string;
  metadata?: Record<string, unknown>;
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_attachments_survey
      ON local_attachments(survey_id, created_at DESC);
  `);

  // Run schema upgrades column-by-column so one duplicate-column error
  // does not prevent later columns from being added.
  await addColumnIfMissing(db, 'local_surveys', 'last_sync_error TEXT');
  await addColumnIfMissing(db, 'sync_queue', 'next_retry_at TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'remote_attachment_id TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'storage_key TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'upload_url TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'confirm_url TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'last_sync_error TEXT');
}

export async function createLocalDraft(input: DraftInput): Promise<LocalSurvey> {
  const db = await dbPromise;

  const id = `survey-${Date.now()}`;
  const now = new Date().toISOString();
  const payload = {
    id,
    sync_version: 1,
    site_name: input.site_name,
    status: 'draft',
    visibility: 'private',
    region_version: input.region_version,
    vegetation_stage: input.vegetation_stage,
    factors: input.factors,
    location: {}
  };

  await db.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, sync_version, sync_state, last_sync_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.site_name, 'draft', 1, 'pending', null, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
    [id, JSON.stringify(payload), now, now]
  );

  return {
    id,
    site_name: input.site_name,
    status: 'draft',
    sync_version: 1,
    sync_state: 'pending',
    last_sync_error: null,
    updated_at: now
  };
}

export async function queueLocalAttachment(input: LocalAttachmentInput): Promise<LocalAttachment> {
  const db = await dbPromise;
  const now = new Date().toISOString();

  const survey = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM local_surveys WHERE id = ?`,
    [input.survey_id]
  );
  if (!survey?.id) {
    throw new Error(`Unknown local survey: ${input.survey_id}`);
  }

  const localAttachmentId = `attachment-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const queuePayload: AttachmentQueuePayload = {
    kind: 'attachment_upload',
    local_attachment_id: localAttachmentId,
    survey_id: input.survey_id,
    local_uri: input.local_uri,
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    captured_at: input.captured_at,
    metadata: input.metadata ?? {}
  };

  await db.runAsync(
    `INSERT INTO local_attachments (
      id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    [localAttachmentId, input.survey_id, input.local_uri, input.mime_type, input.size_bytes, now, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
    [input.survey_id, JSON.stringify(queuePayload), now, now]
  );

  return {
    id: localAttachmentId,
    survey_id: input.survey_id,
    local_uri: input.local_uri,
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    sync_state: 'pending',
    remote_attachment_id: null,
    storage_key: null,
    upload_url: null,
    confirm_url: null,
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

export async function listLocalAttachments(surveyId?: string): Promise<LocalAttachment[]> {
  const db = await dbPromise;
  if (surveyId) {
    return db.getAllAsync<LocalAttachment>(
      `SELECT id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, updated_at
       FROM local_attachments
       WHERE survey_id = ?
       ORDER BY updated_at DESC`,
      [surveyId]
    );
  }

  return db.getAllAsync<LocalAttachment>(
    `SELECT id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, updated_at
     FROM local_attachments
     ORDER BY updated_at DESC`
  );
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
    const payload = safeParseJson(row.payload);

    try {
      if (isAttachmentQueuePayload(payload)) {
        await syncAttachmentRow(db, row, payload, apiUrl, accessToken);
      } else {
        await syncSurveyRow(db, row, apiUrl, accessToken);
      }
      synced += 1;
    } catch (error) {
      failed += 1;
      const message = (error as Error).message;

      if (isAttachmentQueuePayload(payload)) {
        await handleAttachmentSyncFailure(db, row, payload, message);
      } else {
        await handleSurveySyncFailure(db, row, message);
      }
    }
  }

  return { synced, failed };
}

async function syncSurveyRow(db: SQLite.SQLiteDatabase, row: QueueRow, apiUrl: string, accessToken: string): Promise<void> {
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
}

async function syncAttachmentRow(
  db: SQLite.SQLiteDatabase,
  row: QueueRow,
  payload: AttachmentQueuePayload,
  apiUrl: string,
  accessToken: string
): Promise<void> {
  const createResponse = await fetch(`${apiUrl}/surveys/${payload.survey_id}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mime_type: payload.mime_type,
      size_bytes: payload.size_bytes,
      captured_at: payload.captured_at ?? null,
      metadata: payload.metadata ?? {}
    })
  });

  if (!createResponse.ok) {
    throw new Error(`HTTP ${createResponse.status}`);
  }

  const created = (await safeJson(createResponse)) as UploadTargetResponse;
  if (!created.attachment_id || !created.upload_url) {
    throw new Error('Invalid attachment create response');
  }

  const uploadTarget = resolveUploadTarget(apiUrl, created.upload_url);
  const confirmUrl = created.confirm_url ?? created.upload_url;
  const confirmTarget = resolveUploadTarget(apiUrl, confirmUrl);
  const isApiUploadTarget = uploadTarget.includes('/surveys/') && uploadTarget.includes('/attachments/') && uploadTarget.includes('/upload?token=');

  const uploadResponse = isApiUploadTarget
    ? await uploadFileViaApi(uploadTarget, payload, accessToken)
    : await uploadFileDirect(uploadTarget, payload);

  if (!uploadResponse.ok) {
    throw new Error(`UPLOAD_HTTP ${uploadResponse.status}`);
  }

  if (confirmTarget !== uploadTarget) {
    const confirmResponse = await fetch(confirmTarget, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!confirmResponse.ok) {
      throw new Error(`CONFIRM_HTTP ${confirmResponse.status}`);
    }
  }

  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  await db.runAsync(
    `UPDATE local_attachments
     SET sync_state = 'synced',
         remote_attachment_id = ?,
         storage_key = ?,
         upload_url = ?,
         confirm_url = ?,
         last_sync_error = NULL,
         updated_at = ?
     WHERE id = ?`,
    [
      created.attachment_id,
      created.storage_key ?? null,
      created.upload_url,
      created.confirm_url ?? null,
      new Date().toISOString(),
      payload.local_attachment_id
    ]
  );
}

async function uploadFileViaApi(uploadTarget: string, payload: AttachmentQueuePayload, accessToken: string): Promise<Response> {
  const form = new FormData();
  form.append('file', {
    uri: payload.local_uri,
    type: payload.mime_type,
    name: `attachment-${payload.local_attachment_id}`
  } as any);

  return fetch(uploadTarget, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: form
  });
}

async function uploadFileDirect(uploadTarget: string, payload: AttachmentQueuePayload): Promise<Response> {
  const fileResponse = await fetch(payload.local_uri);
  if (!fileResponse.ok) {
    throw new Error(`LOCAL_FILE_HTTP ${fileResponse.status}`);
  }
  const blob = await fileResponse.blob();

  return fetch(uploadTarget, {
    method: 'PUT',
    headers: {
      'Content-Type': payload.mime_type
    },
    body: blob
  });
}

async function handleSurveySyncFailure(db: SQLite.SQLiteDatabase, row: QueueRow, message: string): Promise<void> {
  const now = new Date();
  const terminal = isTerminalSurveyError(message);

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  } else {
    const nextRetry = computeNextRetryAt(now, row.retry_count + 1);
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = retry_count + 1, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetry, now.toISOString(), row.id]
    );
  }

  await db.runAsync(
    `UPDATE local_surveys
     SET sync_state = 'failed', last_sync_error = ?, updated_at = ?
     WHERE id = ?`,
    [message, now.toISOString(), row.survey_id]
  );
}

async function handleAttachmentSyncFailure(
  db: SQLite.SQLiteDatabase,
  row: QueueRow,
  payload: AttachmentQueuePayload,
  message: string
): Promise<void> {
  const now = new Date();
  const terminal = isTerminalAttachmentError(message);

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  } else {
    const nextRetry = computeNextRetryAt(now, row.retry_count + 1);
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = retry_count + 1, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetry, now.toISOString(), row.id]
    );
  }

  await db.runAsync(
    `UPDATE local_attachments
     SET sync_state = 'failed', last_sync_error = ?, updated_at = ?
     WHERE id = ?`,
    [message, now.toISOString(), payload.local_attachment_id]
  );
}

export async function submitSurvey(apiUrl: string, accessToken: string, surveyId: string): Promise<{ ok: boolean; message: string }> {
  const db = await dbPromise;

  const response = await fetch(`${apiUrl}/surveys/${surveyId}/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const payload = (await safeJson(response)) as { errors?: string[]; message?: string };
    const message = payload.errors?.join(' | ') ?? payload.message ?? `HTTP ${response.status}`;

    await db.runAsync(
      `UPDATE local_surveys
       SET sync_state = 'failed', last_sync_error = ?, updated_at = ?
       WHERE id = ?`,
      [message, new Date().toISOString(), surveyId]
    );

    return { ok: false, message };
  }

  await db.runAsync(
    `UPDATE local_surveys
     SET status = 'submitted', sync_state = 'synced', last_sync_error = NULL, updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), surveyId]
  );

  return { ok: true, message: 'Survey submitted' };
}

function isAttachmentQueuePayload(payload: unknown): payload is AttachmentQueuePayload {
  if (!payload || typeof payload !== 'object') return false;
  return (
    (payload as { kind?: string }).kind === 'attachment_upload' &&
    typeof (payload as { local_attachment_id?: string }).local_attachment_id === 'string' &&
    typeof (payload as { survey_id?: string }).survey_id === 'string'
  );
}

function resolveUploadTarget(apiUrl: string, uploadUrl: string): string {
  const base = apiUrl.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(uploadUrl)) {
    return uploadUrl;
  }
  if (uploadUrl.startsWith('/')) {
    return `${base}${uploadUrl}`;
  }
  return `${base}/${uploadUrl}`;
}

function isTerminalSurveyError(message: string): boolean {
  return ['HTTP 400', 'HTTP 401', 'HTTP 403', 'HTTP 404', 'HTTP 409', 'HTTP 422'].some((code) => message.includes(code));
}

function isTerminalAttachmentError(message: string): boolean {
  return (
    [
      'HTTP 400',
      'HTTP 401',
      'HTTP 403',
      'HTTP 404',
      'HTTP 409',
      'HTTP 422',
      'UPLOAD_HTTP 400',
      'UPLOAD_HTTP 401',
      'UPLOAD_HTTP 403',
      'UPLOAD_HTTP 404',
      'CONFIRM_HTTP 400',
      'CONFIRM_HTTP 401',
      'CONFIRM_HTTP 403',
      'CONFIRM_HTTP 404',
      'LOCAL_FILE_HTTP 404'
    ].some((code) =>
      message.includes(code)
    )
  );
}

function computeNextRetryAt(now: Date, retryCount: number): string {
  const seconds = Math.min(300, Math.pow(2, Math.min(retryCount, 8)) * 5);
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function addColumnIfMissing(db: SQLite.SQLiteDatabase, table: string, columnDef: string): Promise<void> {
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`).catch(() => {
    // Column likely already exists; keep migration idempotent.
  });
}
