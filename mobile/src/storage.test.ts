/**
 * Tests for storage.ts — SQLite local persistence layer.
 *
 * Strategy: mock expo-sqlite at the module level so that dbPromise resolves
 * to a fully controllable in-memory stub. The mock DB functions are Jest spies
 * that can be configured per test with mockResolvedValueOnce / mockReturnValueOnce.
 */

// ── Jest hoists jest.mock() calls. Variables starting with "mock" are allowed
// to be referenced inside the factory function despite hoisting. ────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = jest.Mock<Promise<any>, any[]>

const mockDb = {
  execAsync: jest.fn() as MockFn,
  runAsync: jest.fn() as MockFn,
  getFirstAsync: jest.fn() as MockFn,
  getAllAsync: jest.fn() as MockFn,
}

// Helper to safely extract call arguments from runAsync mock calls
function getRunAsyncPayload(calls: unknown[][], sqlFragment: string): unknown[] | undefined {
  const call = calls.find((c) => typeof c[0] === 'string' && (c[0] as string).includes(sqlFragment))
  if (!call) return undefined
  // runAsync(sql, params[]) - params is second arg
  return call[1] as unknown[] | undefined
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue(mockDb),
}))

// ── Imports (happen after mock is registered) ─────────────────────────────
import {
  initLocalDb,
  createLocalDraft,
  updateLocalDraft,
  getLocalSurveyDraft,
  listLocalSurveys,
  listLocalAttachments,
  hasPendingSyncWork,
  queueDeleteSurvey,
  queueLocalAttachment,
  queueDeleteAttachment,
  retrySurveyNow,
  discardSurveyLocalChanges,
  markSurveyExpiredLocally,
  clearLocalIbpData,
  syncPending,
  pullRemoteChanges,
} from './storage'

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_SURVEY_ID = 'survey-test-1'
const TEST_NOW = '2026-01-01T00:00:00.000Z'

function makeSurveyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SURVEY_ID,
    site_name: 'Test site',
    status: 'draft',
    visibility: 'private',
    sync_version: 1,
    sync_state: 'pending',
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
    created_at: TEST_NOW,
    updated_at: TEST_NOW,
    payload_json: null,
    ...overrides,
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  // Default: all DB methods succeed silently
  mockDb.execAsync.mockResolvedValue(undefined)
  mockDb.runAsync.mockResolvedValue({ changes: 0 })
  mockDb.getFirstAsync.mockResolvedValue(null)
  mockDb.getAllAsync.mockResolvedValue([])
})

// ═══════════════════════════════════════════════════════════════════════════
// initLocalDb
// ═══════════════════════════════════════════════════════════════════════════

describe('initLocalDb', () => {
  test('runs CREATE TABLE statements', async () => {
    await initLocalDb()
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS local_surveys'))
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS sync_queue'))
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS local_attachments'))
    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS local_meta'))
  })

  test('runs schema migration runAsync calls', async () => {
    await initLocalDb()
    // At least the two UPDATE calls for backfilling existing rows
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE local_surveys SET created_at = updated_at"),
    )
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE local_surveys SET visibility = 'private'"),
    )
  })

  test('execAsync errors are swallowed (addColumnIfMissing is tolerant)', async () => {
    // Simulate "duplicate column" errors that addColumnIfMissing silently swallows
    // The first call (CREATE TABLE) succeeds; subsequent ALTER TABLE calls may throw.
    mockDb.execAsync.mockResolvedValueOnce(undefined) // CREATE TABLE block
    mockDb.execAsync.mockRejectedValueOnce(new Error('duplicate column name'))
    await expect(initLocalDb()).resolves.toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// createLocalDraft
// ═══════════════════════════════════════════════════════════════════════════

describe('createLocalDraft', () => {
  const input = {
    site_name: 'My forest',
    region_version: 'ACA' as const,
    vegetation_stage: 'adult',
    parcel_ids: ['AB001', 'AB002'],
    factors: { A: { native_genus_count: 5 } },
  }

  test('returns a LocalSurvey with correct shape', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890000)
    const result = await createLocalDraft(input)

    expect(result.id).toMatch(/^survey-/)
    expect(result.site_name).toBe('My forest')
    expect(result.status).toBe('draft')
    expect(result.visibility).toBe('private')
    expect(result.sync_state).toBe('pending')
    expect(result.sync_version).toBe(1)
    expect(result.last_sync_error).toBeNull()
    jest.restoreAllMocks()
  })

  test('inserts into local_surveys', async () => {
    await createLocalDraft(input)
    const insertCall = mockDb.runAsync.mock.calls.find((c) => (c[0] as string).includes('INSERT INTO local_surveys'))
    expect(insertCall).toBeDefined()
    const args = insertCall?.[1] as unknown[]
    expect(args?.[1]).toBe('My forest') // site_name
    expect(args?.[2]).toBe('draft') // status
  })

  test('inserts into sync_queue', async () => {
    await createLocalDraft(input)
    const params = getRunAsyncPayload(mockDb.runAsync.mock.calls, 'INSERT INTO sync_queue')
    expect(params).toBeDefined()
    const payload = JSON.parse(params?.[1] as string)
    expect(payload.site_name).toBe('My forest')
    expect(payload.status).toBe('draft')
  })

  test('normalizes parcel_ids (uppercase, deduplication)', async () => {
    const result = await createLocalDraft({
      ...input,
      parcel_ids: ['ab001', 'AB001', 'ab002'],
    })
    expect(result).toBeDefined()
    const params = getRunAsyncPayload(mockDb.runAsync.mock.calls, 'INSERT INTO sync_queue')
    const payload = JSON.parse(params?.[1] as string)
    // Deduplication should give 2 unique parcel IDs
    expect(payload.parcel_ids).toHaveLength(2)
    expect(payload.parcel_ids).toContain('AB001')
    expect(payload.parcel_ids).toContain('AB002')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// updateLocalDraft
// ═══════════════════════════════════════════════════════════════════════════

describe('updateLocalDraft', () => {
  const existingRow = makeSurveyRow({
    payload_json: JSON.stringify({
      id: TEST_SURVEY_ID,
      sync_version: 2,
      site_name: 'Old name',
      status: 'draft',
      visibility: 'private',
      parcel_ids: [],
      factors: {},
    }),
    sync_version: 2,
  })

  const updateInput = {
    survey_id: TEST_SURVEY_ID,
    site_name: 'New name',
    region_version: 'ACA' as const,
    vegetation_stage: 'adult',
    parcel_ids: ['XY123'],
    factors: { A: { native_genus_count: 3 } },
    visibility: 'private' as const,
  }

  test('throws if survey not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    await expect(updateLocalDraft(updateInput)).rejects.toThrow(`Unknown local survey: ${TEST_SURVEY_ID}`)
  })

  test('increments sync_version', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(existingRow)
    const result = await updateLocalDraft(updateInput)
    expect(result.sync_version).toBe(3) // was 2, incremented by 1
  })

  test('returns updated LocalSurvey with new site_name', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(existingRow)
    const result = await updateLocalDraft(updateInput)
    expect(result.site_name).toBe('New name')
    expect(result.sync_state).toBe('pending')
  })

  test('inserts a new sync_queue row', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(existingRow)
    await updateLocalDraft(updateInput)
    const insertQueueCall = mockDb.runAsync.mock.calls.find((c) => (c[0] as string).includes('INSERT INTO sync_queue'))
    expect(insertQueueCall).toBeDefined()
  })

  test('updates local_surveys row', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(existingRow)
    await updateLocalDraft(updateInput)
    const updateCall = mockDb.runAsync.mock.calls.find((c) => (c[0] as string).includes('UPDATE local_surveys'))
    expect(updateCall).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getLocalSurveyDraft
// ═══════════════════════════════════════════════════════════════════════════

describe('getLocalSurveyDraft', () => {
  test('returns null if not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result).toBeNull()
  })

  test('returns parsed payload_json when valid', async () => {
    const payload = {
      id: TEST_SURVEY_ID,
      sync_version: 1,
      site_name: 'Test',
      status: 'draft',
      visibility: 'private',
      parcel_ids: [],
      factors: {},
    }
    mockDb.getFirstAsync.mockResolvedValue({
      id: TEST_SURVEY_ID,
      site_name: 'Test',
      visibility: 'private',
      sync_version: 1,
      payload_json: JSON.stringify(payload),
    })
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result?.site_name).toBe('Test')
    expect(result?.id).toBe(TEST_SURVEY_ID)
  })

  test('returns fallback payload if payload_json is null', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: TEST_SURVEY_ID,
      site_name: 'Fallback site',
      visibility: 'public',
      sync_version: 3,
      payload_json: null,
    })
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result?.id).toBe(TEST_SURVEY_ID)
    expect(result?.site_name).toBe('Fallback site')
    expect(result?.status).toBe('draft')
    expect(result?.visibility).toBe('public')
  })

  test('returns fallback payload if payload_json is invalid JSON', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: TEST_SURVEY_ID,
      site_name: 'Site',
      visibility: 'private',
      sync_version: 1,
      payload_json: 'not-valid-json',
    })
    const result = await getLocalSurveyDraft(TEST_SURVEY_ID)
    expect(result?.id).toBe(TEST_SURVEY_ID)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// listLocalSurveys
// ═══════════════════════════════════════════════════════════════════════════

describe('listLocalSurveys', () => {
  test('returns empty array when db is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([])
    const result = await listLocalSurveys()
    expect(result).toEqual([])
  })

  test('maps rows to LocalSurvey and computes completion_rate', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeSurveyRow({ status: 'submitted', payload_json: null }),
    ])
    const result = await listLocalSurveys()
    expect(result).toHaveLength(1)
    expect(result[0].completion_rate).toBe(100) // submitted → 100%
    expect(result[0]).not.toHaveProperty('payload_json')
  })

  test('strips payload_json from returned objects', async () => {
    mockDb.getAllAsync.mockResolvedValue([makeSurveyRow()])
    const result = await listLocalSurveys()
    expect(result[0]).not.toHaveProperty('payload_json')
  })

  test('returns multiple surveys', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      makeSurveyRow({ id: 'survey-1' }),
      makeSurveyRow({ id: 'survey-2' }),
    ])
    const result = await listLocalSurveys()
    expect(result).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// listLocalAttachments
// ═══════════════════════════════════════════════════════════════════════════

describe('listLocalAttachments', () => {
  const attachmentRow = {
    id: 'att-1',
    survey_id: TEST_SURVEY_ID,
    local_uri: 'file:///photo.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 1024,
    sync_state: 'pending',
    remote_attachment_id: null,
    storage_key: null,
    upload_url: null,
    confirm_url: null,
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    updated_at: TEST_NOW,
  }

  test('returns all attachments when no filter', async () => {
    mockDb.getAllAsync.mockResolvedValue([attachmentRow])
    const result = await listLocalAttachments()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('att-1')
  })

  test('uses WHERE clause when surveyId provided', async () => {
    mockDb.getAllAsync.mockResolvedValue([attachmentRow])
    await listLocalAttachments(TEST_SURVEY_ID)
    const call = mockDb.getAllAsync.mock.calls[0]
    expect((call[0] as string).toLowerCase()).toContain('where survey_id')
    expect(call[1]).toContain(TEST_SURVEY_ID)
  })

  test('returns empty array when no attachments', async () => {
    mockDb.getAllAsync.mockResolvedValue([])
    const result = await listLocalAttachments()
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// hasPendingSyncWork
// ═══════════════════════════════════════════════════════════════════════════

describe('hasPendingSyncWork', () => {
  test('returns true when pending queue items exist', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 3 })
    const result = await hasPendingSyncWork()
    expect(result).toBe(true)
  })

  test('returns false when queue is empty', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 })
    const result = await hasPendingSyncWork()
    expect(result).toBe(false)
  })

  test('returns false when db returns null', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    const result = await hasPendingSyncWork()
    expect(result).toBe(false)
  })

  test('queries sync_queue for pending and overdue-failed items', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 })
    await hasPendingSyncWork()
    const sql = mockDb.getFirstAsync.mock.calls[0][0] as string
    expect(sql).toContain('sync_queue')
    expect(sql).toContain("status = 'pending'")
    expect(sql).toContain("status = 'failed'")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// queueDeleteSurvey
// ═══════════════════════════════════════════════════════════════════════════

describe('queueDeleteSurvey', () => {
  test('returns { queued_delete: false } if survey not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    const result = await queueDeleteSurvey(TEST_SURVEY_ID)
    expect(result).toEqual({ queued_delete: false })
  })

  test('deletes survey locally and queues a delete operation', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: TEST_SURVEY_ID, sync_state: 'pending' })
    const result = await queueDeleteSurvey(TEST_SURVEY_ID)
    expect(result).toEqual({ queued_delete: true })

    const deleteSurveyCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).includes('DELETE FROM local_surveys'),
    )
    expect(deleteSurveyCall).toBeDefined()

    const params = getRunAsyncPayload(mockDb.runAsync.mock.calls, 'INSERT INTO sync_queue')
    expect(params).toBeDefined()
    const payload = JSON.parse(params?.[1] as string)
    expect(payload.kind).toBe('survey_delete')
    expect(payload.survey_id).toBe(TEST_SURVEY_ID)
  })

  test('also deletes local attachments', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: TEST_SURVEY_ID, sync_state: 'synced' })
    await queueDeleteSurvey(TEST_SURVEY_ID)
    const deleteAttCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).includes('DELETE FROM local_attachments'),
    )
    expect(deleteAttCall).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// queueLocalAttachment
// ═══════════════════════════════════════════════════════════════════════════

describe('queueLocalAttachment', () => {
  const attachmentInput = {
    survey_id: TEST_SURVEY_ID,
    local_uri: 'file:///photo.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 2048,
  }

  test('throws if survey does not exist locally', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    await expect(queueLocalAttachment(attachmentInput)).rejects.toThrow(`Unknown local survey: ${TEST_SURVEY_ID}`)
  })

  test('returns a LocalAttachment object with pending sync_state', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: TEST_SURVEY_ID })
    const result = await queueLocalAttachment(attachmentInput)
    expect(result.id).toMatch(/^attachment-/)
    expect(result.survey_id).toBe(TEST_SURVEY_ID)
    expect(result.mime_type).toBe('image/jpeg')
    expect(result.size_bytes).toBe(2048)
    expect(result.sync_state).toBe('pending')
    expect(result.remote_attachment_id).toBeNull()
  })

  test('inserts into local_attachments and sync_queue', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: TEST_SURVEY_ID })
    await queueLocalAttachment(attachmentInput)

    const insertAttCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).includes('INSERT INTO local_attachments'),
    )
    expect(insertAttCall).toBeDefined()

    const attQueueParams = getRunAsyncPayload(mockDb.runAsync.mock.calls, 'INSERT INTO sync_queue')
    expect(attQueueParams).toBeDefined()
    const payload = JSON.parse(attQueueParams?.[1] as string)
    expect(payload.kind).toBe('attachment_upload')
    expect(payload.mime_type).toBe('image/jpeg')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// queueDeleteAttachment
// ═══════════════════════════════════════════════════════════════════════════

describe('queueDeleteAttachment', () => {
  test('removes_local: false and queued_delete: false when not found', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    const result = await queueDeleteAttachment(TEST_SURVEY_ID, 'att-missing')
    expect(result.removed_local).toBe(false)
    expect(result.queued_delete).toBe(false)
    expect(result.remote_attachment_id).toBeNull()
  })

  test('removes local attachment and queues remote delete when remote_id exists', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'att-1',
      survey_id: TEST_SURVEY_ID,
      remote_attachment_id: 'remote-123',
    })
    const result = await queueDeleteAttachment(TEST_SURVEY_ID, 'att-1')
    expect(result.removed_local).toBe(true)
    expect(result.queued_delete).toBe(true)
    expect(result.remote_attachment_id).toBe('remote-123')

    const delQueueParams = getRunAsyncPayload(mockDb.runAsync.mock.calls, 'INSERT INTO sync_queue')
    expect(delQueueParams).toBeDefined()
    const payload = JSON.parse(delQueueParams?.[1] as string)
    expect(payload.kind).toBe('attachment_delete')
  })

  test('removed_local: true but queued_delete: false when no remote_id', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'att-1',
      survey_id: TEST_SURVEY_ID,
      remote_attachment_id: null,
    })
    const result = await queueDeleteAttachment(TEST_SURVEY_ID, 'att-1')
    expect(result.removed_local).toBe(true)
    expect(result.queued_delete).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// retrySurveyNow
// ═══════════════════════════════════════════════════════════════════════════

describe('retrySurveyNow', () => {
  test('returns { queued: 0 } when no failed items found', async () => {
    // runAsync returns { changes: 0 } by default (set in beforeEach)
    const result = await retrySurveyNow(TEST_SURVEY_ID)
    expect(result.queued).toBe(0)
  })

  test('resets status and next_retry_at for failed queue items', async () => {
    // First runAsync call (UPDATE sync_queue) returns 2 changed rows
    mockDb.runAsync.mockResolvedValueOnce({ changes: 2 })
    const result = await retrySurveyNow(TEST_SURVEY_ID)
    expect(result.queued).toBe(2)
    const updateCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).includes('UPDATE sync_queue'),
    )
    expect(updateCall).toBeDefined()
    expect((updateCall?.[0] as string).toLowerCase()).toContain('next_retry_at')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// discardSurveyLocalChanges
// ═══════════════════════════════════════════════════════════════════════════

describe('discardSurveyLocalChanges', () => {
  test('deletes pending queue rows for survey', async () => {
    const result = await discardSurveyLocalChanges(TEST_SURVEY_ID)
    expect(result.removed_queue).toBeGreaterThanOrEqual(0)

    const deleteQueueCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).includes('DELETE FROM sync_queue'),
    )
    expect(deleteQueueCall).toBeDefined()
  })

  test('marks survey as synced', async () => {
    await discardSurveyLocalChanges(TEST_SURVEY_ID)
    const updateCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).includes('UPDATE local_surveys'),
    )
    expect(updateCall).toBeDefined()
    expect((updateCall?.[0] as string).toLowerCase()).toContain("sync_state")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// markSurveyExpiredLocally
// ═══════════════════════════════════════════════════════════════════════════

describe('markSurveyExpiredLocally', () => {
  test('runs an UPDATE setting status to expired', async () => {
    await markSurveyExpiredLocally(TEST_SURVEY_ID)
    const updateCall = mockDb.runAsync.mock.calls.find(
      (c) => (c[0] as string).toLowerCase().includes("update local_surveys"),
    )
    expect(updateCall).toBeDefined()
    expect((updateCall?.[0] as string).toLowerCase()).toContain('expired')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// clearLocalIbpData
// ═══════════════════════════════════════════════════════════════════════════

describe('clearLocalIbpData', () => {
  test('deletes all data from the four main tables', async () => {
    await clearLocalIbpData()
    const sqls = mockDb.runAsync.mock.calls.map((c) => (c[0] as string).trim())
    expect(sqls.some((s) => s.includes('DELETE FROM sync_queue'))).toBe(true)
    expect(sqls.some((s) => s.includes('DELETE FROM local_attachments'))).toBe(true)
    expect(sqls.some((s) => s.includes('DELETE FROM local_surveys'))).toBe(true)
    expect(sqls.some((s) => s.includes('DELETE FROM local_meta'))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// syncPending — smoke tests (HTTP + DB interplay)
// ═══════════════════════════════════════════════════════════════════════════

describe('syncPending', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns zero counts when queue is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([]) // empty queue
    // syncPending always calls pullRemoteChanges at the end (even with empty queue)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: null,
        has_more: false,
        surveys: [],
        attachments: [],
      }),
    })
    const result = await syncPending('http://api', 'token')
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.pulled_surveys).toBe(0)
  })

  test('calls fetch with correct Authorization header when queue has items', async () => {
    const queueRow = {
      id: 1,
      survey_id: TEST_SURVEY_ID,
      payload: JSON.stringify({
        id: TEST_SURVEY_ID,
        sync_version: 1,
        site_name: 'Test',
        status: 'draft',
        visibility: 'private',
        parcel_ids: [],
        factors: {},
      }),
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
    }
    mockDb.getAllAsync.mockResolvedValueOnce([queueRow]) // queue rows
    mockDb.getAllAsync.mockResolvedValue([]) // attachment rows

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [] }),
    })

    await syncPending('http://api', 'my-token')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer my-token' }) }),
    )
  })

  test('increments failed count on HTTP error', async () => {
    const queueRow = {
      id: 2,
      survey_id: TEST_SURVEY_ID,
      payload: JSON.stringify({
        id: TEST_SURVEY_ID,
        sync_version: 1,
        site_name: 'Test',
        status: 'draft',
        visibility: 'private',
        parcel_ids: [],
        factors: {},
      }),
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
    }
    mockDb.getAllAsync.mockResolvedValueOnce([queueRow])
    mockDb.getAllAsync.mockResolvedValue([])

    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    const result = await syncPending('http://api', 'token')
    expect(result.failed).toBe(1)
    expect(result.synced).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// pullRemoteChanges — smoke tests
// ═══════════════════════════════════════════════════════════════════════════

describe('pullRemoteChanges', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns zero counts when server returns empty response', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null) // no stored cursor
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: null,
        has_more: false,
        surveys: [],
        attachments: [],
      }),
    })

    const result = await pullRemoteChanges('http://api', 'token')
    expect(result.surveys).toBe(0)
    expect(result.attachments).toBe(0)
    expect(result.has_more).toBe(false)
  })

  test('calls fetch with correct URL and Bearer token', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ cursor_in: null, cursor_out: null, has_more: false, surveys: [], attachments: [] }),
    })

    await pullRemoteChanges('http://api', 'my-token')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync/changes'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer my-token' }) }),
    )
  })

  test('counts pulled surveys correctly', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null) // no cursor
    // After pulling, applyRemoteChanges will run SQL but we let it be mocked
    mockDb.getFirstAsync.mockResolvedValue(null) // for internal lookups
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        cursor_in: null,
        cursor_out: 'cursor-1',
        has_more: false,
        surveys: [
          { id: 's1', site_name: 'Site 1', status: 'draft', sync_version: 1 },
          { id: 's2', site_name: 'Site 2', status: 'draft', sync_version: 1 },
        ],
        attachments: [],
      }),
    })

    const result = await pullRemoteChanges('http://api', 'token')
    expect(result.surveys).toBe(2)
    expect(result.attachments).toBe(0)
  })
})
