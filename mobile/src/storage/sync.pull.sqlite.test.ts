/**
 * Real-SQL proof that a pull (D-07/T-01.5-27) never overwrites or deletes a
 * survey with pending local work, and that pulled attachments get the right
 * file_state (D-11): 'remote' for a brand-new pulled row, untouched local_uri
 * on update, and 'unavailable' resets to 'remote' on a changed pull.
 */

import { initLocalDb, getDb } from "./db"
import { pullRemoteChanges } from "./sync"

const NOW = "2026-01-01T00:00:00.000Z"

type MockResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

function changesResponse(body: Record<string, unknown>): MockResponse {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        cursor_in: null,
        cursor_out: null,
        has_more: false,
        surveys: [],
        attachments: [],
        ...body,
      }),
  }
}

async function insertSurvey(
  id: string,
  overrides: { sync_blocked?: number; site_name?: string; status?: string } = {},
): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      overrides.site_name ?? "Local site",
      overrides.status ?? "draft",
      "private",
      1,
      "pending",
      null,
      null,
      null,
      overrides.sync_blocked ?? 0,
      null,
      NOW,
      NOW,
    ],
  )
}

async function insertQueueRow(surveyId: string, opType: string, payload: unknown): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO sync_queue (survey_id, op_type, payload, status, retry_count, next_retry_at, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)`,
    [surveyId, opType, JSON.stringify(payload), NOW, NOW],
  )
}

async function insertLocalAttachment(
  id: string,
  surveyId: string,
  overrides: { local_uri?: string; file_state?: string; remote_attachment_id?: string | null } = {},
): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO local_attachments (id, survey_id, local_uri, mime_type, size_bytes, sync_state, remote_attachment_id, file_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)`,
    [
      id,
      surveyId,
      overrides.local_uri ?? "file:///local-photo.jpg",
      "image/jpeg",
      1234,
      overrides.remote_attachment_id ?? null,
      overrides.file_state ?? "local",
      NOW,
      NOW,
    ],
  )
}

async function getSurvey(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  return db.getFirstAsync(`SELECT * FROM local_surveys WHERE id = ?`, [id])
}

async function getAttachmentRow(id: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  return db.getFirstAsync(`SELECT * FROM local_attachments WHERE id = ?`, [id])
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

describe("pull guard for survey updates", () => {
  test("a remote update for a survey with a pending queue row is skipped", async () => {
    await insertSurvey("survey-pending", { site_name: "Original name" })
    await insertQueueRow("survey-pending", "survey_upsert", {
      id: "survey-pending",
      sync_version: 1,
      site_name: "Original name",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [
          { id: "survey-pending", site_name: "Remote name", status: "draft", sync_version: 2 },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(0)

    const survey = await getSurvey("survey-pending")
    expect(survey?.site_name).toBe("Original name")
  })

  test("a remote update for a sync_blocked survey with no queue row is skipped", async () => {
    await insertSurvey("survey-blocked", { site_name: "Original name", sync_blocked: 1 })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [
          { id: "survey-blocked", site_name: "Remote name", status: "draft", sync_version: 2 },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(0)

    const survey = await getSurvey("survey-blocked")
    expect(survey?.site_name).toBe("Original name")
    expect(survey?.sync_blocked).toBe(1)
  })

  test("a remote update for a clean synced survey is applied", async () => {
    await insertSurvey("survey-clean", { site_name: "Original name" })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [
          { id: "survey-clean", site_name: "Remote name", status: "draft", sync_version: 2 },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(1)

    const survey = await getSurvey("survey-clean")
    expect(survey?.site_name).toBe("Remote name")
  })
})

describe("pull guard for survey deletions", () => {
  test("a remote deletion of a survey with a pending upsert is skipped", async () => {
    await insertSurvey("survey-delete-pending")
    await insertQueueRow("survey-delete-pending", "survey_upsert", {
      id: "survey-delete-pending",
      sync_version: 1,
      site_name: "Local edit",
    })
    await insertLocalAttachment("attachment-kept-1", "survey-delete-pending")
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [
          { id: "survey-delete-pending", deleted_at: NOW, status: "draft", sync_version: 2 },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(0)

    expect(await getSurvey("survey-delete-pending")).not.toBeNull()
    expect(await getAttachmentRow("attachment-kept-1")).not.toBeNull()
  })

  test("a remote deletion of a sync_blocked survey is skipped", async () => {
    await insertSurvey("survey-delete-blocked", { sync_blocked: 1 })
    await insertLocalAttachment("attachment-kept-2", "survey-delete-blocked")
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [
          { id: "survey-delete-blocked", deleted_at: NOW, status: "draft", sync_version: 2 },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(0)

    expect(await getSurvey("survey-delete-blocked")).not.toBeNull()
    expect(await getAttachmentRow("attachment-kept-2")).not.toBeNull()
  })

  test("a remote deletion of a clean survey (or one already queued for delete) still deletes it", async () => {
    await insertSurvey("survey-delete-clean")
    await insertLocalAttachment("attachment-gone", "survey-delete-clean")
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [{ id: "survey-delete-clean", deleted_at: NOW, status: "draft", sync_version: 2 }],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(1)

    expect(await getSurvey("survey-delete-clean")).toBeNull()
    expect(await getAttachmentRow("attachment-gone")).toBeNull()
  })

  test("a remote deletion of a survey already queued for survey_delete still deletes it", async () => {
    await insertSurvey("survey-delete-self-queued")
    await insertQueueRow("survey-delete-self-queued", "survey_delete", {
      kind: "survey_delete",
      survey_id: "survey-delete-self-queued",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        surveys: [
          { id: "survey-delete-self-queued", deleted_at: NOW, status: "draft", sync_version: 2 },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.surveys).toBe(1)

    expect(await getSurvey("survey-delete-self-queued")).toBeNull()
  })
})

describe("pull attachment file_state", () => {
  test("a new remote attachment is inserted with id remote-<id>, local_uri '' and file_state 'remote'", async () => {
    await insertSurvey("survey-new-attachment")
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        attachments: [
          {
            id: "remote-id-1",
            survey_id: "survey-new-attachment",
            mime_type: "image/jpeg",
            size_bytes: 999,
          },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.attachments).toBe(1)

    const row = await getAttachmentRow("remote-remote-id-1")
    expect(row).not.toBeNull()
    expect(row?.local_uri).toBe("")
    expect(row?.file_state).toBe("remote")
  })

  test("an update of an existing local attachment leaves its local_uri and file_state untouched", async () => {
    await insertSurvey("survey-existing-attachment")
    await insertLocalAttachment("attachment-local-1", "survey-existing-attachment", {
      local_uri: "file:///still-here.jpg",
      file_state: "local",
      remote_attachment_id: "remote-id-2",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        attachments: [
          {
            id: "remote-id-2",
            survey_id: "survey-existing-attachment",
            mime_type: "image/jpeg",
            size_bytes: 2048,
          },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.attachments).toBe(1)

    const row = await getAttachmentRow("attachment-local-1")
    expect(row?.local_uri).toBe("file:///still-here.jpg")
    expect(row?.file_state).toBe("local")
    expect(row?.size_bytes).toBe(2048)
  })

  test("an update for an 'unavailable' attachment resets file_state to 'remote'", async () => {
    await insertSurvey("survey-unavailable-attachment")
    await insertLocalAttachment("attachment-unavailable-1", "survey-unavailable-attachment", {
      local_uri: "",
      file_state: "unavailable",
      remote_attachment_id: "remote-id-3",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      changesResponse({
        attachments: [
          {
            id: "remote-id-3",
            survey_id: "survey-unavailable-attachment",
            mime_type: "image/jpeg",
            size_bytes: 4096,
          },
        ],
      }),
    )

    const result = await pullRemoteChanges("http://api", "token")
    expect(result.attachments).toBe(1)

    const row = await getAttachmentRow("attachment-unavailable-1")
    expect(row?.file_state).toBe("remote")
  })

  test.each(["local", "missing"])(
    "an update for a '%s' attachment does not reset file_state",
    async (fileState) => {
      const id = `attachment-${fileState}-1`
      await insertSurvey(`survey-${fileState}-attachment`)
      await insertLocalAttachment(id, `survey-${fileState}-attachment`, {
        local_uri: fileState === "local" ? "file:///still-here.jpg" : "",
        file_state: fileState,
        remote_attachment_id: `remote-id-${fileState}`,
      })
      ;(global.fetch as jest.Mock).mockResolvedValue(
        changesResponse({
          attachments: [
            {
              id: `remote-id-${fileState}`,
              survey_id: `survey-${fileState}-attachment`,
              mime_type: "image/jpeg",
              size_bytes: 512,
            },
          ],
        }),
      )

      await pullRemoteChanges("http://api", "token")

      const row = await getAttachmentRow(id)
      expect(row?.file_state).toBe(fileState)
    },
  )
})
