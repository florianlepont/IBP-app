import { BadRequestException, Logger } from "@nestjs/common"
import { SurveysSyncService } from "../src/surveys/surveys-sync.service"

const AUTH_USER = {
  id: "user-1",
  auth0_sub: "auth0|user-1",
  email: "user@example.com",
  role: "contributor" as const,
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

function buildService() {
  const db = { query: jest.fn() }
  const ibpRules = { validateDraft: jest.fn() }
  const surveysService = {
    upsertForUser: jest.fn().mockResolvedValue({
      id: "survey-1",
      server_status: "synced",
      updated_at: "2026-01-01T00:00:00.000Z",
    }),
    deleteSurvey: jest.fn().mockResolvedValue({
      id: "survey-1",
      deleted_at: "2026-01-01T00:00:00.000Z",
      already_deleted: false,
      missing: false,
    }),
    patchSurveyVisibility: jest.fn().mockResolvedValue({
      id: "survey-1",
      visibility: "public",
      updated_at: "2026-01-01T00:00:00.000Z",
    }),
  }
  const attachmentsService = {
    createAttachment: jest.fn().mockResolvedValue({
      attachment_id: "attachment-1",
      storage_key: "key-1",
      upload_url: "https://example.com/upload",
      confirm_url: "https://example.com/confirm",
    }),
    deleteAttachment: jest.fn().mockResolvedValue({
      survey_id: "survey-1",
      attachment_id: "attachment-1",
      missing: false,
      deleted: true,
    }),
  }

  const service = new SurveysSyncService(
    db as never,
    ibpRules as never,
    surveysService as never,
    attachmentsService as never,
  )

  return { service, db, ibpRules, surveysService, attachmentsService }
}

function validUpsertPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "survey-1",
    sync_version: 1,
    site_name: "Site A",
    status: "draft",
    visibility: "private",
    parcel_ids: ["12345AB0042"],
    region_version: "ACA",
    vegetation_stage: "collineen",
    factors: { A: 1 },
    ...overrides,
  }
}

describe("SurveysSyncService.syncBatch", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it("validates each operation independently: one bad operation fails alone", async () => {
    const { service, surveysService } = buildService()

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        { client_ref: "op-1", entity: "survey", action: "upsert", payload: validUpsertPayload() },
        {
          client_ref: "op-2",
          entity: "survey",
          action: "upsert",
          payload: validUpsertPayload({ sync_version: "1" }),
        },
        {
          client_ref: "op-3",
          entity: "attachment",
          action: "delete",
          survey_id: "survey-1",
          payload: { attachment_id: "attachment-1" },
        },
      ],
    })

    expect(result.results[0].status).toBe("synced")
    expect(result.results[1]).toMatchObject({
      status: "fatal_error",
      error: expect.objectContaining({
        code: "invalid_sync_operation",
        http_status: 400,
      }),
    })
    expect(result.results[1].error?.details?.fields).toContain("sync_version")
    expect(result.results[2].status).toBe("synced")
    expect(surveysService.upsertForUser).toHaveBeenCalledTimes(1)
  })

  it("strips unknown fields but keeps status/expires_at (D-03, D-12)", async () => {
    const { service, surveysService } = buildService()

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        {
          entity: "survey",
          action: "upsert",
          payload: validUpsertPayload({
            expires_at: "2026-10-01T00:00:00.000Z",
            location: { lat: 1, lng: 2 },
            legacy_field: 1,
          }),
        },
      ],
    })

    expect(result.results[0].status).toBe("synced")
    const passedDto = surveysService.upsertForUser.mock.calls[0][1]
    expect(passedDto.status).toBe("draft")
    expect(passedDto.expires_at).toBe("2026-10-01T00:00:00.000Z")
    expect((passedDto as Record<string, unknown>).location).toBeUndefined()
    expect((passedDto as Record<string, unknown>).legacy_field).toBeUndefined()
  })

  it("bounds parcel_ids at 50 entries", async () => {
    const { service } = buildService()

    const tooMany = Array.from({ length: 51 }, (_, i) => `1234${i % 10}AB000${i % 10}`)
    const okMany = Array.from({ length: 50 }, (_, i) => `1234${i % 10}AB000${i % 10}`)

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        {
          entity: "survey",
          action: "upsert",
          payload: validUpsertPayload({ parcel_ids: tooMany }),
        },
        {
          entity: "survey",
          action: "upsert",
          payload: validUpsertPayload({ parcel_ids: okMany }),
        },
      ],
    })

    expect(result.results[0]).toMatchObject({ status: "fatal_error", error: { http_status: 400 } })
    expect(result.results[1].status).toBe("synced")
  })

  it.each([
    ["12345AB0042", true],
    ["75056000AB0012", true],
    ["2A004000AB0012", true],
    ["75056000ab0012", true],
  ])("accepts parcel_id format %s", async (parcelId) => {
    const { service } = buildService()
    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        {
          entity: "survey",
          action: "upsert",
          payload: validUpsertPayload({ parcel_ids: [parcelId] }),
        },
      ],
    })
    expect(result.results[0].status).toBe("synced")
  })

  it.each([["12345 AB"], ["../x"], ["A".repeat(33)], [""], [42]])(
    "rejects invalid parcel_ids entry %j",
    async (badId) => {
      const { service } = buildService()
      const result = await service.syncBatch(AUTH_USER as never, {
        operations: [
          {
            entity: "survey",
            action: "upsert",
            payload: validUpsertPayload({ parcel_ids: [badId] }),
          },
        ],
      })
      expect(result.results[0]).toMatchObject({
        status: "fatal_error",
        error: { http_status: 400 },
      })
    },
  )

  it("rejects malformed envelopes without throwing, keeping client_ref handling correct", async () => {
    const { service } = buildService()

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        { client_ref: "op-a", entity: "photo", action: "merge" },
        { client_ref: 12, entity: "survey", action: "upsert", payload: validUpsertPayload() },
        null,
        "x",
        { entity: "survey", action: "upsert", payload: "x" },
      ],
    })

    expect(result.results).toHaveLength(5)
    for (const item of result.results) {
      expect(item.status).toBe("fatal_error")
      expect(item.error?.http_status).toBe(400)
    }
    expect(result.results[0].client_ref).toBe("op-a")
    expect(result.results[1].client_ref).toBeNull()
  })

  it("attachment.create accepts null captured_at and empty metadata, rejects bad size_bytes", async () => {
    const { service } = buildService()

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        {
          entity: "attachment",
          action: "create",
          survey_id: "survey-1",
          payload: { mime_type: "image/jpeg", size_bytes: 10, captured_at: null, metadata: {} },
        },
        {
          entity: "attachment",
          action: "create",
          survey_id: "survey-1",
          payload: { mime_type: "image/jpeg", size_bytes: "10" },
        },
      ],
    })

    expect(result.results[0].status).toBe("synced")
    expect(result.results[1]).toMatchObject({ status: "fatal_error", error: { http_status: 400 } })
  })

  it("survey.delete falls back to payload.id when survey_id is absent", async () => {
    const { service, surveysService } = buildService()

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        { entity: "survey", action: "delete", payload: { id: "survey-9" } },
        { entity: "survey", action: "delete", payload: {} },
      ],
    })

    expect(result.results[0].status).toBe("synced")
    expect(surveysService.deleteSurvey).toHaveBeenCalledWith(
      AUTH_USER,
      "survey-9",
      expect.objectContaining({ allowMissing: true }),
    )
    expect(result.results[1]).toMatchObject({ status: "fatal_error", error: { http_status: 400 } })
  })

  it("rejects an invalid visibility value", async () => {
    const { service } = buildService()

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [
        {
          entity: "survey",
          action: "visibility_update",
          survey_id: "survey-1",
          payload: { visibility: "friends" },
        },
      ],
    })

    expect(result.results[0]).toMatchObject({ status: "fatal_error", error: { http_status: 400 } })
  })

  it("maps a deterministic pg error from upsertForUser to fatal_error invalid_operation", async () => {
    const { service, surveysService } = buildService()
    surveysService.upsertForUser.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "23505" }),
    )

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [{ entity: "survey", action: "upsert", payload: validUpsertPayload() }],
    })

    expect(result.results[0]).toMatchObject({
      status: "fatal_error",
      error: { code: "invalid_operation" },
    })
  })

  it("maps a plain error from upsertForUser to retryable_error and logs the raw message server-side", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const { service, surveysService } = buildService()
    surveysService.upsertForUser.mockRejectedValueOnce(new Error("boom"))

    const result = await service.syncBatch(AUTH_USER as never, {
      operations: [{ entity: "survey", action: "upsert", payload: validUpsertPayload() }],
    })

    expect(result.results[0].status).toBe("retryable_error")
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes("boom"))).toBe(true)
  })
})

describe("SurveysSyncService.getSyncChanges", () => {
  const USER_ID = AUTH_USER.id

  function eventRow(id: string, xid8: string, seq: string) {
    return {
      id,
      survey_id: "survey-1",
      actor_id: USER_ID,
      event_type: "survey_upserted",
      payload: { sync_version: 1 },
      created_at: "2026-03-09 10:20:31.991+00",
      xid8,
      seq,
    }
  }

  function sqlOf(db: { query: jest.Mock }, index: number): string {
    return String(db.query.mock.calls[index][0])
  }

  function findEventsCall(db: { query: jest.Mock }) {
    const call = db.query.mock.calls.find((c) =>
      String(c[0]).includes("pg_snapshot_xmin(pg_current_snapshot())"),
    )
    if (!call) throw new Error("events query not issued")
    return { sql: String(call[0]), params: call[1] as unknown[] }
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("reads events below the snapshot minimum in (xid8, seq) order and emits a v2 cursor", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [eventRow("e1", "900", "3"), eventRow("e2", "901", "2")] })
      .mockResolvedValueOnce({ rows: [{ id: "survey-1" }] })

    const result = await service.getSyncChanges(AUTH_USER as never, undefined, 10)

    const { sql, params } = findEventsCall(db)
    expect(sqlOf(db, 0)).toBe(sql)
    expect(sql).toContain("(e.xid8, e.seq) >")
    expect(sql).toContain("ORDER BY e.xid8 ASC, e.seq ASC")
    expect(params).toEqual([USER_ID, "0", "0", 11])
    expect(result.cursor_in).toBeNull()
    expect(result.cursor_out).toBe("v2:901:2")
    expect(result.has_more).toBe(false)
    expect(result.events.map((event) => event.id)).toEqual(["e1", "e2"])
    // The public event shape the mobile app parses is unchanged: no xid8/seq leak out.
    expect(Object.keys(result.events[0]).sort()).toEqual(
      ["actor_id", "created_at", "event_type", "id", "payload", "survey_id"].sort(),
    )
    expect(result.surveys).toEqual([{ id: "survey-1" }])
  })

  it("reports has_more and builds the cursor from the limit-th row when limit + 1 rows come back", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({
        rows: [eventRow("e1", "900", "1"), eventRow("e2", "900", "2"), eventRow("e3", "901", "3")],
      })
      .mockResolvedValueOnce({ rows: [] })

    const result = await service.getSyncChanges(AUTH_USER as never, undefined, 2)

    expect(findEventsCall(db).params).toEqual([USER_ID, "0", "0", 3])
    expect(result.has_more).toBe(true)
    expect(result.events.map((event) => event.id)).toEqual(["e1", "e2"])
    expect(result.cursor_out).toBe("v2:900:2")
  })

  it("binds a v2 cursor as strings and echoes it back when there are no new events", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [{ future: false }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await service.getSyncChanges(AUTH_USER as never, "v2:9843:7", 10)

    expect(sqlOf(db, 0)).toContain("pg_snapshot_xmax(pg_current_snapshot())")
    expect(db.query.mock.calls[0][1]).toEqual(["9843"])
    expect(findEventsCall(db).params).toEqual([USER_ID, "9843", "7", 11])
    expect(result.cursor_in).toBe("v2:9843:7")
    expect(result.cursor_out).toBe("v2:9843:7")
    expect(result.has_more).toBe(false)
    expect(result.events).toEqual([])
  })

  it("translates a legacy cursor with (created_at, id) <= and returns the translated v2 cursor", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [{ xid8: "9000", seq: "12" }] })
      .mockResolvedValueOnce({ rows: [] })
    const legacy = "2026-03-09 10:20:31.991+00|survey-1"

    const result = await service.getSyncChanges(AUTH_USER as never, legacy, 10)

    expect(sqlOf(db, 0)).toContain("(e.created_at, e.id) <=")
    expect(sqlOf(db, 0)).toContain("s.user_id = $1")
    expect(db.query.mock.calls[0][1]).toEqual([USER_ID, "2026-03-09 10:20:31.991+00", "survey-1"])
    expect(findEventsCall(db).params).toEqual([USER_ID, "9000", "12", 11])
    expect(result.cursor_in).toBe(legacy)
    expect(result.cursor_out).toBe("v2:9000:12")
  })

  it("starts a legacy cursor with no matching event from the beginning", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })

    const result = await service.getSyncChanges(
      AUTH_USER as never,
      "2020-01-01 00:00:00+00|nothing",
      10,
    )

    expect(findEventsCall(db).params).toEqual([USER_ID, "0", "0", 11])
    expect(result.cursor_out).toBe("v2:0:0")
  })

  it.each(["22008", "22007", "22009"])(
    "maps a %s raised by the legacy translation cast to 400 Invalid sync cursor (D-12 backstop)",
    async (code) => {
      const { service, db } = buildService()
      db.query.mockRejectedValueOnce(
        Object.assign(new Error("date/time field value out of range"), { code }),
      )

      const promise = service.getSyncChanges(
        AUTH_USER as never,
        "2026-03-09 10:20:31.991+00|survey-1",
        10,
      )

      await expect(promise).rejects.toBeInstanceOf(BadRequestException)
      await expect(promise).rejects.toThrow("Invalid sync cursor")
      // Only the translation query ran: the feed query is never reached.
      expect(db.query).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    [
      "a statement timeout (57014)",
      Object.assign(new Error("canceling statement"), { code: "57014" }),
    ],
    ["a plain Error", new Error("connection terminated")],
  ])("rethrows %s from the legacy translation query unchanged", async (_label, failure) => {
    const { service, db } = buildService()
    db.query.mockRejectedValueOnce(failure)

    await expect(
      service.getSyncChanges(AUTH_USER as never, "2026-03-09 10:20:31.991+00|survey-1", 10),
    ).rejects.toBe(failure)
  })

  it("returns a null cursor and never re-sends event-less surveys when there is nothing new", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [] })

    const result = await service.getSyncChanges(AUTH_USER as never, undefined, 10)

    expect(result).toEqual({
      cursor_in: null,
      cursor_out: null,
      has_more: false,
      events: [],
      surveys: [],
      attachments: [],
    })
    // Only the events query runs: the old fallback that read `surveys` directly is gone.
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(sqlOf(db, 0)).toContain("FROM survey_events e")
  })

  it("restarts from the beginning when a v2 cursor is beyond the current xid counter", async () => {
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [{ future: true }] }).mockResolvedValueOnce({ rows: [] })

    const result = await service.getSyncChanges(AUTH_USER as never, "v2:99999999999:5", 10)

    expect(findEventsCall(db).params).toEqual([USER_ID, "0", "0", 11])
    expect(result.cursor_out).toBe("v2:0:0")
    expect(warnSpy).toHaveBeenCalled()
    const logged = warnSpy.mock.calls.map((call) => String(call[0])).join("\n")
    expect(logged).toContain(USER_ID)
    expect(logged).not.toContain("99999999999")
  })

  it("keeps a v2 cursor that is not beyond the current xid counter", async () => {
    const { service, db } = buildService()
    db.query
      .mockResolvedValueOnce({ rows: [{ future: false }] })
      .mockResolvedValueOnce({ rows: [] })

    await service.getSyncChanges(AUTH_USER as never, "v2:99999999999:5", 10)

    expect(findEventsCall(db).params).toEqual([USER_ID, "99999999999", "5", 11])
  })

  it("rejects a malformed cursor with 400 before touching the database", async () => {
    const { service, db } = buildService()

    await expect(service.getSyncChanges(AUTH_USER as never, "garbage", 10)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(db.query).not.toHaveBeenCalled()
  })
})
