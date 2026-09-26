import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService, Queryable } from "../database/database.service"
import { StorageService } from "../storage/storage.service"
import { IbpRulesService, IbpValidationResult } from "./ibp-rules.service"
import { ParcelsService } from "./parcels.service"
import { SurveyEventsService } from "./survey-events.service"
import {
  ListPage,
  SurveyListFilters,
  SurveyListItem,
  SurveysRepository,
} from "./surveys.repository"
import {
  AttachmentRow,
  SurveyPatchBody,
  SurveyVisibilityPatchBody,
  SurveyRow,
  SurveyUpsertBody,
} from "./surveys.types"
import {
  classifySameVersionContent,
  getChangedSubmittedReadOnlyFields,
  getSubmittedReadOnlyFields,
  normalizeObservationYear,
  normalizeParcelId,
  normalizeParcelIds,
  normalizePreviousSurveyId,
  normalizeVersionNumber,
  SameVersionContent,
} from "./surveys-normalize.utils"

type UpsertResult = {
  id: string
  server_status: "synced"
  updated_at: string
  warnings?: string[]
  factor_results?: SurveyRow["factor_results"]
}

// An upsert body after validation and scoring, shared by the fast path and the locked path.
type PreparedUpsert = {
  surveyId: string
  syncVersion: number
  siteName: string
  draftValidation: IbpValidationResult
  computedScores: NonNullable<IbpValidationResult["scores"]>
  now: Date
  expiresAt: string
}

function olderSyncVersionConflict(
  surveyId: string,
  serverSyncVersion: number,
  clientSyncVersion: number,
): ConflictException {
  return new ConflictException({
    code: "sync_version_conflict",
    message: "Older sync_version received",
    details: {
      survey_id: surveyId,
      server_sync_version: serverSyncVersion,
      client_sync_version: clientSyncVersion,
    },
  })
}

@Injectable()
export class SurveysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService,
    private readonly storage: StorageService,
    // D-07: the shared ownership lookup, parcel links and event writer (SurveysDataModule).
    private readonly repository: SurveysRepository,
    private readonly events: SurveyEventsService,
    // D-07/D-10: parcel registration, display location and submit validation.
    private readonly parcels: ParcelsService,
  ) {}

  // D-11: GET /surveys, keyset-paginated when page.limit is set; unpaginated otherwise.
  async listForUser(
    user: AuthenticatedUser,
    input: SurveyListFilters | undefined,
    page: ListPage = { limit: null, after: null },
  ): Promise<{ items: SurveyListItem[]; next_cursor: string | null }> {
    return this.repository.listForUser(this.db, user.id, input, page)
  }

  /**
   * D-09: the upsert fast path. Statement A is an unlocked read of the row, its parcel ids and
   * its xmin. Then:
   * - no row for this user: one atomic CTE creates the survey, parcels, links and event;
   * - a newer sync_version on a row that is not submitted: one atomic CTE updates the row,
   *   guarded by xmin, sync_version and status, and diffs the links and writes the event;
   * - the same sync_version: classified on the row just read; an identical replay (or a
   *   visibility-only replay on a deleted row) answers without writing, a conflict is a 409;
   * - anything else (a visibility-only write, a submitted survey, a write that affected 0 rows)
   *   runs the locked transaction, upsertLocked.
   * The explicit transaction of 01.4 D-06 becomes single-statement atomicity on the two fast
   * writes; the invariant is unchanged: the row, its links and its event commit together or not
   * at all. The fallback runs only when a statement affected 0 rows, never on an error (C-5):
   * an error has written nothing and propagates.
   */
  async upsertForUser(user: AuthenticatedUser, body: SurveyUpsertBody): Promise<UpsertResult> {
    const prepared = this.prepareUpsert(body)
    const { surveyId, syncVersion, draftValidation } = prepared

    const current = await this.repository.readForUpsert(this.db, surveyId, user.id)

    if (!current) {
      const selectedParcelIds = this.selectParcelIds(body, null, [])
      const parcelId = selectedParcelIds[0] ?? null
      const version = this.versionDefaults(body, null, parcelId, prepared.now)
      const created = await this.repository.createSurveyAtomic(this.db, {
        surveyId,
        userId: user.id,
        siteName: prepared.siteName,
        visibility: body.visibility ?? "private",
        parcelId,
        parcelIds: selectedParcelIds,
        observationYear: version.observationYear,
        versionNumber: version.versionNumber,
        previousSurveyId: version.previousSurveyId,
        regionVersion: body.region_version ?? null,
        vegetationStage: body.vegetation_stage ?? null,
        factors: body.factors ?? {},
        factorResults: draftValidation.factor_results ?? {},
        scores: prepared.computedScores,
        syncVersion,
        now: prepared.now.toISOString(),
        expiresAt: prepared.expiresAt,
        eventPayload: this.upsertEventPayload(prepared),
      })
      if (created) {
        return this.syncedResult(prepared, created.id, created.updated_at)
      }
      // 0 rows: the id exists (a concurrent create, or another user's survey id).
      return this.upsertLocked(user, body, prepared)
    }

    const { cas_token: casToken, parcel_ids: existingParcelIds, ...existing } = current

    if (syncVersion < existing.sync_version) {
      throw olderSyncVersionConflict(surveyId, existing.sync_version, syncVersion)
    }

    if (syncVersion === existing.sync_version) {
      const content = classifySameVersionContent(body, existing, existingParcelIds)
      if (content === "visibility_only" && !existing.deleted_at && body.visibility) {
        // The visibility write keeps its transaction (applyVisibilityChange + event).
        return this.upsertLocked(user, body, prepared)
      }
      // Identical, conflict, or visibility-only on a deleted row: nothing is written.
      return this.syncedResult(
        prepared,
        existing.id,
        await this.resolveSameVersionUpsert(this.db, user.id, existing, body, syncVersion, content),
      )
    }

    if (existing.status === "submitted") {
      // The read-only rule and the restricted update keep the locked transaction.
      return this.upsertLocked(user, body, prepared)
    }

    const selectedParcelIds = this.selectParcelIds(body, existing, existingParcelIds)
    const parcelId = selectedParcelIds[0] ?? null
    const version = this.versionDefaults(body, existing, parcelId, prepared.now)
    const updated = await this.repository.updateSurveyIfUnchanged(
      this.db,
      {
        surveyId,
        userId: user.id,
        siteName: prepared.siteName,
        visibility: body.visibility ?? existing.visibility,
        parcelId,
        parcelIds: selectedParcelIds,
        observationYear: version.observationYear,
        versionNumber: version.versionNumber,
        previousSurveyId: version.previousSurveyId,
        regionVersion: body.region_version ?? existing.region_version,
        vegetationStage: body.vegetation_stage ?? existing.vegetation_stage,
        factors: body.factors ?? existing.factors ?? {},
        factorResults: draftValidation.factor_results ?? existing.factor_results ?? {},
        scores: prepared.computedScores,
        syncVersion,
        now: prepared.now.toISOString(),
        expiresAt: prepared.expiresAt,
        eventPayload: this.upsertEventPayload(prepared),
      },
      casToken,
    )
    if (updated) {
      return this.syncedResult(prepared, updated.id, updated.updated_at)
    }
    // 0 rows: the row changed since statement A (xmin), or was submitted, or another request
    // already stored this sync_version. The locked path decides on the fresh row.
    return this.upsertLocked(user, body, prepared)
  }

  // Request validation and scoring, before any statement (unchanged from the pre-D-09 upsert).
  private prepareUpsert(body: SurveyUpsertBody): PreparedUpsert {
    if (!body.id) {
      throw new BadRequestException("id is required")
    }

    if (typeof body.sync_version !== "number") {
      throw new BadRequestException("sync_version is required")
    }

    if (!body.site_name) {
      throw new BadRequestException("site_name is required")
    }

    const draftValidation = this.ibpRules.validateDraft(
      body.factors,
      body.region_version,
      body.vegetation_stage,
    )
    if (!draftValidation.ok) {
      throw new UnprocessableEntityException({
        message: "IBP factor validation failed",
        errors: draftValidation.errors,
        warnings: draftValidation.warnings,
      })
    }

    const now = new Date()
    return {
      surveyId: body.id,
      syncVersion: body.sync_version,
      siteName: body.site_name,
      draftValidation,
      computedScores: draftValidation.scores ?? {
        ibp_peuplement_gestion: 0,
        ibp_contexte: 0,
        ibp_total: 0,
      },
      now,
      // D-03: expires_at is computed server-side at creation and never moved by an upsert; the
      // client-sent value (kept on the DTO for compatibility) is never read here.
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  private syncedResult(prepared: PreparedUpsert, id: string, updatedAt: string): UpsertResult {
    return {
      id,
      server_status: "synced" as const,
      updated_at: updatedAt,
      warnings: prepared.draftValidation.warnings,
      factor_results: prepared.draftValidation.factor_results ?? undefined,
    }
  }

  private upsertEventPayload(prepared: PreparedUpsert): Record<string, unknown> {
    return {
      sync_version: prepared.syncVersion,
      site_name: prepared.siteName,
      warnings: prepared.draftValidation.warnings,
    }
  }

  /**
   * The locked upsert (01.4 D-06), the D-09 fallback: one transaction that reads the row with
   * FOR UPDATE and decides on it. It covers a create whose id already exists (the same user's
   * concurrent create continues as an update; another user's id is survey_id_conflict), the
   * same-version visibility write, the submitted read-only rule, and any fast write that missed.
   */
  private async upsertLocked(
    user: AuthenticatedUser,
    body: SurveyUpsertBody,
    prepared: PreparedUpsert,
  ): Promise<UpsertResult> {
    const { surveyId, syncVersion, siteName, draftValidation, computedScores, now } = prepared

    return this.db.transaction(async (db) => {
      let existing = await this.repository.findOwned(db, surveyId, user.id, {
        activeOnly: false,
        forUpdate: true,
        columns: "full",
      })

      if (!existing) {
        const selectedParcelIds = await this.resolveSelectedParcelIds(db, body, null, [])
        const parcelId = selectedParcelIds[0] ?? null
        const { observationYear, versionNumber, previousSurveyId } = await this.resolveVersionInfo(
          db,
          body,
          null,
          parcelId,
          now,
        )

        const createdAt = now.toISOString()
        const insertResult = await db.query<{ id: string; updated_at: string }>(
          `INSERT INTO surveys (
            id, user_id, site_name, status, visibility, parcel_id, observation_year, version_number, previous_survey_id, region_version, vegetation_stage,
            factors, factor_results, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id, updated_at::text`,
          [
            surveyId,
            user.id,
            siteName,
            // D-03: a client can never submit through upsert; new surveys are
            // always created as draft.
            "draft",
            body.visibility ?? "private",
            parcelId,
            observationYear,
            versionNumber,
            previousSurveyId,
            body.region_version ?? null,
            body.vegetation_stage ?? null,
            JSON.stringify(body.factors ?? {}),
            JSON.stringify(draftValidation.factor_results ?? {}),
            JSON.stringify(computedScores),
            JSON.stringify({}),
            createdAt,
            createdAt,
            null,
            prepared.expiresAt,
            syncVersion,
          ],
        )

        if (insertResult.rows[0]) {
          await this.repository.syncSurveyParcels(db, surveyId, selectedParcelIds)

          await this.events.insert(
            db,
            surveyId,
            user.id,
            "created",
            this.upsertEventPayload(prepared),
          )

          return this.syncedResult(
            prepared,
            insertResult.rows[0].id,
            insertResult.rows[0].updated_at,
          )
        }

        // A concurrent create committed first: re-read under lock and either
        // continue through the existing-row path below (same user) or reject
        // as a survey id owned by someone else (T-01.4-15).
        existing = await this.lockedReRead(db, surveyId, user.id, "survey_id_conflict")
      }

      const existingParcelIds = await this.repository.getSurveyParcelIds(db, existing.id)

      if (syncVersion < existing.sync_version) {
        throw olderSyncVersionConflict(surveyId, existing.sync_version, syncVersion)
      }

      if (syncVersion === existing.sync_version) {
        // D-04/D-16: same version is an idempotent replay only when the
        // content matches by value; a visibility-only difference is applied
        // last-writer-wins, any read-only difference is a 409.
        const content = classifySameVersionContent(body, existing, existingParcelIds)
        return this.syncedResult(
          prepared,
          existing.id,
          await this.resolveSameVersionUpsert(db, user.id, existing, body, syncVersion, content),
        )
      }

      // D-04/D-13: a submitted survey's observation fields are read-only by
      // value. Identical resends (including today's installed apps replaying
      // status/expires_at) are accepted and only touch visibility/sync_version;
      // any actual change to a read-only field is rejected — never falls
      // through to ensureParcelIds/syncSurveyParcels or rewrites factors,
      // factor_results or scores.
      if (existing.status === "submitted") {
        const changedFields = getChangedSubmittedReadOnlyFields(body, existing, existingParcelIds)
        if (changedFields.length > 0) {
          throw new ConflictException({
            code: "survey_submitted_read_only",
            message: "Submitted survey fields are read-only",
            details: { survey_id: surveyId, fields: changedFields },
          })
        }

        const restrictedUpdateResult = await db.query<{ id: string; updated_at: string }>(
          `UPDATE surveys
           SET visibility = $3,
               sync_version = $4,
               updated_at = $5
           WHERE id = $1 AND user_id = $2 AND sync_version < $4
           RETURNING id, updated_at::text`,
          [
            surveyId,
            user.id,
            body.visibility ?? existing.visibility,
            syncVersion,
            now.toISOString(),
          ],
        )

        if (!restrictedUpdateResult.rows[0]) {
          return this.settleMissedLockedWrite(db, user, body, prepared)
        }

        await this.events.insert(
          db,
          surveyId,
          user.id,
          "updated",
          this.upsertEventPayload(prepared),
        )

        return this.syncedResult(
          prepared,
          restrictedUpdateResult.rows[0].id,
          restrictedUpdateResult.rows[0].updated_at,
        )
      }

      const selectedParcelIds = await this.resolveSelectedParcelIds(
        db,
        body,
        existing,
        existingParcelIds,
      )
      const parcelId = selectedParcelIds[0] ?? null
      const { observationYear, versionNumber, previousSurveyId } = await this.resolveVersionInfo(
        db,
        body,
        existing,
        parcelId,
        now,
      )

      const updateResult = await db.query<{ id: string; updated_at: string }>(
        `UPDATE surveys
         SET site_name = $3,
             visibility = $4,
             parcel_id = $5,
             observation_year = $6,
             version_number = $7,
             previous_survey_id = $8,
             region_version = $9,
             vegetation_stage = $10,
             factors = $11::jsonb,
             factor_results = $12::jsonb,
             scores = $13::jsonb,
             location = $14::jsonb,
             sync_version = $15,
             updated_at = $16
         WHERE id = $1 AND user_id = $2 AND sync_version < $15
         RETURNING id, updated_at::text`,
        [
          surveyId,
          user.id,
          siteName,
          body.visibility ?? existing.visibility,
          parcelId,
          observationYear,
          versionNumber,
          previousSurveyId,
          body.region_version ?? existing.region_version,
          body.vegetation_stage ?? existing.vegetation_stage,
          JSON.stringify(body.factors ?? existing.factors ?? {}),
          JSON.stringify(draftValidation.factor_results ?? existing.factor_results ?? {}),
          JSON.stringify(computedScores),
          JSON.stringify({}),
          syncVersion,
          now.toISOString(),
        ],
      )

      if (!updateResult.rows[0]) {
        // Zero rows updated: another request already advanced sync_version (T-01.4-11).
        return this.settleMissedLockedWrite(db, user, body, prepared)
      }

      await this.repository.syncSurveyParcels(db, surveyId, selectedParcelIds)

      await this.events.insert(db, surveyId, user.id, "updated", this.upsertEventPayload(prepared))

      return this.syncedResult(prepared, updateResult.rows[0].id, updateResult.rows[0].updated_at)
    })
  }

  // The locked re-read after a write inside upsertLocked affected 0 rows. A missing row is
  // survey_id_conflict after a create race (another user's id, T-01.4-15) and 404 otherwise.
  private async lockedReRead(
    db: Queryable,
    surveyId: string,
    userId: string,
    whenMissing: "survey_id_conflict" | "not_found",
  ): Promise<SurveyRow> {
    const reRead = await this.repository.findOwned(db, surveyId, userId, {
      activeOnly: false,
      forUpdate: true,
      columns: "full",
    })
    if (reRead) {
      return reRead
    }
    if (whenMissing === "survey_id_conflict") {
      throw new ConflictException({
        code: "survey_id_conflict",
        message: "Survey id already exists",
        details: { survey_id: surveyId },
      })
    }
    throw new NotFoundException("Survey not found")
  }

  // A guarded UPDATE inside upsertLocked affected 0 rows: re-read under lock and decide
  // idempotent replay (same version, D-04/D-16 content rule) versus conflict (T-01.4-11).
  private async settleMissedLockedWrite(
    db: Queryable,
    user: AuthenticatedUser,
    body: SurveyUpsertBody,
    prepared: PreparedUpsert,
  ): Promise<UpsertResult> {
    const { surveyId, syncVersion } = prepared
    const reRead = await this.lockedReRead(db, surveyId, user.id, "not_found")

    if (reRead.sync_version === syncVersion) {
      const content = classifySameVersionContent(
        body,
        reRead,
        await this.repository.getSurveyParcelIds(db, reRead.id),
      )
      return this.syncedResult(
        prepared,
        reRead.id,
        await this.resolveSameVersionUpsert(db, user.id, reRead, body, syncVersion, content),
      )
    }

    throw olderSyncVersionConflict(surveyId, reRead.sync_version, syncVersion)
  }

  // The parcel selection of an upsert, normalised and de-duplicated in body order: the body's
  // parcel_ids when present, else its legacy parcel_id, else the stored links, else the stored
  // legacy parcel_id. Pure; ensureParcelIds returns exactly this list after registering it.
  private selectParcelIds(
    body: SurveyUpsertBody,
    existing: SurveyRow | null,
    existingParcelIds: string[],
  ): string[] {
    const hasParcelIdsInput = Array.isArray(body.parcel_ids)
    const normalizedParcelIdsFromBody = normalizeParcelIds(body.parcel_ids)
    const normalizedLegacyParcelId = normalizeParcelId(body.parcel_id)

    let selectedParcelIds = normalizedParcelIdsFromBody
    if (!hasParcelIdsInput) {
      if (normalizedLegacyParcelId) {
        selectedParcelIds = [normalizedLegacyParcelId]
      } else if (existingParcelIds.length > 0) {
        selectedParcelIds = existingParcelIds
      } else if (existing?.parcel_id) {
        selectedParcelIds = [existing.parcel_id]
      }
    }

    return normalizeParcelIds(selectedParcelIds)
  }

  private async resolveSelectedParcelIds(
    db: Queryable,
    body: SurveyUpsertBody,
    existing: SurveyRow | null,
    existingParcelIds: string[],
  ): Promise<string[]> {
    return this.parcels.ensureParcelIds(db, this.selectParcelIds(body, existing, existingParcelIds))
  }

  // The version fields an upsert resolves without the database. versionNumber is null when
  // neither the body nor the stored row has one; the caller then derives the parcel's next
  // version (resolveVersionInfo here, the same subquery inside the D-09 statements).
  private versionDefaults(
    body: SurveyUpsertBody,
    existing: SurveyRow | null,
    parcelId: string | null,
    now: Date,
  ): {
    observationYear: number | null
    versionNumber: number | null
    previousSurveyId: string | null
  } {
    const observationYear =
      normalizeObservationYear(body.observation_year) ??
      existing?.observation_year ??
      (parcelId ? now.getUTCFullYear() : null)
    const versionNumber =
      normalizeVersionNumber(body.version_number) ?? existing?.version_number ?? null
    const previousSurveyId =
      normalizePreviousSurveyId(body.previous_survey_id) ?? existing?.previous_survey_id ?? null

    return { observationYear, versionNumber, previousSurveyId }
  }

  private async resolveVersionInfo(
    db: Queryable,
    body: SurveyUpsertBody,
    existing: SurveyRow | null,
    parcelId: string | null,
    now: Date,
  ): Promise<{
    observationYear: number | null
    versionNumber: number | null
    previousSurveyId: string | null
  }> {
    const defaults = this.versionDefaults(body, existing, parcelId, now)
    const versionNumber =
      defaults.versionNumber ??
      (parcelId ? await this.parcels.getDefaultVersionNumber(db, parcelId, body.id) : null)

    return { ...defaults, versionNumber }
  }

  async patchSurvey(
    user: AuthenticatedUser,
    surveyId: string,
    body: SurveyPatchBody,
  ): Promise<{ id: string; updated_at: string }> {
    return this.db.transaction(async (db) => {
      const existing = await this.repository.findOwnedOrThrow(db, surveyId, user.id, {
        activeOnly: true,
        columns: "full",
      })
      const forbiddenPostSubmitFields = getSubmittedReadOnlyFields(body)

      if (existing.status === "submitted" && forbiddenPostSubmitFields.length > 0) {
        throw new UnprocessableEntityException({
          code: "submitted_read_only_fields",
          message: "submitted survey is read-only for observation fields",
          forbidden_fields: forbiddenPostSubmitFields,
        })
      }

      if (body.factors) {
        const check = this.ibpRules.validateDraft(
          body.factors,
          body.region_version ?? existing.region_version,
          body.vegetation_stage ?? existing.vegetation_stage,
        )
        if (!check.ok) {
          throw new UnprocessableEntityException({
            message: "IBP factor validation failed",
            errors: check.errors,
            warnings: check.warnings,
          })
        }
        if (check.scores) {
          body.scores = check.scores
        }
        if (check.factor_results) {
          const mutableBody = body as SurveyPatchBody & {
            factor_results?: SurveyRow["factor_results"]
          }
          mutableBody.factor_results = check.factor_results
        }
      }

      const hasParcelIdsPatch = Object.prototype.hasOwnProperty.call(body, "parcel_ids")
      const hasLegacyParcelIdPatch = Object.prototype.hasOwnProperty.call(body, "parcel_id")
      const normalizedParcelIdsFromPatch = normalizeParcelIds(body.parcel_ids)
      const normalizedLegacyParcelId = normalizeParcelId(body.parcel_id)
      const currentParcelIds = await this.repository.getSurveyParcelIds(db, existing.id)

      let targetParcelIds =
        currentParcelIds.length > 0
          ? currentParcelIds
          : existing.parcel_id
            ? [existing.parcel_id]
            : []
      if (hasParcelIdsPatch) {
        targetParcelIds = normalizedParcelIdsFromPatch
      } else if (hasLegacyParcelIdPatch) {
        targetParcelIds = normalizedLegacyParcelId ? [normalizedLegacyParcelId] : []
      }

      const shouldUpdateParcels = hasParcelIdsPatch || hasLegacyParcelIdPatch
      targetParcelIds = await this.parcels.ensureParcelIds(db, targetParcelIds)
      const parcelIdForPatch = targetParcelIds[0] ?? null
      const observationYearForPatch =
        normalizeObservationYear(body.observation_year) ??
        (parcelIdForPatch && !existing.observation_year ? new Date().getUTCFullYear() : null)
      const versionNumberForPatch =
        normalizeVersionNumber(body.version_number) ??
        (parcelIdForPatch && !existing.version_number
          ? await this.parcels.getDefaultVersionNumber(db, parcelIdForPatch, surveyId)
          : null)
      const hasPreviousSurveyId = Object.prototype.hasOwnProperty.call(body, "previous_survey_id")
      const previousSurveyIdForPatch = hasPreviousSurveyId
        ? normalizePreviousSurveyId(body.previous_survey_id)
        : null

      const result = await db.query<{ id: string; updated_at: string }>(
        `UPDATE surveys
         SET site_name = COALESCE($3, site_name),
             visibility = COALESCE($4, visibility),
             parcel_id = CASE WHEN $14::boolean THEN $5 ELSE parcel_id END,
             observation_year = COALESCE($6, observation_year),
             version_number = COALESCE($7, version_number),
             previous_survey_id = COALESCE($8, previous_survey_id),
             region_version = COALESCE($9, region_version),
             vegetation_stage = COALESCE($10, vegetation_stage),
             factors = COALESCE($11::jsonb, factors),
             factor_results = COALESCE($12::jsonb, factor_results),
             scores = COALESCE($13::jsonb, scores),
             location = '{}'::jsonb,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING id, updated_at::text`,
        [
          surveyId,
          user.id,
          body.site_name ?? null,
          body.visibility ?? null,
          parcelIdForPatch,
          observationYearForPatch,
          versionNumberForPatch,
          previousSurveyIdForPatch,
          body.region_version ?? null,
          body.vegetation_stage ?? null,
          body.factors ? JSON.stringify(body.factors) : null,
          (body as SurveyPatchBody & { factor_results?: SurveyRow["factor_results"] })
            .factor_results
            ? JSON.stringify(
                (body as SurveyPatchBody & { factor_results?: SurveyRow["factor_results"] })
                  .factor_results,
              )
            : null,
          body.scores ? JSON.stringify(body.scores) : null,
          shouldUpdateParcels,
        ],
      )

      if (!result.rows[0]) {
        throw new NotFoundException("Survey not found")
      }

      await this.events.insert(db, surveyId, user.id, "updated", {
        changed_fields: Object.keys(body),
      })

      if (shouldUpdateParcels) {
        await this.repository.syncSurveyParcels(db, surveyId, targetParcelIds)
      }

      if (body.visibility && body.visibility !== existing.visibility) {
        await this.events.insert(db, surveyId, user.id, "visibility_changed", {
          from: existing.visibility,
          to: body.visibility,
        })
      }

      return result.rows[0]
    })
  }

  async patchSurveyVisibility(
    user: AuthenticatedUser,
    surveyId: string,
    body: SurveyVisibilityPatchBody,
  ): Promise<{ id: string; visibility: "private" | "public"; updated_at: string }> {
    if (body.visibility !== "private" && body.visibility !== "public") {
      throw new BadRequestException("visibility must be private or public")
    }
    const visibility = body.visibility

    return this.db.transaction(async (db) => {
      // "full", not "ownership": the no-op answer returns updated_at, which is not an
      // ownership column (D-07).
      const existing = await this.repository.findOwnedOrThrow(db, surveyId, user.id, {
        activeOnly: true,
        columns: "full",
      })
      if (existing.visibility === visibility) {
        return {
          id: existing.id,
          visibility: existing.visibility,
          updated_at: existing.updated_at,
        }
      }

      return this.applyVisibilityChange(db, user.id, surveyId, existing.visibility, visibility)
    })
  }

  /**
   * The visibility_update write: new visibility, updated_at = NOW() and a
   * visibility_changed event, in the caller's transaction. sync_version is not
   * touched. Shared by patchSurveyVisibility and the same-version upsert path
   * so both apply visibility the same way (D-16 amended 2026-09-25).
   */
  private async applyVisibilityChange(
    db: Queryable,
    userId: string,
    surveyId: string,
    from: "private" | "public",
    to: "private" | "public",
  ): Promise<{ id: string; visibility: "private" | "public"; updated_at: string }> {
    const result = await db.query<{
      id: string
      visibility: "private" | "public"
      updated_at: string
    }>(
      `UPDATE surveys
       SET visibility = $3,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING id, visibility, updated_at::text`,
      [surveyId, userId, to],
    )

    if (!result.rows[0]) {
      throw new NotFoundException("Survey not found")
    }

    await this.events.insert(db, surveyId, userId, "visibility_changed", {
      from,
      to: result.rows[0].visibility,
    })

    return result.rows[0]
  }

  /**
   * Resolve an upsert whose sync_version equals the stored one (D-04, D-16
   * amended 2026-09-25) and return the updated_at to answer with.
   * - conflict: 409 sync_version_conflict, nothing written.
   * - visibility_only: applied like visibility_update. A soft-deleted row is
   *   left untouched (patchSurveyVisibility refuses deleted surveys) and the
   *   replay is still answered synced, never 404.
   * - identical: idempotent replay, nothing written.
   */
  private async resolveSameVersionUpsert(
    db: Queryable,
    userId: string,
    row: SurveyRow,
    body: SurveyUpsertBody,
    syncVersion: number,
    content: SameVersionContent,
  ): Promise<string> {
    if (content === "conflict") {
      throw new ConflictException({
        code: "sync_version_conflict",
        message: "Same sync_version with different content",
        details: {
          survey_id: row.id,
          server_sync_version: row.sync_version,
          client_sync_version: syncVersion,
        },
      })
    }

    if (content === "visibility_only" && !row.deleted_at && body.visibility) {
      const applied = await this.applyVisibilityChange(
        db,
        userId,
        row.id,
        row.visibility,
        body.visibility,
      )
      return applied.updated_at
    }

    return row.updated_at
  }

  async getSurveyById(
    user: AuthenticatedUser,
    surveyId: string,
  ): Promise<
    Pick<
      SurveyRow,
      | "id"
      | "site_name"
      | "status"
      | "visibility"
      | "parcel_id"
      | "parcel_ids"
      | "observation_year"
      | "version_number"
      | "previous_survey_id"
      | "region_version"
      | "vegetation_stage"
      | "factors"
      | "factor_results"
      | "scores"
      | "created_at"
      | "updated_at"
      | "submitted_at"
      | "expires_at"
      | "sync_version"
    > & { display_location: { lat: number; lng: number } | null }
  > {
    const survey = await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "full",
    })
    const parcelIds = await this.repository.getSurveyParcelIds(this.db, survey.id)
    const displayLocation = await this.parcels.displayLocation(this.db, survey.id, survey.parcel_id)

    return {
      id: survey.id,
      site_name: survey.site_name,
      status: survey.status,
      visibility: survey.visibility,
      parcel_id: survey.parcel_id,
      parcel_ids: parcelIds,
      observation_year: survey.observation_year,
      version_number: survey.version_number,
      previous_survey_id: survey.previous_survey_id,
      region_version: survey.region_version,
      vegetation_stage: survey.vegetation_stage,
      factors: survey.factors,
      factor_results: survey.factor_results,
      scores: survey.scores,
      display_location: displayLocation,
      created_at: survey.created_at,
      updated_at: survey.updated_at,
      submitted_at: survey.submitted_at,
      expires_at: survey.expires_at,
      sync_version: survey.sync_version,
    }
  }

  async submitSurvey(
    user: AuthenticatedUser,
    surveyId: string,
  ): Promise<{
    id: string
    status: "submitted"
    submitted_at: string
    scores: Record<string, number>
    warnings?: string[]
  }> {
    type SubmitOutcome =
      | {
          kind: "submitted"
          result: {
            id: string
            status: "submitted"
            submitted_at: string
            scores: Record<string, number>
            warnings?: string[]
          }
        }
      | { kind: "rejected"; error: UnprocessableEntityException }

    try {
      const outcome: SubmitOutcome = await this.db.transaction(async (db) => {
        const existing = await this.repository.findOwnedOrThrow(db, surveyId, user.id, {
          activeOnly: true,
          forUpdate: true,
          columns: "full",
        })

        const validation = this.ibpRules.validateSubmit({
          region_version: existing.region_version,
          vegetation_stage: existing.vegetation_stage,
          expires_at: existing.expires_at,
          factors: existing.factors,
        })

        // D-08/T-01.4-12: lock the affected parcels in a consistent (sorted)
        // order before resolving the submit version, so two concurrent
        // submits on the same parcel serialise instead of racing.
        const surveyParcelIds = await this.repository.getSurveyParcelIds(db, existing.id)
        const parcelIdsToLock =
          surveyParcelIds.length > 0
            ? surveyParcelIds
            : existing.parcel_id
              ? [existing.parcel_id]
              : []
        if (parcelIdsToLock.length > 0) {
          const sortedParcelIds = [...parcelIdsToLock].sort()
          await db.query(
            `SELECT parcel_id
             FROM parcels
             WHERE parcel_id = ANY($1::text[])
             ORDER BY parcel_id
             FOR UPDATE`,
            [sortedParcelIds],
          )
        }

        const parcelValidation = await this.parcels.validateParcelSubmit(
          db,
          existing,
          surveyParcelIds,
        )

        if (parcelValidation.versionConflict) {
          throw new ConflictException({
            code: "parcel_version_conflict",
            message: "Parcel version conflict",
            details: {
              parcel_id: existing.parcel_id,
              expected_version_number: parcelValidation.versionConflict.expectedVersionNumber,
              client_version_number: existing.version_number,
            },
          })
        }

        if (!validation.ok || !validation.scores || parcelValidation.errors.length > 0) {
          const isExpired = validation.issues.some((issue) => issue.code === "survey_expired")
          if (isExpired && existing.status !== "expired") {
            // This write must commit even though the request is rejected
            // below, so we return a discriminated outcome instead of
            // throwing (which would roll it back).
            await db.query(
              `UPDATE surveys
               SET status = 'expired',
                   updated_at = NOW()
               WHERE id = $1 AND user_id = $2`,
              [surveyId, user.id],
            )
            await this.events.insert(db, surveyId, user.id, "expired", {
              reason: "submit_after_deadline",
              expires_at: existing.expires_at,
            })
          }

          return {
            kind: "rejected",
            error: new UnprocessableEntityException({
              code: parcelValidation.code,
              message: "Survey cannot be submitted",
              errors: [...validation.errors, ...parcelValidation.errors],
              warnings: validation.warnings,
            }),
          }
        }

        const result = await db.query<{
          id: string
          status: "submitted"
          submitted_at: string
        }>(
          `UPDATE surveys
           SET status = 'submitted',
               submitted_at = NOW(),
               factor_results = $3::jsonb,
               scores = $4::jsonb,
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING id, status, submitted_at::text`,
          [
            surveyId,
            user.id,
            JSON.stringify(validation.factor_results ?? {}),
            JSON.stringify(validation.scores),
          ],
        )

        if (!result.rows[0]) {
          throw new NotFoundException("Survey not found")
        }

        await this.events.insert(db, surveyId, user.id, "submitted", {
          scores: validation.scores,
          warnings: validation.warnings,
        })

        return {
          kind: "submitted",
          result: {
            ...result.rows[0],
            scores: validation.scores,
            warnings: validation.warnings,
          },
        }
      })

      if (outcome.kind === "rejected") {
        throw outcome.error
      }

      return outcome.result
    } catch (error: unknown) {
      // D-14: no UNIQUE(parcel_id, version_number) constraint exists in this
      // phase, so the sorted FOR UPDATE lock above is the primary guard; a
      // residual 23505 is still mapped to 409 as defence in depth. Every
      // other error (including the ConflictException/UnprocessableEntityException
      // thrown above) is rethrown untouched (RESEARCH Pitfall 3).
      const pgError = error as { code?: string }
      if (pgError && typeof pgError === "object" && pgError.code === "23505") {
        throw new ConflictException({
          code: "parcel_version_conflict",
          message: "Parcel version conflict",
          details: { survey_id: surveyId },
        })
      }
      throw error
    }
  }

  async deleteSurvey(
    user: AuthenticatedUser,
    surveyId: string,
    options?: { allowMissing?: boolean },
  ): Promise<{
    id: string
    deleted_at: string | null
    already_deleted: boolean
    missing: boolean
  }> {
    // D-07: delete reads only id and deleted_at.
    const existing = await this.repository.findOwned(this.db, surveyId, user.id, {
      activeOnly: false,
      columns: "ownership",
    })
    if (!existing) {
      if (options?.allowMissing) {
        return { id: surveyId, deleted_at: null, already_deleted: false, missing: true }
      }
      throw new NotFoundException("Survey not found")
    }

    if (existing.deleted_at) {
      return {
        id: existing.id,
        deleted_at: existing.deleted_at,
        already_deleted: true,
        missing: false,
      }
    }

    const { deletedAt, storageKeys } = await this.db.transaction(async (db) => {
      const attachmentsResult = await db.query<Pick<AttachmentRow, "id" | "storage_key">>(
        `SELECT id, storage_key
         FROM attachments
         WHERE survey_id = $1
           AND deleted_at IS NULL`,
        [surveyId],
      )

      await db.query(
        `UPDATE attachments
         SET deleted_at = NOW()
         WHERE survey_id = $1
           AND deleted_at IS NULL`,
        [surveyId],
      )

      const deletedSurvey = await db.query<{ id: string; deleted_at: string }>(
        `UPDATE surveys
         SET deleted_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND user_id = $2
           AND deleted_at IS NULL
         RETURNING id, deleted_at::text`,
        [surveyId, user.id],
      )

      await this.events.insert(db, surveyId, user.id, "deleted", {
        attachment_count_deleted: attachmentsResult.rows.length,
      })

      return {
        deletedAt: deletedSurvey.rows[0]?.deleted_at ?? existing.deleted_at ?? null,
        storageKeys: attachmentsResult.rows.map((row) => row.storage_key),
      }
    })

    // D-07: object-storage cleanup is best-effort and runs only after commit.
    // StorageService.deleteObject never throws, so a storage failure cannot
    // undo the committed deletion.
    for (const storageKey of storageKeys) {
      await this.storage.deleteObject(storageKey)
    }

    return {
      id: surveyId,
      deleted_at: deletedAt,
      already_deleted: false,
      missing: false,
    }
  }
}
