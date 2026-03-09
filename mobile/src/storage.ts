import * as SQLite from 'expo-sqlite';

export type LocalSurvey = {
  id: string;
  site_name: string;
  status: string;
  sync_version: number;
  sync_state: 'pending' | 'synced' | 'failed';
  last_sync_error: string | null;
  last_sync_error_code: string | null;
  last_sync_error_at: string | null;
  sync_blocked: number;
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
  last_sync_error_code: string | null;
  last_sync_error_at: string | null;
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

type SurveyQueuePayload = {
  id?: string;
  sync_version?: number;
  site_name?: string;
  status?: string;
  visibility?: string;
  region_version?: string;
  vegetation_stage?: string;
  factors?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  location?: Record<string, unknown>;
  expires_at?: string;
};

type SurveyDeleteQueuePayload = {
  kind: 'survey_delete';
  survey_id: string;
};

type UploadTargetResponse = {
  attachment_id: string;
  storage_key: string;
  upload_url: string;
  confirm_url?: string;
};

type SyncBatchOperation = {
  client_ref: string;
  entity: 'survey' | 'attachment';
  action: 'upsert' | 'create' | 'delete';
  survey_id?: string;
  payload: Record<string, unknown>;
};

type SyncBatchError = {
  code?: string;
  message?: string;
  http_status?: number;
};

type SyncBatchResult = {
  client_ref: string | null;
  entity: string;
  action: string;
  status: 'synced' | 'retryable_error' | 'fatal_error';
  data?: Record<string, unknown>;
  error?: SyncBatchError;
};

type SyncBatchResponse = {
  results?: SyncBatchResult[];
};

type RemoteSurvey = {
  id: string;
  site_name: string;
  status: string;
  visibility?: string;
  region_version?: string | null;
  vegetation_stage?: string | null;
  factors?: Record<string, unknown>;
  scores?: Record<string, unknown>;
  location?: Record<string, unknown>;
  expires_at?: string | null;
  sync_version: number;
  deleted_at?: string | null;
};

type RemoteAttachment = {
  id: string;
  survey_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at?: string | null;
  deleted_at?: string | null;
};

type SyncChangesResponse = {
  cursor_in: string | null;
  cursor_out: string | null;
  has_more: boolean;
  surveys?: RemoteSurvey[];
  attachments?: RemoteAttachment[];
};

export type DraftInput = {
  site_name: string;
  region_version: 'ACA' | 'M';
  vegetation_stage: string;
  factors: Record<string, unknown>;
};

export type UpdateDraftInput = {
  survey_id: string;
  site_name: string;
  region_version: 'ACA' | 'M';
  vegetation_stage: string;
  factors: Record<string, unknown>;
  visibility?: 'private' | 'public';
  location?: Record<string, unknown>;
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
const MAX_RETRY_COUNT = 8;

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
      last_sync_error_code TEXT,
      last_sync_error_at TEXT,
      sync_blocked INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT,
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
  `);

  // Run schema upgrades column-by-column so one duplicate-column error
  // does not prevent later columns from being added.
  await addColumnIfMissing(db, 'local_surveys', 'last_sync_error TEXT');
  await addColumnIfMissing(db, 'local_surveys', 'last_sync_error_code TEXT');
  await addColumnIfMissing(db, 'local_surveys', 'last_sync_error_at TEXT');
  await addColumnIfMissing(db, 'local_surveys', 'sync_blocked INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'local_surveys', 'payload_json TEXT');
  await addColumnIfMissing(db, 'sync_queue', 'next_retry_at TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'remote_attachment_id TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'storage_key TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'upload_url TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'confirm_url TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'last_sync_error TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'last_sync_error_code TEXT');
  await addColumnIfMissing(db, 'local_attachments', 'last_sync_error_at TEXT');
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
    `INSERT INTO local_surveys (id, site_name, status, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.site_name, 'draft', 1, 'pending', null, null, null, 0, JSON.stringify(payload), now]
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
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
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
      id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
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
    last_sync_error_code: null,
    last_sync_error_at: null,
    updated_at: now
  };
}

export async function queueDeleteSurvey(surveyId: string): Promise<{ queued_delete: boolean }> {
  const db = await dbPromise;
  const now = new Date().toISOString();

  const survey = await db.getFirstAsync<Pick<LocalSurvey, 'id' | 'sync_state'>>(
    `SELECT id, sync_state
     FROM local_surveys
     WHERE id = ?`,
    [surveyId]
  );

  if (!survey?.id) {
    return { queued_delete: false };
  }

  await db.runAsync(`DELETE FROM sync_queue WHERE survey_id = ?`, [surveyId]);

  // Keep remote state consistent even for unknown sync history by issuing an idempotent delete op.
  const payload: SurveyDeleteQueuePayload = {
    kind: 'survey_delete',
    survey_id: surveyId
  };

  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
    [surveyId, JSON.stringify(payload), now, now]
  );

  // Immediate local purge; server deletion will complete asynchronously.
  await db.runAsync(`DELETE FROM local_attachments WHERE survey_id = ?`, [surveyId]);
  await db.runAsync(`DELETE FROM local_surveys WHERE id = ?`, [surveyId]);

  return { queued_delete: true };
}

export async function getLocalSurveyDraft(surveyId: string): Promise<SurveyQueuePayload | null> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{
    id: string;
    site_name: string;
    sync_version: number;
    payload_json: string | null;
  }>(
    `SELECT id, site_name, sync_version, payload_json
     FROM local_surveys
     WHERE id = ?`,
    [surveyId]
  );

  if (!row?.id) {
    return null;
  }

  const parsedPayload = row.payload_json ? safeParseJson(row.payload_json) : null;
  if (isSurveyQueuePayload(parsedPayload)) {
    return parsedPayload;
  }

  return {
    id: row.id,
    sync_version: row.sync_version,
    site_name: row.site_name,
    status: 'draft',
    visibility: 'private',
    factors: {},
    location: {}
  };
}

export async function updateLocalDraft(input: UpdateDraftInput): Promise<LocalSurvey> {
  const db = await dbPromise;
  const now = new Date().toISOString();

  const existing = await db.getFirstAsync<{
    id: string;
    site_name: string;
    status: string;
    sync_version: number;
    payload_json: string | null;
  }>(
    `SELECT id, site_name, status, sync_version, payload_json
     FROM local_surveys
     WHERE id = ?`,
    [input.survey_id]
  );

  if (!existing?.id) {
    throw new Error(`Unknown local survey: ${input.survey_id}`);
  }

  const parsedPayload = existing.payload_json ? safeParseJson(existing.payload_json) : null;
  const basePayload = isSurveyQueuePayload(parsedPayload)
    ? parsedPayload
    : {
        id: existing.id,
        sync_version: existing.sync_version,
        site_name: existing.site_name,
        status: existing.status || 'draft',
        visibility: 'private',
        factors: {},
        location: {}
      };

  const nextSyncVersion = Math.max(1, Number(basePayload.sync_version ?? existing.sync_version ?? 0) + 1);
  const nextPayload: SurveyQueuePayload = {
    ...basePayload,
    id: input.survey_id,
    sync_version: nextSyncVersion,
    site_name: input.site_name,
    status: 'draft',
    visibility: input.visibility ?? (basePayload.visibility as 'private' | 'public' | undefined) ?? 'private',
    region_version: input.region_version,
    vegetation_stage: input.vegetation_stage,
    factors: input.factors,
    location: input.location ?? (basePayload.location as Record<string, unknown> | undefined) ?? {}
  };

  await deleteQueuedSurveyUpserts(db, input.survey_id);

  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, NULL, ?, ?)`,
    [input.survey_id, JSON.stringify(nextPayload), now, now]
  );

  await db.runAsync(
    `UPDATE local_surveys
     SET site_name = ?,
         status = 'draft',
         sync_version = ?,
         sync_state = 'pending',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         sync_blocked = 0,
         payload_json = ?,
         updated_at = ?
     WHERE id = ?`,
    [input.site_name, nextSyncVersion, JSON.stringify(nextPayload), now, input.survey_id]
  );

  return {
    id: input.survey_id,
    site_name: input.site_name,
    status: 'draft',
    sync_version: nextSyncVersion,
    sync_state: 'pending',
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
    updated_at: now
  };
}

export async function listLocalSurveys(): Promise<LocalSurvey[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<LocalSurvey>(
    `SELECT id, site_name, status, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, updated_at
     FROM local_surveys
     ORDER BY updated_at DESC`
  );
  return rows;
}

export async function listLocalAttachments(surveyId?: string): Promise<LocalAttachment[]> {
  const db = await dbPromise;
  if (surveyId) {
    return db.getAllAsync<LocalAttachment>(
      `SELECT id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, updated_at
       FROM local_attachments
       WHERE survey_id = ?
       ORDER BY updated_at DESC`,
      [surveyId]
    );
  }

  return db.getAllAsync<LocalAttachment>(
    `SELECT id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, updated_at
     FROM local_attachments
     ORDER BY updated_at DESC`
  );
}

export async function syncPending(
  apiUrl: string,
  accessToken: string
): Promise<{ synced: number; failed: number; pulled_surveys: number; pulled_attachments: number }> {
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
  const operationRows = new Map<string, { row: QueueRow; payload: SurveyQueuePayload | AttachmentQueuePayload | SurveyDeleteQueuePayload }>();
  const operations: SyncBatchOperation[] = [];
  const uploadOnlyRows: Array<{ row: QueueRow; payload: AttachmentQueuePayload; target: UploadTargetResponse }> = [];

  for (const row of queueRows) {
    const parsedPayload = safeParseJson(row.payload);

    if (isAttachmentQueuePayload(parsedPayload)) {
      const existingAttachment = await getLocalAttachmentById(db, parsedPayload.local_attachment_id);
      if (existingAttachment?.remote_attachment_id && existingAttachment.upload_url) {
        uploadOnlyRows.push({
          row,
          payload: parsedPayload,
          target: {
            attachment_id: existingAttachment.remote_attachment_id,
            storage_key: existingAttachment.storage_key ?? '',
            upload_url: existingAttachment.upload_url,
            confirm_url: existingAttachment.confirm_url ?? undefined
          }
        });
        continue;
      }

      const clientRef = String(row.id);
      operationRows.set(clientRef, { row, payload: parsedPayload });
      operations.push({
        client_ref: clientRef,
        entity: 'attachment',
        action: 'create',
        survey_id: parsedPayload.survey_id,
        payload: {
          mime_type: parsedPayload.mime_type,
          size_bytes: parsedPayload.size_bytes,
          captured_at: parsedPayload.captured_at ?? null,
          metadata: parsedPayload.metadata ?? {}
        }
      });
      continue;
    }

    if (isSurveyQueuePayload(parsedPayload)) {
      const clientRef = String(row.id);
      operationRows.set(clientRef, { row, payload: parsedPayload });
      operations.push({
        client_ref: clientRef,
        entity: 'survey',
        action: 'upsert',
        payload: parsedPayload
      });
      continue;
    }

    if (isSurveyDeleteQueuePayload(parsedPayload)) {
      const clientRef = String(row.id);
      operationRows.set(clientRef, { row, payload: parsedPayload });
      operations.push({
        client_ref: clientRef,
        entity: 'survey',
        action: 'delete',
        survey_id: parsedPayload.survey_id,
        payload: {
          id: parsedPayload.survey_id
        }
      });
      continue;
    }

    failed += 1;
    await handleSurveySyncFailure(db, row, 'Invalid sync payload', {
      terminalOverride: true,
      errorCode: 'invalid_local_payload'
    });
  }

  if (operations.length > 0) {
    let batchResults: SyncBatchResult[] = [];

    try {
      const response = await fetch(`${apiUrl}/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        throw new Error(`BATCH_HTTP ${response.status}`);
      }

      const payload = (await safeJson(response)) as SyncBatchResponse;
      batchResults = Array.isArray(payload.results) ? payload.results : [];
    } catch (error) {
      const message = (error as Error).message;
      for (const operation of operations) {
        failed += 1;
        const linked = operationRows.get(operation.client_ref);
        if (!linked) continue;

        if (isAttachmentQueuePayload(linked.payload)) {
          await handleAttachmentSyncFailure(db, linked.row, linked.payload, message, {
            terminalOverride: false
          });
        } else {
          await handleSurveySyncFailure(db, linked.row, message, {
            terminalOverride: false
          });
        }
      }
      batchResults = [];
    }

    for (const result of batchResults) {
      const clientRef = result.client_ref ?? '';
      const linked = operationRows.get(clientRef);
      if (!linked) {
        continue;
      }

      const message = buildSyncResultMessage(result);

      if (result.status === 'synced') {
        if (isAttachmentQueuePayload(linked.payload)) {
          const target = toUploadTarget(result.data);
          if (!target) {
            failed += 1;
            await handleAttachmentSyncFailure(db, linked.row, linked.payload, 'Invalid attachment sync response', {
              terminalOverride: true,
              errorCode: 'invalid_attachment_response'
            });
            continue;
          }

          await saveAttachmentUploadTarget(db, linked.payload.local_attachment_id, target);

          try {
            await uploadAttachmentAndMarkSynced(db, linked.row, linked.payload, target, apiUrl, accessToken);
            synced += 1;
          } catch (error) {
            failed += 1;
            await handleAttachmentSyncFailure(db, linked.row, linked.payload, (error as Error).message);
          }
        } else {
          if (isSurveyDeleteQueuePayload(linked.payload)) {
            await markSurveyDeleteRowSynced(db, linked.row);
          } else {
            await markSurveyQueueRowSynced(db, linked.row);
          }
          synced += 1;
        }
        continue;
      }

      if (isAttachmentQueuePayload(linked.payload)) {
        failed += 1;
        await handleAttachmentSyncFailure(db, linked.row, linked.payload, message, {
          terminalOverride: result.status === 'fatal_error',
          errorCode: result.error?.code
        });
      } else {
        failed += 1;
        await handleSurveySyncFailure(db, linked.row, message, {
          terminalOverride: result.status === 'fatal_error',
          errorCode: result.error?.code
        });
      }
    }
  }

  for (const item of uploadOnlyRows) {
    try {
      await uploadAttachmentAndMarkSynced(db, item.row, item.payload, item.target, apiUrl, accessToken);
      synced += 1;
    } catch (error) {
      failed += 1;
      await handleAttachmentSyncFailure(db, item.row, item.payload, (error as Error).message);
    }
  }

  const pulled = await pullRemoteChanges(apiUrl, accessToken).catch(() => ({
    surveys: 0,
    attachments: 0,
    pages: 0,
    has_more: false
  }));

  return {
    synced,
    failed,
    pulled_surveys: pulled.surveys,
    pulled_attachments: pulled.attachments
  };
}

export async function pullRemoteChanges(
  apiUrl: string,
  accessToken: string,
  options?: { maxPages?: number; limit?: number }
): Promise<{ surveys: number; attachments: number; pages: number; has_more: boolean }> {
  const db = await dbPromise;
  const maxPages = Math.max(1, Math.min(10, options?.maxPages ?? 5));
  const limit = Math.max(1, Math.min(200, options?.limit ?? 50));

  let cursor = await getMetaValue(db, 'downsync_cursor');
  let pages = 0;
  let totalSurveys = 0;
  let totalAttachments = 0;
  let hasMore = false;

  for (let index = 0; index < maxPages; index += 1) {
    const response = await fetch(buildSyncChangesUrl(apiUrl, cursor, limit), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`DOWNSYNC_HTTP ${response.status}`);
    }

    const payload = (await safeJson(response)) as SyncChangesResponse;
    const surveys = Array.isArray(payload.surveys) ? payload.surveys : [];
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

    const applied = await applyRemoteChanges(db, surveys, attachments);
    totalSurveys += applied.surveys;
    totalAttachments += applied.attachments;
    pages += 1;

    if (payload.cursor_out && payload.cursor_out !== cursor) {
      cursor = payload.cursor_out;
      await setMetaValue(db, 'downsync_cursor', cursor);
    }

    hasMore = Boolean(payload.has_more);
    if (!hasMore) {
      break;
    }
  }

  return {
    surveys: totalSurveys,
    attachments: totalAttachments,
    pages,
    has_more: hasMore
  };
}

export async function retrySurveyNow(surveyId: string): Promise<{ queued: number }> {
  const db = await dbPromise;
  const now = new Date().toISOString();

  const updatedQueue = await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending',
         next_retry_at = NULL,
         updated_at = ?
     WHERE survey_id = ?
       AND status = 'failed'`,
    [now, surveyId]
  );

  await db.runAsync(
    `UPDATE local_surveys
     SET sync_state = 'pending',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         sync_blocked = 0,
         updated_at = ?
     WHERE id = ?`,
    [now, surveyId]
  );

  await db.runAsync(
    `UPDATE local_attachments
     SET sync_state = 'pending',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         updated_at = ?
     WHERE survey_id = ?
       AND sync_state = 'failed'`,
    [now, surveyId]
  );

  return { queued: Number((updatedQueue as { changes?: number }).changes ?? 0) };
}

export async function discardSurveyLocalChanges(surveyId: string): Promise<{ removed_queue: number }> {
  const db = await dbPromise;
  const now = new Date().toISOString();

  const removedQueue = await db.runAsync(`DELETE FROM sync_queue WHERE survey_id = ?`, [surveyId]);

  await db.runAsync(
    `UPDATE local_surveys
     SET sync_state = 'synced',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         sync_blocked = 0,
         updated_at = ?
     WHERE id = ?`,
    [now, surveyId]
  );

  await db.runAsync(
    `DELETE FROM local_attachments
     WHERE survey_id = ?
       AND sync_state <> 'synced'`,
    [surveyId]
  );

  return { removed_queue: Number((removedQueue as { changes?: number }).changes ?? 0) };
}

async function markSurveyQueueRowSynced(db: SQLite.SQLiteDatabase, row: QueueRow): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  await db.runAsync(
    `UPDATE local_surveys
     SET sync_state = 'synced',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         sync_blocked = 0,
         updated_at = ?
     WHERE id = ?`,
    [now, row.survey_id]
  );
}

async function markSurveyDeleteRowSynced(db: SQLite.SQLiteDatabase, row: QueueRow): Promise<void> {
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  await db.runAsync(`DELETE FROM local_attachments WHERE survey_id = ?`, [row.survey_id]);
  await db.runAsync(`DELETE FROM local_surveys WHERE id = ?`, [row.survey_id]);
}

async function uploadAttachmentAndMarkSynced(
  db: SQLite.SQLiteDatabase,
  row: QueueRow,
  payload: AttachmentQueuePayload,
  target: UploadTargetResponse,
  apiUrl: string,
  accessToken: string
): Promise<void> {
  const uploadTarget = resolveUploadTarget(apiUrl, target.upload_url);
  const confirmUrl = target.confirm_url ?? target.upload_url;
  const confirmTarget = resolveUploadTarget(apiUrl, confirmUrl);
  const isApiUploadTarget =
    uploadTarget.includes('/surveys/') &&
    uploadTarget.includes('/attachments/') &&
    uploadTarget.includes('/upload?token=');

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

  const now = new Date().toISOString();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  await db.runAsync(
    `UPDATE local_attachments
     SET sync_state = 'synced',
         remote_attachment_id = ?,
         storage_key = ?,
         upload_url = ?,
         confirm_url = ?,
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         updated_at = ?
     WHERE id = ?`,
    [
      target.attachment_id,
      target.storage_key ?? null,
      target.upload_url,
      target.confirm_url ?? null,
      now,
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

function isSurveyQueuePayload(payload: unknown): payload is SurveyQueuePayload {
  if (!payload || typeof payload !== 'object') return false;
  return (
    typeof (payload as { id?: string }).id === 'string' &&
    typeof (payload as { sync_version?: number }).sync_version === 'number' &&
    typeof (payload as { site_name?: string }).site_name === 'string'
  );
}

function isSurveyDeleteQueuePayload(payload: unknown): payload is SurveyDeleteQueuePayload {
  if (!payload || typeof payload !== 'object') return false;
  return (
    (payload as { kind?: string }).kind === 'survey_delete' &&
    typeof (payload as { survey_id?: string }).survey_id === 'string'
  );
}

async function getLocalAttachmentById(
  db: SQLite.SQLiteDatabase,
  localAttachmentId: string
): Promise<Pick<LocalAttachment, 'id' | 'remote_attachment_id' | 'storage_key' | 'upload_url' | 'confirm_url'> | null> {
  const row = await db.getFirstAsync<Pick<LocalAttachment, 'id' | 'remote_attachment_id' | 'storage_key' | 'upload_url' | 'confirm_url'>>(
    `SELECT id, remote_attachment_id, storage_key, upload_url, confirm_url
     FROM local_attachments
     WHERE id = ?`,
    [localAttachmentId]
  );
  return row ?? null;
}

async function saveAttachmentUploadTarget(db: SQLite.SQLiteDatabase, localAttachmentId: string, target: UploadTargetResponse): Promise<void> {
  await db.runAsync(
    `UPDATE local_attachments
     SET remote_attachment_id = ?,
         storage_key = ?,
         upload_url = ?,
         confirm_url = ?,
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         updated_at = ?
     WHERE id = ?`,
    [target.attachment_id, target.storage_key ?? null, target.upload_url, target.confirm_url ?? null, new Date().toISOString(), localAttachmentId]
  );
}

function toUploadTarget(data: Record<string, unknown> | undefined): UploadTargetResponse | null {
  if (!data) return null;

  const attachmentId = data.attachment_id;
  const storageKey = data.storage_key;
  const uploadUrl = data.upload_url;
  const confirmUrl = data.confirm_url;

  if (typeof attachmentId !== 'string' || typeof uploadUrl !== 'string') {
    return null;
  }

  return {
    attachment_id: attachmentId,
    storage_key: typeof storageKey === 'string' ? storageKey : '',
    upload_url: uploadUrl,
    confirm_url: typeof confirmUrl === 'string' ? confirmUrl : undefined
  };
}

function buildSyncResultMessage(result: SyncBatchResult): string {
  const errorMessage = result.error?.message ?? result.status;
  const http = result.error?.http_status;
  if (typeof http === 'number') {
    return `HTTP ${http} ${errorMessage}`.trim();
  }
  return errorMessage;
}

async function applyRemoteChanges(
  db: SQLite.SQLiteDatabase,
  surveys: RemoteSurvey[],
  attachments: RemoteAttachment[]
): Promise<{ surveys: number; attachments: number }> {
  const now = new Date().toISOString();
  let appliedSurveys = 0;
  let appliedAttachments = 0;

  for (const survey of surveys) {
    if (!survey?.id) continue;
    if (survey.deleted_at) {
      await db.runAsync(`DELETE FROM sync_queue WHERE survey_id = ?`, [survey.id]);
      await db.runAsync(`DELETE FROM local_attachments WHERE survey_id = ?`, [survey.id]);
      await db.runAsync(`DELETE FROM local_surveys WHERE id = ?`, [survey.id]);
      appliedSurveys += 1;
      continue;
    }

    const pendingQueue = await hasPendingQueueForSurvey(db, survey.id);

    const existing = await db.getFirstAsync<{ id: string; sync_state: string }>(
      `SELECT id, sync_state FROM local_surveys WHERE id = ?`,
      [survey.id]
    );

    if (!existing) {
      const payload = buildSurveyPayloadFromRemote(survey);
      await db.runAsync(
        `INSERT INTO local_surveys (id, site_name, status, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, updated_at)
         VALUES (?, ?, ?, ?, 'synced', NULL, NULL, NULL, 0, ?, ?)`,
        [survey.id, survey.site_name ?? 'Remote survey', survey.status ?? 'draft', survey.sync_version ?? 1, JSON.stringify(payload), now]
      );
      appliedSurveys += 1;
      continue;
    }

    if (!pendingQueue) {
      const payload = buildSurveyPayloadFromRemote(survey);
      await db.runAsync(
        `UPDATE local_surveys
         SET site_name = ?,
             status = ?,
             sync_version = ?,
             sync_state = 'synced',
             last_sync_error = NULL,
             last_sync_error_code = NULL,
             last_sync_error_at = NULL,
             sync_blocked = 0,
             payload_json = ?,
             updated_at = ?
         WHERE id = ?`,
        [survey.site_name ?? 'Remote survey', survey.status ?? 'draft', survey.sync_version ?? 1, JSON.stringify(payload), now, survey.id]
      );
      appliedSurveys += 1;
    }
  }

  for (const attachment of attachments) {
    if (!attachment?.id || !attachment.survey_id) continue;

    if (attachment.deleted_at) {
      await db.runAsync(
        `DELETE FROM local_attachments
         WHERE remote_attachment_id = ?
            OR id = ?`,
        [attachment.id, `remote-${attachment.id}`]
      );
      appliedAttachments += 1;
      continue;
    }

    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM local_attachments
       WHERE remote_attachment_id = ?
          OR id = ?
       LIMIT 1`,
      [attachment.id, `remote-${attachment.id}`]
    );

    if (!existing) {
      await db.runAsync(
        `INSERT INTO local_attachments (
           id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, storage_key, upload_url, confirm_url, last_sync_error, last_sync_error_code, last_sync_error_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
        [
          `remote-${attachment.id}`,
          attachment.survey_id,
          '',
          attachment.mime_type ?? 'application/octet-stream',
          attachment.size_bytes ?? 0,
          attachment.id,
          attachment.storage_key ?? null,
          now,
          now
        ]
      );
    } else {
      await db.runAsync(
        `UPDATE local_attachments
         SET survey_id = ?,
             mime_type = ?,
             size_bytes = ?,
             sync_state = 'synced',
             remote_attachment_id = ?,
             storage_key = ?,
             last_sync_error = NULL,
             last_sync_error_code = NULL,
             last_sync_error_at = NULL,
             updated_at = ?
         WHERE id = ?`,
        [
          attachment.survey_id,
          attachment.mime_type ?? 'application/octet-stream',
          attachment.size_bytes ?? 0,
          attachment.id,
          attachment.storage_key ?? null,
          now,
          existing.id
        ]
      );
    }

    appliedAttachments += 1;
  }

  return { surveys: appliedSurveys, attachments: appliedAttachments };
}

function buildSurveyPayloadFromRemote(survey: RemoteSurvey): SurveyQueuePayload {
  return {
    id: survey.id,
    sync_version: survey.sync_version ?? 1,
    site_name: survey.site_name ?? 'Remote survey',
    status: survey.status ?? 'draft',
    visibility: (survey.visibility as 'private' | 'public' | undefined) ?? 'private',
    region_version: survey.region_version ?? undefined,
    vegetation_stage: survey.vegetation_stage ?? undefined,
    factors: survey.factors ?? {},
    scores: survey.scores ?? {},
    location: survey.location ?? {},
    expires_at: survey.expires_at ?? undefined
  };
}

async function hasPendingQueueForSurvey(db: SQLite.SQLiteDatabase, surveyId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM sync_queue
     WHERE survey_id = ?
       AND status IN ('pending', 'failed')`,
    [surveyId]
  );
  return Number(row?.count ?? 0) > 0;
}

async function deleteQueuedSurveyUpserts(db: SQLite.SQLiteDatabase, surveyId: string): Promise<void> {
  const rows = await db.getAllAsync<Array<{ id: number; payload: string }>[number]>(
    `SELECT id, payload
     FROM sync_queue
     WHERE survey_id = ?`,
    [surveyId]
  );

  for (const row of rows) {
    const payload = safeParseJson(row.payload);
    if (isSurveyQueuePayload(payload)) {
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
    }
  }
}

function buildSyncChangesUrl(apiUrl: string, cursor: string | null, limit: number): string {
  const base = apiUrl.replace(/\/+$/, '');
  const params = [`limit=${encodeURIComponent(String(limit))}`];
  if (cursor) {
    params.push(`cursor=${encodeURIComponent(cursor)}`);
  }
  return `${base}/sync/changes?${params.join('&')}`;
}

async function getMetaValue(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value
     FROM local_meta
     WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

async function setMetaValue(db: SQLite.SQLiteDatabase, key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, value, now]
  );
}

type FailureOptions = {
  terminalOverride?: boolean;
  errorCode?: string;
};

async function handleSurveySyncFailure(
  db: SQLite.SQLiteDatabase,
  row: QueueRow,
  message: string,
  options?: FailureOptions
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const nextRetryCount = row.retry_count + 1;
  const reachedRetryCap = nextRetryCount >= MAX_RETRY_COUNT;
  const terminalByMessage = isTerminalSurveyError(message);
  const terminal = options?.terminalOverride ?? (terminalByMessage || reachedRetryCap);
  const finalMessage = reachedRetryCap && !terminalByMessage && !options?.terminalOverride
    ? `${message} | retry cap reached (${MAX_RETRY_COUNT})`
    : message;
  const errorCode = options?.errorCode ?? deriveSurveyErrorCode(finalMessage);

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  } else {
    const nextRetryAt = computeNextRetryAt(now, nextRetryCount);
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetryCount, nextRetryAt, nowIso, row.id]
    );
  }

  await db.runAsync(
    `UPDATE local_surveys
     SET sync_state = 'failed',
         last_sync_error = ?,
         last_sync_error_code = ?,
         last_sync_error_at = ?,
         sync_blocked = ?,
         updated_at = ?
     WHERE id = ?`,
    [finalMessage, errorCode, nowIso, terminal ? 1 : 0, nowIso, row.survey_id]
  );
}

async function handleAttachmentSyncFailure(
  db: SQLite.SQLiteDatabase,
  row: QueueRow,
  payload: AttachmentQueuePayload,
  message: string,
  options?: FailureOptions
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const nextRetryCount = row.retry_count + 1;
  const reachedRetryCap = nextRetryCount >= MAX_RETRY_COUNT;
  const terminalByMessage = isTerminalAttachmentError(message);
  const terminal = options?.terminalOverride ?? (terminalByMessage || reachedRetryCap);
  const finalMessage = reachedRetryCap && !terminalByMessage && !options?.terminalOverride
    ? `${message} | retry cap reached (${MAX_RETRY_COUNT})`
    : message;
  const errorCode = options?.errorCode ?? deriveAttachmentErrorCode(finalMessage);

  if (terminal) {
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
  } else {
    const nextRetryAt = computeNextRetryAt(now, nextRetryCount);
    await db.runAsync(
      `UPDATE sync_queue
       SET status = 'failed', retry_count = ?, next_retry_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextRetryCount, nextRetryAt, nowIso, row.id]
    );
  }

  await db.runAsync(
    `UPDATE local_attachments
     SET sync_state = 'failed',
         last_sync_error = ?,
         last_sync_error_code = ?,
         last_sync_error_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [finalMessage, errorCode, nowIso, nowIso, payload.local_attachment_id]
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
       SET sync_state = 'failed',
           last_sync_error = ?,
           last_sync_error_code = 'submit_failed',
           last_sync_error_at = ?,
           sync_blocked = 1,
           updated_at = ?
       WHERE id = ?`,
      [message, new Date().toISOString(), new Date().toISOString(), surveyId]
    );

    return { ok: false, message };
  }

  await db.runAsync(
    `UPDATE local_surveys
     SET status = 'submitted',
         sync_state = 'synced',
         last_sync_error = NULL,
         last_sync_error_code = NULL,
         last_sync_error_at = NULL,
         sync_blocked = 0,
         updated_at = ?
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

function deriveSurveyErrorCode(message: string): string {
  if (message.includes('HTTP 409')) return 'sync_version_conflict';
  if (message.includes('HTTP 422')) return 'survey_validation_failed';
  if (message.includes('HTTP 400')) return 'bad_request';
  if (message.includes('HTTP 401')) return 'unauthorized';
  if (message.includes('HTTP 403')) return 'forbidden';
  if (message.includes('HTTP 404')) return 'not_found';
  if (message.includes('HTTP 429')) return 'rate_limited';
  if (message.includes('HTTP 5') || message.includes('BATCH_HTTP 5')) return 'transient_upstream_error';
  if (message.includes('BATCH_HTTP')) return 'network_gateway_error';
  if (message.includes('retry cap reached')) return 'retry_cap_reached';
  return 'sync_failed';
}

function deriveAttachmentErrorCode(message: string): string {
  if (message.includes('UPLOAD_HTTP 400')) return 'attachment_bad_request';
  if (message.includes('UPLOAD_HTTP 401') || message.includes('CONFIRM_HTTP 401')) return 'unauthorized';
  if (message.includes('UPLOAD_HTTP 403') || message.includes('CONFIRM_HTTP 403')) return 'forbidden';
  if (message.includes('UPLOAD_HTTP 404') || message.includes('CONFIRM_HTTP 404') || message.includes('LOCAL_FILE_HTTP 404')) return 'not_found';
  if (message.includes('UPLOAD_HTTP 429') || message.includes('CONFIRM_HTTP 429')) return 'rate_limited';
  if (message.includes('UPLOAD_HTTP 5') || message.includes('CONFIRM_HTTP 5')) return 'transient_upstream_error';
  if (message.includes('HTTP 409')) return 'sync_version_conflict';
  if (message.includes('HTTP 422')) return 'attachment_validation_failed';
  if (message.includes('retry cap reached')) return 'retry_cap_reached';
  return 'attachment_sync_failed';
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
