/**
 * Real-SQL proof of the D-03/D-04/D-08/D-17 engine guarantees (ROADMAP
 * criteria 1 and 2, phase 01.5 plan 10):
 *  - one module-level single flight: concurrent drains/pulls collapse into
 *    one POST /sync or one GET /sync/changes; a sync and a pull never
 *    overlap
 *  - a 250-operation queue drains in batches of at most SYNC_BATCH_SIZE
 *    (100), in ascending queue-id order; a batch-level failure stops the
 *    remaining batches for that run
 *  - a survey flips to "synced" only when no other queue row remains for it
 *  - every multi-statement writer in sync.ts is atomic: an aborted write
 *    rolls back and the drain/pull continues without throwing for other rows
 *
 * Strategy: real SQL against the global expo-sqlite mock (node:sqlite), same
 * approach as sync.retry.sqlite.test.ts / sync.pull.sqlite.test.ts. Only
 * `global.fetch` is mocked; fault injection uses SQLite triggers copied from
 * surveys.transactions.sqlite.test.ts.
 */

import { initLocalDb, getDb } from "./db"
import { syncPending, pullRemoteChanges, updateSurveyVisibility } from "./sync"

const NOW = "2026-01-01T00:00:00.000Z"

type MockResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

function jsonResponse(status: number, body: unknown): MockResponse {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

function emptyChangesResponse(): MockResponse {
  return jsonResponse(200, {
    cursor_in: null,
    cursor_out: null,
    has_more: false,
    surveys: [],
    attachments: [],
  })
}

/** Builds a /sync batch response whose results mirror whatever operations
 * were actually sent, so a chunked drain gets a matching "synced" result for
 * every operation in every chunk without hand-authoring 250 fixtures. */
function echoSyncedResponse(requestBodyText: string): MockResponse {
  const body = JSON.parse(requestBodyText) as {
    operations: Array<{ client_ref: string; entity: string; action: string }>
  }
  const results = body.operations.map((op) => ({
    client_ref: op.client_ref,
    entity: op.entity,
    action: op.action,
    status: "synced",
  }))
  return jsonResponse(200, { results })
}

async function insertSurvey(
  id: string,
  overrides: { site_name?: string; status?: string } = {},
): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      overrides.site_name ?? "Site",
      overrides.status ?? "draft",
      "private",
      1,
      "pending",
      null,
      null,
      null,
      0,
      null,
      NOW,
      NOW,
    ],
  )
}

async function insertSurveyUpsertQueueRow(surveyId: string): Promise<number> {
  const db = await getDb()
  const payload = { id: surveyId, sync_version: 1, site_name: "Site" }
  const result = await db.runAsync(
    `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, 'survey_upsert', ?, 'pending', 0, NULL, ?, ?)`,
    [surveyId, JSON.stringify(payload), NOW, NOW],
  )
  return Number(result.lastInsertRowId)
}

async function insertSurveyVisibilityQueueRow(
  surveyId: string,
  visibility: "private" | "public",
): Promise<number> {
  const db = await getDb()
  const payload = { kind: "survey_visibility_update", survey_id: surveyId, visibility }
  const result = await db.runAsync(
    `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, 'survey_visibility', ?, 'pending', 0, NULL, ?, ?)`,
    [surveyId, JSON.stringify(payload), NOW, NOW],
  )
  return Number(result.lastInsertRowId)
}

async function getQueueRow(id: number): Promise<{ status: string; retry_count: number } | null> {
  const db = await getDb()
  return db.getFirstAsync(`SELECT status, retry_count FROM sync_queue WHERE id = ?`, [id])
}

async function countQueueRowsForSurvey(surveyId: string): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE survey_id = ?`,
    [surveyId],
  )
  return Number(row?.count ?? 0)
}

async function getSurvey(
  id: string,
): Promise<{ sync_state: string; sync_blocked: number; visibility: string } | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT sync_state, sync_blocked, visibility FROM local_surveys WHERE id = ?`,
    [id],
  )
}

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM local_meta WHERE key = ?`,
    [key],
  )
  return row?.value ?? null
}

const activeTriggers = new Set<string>()

async function createTrigger(
  name: string,
  event: "INSERT" | "DELETE" | "UPDATE",
  table: string,
  when: string,
  raiseSql: string,
): Promise<void> {
  const db = await getDb()
  await db.execAsync(
    `CREATE TRIGGER ${name} BEFORE ${event} ON ${table} WHEN ${when} BEGIN ${raiseSql}; END;`,
  )
  activeTriggers.add(name)
}

async function dropAllTriggers(): Promise<void> {
  const db = await getDb()
  for (const name of activeTriggers) {
    await db.execAsync(`DROP TRIGGER IF EXISTS ${name};`)
  }
  activeTriggers.clear()
}

beforeAll(async () => {
  await initLocalDb()
})

beforeEach(async () => {
  const db = await getDb()
  await db.execAsync(`
    DELETE FROM local_surveys;
    DELETE FROM sync_queue;
    DELETE FROM local_attachments;
    DELETE FROM local_meta;
  `)
  global.fetch = jest.fn()
})

afterEach(async () => {
  await dropAllTriggers()
  jest.restoreAllMocks()
})

describe("single flight (D-03)", () => {
  test("two syncPending calls without awaiting produce exactly one POST /sync, both resolve to the same result", async () => {
    await insertSurvey("survey-a")
    await insertSurveyUpsertQueueRow("survey-a")

    const fetchMock = global.fetch as jest.Mock
    let syncCalls = 0
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        syncCalls += 1
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const [first, second] = await Promise.all([
      syncPending("http://api", "token"),
      syncPending("http://api", "token"),
    ])

    expect(syncCalls).toBe(1)
    expect(first).toEqual(second)
  })

  test("updateSurveyVisibility joins an in-flight syncPending drain: one POST /sync total", async () => {
    await insertSurvey("survey-vis")
    await insertSurveyUpsertQueueRow("survey-vis")

    const fetchMock = global.fetch as jest.Mock
    let syncCalls = 0
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        syncCalls += 1
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await Promise.all([
      syncPending("http://api", "token"),
      updateSurveyVisibility("http://api", "token", "survey-vis", "public"),
    ])

    expect(syncCalls).toBe(1)
  })

  test("pullRemoteChanges called while syncPending is in flight starts its GET only after the sync resolves", async () => {
    await insertSurvey("survey-order")
    await insertSurveyUpsertQueueRow("survey-order")

    const callOrder: string[] = []
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        callOrder.push("changes")
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        callOrder.push("sync")
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const syncPromise = syncPending("http://api", "token")
    const pullPromise = pullRemoteChanges("http://api", "token")

    await Promise.all([syncPromise, pullPromise])

    // The sync's own POST /sync, then its opportunistic GET /sync/changes,
    // then the standalone pull's GET /sync/changes — never interleaved.
    expect(callOrder).toEqual(["sync", "changes", "changes"])
  })
})

describe("chunking (D-04)", () => {
  test("250 survey upsert rows produce three POST /sync batches of 100, 100, 50 in ascending id order; every row is deleted and every survey synced", async () => {
    const surveyIds: string[] = []
    for (let i = 0; i < 250; i += 1) {
      const id = `survey-chunk-${i}`
      surveyIds.push(id)
      await insertSurvey(id)
      await insertSurveyUpsertQueueRow(id)
    }

    const batchSizes: number[] = []
    const batchClientRefs: string[][] = []
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        const body = JSON.parse(String(init?.body)) as {
          operations: Array<{ client_ref: string }>
        }
        batchSizes.push(body.operations.length)
        batchClientRefs.push(body.operations.map((op) => op.client_ref))
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await syncPending("http://api", "token")

    expect(batchSizes).toEqual([100, 100, 50])
    for (const refs of batchClientRefs) {
      const numericRefs = refs.map(Number)
      const sorted = [...numericRefs].sort((a, b) => a - b)
      expect(numericRefs).toEqual(sorted)
    }
    // Batches are in ascending queue-id order end to end too.
    const allRefs = batchClientRefs.flat().map(Number)
    expect(allRefs).toEqual([...allRefs].sort((a, b) => a - b))

    expect(result.synced).toBe(250)
    expect(result.failed).toBe(0)

    for (const id of surveyIds) {
      expect(await countQueueRowsForSurvey(id)).toBe(0)
      const survey = await getSurvey(id)
      expect(survey?.sync_state).toBe("synced")
    }
  })

  test("a batch-level failure (network TypeError) stops the remaining batches: their rows stay untouched", async () => {
    const surveyIds: string[] = []
    for (let i = 0; i < 250; i += 1) {
      const id = `survey-fail-${i}`
      surveyIds.push(id)
      await insertSurvey(id)
      await insertSurveyUpsertQueueRow(id)
    }

    let syncCallCount = 0
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        syncCallCount += 1
        throw new TypeError("Network request failed")
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await syncPending("http://api", "token")

    // Only the first batch was attempted; the second and third never ran.
    expect(syncCallCount).toBe(1)
    expect(result.synced).toBe(0)
    expect(result.failed).toBe(100)

    const rows = await Promise.all(
      surveyIds.map(async (id) => {
        const db = await getDb()
        return db.getFirstAsync<{ status: string; retry_count: number }>(
          `SELECT status, retry_count FROM sync_queue WHERE survey_id = ?`,
          [id],
        )
      }),
    )

    const firstBatch = rows.slice(0, 100)
    const remaining = rows.slice(100)

    for (const row of firstBatch) {
      expect(row?.status).toBe("failed")
      expect(row?.retry_count).toBe(0) // retryable never counts (D-05/D-14)
    }
    for (const row of remaining) {
      expect(row?.status).toBe("pending")
      expect(row?.retry_count).toBe(0)
    }
  })
})

describe("synced-only-when-queue-empty (D-04)", () => {
  test("a survey with an upsert row in batch 1 and a visibility row in batch 2 stays pending until both are processed", async () => {
    // Seed 99 filler rows so the target survey's upsert lands in batch 1 and
    // its visibility row lands in batch 2.
    for (let i = 0; i < 99; i += 1) {
      const id = `survey-filler-${i}`
      await insertSurvey(id)
      await insertSurveyUpsertQueueRow(id)
    }
    await insertSurvey("survey-cross-batch")
    await insertSurveyUpsertQueueRow("survey-cross-batch")
    // Push the visibility row's id well past the 100th to guarantee batch 2.
    for (let i = 0; i < 5; i += 1) {
      const id = `survey-filler-late-${i}`
      await insertSurvey(id)
      await insertSurveyUpsertQueueRow(id)
    }
    await insertSurveyVisibilityQueueRow("survey-cross-batch", "public")

    let batchCount = 0
    let pendingDuringSecondBatch: string | undefined
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        batchCount += 1
        if (batchCount === 2) {
          const survey = await getSurvey("survey-cross-batch")
          pendingDuringSecondBatch = survey?.sync_state
        }
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await syncPending("http://api", "token")

    expect(batchCount).toBe(2)
    expect(pendingDuringSecondBatch).toBe("pending")

    const survey = await getSurvey("survey-cross-batch")
    expect(survey?.sync_state).toBe("synced")
    expect(await countQueueRowsForSurvey("survey-cross-batch")).toBe(0)
  })

  test("a survey with two rows in one batch, one synced and one retryable_error, never reaches synced", async () => {
    await insertSurvey("survey-mixed")
    const syncedRowId = await insertSurveyUpsertQueueRow("survey-mixed")
    const retryableRowId = await insertSurveyVisibilityQueueRow("survey-mixed", "public")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        return jsonResponse(200, {
          results: [
            {
              client_ref: String(syncedRowId),
              entity: "survey",
              action: "upsert",
              status: "synced",
            },
            {
              client_ref: String(retryableRowId),
              entity: "survey",
              action: "visibility_update",
              status: "retryable_error",
              error: { http_status: 503 },
            },
          ],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await syncPending("http://api", "token")

    const survey = await getSurvey("survey-mixed")
    expect(survey?.sync_state).not.toBe("synced")
    expect(["pending", "failed"]).toContain(survey?.sync_state)

    const failedRow = await getQueueRow(retryableRowId)
    expect(failedRow?.status).toBe("failed")

    const syncedRowStillThere = await getQueueRow(syncedRowId)
    expect(syncedRowStillThere).toBeNull()
  })
})

describe("atomic writers (D-08/D-17)", () => {
  test("an aborted UPDATE local_surveys during mark-synced leaves the queue row in place, and syncPending does not throw", async () => {
    await insertSurvey("survey-atomic-z")
    const rowId = await insertSurveyUpsertQueueRow("survey-atomic-z")
    await insertSurvey("survey-atomic-other")
    await insertSurveyUpsertQueueRow("survey-atomic-other")

    await createTrigger(
      "trg_abort_mark_synced",
      "UPDATE",
      "local_surveys",
      `NEW.id = 'survey-atomic-z'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await syncPending("http://api", "token")

    // The DELETE was rolled back together with the aborted UPDATE.
    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("pending")
    expect(result.failed).toBeGreaterThanOrEqual(1)

    // The other survey's row still got processed normally.
    expect(await countQueueRowsForSurvey("survey-atomic-other")).toBe(0)
    const other = await getSurvey("survey-atomic-other")
    expect(other?.sync_state).toBe("synced")
  })

  test("updateSurveyVisibility queues a row with op_type 'survey_visibility'; an aborted UPDATE local_surveys leaves no queue row behind", async () => {
    await insertSurvey("survey-visibility-op-type")

    const withoutTrigger = await updateSurveyVisibility(
      "http://api",
      "",
      "survey-visibility-op-type",
      "public",
    )
    expect(withoutTrigger.queued).toBe(true)

    const db = await getDb()
    const row = await db.getFirstAsync<{ op_type: string }>(
      `SELECT op_type FROM sync_queue WHERE survey_id = ?`,
      ["survey-visibility-op-type"],
    )
    expect(row?.op_type).toBe("survey_visibility")

    // Revert to private locally so the next call has a change to make, then
    // inject the fault and prove the insert+update roll back together.
    await db.runAsync(`DELETE FROM sync_queue WHERE survey_id = ?`, ["survey-visibility-op-type"])
    await db.runAsync(`UPDATE local_surveys SET visibility = 'private' WHERE id = ?`, [
      "survey-visibility-op-type",
    ])

    await createTrigger(
      "trg_abort_visibility_update",
      "UPDATE",
      "local_surveys",
      `NEW.id = 'survey-visibility-op-type'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    await expect(
      updateSurveyVisibility("http://api", "", "survey-visibility-op-type", "public"),
    ).rejects.toThrow()

    expect(await countQueueRowsForSurvey("survey-visibility-op-type")).toBe(0)
  })

  test("full drain + pull under the real mutex completes without a 'runInTransaction called reentrantly' rejection", async () => {
    await insertSurvey("survey-reentrancy")
    await insertSurveyUpsertQueueRow("survey-reentrancy")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/sync/changes")) {
        return emptyChangesResponse()
      }
      if (url.includes("/sync")) {
        return echoSyncedResponse(String(init?.body))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await expect(
      Promise.all([syncPending("http://api", "token"), pullRemoteChanges("http://api", "token")]),
    ).resolves.toBeDefined()
  })
})

describe("pull page + cursor atomicity (D-08/D-17)", () => {
  test("an aborted INSERT of a pulled survey leaves the downsync_cursor unchanged", async () => {
    await createTrigger(
      "trg_abort_pull_insert",
      "INSERT",
      "local_surveys",
      `NEW.id = 'survey-pulled-abort'`,
      `SELECT RAISE(ABORT, 'injected')`,
    )

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/sync/changes")) {
        return jsonResponse(200, {
          cursor_in: null,
          cursor_out: "cursor-1",
          has_more: false,
          surveys: [
            {
              id: "survey-pulled-abort",
              site_name: "Pulled",
              status: "draft",
              sync_version: 1,
            },
          ],
          attachments: [],
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await expect(pullRemoteChanges("http://api", "token")).rejects.toThrow()

    expect(await getMeta("downsync_cursor")).toBeNull()
  })
})
