/**
 * Real-SQL proof that the D-05/D-14 retry cap is applied per failure class:
 * retryable (network/timeout/5xx/429) never counts, unknown counts and caps
 * at MAX_RETRY_COUNT (8), fatal blocks on the first attempt, and a batch-level
 * 401/403 leaves every row untouched and rethrows (T-01.5-31).
 *
 * Strategy: real SQL against the global expo-sqlite mock (node:sqlite), same
 * approach as storage.test.ts and surveys.transactions.sqlite.test.ts. Only
 * `global.fetch` is mocked — everything else is a real INSERT/SELECT against
 * the in-memory database.
 */

import { initLocalDb, getDb } from "./db"
import { syncPending } from "./sync"

const NOW = "2026-01-01T00:00:00.000Z"

type MockResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

function jsonResponse(status: number, body: unknown): MockResponse {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

async function insertSurvey(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, "Site", "draft", "private", 1, "pending", null, null, null, 0, null, NOW, NOW],
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

async function insertAttachment(id: string, surveyId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, file_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 'local', ?, ?)`,
    [id, surveyId, "file:///photo.jpg", "image/jpeg", 1234, NOW, NOW],
  )
}

async function insertAttachmentDeleteQueueRow(
  surveyId: string,
  attachmentId: string,
): Promise<number> {
  const db = await getDb()
  const payload = { kind: "attachment_delete", survey_id: surveyId, attachment_id: attachmentId }
  const result = await db.runAsync(
    `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, 'attachment_delete', ?, 'pending', 0, NULL, ?, ?)`,
    [surveyId, JSON.stringify(payload), NOW, NOW],
  )
  return Number(result.lastInsertRowId)
}

async function resetNextRetry(): Promise<void> {
  const db = await getDb()
  await db.runAsync(`UPDATE sync_queue SET next_retry_at = NULL WHERE status = 'failed'`)
}

async function getQueueRow(
  id: number,
): Promise<{ status: string; retry_count: number; next_retry_at: string | null } | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT status, retry_count, next_retry_at FROM sync_queue WHERE id = ?`,
    [id],
  )
}

async function getSurvey(
  id: string,
): Promise<{ sync_blocked: number; last_sync_error_code: string | null; status: string } | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT sync_blocked, last_sync_error_code, status FROM local_surveys WHERE id = ?`,
    [id],
  )
}

async function getAttachment(
  id: string,
): Promise<{ sync_state: string; last_sync_error_code: string | null } | null> {
  const db = await getDb()
  return db.getFirstAsync(
    `SELECT sync_state, last_sync_error_code FROM local_attachments WHERE id = ?`,
    [id],
  )
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

afterEach(() => {
  jest.restoreAllMocks()
})

// The final call in every syncPending invocation is pullRemoteChanges; give
// it an empty-but-well-formed response so it never itself fails the test.
function withEmptyChangesResponse(mock: jest.Mock): void {
  mock.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/sync/changes")) {
      return Promise.resolve(
        jsonResponse(200, {
          cursor_in: null,
          cursor_out: null,
          has_more: false,
          surveys: [],
          attachments: [],
        }),
      )
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  })
}

describe("retryable failures never count toward the retry cap", () => {
  test("network TypeError: 20 attempts leave the row failed, retry_count 0, unblocked", async () => {
    await insertSurvey("survey-network")
    const rowId = await insertSurveyUpsertQueueRow("survey-network")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.reject(new TypeError("Network request failed"))
    })

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await syncPending("http://api", "token")
      const row = await getQueueRow(rowId)
      expect(row?.status).toBe("failed")
      expect(row?.next_retry_at).not.toBeNull()
      await resetNextRetry()
    }

    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(0)

    const survey = await getSurvey("survey-network")
    expect(survey?.sync_blocked).toBe(0)
  })

  test("fetch AbortError (-> 408): 20 attempts leave the row failed, retry_count 0", async () => {
    await insertSurvey("survey-abort")
    const rowId = await insertSurveyUpsertQueueRow("survey-abort")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.reject({ name: "AbortError" })
    })

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(0)

    const survey = await getSurvey("survey-abort")
    expect(survey?.sync_blocked).toBe(0)
  })

  test.each([503, 429])(
    "batch HTTP %i: 20 attempts leave the row failed, retry_count 0",
    async (status) => {
      await insertSurvey(`survey-batch-${status}`)
      const rowId = await insertSurveyUpsertQueueRow(`survey-batch-${status}`)

      const fetchMock = global.fetch as jest.Mock
      fetchMock.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/sync/changes")) {
          return Promise.resolve(
            jsonResponse(200, {
              cursor_in: null,
              cursor_out: null,
              has_more: false,
              surveys: [],
              attachments: [],
            }),
          )
        }
        return Promise.resolve(jsonResponse(status, { message: "unavailable" }))
      })

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await syncPending("http://api", "token")
        await resetNextRetry()
      }

      const row = await getQueueRow(rowId)
      expect(row?.status).toBe("failed")
      expect(row?.retry_count).toBe(0)

      const survey = await getSurvey(`survey-batch-${status}`)
      expect(survey?.sync_blocked).toBe(0)
    },
  )

  test("per-op retryable_error with http_status 503: 20 attempts leave the row failed, retry_count 0", async () => {
    await insertSurvey("survey-op-503")
    const rowId = await insertSurveyUpsertQueueRow("survey-op-503")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          results: [
            {
              client_ref: String(rowId),
              entity: "survey",
              action: "upsert",
              status: "retryable_error",
              error: { http_status: 503, message: "upstream unavailable" },
            },
          ],
        }),
      )
    })

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(0)

    const survey = await getSurvey("survey-op-503")
    expect(survey?.sync_blocked).toBe(0)
  })
})

describe("unknown failures count toward the retry cap", () => {
  test("per-op retryable_error with no http_status: 7 attempts count, the 8th blocks", async () => {
    await insertSurvey("survey-unknown")
    const rowId = await insertSurveyUpsertQueueRow("survey-unknown")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          results: [
            {
              client_ref: String(rowId),
              entity: "survey",
              action: "upsert",
              status: "retryable_error",
              error: { message: "ambiguous failure" },
            },
          ],
        }),
      )
    })

    for (let attempt = 1; attempt <= 7; attempt += 1) {
      await syncPending("http://api", "token")
      const row = await getQueueRow(rowId)
      expect(row?.status).toBe("failed")
      expect(row?.retry_count).toBe(attempt)
      await resetNextRetry()
    }

    await syncPending("http://api", "token")

    const row = await getQueueRow(rowId)
    expect(row).toBeNull()

    const survey = await getSurvey("survey-unknown")
    expect(survey?.sync_blocked).toBe(1)
    expect(survey?.last_sync_error_code).toBe("retry_cap_reached")
    expect(survey?.status).toBe("error")
  })

  test("an unparsable batch response counts once per attempt", async () => {
    await insertSurvey("survey-unparsable")
    const rowId = await insertSurveyUpsertQueueRow("survey-unparsable")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => "<html>not json</html>" })
    })

    await syncPending("http://api", "token")

    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(1)
  })
})

describe("fatal failures block on the first attempt", () => {
  test.each(["survey_submitted_read_only", "invalid_operation"])(
    "per-op fatal_error with code %s blocks after 1 attempt",
    async (code) => {
      const surveyId = `survey-fatal-${code}`
      await insertSurvey(surveyId)
      const rowId = await insertSurveyUpsertQueueRow(surveyId)

      const fetchMock = global.fetch as jest.Mock
      fetchMock.mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/sync/changes")) {
          return Promise.resolve(
            jsonResponse(200, {
              cursor_in: null,
              cursor_out: null,
              has_more: false,
              surveys: [],
              attachments: [],
            }),
          )
        }
        return Promise.resolve(
          jsonResponse(200, {
            results: [
              {
                client_ref: String(rowId),
                entity: "survey",
                action: "upsert",
                status: "fatal_error",
                error: { code, message: code },
              },
            ],
          }),
        )
      })

      await syncPending("http://api", "token")

      const row = await getQueueRow(rowId)
      expect(row).toBeNull()

      const survey = await getSurvey(surveyId)
      expect(survey?.sync_blocked).toBe(1)
      expect(survey?.last_sync_error_code).toBe(code)
    },
  )

  test("invalid local payload row blocks after 1 attempt with code invalid_local_payload", async () => {
    await insertSurvey("survey-invalid-payload")
    const db = await getDb()
    await db.runAsync(
      `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
       VALUES (?, 'unknown', ?, 'pending', 0, NULL, ?, ?)`,
      ["survey-invalid-payload", JSON.stringify({ not: "a recognised payload" }), NOW, NOW],
    )

    withEmptyChangesResponse(global.fetch as jest.Mock)

    await syncPending("http://api", "token")

    const survey = await getSurvey("survey-invalid-payload")
    expect(survey?.sync_blocked).toBe(1)
    expect(survey?.last_sync_error_code).toBe("invalid_local_payload")
  })

  test("synced attachment result without a usable upload target blocks with invalid_attachment_response", async () => {
    const surveyId = "survey-attachment-invalid"
    await insertSurvey(surveyId)
    await insertAttachment("attachment-1", surveyId)
    const db = await getDb()
    const payload = {
      kind: "attachment_upload",
      local_attachment_id: "attachment-1",
      survey_id: surveyId,
      local_uri: "file:///photo.jpg",
      mime_type: "image/jpeg",
      size_bytes: 1234,
    }
    const result = await db.runAsync(
      `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
       VALUES (?, 'attachment_upload', ?, 'pending', 0, NULL, ?, ?)`,
      [surveyId, JSON.stringify(payload), NOW, NOW],
    )
    const rowId = Number(result.lastInsertRowId)

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          results: [
            {
              client_ref: String(rowId),
              entity: "attachment",
              action: "create",
              status: "synced",
              data: { not_a_target: true },
            },
          ],
        }),
      )
    })

    await syncPending("http://api", "token")

    const row = await getQueueRow(rowId)
    expect(row).toBeNull()

    const attachment = await getAttachment("attachment-1")
    expect(attachment?.sync_state).toBe("failed")
    expect(attachment?.last_sync_error_code).toBe("invalid_attachment_response")
  })
})

describe("attachment_delete rows follow the same classes", () => {
  test("retryable per-op result: 20 attempts leave the row failed, retry_count 0", async () => {
    const surveyId = "survey-att-delete-retryable"
    await insertSurvey(surveyId)
    const rowId = await insertAttachmentDeleteQueueRow(surveyId, "remote-attachment-1")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          results: [
            {
              client_ref: String(rowId),
              entity: "attachment",
              action: "delete",
              status: "retryable_error",
              error: { http_status: 503 },
            },
          ],
        }),
      )
    })

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("failed")
    expect(row?.retry_count).toBe(0)
  })

  test("unknown per-op result: the 8th counted attempt deletes the row", async () => {
    const surveyId = "survey-att-delete-unknown"
    await insertSurvey(surveyId)
    const rowId = await insertAttachmentDeleteQueueRow(surveyId, "remote-attachment-2")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync/changes")) {
        return Promise.resolve(
          jsonResponse(200, {
            cursor_in: null,
            cursor_out: null,
            has_more: false,
            surveys: [],
            attachments: [],
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          results: [
            {
              client_ref: String(rowId),
              entity: "attachment",
              action: "delete",
              status: "retryable_error",
              error: { message: "ambiguous" },
            },
          ],
        }),
      )
    })

    for (let attempt = 0; attempt < 7; attempt += 1) {
      await syncPending("http://api", "token")
      await resetNextRetry()
    }

    let row = await getQueueRow(rowId)
    expect(row?.retry_count).toBe(7)

    await syncPending("http://api", "token")
    row = await getQueueRow(rowId)
    expect(row).toBeNull()
  })
})

describe("batch-level 401/403", () => {
  test("rejects with ApiError 401 and leaves every queue row untouched", async () => {
    await insertSurvey("survey-auth")
    const rowId = await insertSurveyUpsertQueueRow("survey-auth")

    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/sync")) {
        return Promise.resolve(jsonResponse(401, { message: "Unauthorized" }))
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    await expect(syncPending("http://api", "token")).rejects.toMatchObject({ status: 401 })

    const row = await getQueueRow(rowId)
    expect(row?.status).toBe("pending")
    expect(row?.retry_count).toBe(0)
    expect(row?.next_retry_at).toBeNull()
  })
})
