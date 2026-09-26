import { ConflictException } from "@nestjs/common"
import { AuthenticatedUser } from "../src/auth/auth.types"
import { DatabaseService } from "../src/database/database.service"
import { StorageService } from "../src/storage/storage.service"
import { IbpRulesService } from "../src/surveys/ibp-rules.service"
import { ParcelsService } from "../src/surveys/parcels.service"
import { SurveyEventsService } from "../src/surveys/survey-events.service"
import { SurveysService } from "../src/surveys/surveys.service"
import {
  CREATE_SURVEY_ATOMIC_SQL,
  fastWriteValues,
  SurveyFastWriteInput,
  SurveysRepository,
  UPDATE_SURVEY_IF_UNCHANGED_SQL,
  UpsertReadRow,
} from "../src/surveys/surveys.repository"
import { SurveyUpsertBody } from "../src/surveys/surveys.types"

// D-09 / C-5: the upsert fast path writes with one statement and falls back to the locked
// transaction (db.transaction) only when that statement affected 0 rows. An error propagates
// and never reaches the fallback.
describe("SurveysService upsert fast path", () => {
  const user = { id: "11111111-1111-4111-8111-111111111111" } as AuthenticatedUser
  const lockedResult = {
    id: "survey-1",
    server_status: "synced" as const,
    updated_at: "locked",
  }

  function storedRow(overrides: Partial<UpsertReadRow> = {}): UpsertReadRow {
    return {
      id: "survey-1",
      user_id: "11111111-1111-4111-8111-111111111111",
      site_name: "Stored",
      status: "draft",
      visibility: "public",
      parcel_id: "01001A0001",
      parcel_ids: ["01001A0001"],
      observation_year: 2025,
      version_number: 2,
      previous_survey_id: null,
      region_version: null,
      vegetation_stage: null,
      factors: {},
      factor_results: {},
      scores: {},
      created_at: "2026-01-01 00:00:00+00",
      updated_at: "2026-01-01 00:00:00+00",
      submitted_at: null,
      expires_at: "2026-01-08 00:00:00+00",
      sync_version: 1,
      last_sync_error: null,
      deleted_at: null,
      cas_token: "4242",
      ...overrides,
    }
  }

  function setup() {
    const db = {
      query: jest.fn(),
      transaction: jest.fn().mockResolvedValue(lockedResult),
    }
    const repository = {
      readForUpsert: jest.fn(),
      createSurveyAtomic: jest.fn(),
      updateSurveyIfUnchanged: jest.fn(),
    }
    const ibpRules = {
      validateDraft: jest.fn().mockReturnValue({
        ok: true,
        errors: [],
        warnings: ["w1"],
        issues: [],
        factor_scores: null,
        factor_results: null,
        scores: null,
      }),
    }
    const service = new SurveysService(
      db as unknown as DatabaseService,
      ibpRules as unknown as IbpRulesService,
      {} as StorageService,
      repository as unknown as SurveysRepository,
      {} as SurveyEventsService,
      {} as ParcelsService,
    )
    return { service, db, repository }
  }

  const body = (overrides: Partial<SurveyUpsertBody> = {}): SurveyUpsertBody => ({
    id: "survey-1",
    sync_version: 1,
    site_name: "Forest",
    parcel_ids: [" 01001a0002 ", "01001A0001", "01001A0002"],
    factors: {},
    ...overrides,
  })

  describe("create", () => {
    it("writes with one statement and no transaction", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(null)
      repository.createSurveyAtomic.mockResolvedValue({ id: "survey-1", updated_at: "t1" })

      await expect(service.upsertForUser(user, body())).resolves.toEqual({
        id: "survey-1",
        server_status: "synced",
        updated_at: "t1",
        warnings: ["w1"],
        factor_results: undefined,
      })

      expect(db.transaction).not.toHaveBeenCalled()
      expect(repository.createSurveyAtomic).toHaveBeenCalledTimes(1)
      const input = repository.createSurveyAtomic.mock.calls[0][1] as SurveyFastWriteInput
      expect(input).toMatchObject({
        surveyId: "survey-1",
        userId: user.id,
        visibility: "private",
        parcelId: "01001A0002",
        parcelIds: ["01001A0002", "01001A0001"],
        versionNumber: null,
        syncVersion: 1,
        eventPayload: { sync_version: 1, site_name: "Forest", warnings: ["w1"] },
      })
    })

    it("runs the locked path once when the statement affected 0 rows", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(null)
      repository.createSurveyAtomic.mockResolvedValue(null)

      await expect(service.upsertForUser(user, body())).resolves.toBe(lockedResult)
      expect(db.transaction).toHaveBeenCalledTimes(1)
    })

    it("propagates an error without running the locked path", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(null)
      repository.createSurveyAtomic.mockRejectedValue(new Error("e2e injected event failure"))

      await expect(service.upsertForUser(user, body())).rejects.toThrow(
        "e2e injected event failure",
      )
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("writes with one CAS statement and no transaction", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow())
      repository.updateSurveyIfUnchanged.mockResolvedValue({ id: "survey-1", updated_at: "t2" })

      const result = await service.upsertForUser(
        user,
        body({ sync_version: 2, parcel_ids: undefined }),
      )

      expect(result.updated_at).toBe("t2")
      expect(db.transaction).not.toHaveBeenCalled()
      expect(repository.updateSurveyIfUnchanged).toHaveBeenCalledTimes(1)
      const [, input, casToken] = repository.updateSurveyIfUnchanged.mock.calls[0] as [
        unknown,
        SurveyFastWriteInput,
        string,
      ]
      expect(casToken).toBe("4242")
      // Without parcel_ids in the body the stored links are kept; the stored visibility and
      // version number are carried over, as in the locked path.
      expect(input).toMatchObject({
        visibility: "public",
        parcelIds: ["01001A0001"],
        versionNumber: 2,
        observationYear: 2025,
        syncVersion: 2,
      })
    })

    it("runs the locked path once when the CAS affected 0 rows", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow())
      repository.updateSurveyIfUnchanged.mockResolvedValue(null)

      await expect(service.upsertForUser(user, body({ sync_version: 2 }))).resolves.toBe(
        lockedResult,
      )
      expect(db.transaction).toHaveBeenCalledTimes(1)
    })

    it("propagates an error without running the locked path", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow())
      repository.updateSurveyIfUnchanged.mockRejectedValue(new Error("boom"))

      await expect(service.upsertForUser(user, body({ sync_version: 2 }))).rejects.toThrow("boom")
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("leaves a submitted survey to the locked path", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow({ status: "submitted" }))

      await expect(service.upsertForUser(user, body({ sync_version: 2 }))).resolves.toBe(
        lockedResult,
      )
      expect(repository.updateSurveyIfUnchanged).not.toHaveBeenCalled()
      expect(db.transaction).toHaveBeenCalledTimes(1)
    })

    it("rejects an older sync_version from the read alone", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow({ sync_version: 3 }))

      const error = await service
        .upsertForUser(user, body({ sync_version: 2 }))
        .catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(ConflictException)
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: "sync_version_conflict",
        details: { survey_id: "survey-1", server_sync_version: 3, client_sync_version: 2 },
      })
      expect(db.transaction).not.toHaveBeenCalled()
      expect(repository.updateSurveyIfUnchanged).not.toHaveBeenCalled()
    })
  })

  describe("same sync_version", () => {
    const same = () =>
      body({
        site_name: "Stored",
        parcel_ids: ["01001A0001"],
        visibility: "public",
        observation_year: 2025,
        version_number: 2,
      })

    it("answers an identical replay from the read, with no write", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow())

      const result = await service.upsertForUser(user, same())

      expect(result.updated_at).toBe("2026-01-01 00:00:00+00")
      expect(db.transaction).not.toHaveBeenCalled()
      expect(db.query).not.toHaveBeenCalled()
      expect(repository.updateSurveyIfUnchanged).not.toHaveBeenCalled()
    })

    it("sends a visibility-only replay to the locked path", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow({ visibility: "private" }))

      await expect(service.upsertForUser(user, same())).resolves.toBe(lockedResult)
      expect(db.transaction).toHaveBeenCalledTimes(1)
    })

    it("answers a visibility-only replay on a deleted survey without writing", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(
        storedRow({ visibility: "private", deleted_at: "2026-01-02 00:00:00+00" }),
      )

      const result = await service.upsertForUser(user, same())
      expect(result.updated_at).toBe("2026-01-01 00:00:00+00")
      expect(db.transaction).not.toHaveBeenCalled()
      expect(db.query).not.toHaveBeenCalled()
    })

    it("rejects different content with a 409", async () => {
      const { service, db, repository } = setup()
      repository.readForUpsert.mockResolvedValue(storedRow())

      await expect(
        service.upsertForUser(user, { ...same(), site_name: "Changed" }),
      ).rejects.toBeInstanceOf(ConflictException)
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })
})

describe("SurveysRepository fast-path statements", () => {
  const input: SurveyFastWriteInput = {
    surveyId: "survey-1",
    userId: "11111111-1111-4111-8111-111111111111",
    siteName: "Forest",
    visibility: "private",
    parcelId: "01001B0002",
    parcelIds: ["01001B0002", "01001a0001", "01001A0001"],
    observationYear: 2025,
    versionNumber: null,
    previousSurveyId: null,
    regionVersion: null,
    vegetationStage: null,
    factors: {},
    factorResults: {},
    scores: { ibp_total: 0 },
    syncVersion: 1,
    now: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    eventPayload: { sync_version: 1 },
  }

  it("binds sorted, de-duplicated parcels and the create or CAS token as $23", () => {
    const create = fastWriteValues(input, null)
    expect(create).toHaveLength(23)
    expect(create[15]).toEqual(["01001A0001", "01001B0002"])
    expect(create[16]).toEqual(["01001", "01001"])
    expect(create[17]).toEqual(["AA", "BA"])
    expect(create[18]).toEqual(["0001", "0002"])
    expect(create[22]).toBe("2026-01-08T00:00:00.000Z")
    expect(fastWriteValues(input, "777")[22]).toBe("777")
  })

  it("gates parcel registration on the survey write and uses the shared event insert", () => {
    expect(CREATE_SURVEY_ATOMIC_SQL).toContain("ON CONFLICT (id) DO NOTHING")
    expect(CREATE_SURVEY_ATOMIC_SQL).toContain("EXISTS (SELECT 1 FROM ins)")
    expect(CREATE_SURVEY_ATOMIC_SQL).toContain(
      "INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)",
    )
    expect(UPDATE_SURVEY_IF_UNCHANGED_SQL).toContain("xmin = $23::xid")
    expect(UPDATE_SURVEY_IF_UNCHANGED_SQL).toContain("sync_version < $14::int")
    expect(UPDATE_SURVEY_IF_UNCHANGED_SQL).toContain("status <> 'submitted'")
    expect(UPDATE_SURVEY_IF_UNCHANGED_SQL).toContain("EXISTS (SELECT 1 FROM u)")
    expect(UPDATE_SURVEY_IF_UNCHANGED_SQL).toContain("parcel_id <> ALL($16::text[])")
  })

  it("returns null when the statement wrote no row", async () => {
    const repository = new SurveysRepository()
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) }
    await expect(repository.createSurveyAtomic(db, input)).resolves.toBeNull()
    await expect(repository.updateSurveyIfUnchanged(db, input, "1")).resolves.toBeNull()
    await expect(repository.readForUpsert(db, "survey-1", input.userId)).resolves.toBeNull()
    expect(db.query.mock.calls[2][0]).toContain("s.xmin::text AS cas_token")
  })
})
