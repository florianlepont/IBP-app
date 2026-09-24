import { Logger } from "@nestjs/common"
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
