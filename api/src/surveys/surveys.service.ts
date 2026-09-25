import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "crypto"
import { AuthenticatedUser } from "../auth/auth.types"
import { appConfigOf } from "../config/app-config"
import { DatabaseService, Queryable } from "../database/database.service"
import { StorageService } from "../storage/storage.service"
import { CadastreProviderService } from "./cadastre-provider.service"
import { IbpRulesService } from "./ibp-rules.service"
import { SurveyEventsService } from "./survey-events.service"
import { SurveysRepository } from "./surveys.repository"
import { normalizeDateInput, PublicMapDbRow, toPublicMapItem } from "./public-map.utils"
import {
  AttachmentRow,
  ParcelRow,
  SurveyPatchBody,
  SurveyVisibilityPatchBody,
  SurveyRow,
  SurveyUpsertBody,
} from "./surveys.types"
import {
  buildFallbackParcelGeometry,
  buildParcelKey,
  classifySameVersionContent,
  getChangedSubmittedReadOnlyFields,
  getSubmittedReadOnlyFields,
  normalizeCentroid,
  normalizeObservationYear,
  normalizeParcelId,
  normalizeParcelIds,
  normalizeParcelHistoryLimit,
  normalizeParcelPartToDigits,
  normalizeParcelSection,
  normalizePreviousSurveyId,
  normalizeSurveyStatusFilter,
  normalizeVersionNumber,
  parseBbox,
  parseParcelIdentifier,
  SameVersionContent,
  toFiniteNumber,
} from "./surveys-normalize.utils"

@Injectable()
export class SurveysService {
  private readonly useIgnParcelWfs: boolean
  private readonly ignParcelWfsUrl: string
  private readonly ignParcelWfsTypeName: string
  private readonly ignParcelWfsCount: number
  private readonly ignParcelWfsTimeoutMs: number

  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService,
    private readonly cadastreProvider: CadastreProviderService,
    private readonly storage: StorageService,
    config: ConfigService,
    // D-07: the shared ownership lookup, parcel links and event writer (SurveysDataModule).
    private readonly repository: SurveysRepository,
    private readonly events: SurveyEventsService,
  ) {
    // D-01: the WFS count cap (3000) and the defaults live in app-config.ts.
    const cadastre = appConfigOf(config).cadastre
    this.useIgnParcelWfs = cadastre.provider === "ign"
    this.ignParcelWfsUrl = cadastre.wfsUrl
    this.ignParcelWfsTypeName = cadastre.wfsTypename
    this.ignParcelWfsCount = cadastre.wfsCount
    this.ignParcelWfsTimeoutMs = cadastre.timeoutMs
  }

  async listForUser(
    user: AuthenticatedUser,
    input?: { status?: string; from?: string; to?: string; q?: string },
  ): Promise<
    Array<
      Pick<
        SurveyRow,
        | "id"
        | "site_name"
        | "status"
        | "visibility"
        | "parcel_id"
        | "observation_year"
        | "version_number"
        | "updated_at"
        | "sync_version"
      >
    >
  > {
    const filters: string[] = ["user_id = $1", "deleted_at IS NULL"]
    const values: unknown[] = [user.id]

    const normalizedStatus = normalizeSurveyStatusFilter(input?.status)
    if (normalizedStatus) {
      values.push(normalizedStatus)
      filters.push(`status = $${values.length}`)
    }

    const fromDate = normalizeDateInput(input?.from)
    if (fromDate) {
      values.push(fromDate)
      filters.push(`updated_at::date >= $${values.length}::date`)
    }

    const toDate = normalizeDateInput(input?.to)
    if (toDate) {
      values.push(toDate)
      filters.push(`updated_at::date <= $${values.length}::date`)
    }

    const query = input?.q?.trim()
    if (query) {
      values.push(`%${query}%`)
      filters.push(`(site_name ILIKE $${values.length} OR parcel_id ILIKE $${values.length})`)
    }

    const result = await this.db.query<
      Pick<
        SurveyRow,
        | "id"
        | "site_name"
        | "status"
        | "visibility"
        | "parcel_id"
        | "observation_year"
        | "version_number"
        | "updated_at"
        | "sync_version"
      >
    >(
      `SELECT id, site_name, status, visibility, parcel_id, observation_year, version_number, updated_at::text, sync_version
       FROM surveys
       WHERE ${filters.join(" AND ")}
       ORDER BY updated_at DESC`,
      values,
    )

    return result.rows
  }

  async upsertForUser(
    user: AuthenticatedUser,
    body: SurveyUpsertBody,
  ): Promise<{
    id: string
    server_status: "synced"
    updated_at: string
    warnings?: string[]
    factor_results?: SurveyRow["factor_results"]
  }> {
    if (!body.id) {
      throw new BadRequestException("id is required")
    }

    if (typeof body.sync_version !== "number") {
      throw new BadRequestException("sync_version is required")
    }
    const syncVersion = body.sync_version

    if (!body.site_name) {
      throw new BadRequestException("site_name is required")
    }
    const siteName = body.site_name

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
    // D-03: expires_at is computed server-side at creation and never moved by
    // an upsert; the client-sent value (kept on the DTO for compatibility) is
    // never read here.
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const computedScores = draftValidation.scores ?? {
      ibp_peuplement_gestion: 0,
      ibp_contexte: 0,
      ibp_total: 0,
    }
    const surveyId = body.id

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
            expiresAt,
            syncVersion,
          ],
        )

        if (insertResult.rows[0]) {
          await this.repository.syncSurveyParcels(db, surveyId, selectedParcelIds)

          await this.events.insert(db, surveyId, user.id, "created", {
            sync_version: syncVersion,
            site_name: siteName,
            warnings: draftValidation.warnings,
          })

          return {
            id: insertResult.rows[0].id,
            server_status: "synced" as const,
            updated_at: insertResult.rows[0].updated_at,
            warnings: draftValidation.warnings,
            factor_results: draftValidation.factor_results ?? undefined,
          }
        }

        // A concurrent create committed first: re-read under lock and either
        // continue through the existing-row path below (same user) or reject
        // as a survey id owned by someone else (T-01.4-15).
        const raced = await this.repository.findOwned(db, surveyId, user.id, {
          activeOnly: false,
          forUpdate: true,
          columns: "full",
        })
        if (!raced) {
          throw new ConflictException({
            code: "survey_id_conflict",
            message: "Survey id already exists",
            details: { survey_id: surveyId },
          })
        }
        existing = raced
      }

      const existingParcelIds = await this.repository.getSurveyParcelIds(db, existing.id)

      if (syncVersion < existing.sync_version) {
        throw new ConflictException({
          code: "sync_version_conflict",
          message: "Older sync_version received",
          details: {
            survey_id: surveyId,
            server_sync_version: existing.sync_version,
            client_sync_version: syncVersion,
          },
        })
      }

      if (syncVersion === existing.sync_version) {
        // D-04/D-16: same version is an idempotent replay only when the
        // content matches by value; a visibility-only difference is applied
        // last-writer-wins, any read-only difference is a 409.
        const content = classifySameVersionContent(body, existing, existingParcelIds)
        return {
          id: existing.id,
          server_status: "synced" as const,
          updated_at: await this.resolveSameVersionUpsert(
            db,
            user.id,
            existing,
            body,
            syncVersion,
            content,
          ),
          warnings: draftValidation.warnings,
          factor_results: draftValidation.factor_results ?? undefined,
        }
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
          const reRead = await this.repository.findOwned(db, surveyId, user.id, {
            activeOnly: false,
            forUpdate: true,
            columns: "full",
          })
          if (!reRead) {
            throw new NotFoundException("Survey not found")
          }

          if (reRead.sync_version === syncVersion) {
            const content = classifySameVersionContent(
              body,
              reRead,
              await this.repository.getSurveyParcelIds(db, reRead.id),
            )
            return {
              id: reRead.id,
              server_status: "synced" as const,
              updated_at: await this.resolveSameVersionUpsert(
                db,
                user.id,
                reRead,
                body,
                syncVersion,
                content,
              ),
              warnings: draftValidation.warnings,
              factor_results: draftValidation.factor_results ?? undefined,
            }
          }

          throw new ConflictException({
            code: "sync_version_conflict",
            message: "Older sync_version received",
            details: {
              survey_id: surveyId,
              server_sync_version: reRead.sync_version,
              client_sync_version: syncVersion,
            },
          })
        }

        await this.events.insert(db, surveyId, user.id, "updated", {
          sync_version: syncVersion,
          site_name: siteName,
          warnings: draftValidation.warnings,
        })

        return {
          id: restrictedUpdateResult.rows[0].id,
          server_status: "synced" as const,
          updated_at: restrictedUpdateResult.rows[0].updated_at,
          warnings: draftValidation.warnings,
          factor_results: draftValidation.factor_results ?? undefined,
        }
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
        // Zero rows updated: another request already advanced sync_version.
        // Re-read under lock and decide idempotent-replay vs conflict (T-01.4-11).
        const reRead = await this.repository.findOwned(db, surveyId, user.id, {
          activeOnly: false,
          forUpdate: true,
          columns: "full",
        })
        if (!reRead) {
          throw new NotFoundException("Survey not found")
        }

        if (reRead.sync_version === syncVersion) {
          const content = classifySameVersionContent(
            body,
            reRead,
            await this.repository.getSurveyParcelIds(db, reRead.id),
          )
          return {
            id: reRead.id,
            server_status: "synced" as const,
            updated_at: await this.resolveSameVersionUpsert(
              db,
              user.id,
              reRead,
              body,
              syncVersion,
              content,
            ),
            warnings: draftValidation.warnings,
            factor_results: draftValidation.factor_results ?? undefined,
          }
        }

        throw new ConflictException({
          code: "sync_version_conflict",
          message: "Older sync_version received",
          details: {
            survey_id: surveyId,
            server_sync_version: reRead.sync_version,
            client_sync_version: syncVersion,
          },
        })
      }

      await this.repository.syncSurveyParcels(db, surveyId, selectedParcelIds)

      await this.events.insert(db, surveyId, user.id, "updated", {
        sync_version: syncVersion,
        site_name: siteName,
        warnings: draftValidation.warnings,
      })

      return {
        id: updateResult.rows[0].id,
        server_status: "synced" as const,
        updated_at: updateResult.rows[0].updated_at,
        warnings: draftValidation.warnings,
        factor_results: draftValidation.factor_results ?? undefined,
      }
    })
  }

  private async resolveSelectedParcelIds(
    db: Queryable,
    body: SurveyUpsertBody,
    existing: SurveyRow | null,
    existingParcelIds: string[],
  ): Promise<string[]> {
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

    return this.ensureParcelIds(db, selectedParcelIds)
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
    const observationYear =
      normalizeObservationYear(body.observation_year) ??
      existing?.observation_year ??
      (parcelId ? now.getUTCFullYear() : null)
    const versionNumberRaw =
      normalizeVersionNumber(body.version_number) ?? existing?.version_number ?? null
    const versionNumber =
      versionNumberRaw ??
      (parcelId ? await this.getDefaultVersionNumber(db, parcelId, body.id) : null)
    const previousSurveyId =
      normalizePreviousSurveyId(body.previous_survey_id) ?? existing?.previous_survey_id ?? null

    return { observationYear, versionNumber, previousSurveyId }
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
      targetParcelIds = await this.ensureParcelIds(db, targetParcelIds)
      const parcelIdForPatch = targetParcelIds[0] ?? null
      const observationYearForPatch =
        normalizeObservationYear(body.observation_year) ??
        (parcelIdForPatch && !existing.observation_year ? new Date().getUTCFullYear() : null)
      const versionNumberForPatch =
        normalizeVersionNumber(body.version_number) ??
        (parcelIdForPatch && !existing.version_number
          ? await this.getDefaultVersionNumber(db, parcelIdForPatch, surveyId)
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
    const displayLocation = await this.computeSurveyDisplayLocation(survey.id, survey.parcel_id)

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

        const parcelValidation = await this.validateParcelSubmit(db, existing)

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

  async getPublicMapItems(input?: { from?: string; to?: string; region?: string }): Promise<{
    items: Array<{
      survey_id: string
      display_location: { lat: number; lng: number }
      survey_date: string
      region_code: string
      ibp_total: number
    }>
  }> {
    const filters: string[] = [
      `deleted_at IS NULL`,
      `visibility = 'public'`,
      `status = 'submitted'`,
      `submitted_at IS NOT NULL`,
    ]
    const values: unknown[] = []

    const fromDate = normalizeDateInput(input?.from)
    if (fromDate) {
      values.push(fromDate)
      filters.push(`submitted_at::date >= $${values.length}::date`)
    }

    const toDate = normalizeDateInput(input?.to)
    if (toDate) {
      values.push(toDate)
      filters.push(`submitted_at::date <= $${values.length}::date`)
    }

    if (input?.region && input.region.trim().length > 0) {
      values.push(input.region.trim())
      filters.push(`region_version = $${values.length}`)
    }

    const result = await this.db.query<PublicMapDbRow>(
      `SELECT
         s.id,
         s.region_version,
         s.scores,
         s.submitted_at::text,
         AVG((p.centroid ->> 'lat')::double precision) AS parcel_centroid_lat,
         AVG((p.centroid ->> 'lng')::double precision) AS parcel_centroid_lng
       FROM surveys s
       LEFT JOIN survey_parcels sp
         ON sp.survey_id = s.id
       LEFT JOIN parcels p
         ON p.parcel_id = sp.parcel_id
       WHERE ${filters.map((filter) => `s.${filter}`).join(" AND ")}
       GROUP BY s.id, s.region_version, s.scores, s.submitted_at
       ORDER BY s.submitted_at DESC
       LIMIT 500`,
      values,
    )

    const items = result.rows
      .map((row) => toPublicMapItem(row))
      .filter(
        (
          item,
        ): item is {
          survey_id: string
          display_location: { lat: number; lng: number }
          survey_date: string
          region_code: string
          ibp_total: number
        } => Boolean(item),
      )

    return { items }
  }

  async getPublicParcelStatuses(input?: { bbox?: string; zoom?: string; year?: string }): Promise<{
    items: Array<{
      parcel_id: string
      study_status: "studied" | "not_studied"
      latest_submitted_survey_id: string | null
      latest_observation_year: number | null
      latest_ibp_total: number | null
      geometry?: Record<string, unknown>
    }>
  }> {
    const zoom = toFiniteNumber(input?.zoom)
    if (zoom !== null && zoom < 15) {
      return { items: [] }
    }

    const bbox = parseBbox(input?.bbox)
    const year = normalizeObservationYear(input?.year)
    if (this.useIgnParcelWfs && bbox) {
      const ignItems = await this.resolvePublicParcelStatusesFromIgnWfs(bbox, year)
      if (ignItems.length > 0) {
        return { items: ignItems }
      }
    }

    const values: unknown[] = [year]
    const bboxFilters: string[] = []

    if (bbox) {
      values.push(bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat)
      bboxFilters.push(
        `(p.centroid ->> 'lng')::double precision BETWEEN $2::double precision AND $3::double precision`,
      )
      bboxFilters.push(
        `(p.centroid ->> 'lat')::double precision BETWEEN $4::double precision AND $5::double precision`,
      )
    }

    const result = await this.db.query<{
      parcel_id: string
      study_status: "studied" | "not_studied"
      latest_submitted_survey_id: string | null
      latest_observation_year: number | null
      latest_ibp_total: number | null
      geometry: Record<string, unknown>
      centroid: Record<string, unknown>
    }>(
      `WITH latest_public AS (
         SELECT
           sp.parcel_id,
           s.id,
           s.observation_year,
           s.version_number,
           s.submitted_at,
           s.scores,
           ROW_NUMBER() OVER (
             PARTITION BY sp.parcel_id
             ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST
           ) AS rank_in_parcel
         FROM surveys s
         JOIN survey_parcels sp
           ON sp.survey_id = s.id
         WHERE s.deleted_at IS NULL
           AND s.status = 'submitted'
           AND s.visibility = 'public'
           AND ($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)
       )
       SELECT
         p.parcel_id,
         p.geometry,
         p.centroid,
         CASE WHEN lp.parcel_id IS NULL THEN 'not_studied' ELSE 'studied' END AS study_status,
         lp.id AS latest_submitted_survey_id,
         lp.observation_year AS latest_observation_year,
         (lp.scores ->> 'ibp_total')::integer AS latest_ibp_total
       FROM parcels p
       LEFT JOIN latest_public lp
         ON lp.parcel_id = p.parcel_id
        AND lp.rank_in_parcel = 1
       ${bboxFilters.length ? `WHERE ${bboxFilters.join(" AND ")}` : ""}
       ORDER BY p.parcel_id ASC
       LIMIT 1000`,
      values,
    )

    const seenParcelIds = new Set<string>()
    const items = result.rows
      .map((row) => {
        const centroid = normalizeCentroid(row.centroid)
        const geometry =
          row.geometry && Object.keys(row.geometry).length > 0
            ? row.geometry
            : centroid
              ? buildFallbackParcelGeometry(centroid)
              : undefined
        return {
          parcel_id: row.parcel_id,
          study_status: row.study_status,
          latest_submitted_survey_id: row.latest_submitted_survey_id,
          latest_observation_year: row.latest_observation_year,
          latest_ibp_total: row.latest_ibp_total,
          geometry,
        }
      })
      .filter((item) => {
        if (seenParcelIds.has(item.parcel_id)) {
          return false
        }
        seenParcelIds.add(item.parcel_id)
        return true
      })

    return {
      items,
    }
  }

  private async resolvePublicParcelStatusesFromIgnWfs(
    bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
    year: number | null,
  ): Promise<
    Array<{
      parcel_id: string
      study_status: "studied" | "not_studied"
      latest_submitted_survey_id: string | null
      latest_observation_year: number | null
      latest_ibp_total: number | null
      geometry?: Record<string, unknown>
    }>
  > {
    try {
      const url = new URL(this.ignParcelWfsUrl)
      url.searchParams.set("service", "WFS")
      url.searchParams.set("version", "2.0.0")
      url.searchParams.set("request", "GetFeature")
      url.searchParams.set("typeNames", this.ignParcelWfsTypeName)
      url.searchParams.set(
        "bbox",
        `${bbox.minLng.toFixed(6)},${bbox.minLat.toFixed(6)},${bbox.maxLng.toFixed(6)},${bbox.maxLat.toFixed(6)},EPSG:4326`,
      )
      url.searchParams.set("outputFormat", "application/json")
      url.searchParams.set("count", String(this.ignParcelWfsCount))

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.ignParcelWfsTimeoutMs)
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        return []
      }

      const payloadRaw = await response.json()
      const payload =
        payloadRaw && typeof payloadRaw === "object" ? (payloadRaw as Record<string, unknown>) : {}
      const featuresRaw = Array.isArray(payload.features) ? payload.features : []
      if (featuresRaw.length === 0) {
        return []
      }

      const latestResult = await this.db.query<{
        parcel_id: string
        commune_code: string
        section: string
        number: string
        latest_submitted_survey_id: string
        latest_observation_year: number | null
        latest_ibp_total: number | null
      }>(
        `WITH latest_public AS (
           SELECT
             sp.parcel_id,
             s.id,
             s.observation_year,
             s.version_number,
             s.submitted_at,
             s.scores,
             ROW_NUMBER() OVER (
               PARTITION BY sp.parcel_id
               ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST
             ) AS rank_in_parcel
           FROM surveys s
           JOIN survey_parcels sp
             ON sp.survey_id = s.id
           WHERE s.deleted_at IS NULL
             AND s.status = 'submitted'
             AND s.visibility = 'public'
             AND ($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)
         )
         SELECT
           p.parcel_id,
           p.commune_code,
           p.section,
           p.number,
           lp.id::text AS latest_submitted_survey_id,
           lp.observation_year AS latest_observation_year,
           (lp.scores ->> 'ibp_total')::integer AS latest_ibp_total
         FROM latest_public lp
         JOIN parcels p
           ON p.parcel_id = lp.parcel_id
         WHERE lp.rank_in_parcel = 1`,
        [year],
      )

      const studiedByParcelKey = new Map<
        string,
        {
          latest_submitted_survey_id: string
          latest_observation_year: number | null
          latest_ibp_total: number | null
        }
      >()
      for (const row of latestResult.rows) {
        const key = buildParcelKey(row.commune_code, row.section, row.number)
        studiedByParcelKey.set(key, {
          latest_submitted_survey_id: row.latest_submitted_survey_id,
          latest_observation_year: row.latest_observation_year,
          latest_ibp_total: row.latest_ibp_total,
        })
      }

      const items: Array<{
        parcel_id: string
        study_status: "studied" | "not_studied"
        latest_submitted_survey_id: string | null
        latest_observation_year: number | null
        latest_ibp_total: number | null
        geometry?: Record<string, unknown>
      }> = []
      const seen = new Set<string>()

      for (const featureRaw of featuresRaw) {
        const feature =
          featureRaw && typeof featureRaw === "object"
            ? (featureRaw as Record<string, unknown>)
            : {}
        const propertiesRaw = feature.properties
        const properties =
          propertiesRaw && typeof propertiesRaw === "object" && !Array.isArray(propertiesRaw)
            ? (propertiesRaw as Record<string, unknown>)
            : {}
        const geometryRaw = feature.geometry
        const geometry =
          geometryRaw && typeof geometryRaw === "object" && !Array.isArray(geometryRaw)
            ? (geometryRaw as Record<string, unknown>)
            : {}
        const geometryType = typeof geometry.type === "string" ? geometry.type : ""
        if (
          (geometryType !== "Polygon" && geometryType !== "MultiPolygon") ||
          !Array.isArray(geometry.coordinates)
        ) {
          continue
        }

        const communeCode = normalizeParcelPartToDigits(properties.code_insee, 5)
        const section = normalizeParcelSection(properties.section)
        const number = normalizeParcelPartToDigits(properties.numero, 4)
        if (!communeCode || !section || !number) {
          continue
        }

        const parcelKey = buildParcelKey(communeCode, section, number)
        if (seen.has(parcelKey)) {
          continue
        }
        seen.add(parcelKey)

        const idu = typeof properties.idu === "string" ? properties.idu.trim().toUpperCase() : ""
        const parcelId = idu.length > 0 ? idu : `${communeCode}${section}${number}`
        const studied = studiedByParcelKey.get(parcelKey)
        items.push({
          parcel_id: parcelId,
          study_status: studied ? "studied" : "not_studied",
          latest_submitted_survey_id: studied?.latest_submitted_survey_id ?? null,
          latest_observation_year: studied?.latest_observation_year ?? null,
          latest_ibp_total: studied?.latest_ibp_total ?? null,
          geometry,
        })
      }

      return items
    } catch {
      return []
    }
  }

  async resolveParcelByCoordinates(input?: { lat?: string; lng?: string }): Promise<{
    parcel: {
      parcel_id: string
      commune_code: string
      section: string
      number: string
      centroid: { lat: number; lng: number }
    }
  }> {
    const lat = toFiniteNumber(input?.lat)
    const lng = toFiniteNumber(input?.lng)
    if (lat === null || lng === null) {
      throw new BadRequestException("lat and lng query parameters are required")
    }

    const parcel = await this.resolveParcelFromCoordinates(lat, lng)
    if (!parcel) {
      throw new UnprocessableEntityException({
        code: "parcel_invalid",
        message: "Parcel could not be resolved from coordinates",
      })
    }

    const centroid = normalizeCentroid(parcel.centroid)
    if (!centroid) {
      throw new UnprocessableEntityException({
        code: "parcel_invalid",
        message: "Resolved parcel has invalid centroid metadata",
      })
    }

    return {
      parcel: {
        parcel_id: parcel.parcel_id,
        commune_code: parcel.commune_code,
        section: parcel.section,
        number: parcel.number,
        centroid,
      },
    }
  }

  async getParcelSurveyHistory(
    user: AuthenticatedUser,
    parcelIdRaw: string,
    limitRaw?: string,
  ): Promise<{
    parcel_id: string
    items: Array<{
      survey_id: string
      observation_year: number | null
      version_number: number | null
      scores: Record<string, unknown>
      factor_results: Record<string, unknown>
      submitted_at: string
    }>
  }> {
    const parcelId = normalizeParcelId(parcelIdRaw)
    if (!parcelId) {
      throw new BadRequestException("parcel_id is required")
    }

    const limit = normalizeParcelHistoryLimit(limitRaw)
    const result = await this.db.query<{
      survey_id: string
      observation_year: number | null
      version_number: number | null
      scores: Record<string, unknown>
      factor_results: Record<string, unknown>
      submitted_at: string
    }>(
      `SELECT
         s.id AS survey_id,
         s.observation_year,
         s.version_number,
         s.scores,
         s.factor_results,
         s.submitted_at::text
       FROM surveys s
       JOIN survey_parcels sp
         ON sp.survey_id = s.id
       WHERE sp.parcel_id = $1
         AND s.deleted_at IS NULL
         AND s.status = 'submitted'
         AND s.submitted_at IS NOT NULL
         AND (s.visibility = 'public' OR s.user_id = $2)
       ORDER BY s.observation_year ASC NULLS LAST, s.version_number ASC NULLS LAST, s.submitted_at ASC
       LIMIT $3`,
      [parcelId, user.id, limit],
    )

    return {
      parcel_id: parcelId,
      items: result.rows,
    }
  }

  private async computeSurveyDisplayLocation(
    surveyId: string,
    fallbackParcelId?: string | null,
  ): Promise<{ lat: number; lng: number } | null> {
    const fromMany = await this.db.query<{ lat: number | null; lng: number | null }>(
      `SELECT
         AVG((p.centroid ->> 'lat')::double precision) AS lat,
         AVG((p.centroid ->> 'lng')::double precision) AS lng
       FROM survey_parcels sp
       JOIN parcels p
         ON p.parcel_id = sp.parcel_id
       WHERE sp.survey_id = $1`,
      [surveyId],
    )
    const centroidMany = normalizeCentroid({
      lat: fromMany.rows[0]?.lat,
      lng: fromMany.rows[0]?.lng,
    })
    if (centroidMany) {
      return centroidMany
    }

    const parcelId = normalizeParcelId(fallbackParcelId)
    if (!parcelId) {
      return null
    }

    const fallback = await this.db.query<{ centroid: Record<string, unknown> }>(
      `SELECT centroid
       FROM parcels
       WHERE parcel_id = $1`,
      [parcelId],
    )
    if (!fallback.rows[0]?.centroid) {
      return null
    }
    return normalizeCentroid(fallback.rows[0].centroid)
  }

  private async ensureParcelIds(db: Queryable, parcelIds: string[]): Promise<string[]> {
    if (parcelIds.length === 0) {
      return []
    }

    const output: string[] = []
    const seen = new Set<string>()
    for (const raw of parcelIds) {
      const normalized = normalizeParcelId(raw)
      if (!normalized || seen.has(normalized)) {
        continue
      }
      const ensured = await this.ensureParcelById(db, normalized)
      if (!seen.has(ensured.parcel_id)) {
        seen.add(ensured.parcel_id)
        output.push(ensured.parcel_id)
      }
    }

    return output
  }

  private async resolveParcelFromCoordinates(lat: number, lng: number): Promise<ParcelRow | null> {
    const resolved = await this.cadastreProvider.resolveFromPoint(lat, lng)
    if (!resolved) {
      return null
    }

    const result = await this.db.query<ParcelRow>(
      `INSERT INTO parcels (id, parcel_id, commune_code, section, number, geometry, centroid, source)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       ON CONFLICT (parcel_id) DO UPDATE
         SET centroid = COALESCE(NULLIF(parcels.centroid, '{}'::jsonb), EXCLUDED.centroid),
             geometry = COALESCE(NULLIF(parcels.geometry, '{}'::jsonb), EXCLUDED.geometry),
             source = COALESCE(parcels.source, EXCLUDED.source),
             updated_at = NOW()
       RETURNING
         id::text,
         parcel_id,
         commune_code,
         section,
         number,
         geometry,
         centroid,
         area_m2,
         source,
         created_at::text,
         updated_at::text`,
      [
        randomUUID(),
        resolved.parcel_id,
        resolved.commune_code,
        resolved.section,
        resolved.number,
        JSON.stringify(resolved.geometry ?? {}),
        JSON.stringify(resolved.centroid),
        resolved.source,
      ],
    )

    return result.rows[0] ?? null
  }

  private async ensureParcelById(db: Queryable, parcelId: string): Promise<ParcelRow> {
    const existing = await db.query<ParcelRow>(
      `SELECT
         id::text,
         parcel_id,
         commune_code,
         section,
         number,
         geometry,
         centroid,
         area_m2,
         source,
         created_at::text,
         updated_at::text
       FROM parcels
       WHERE parcel_id = $1`,
      [parcelId],
    )
    if (existing.rows[0]) {
      return existing.rows[0]
    }

    const parsed = parseParcelIdentifier(parcelId)
    const inserted = await db.query<ParcelRow>(
      `INSERT INTO parcels (id, parcel_id, commune_code, section, number, geometry, centroid, source)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       ON CONFLICT (parcel_id) DO UPDATE
         SET updated_at = NOW()
       RETURNING
         id::text,
         parcel_id,
         commune_code,
         section,
         number,
         geometry,
         centroid,
         area_m2,
         source,
         created_at::text,
         updated_at::text`,
      [
        randomUUID(),
        parcelId,
        parsed.communeCode,
        parsed.section,
        parsed.number,
        JSON.stringify({}),
        JSON.stringify({}),
        "manual",
      ],
    )

    return inserted.rows[0]
  }

  private async getDefaultVersionNumber(
    db: Queryable,
    parcelId: string,
    surveyIdToExclude?: string,
  ): Promise<number> {
    const result = await db.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM surveys s
       JOIN survey_parcels sp
         ON sp.survey_id = s.id
       WHERE sp.parcel_id = $1
         AND s.deleted_at IS NULL
         AND s.status = 'submitted'
         AND ($2::text IS NULL OR s.id <> $2)`,
      [parcelId, surveyIdToExclude ?? null],
    )
    return result.rows[0]?.next_version ?? 1
  }

  private async validateParcelSubmit(
    db: Queryable,
    survey: SurveyRow,
  ): Promise<{
    code?: "parcel_required" | "parcel_invalid"
    errors: string[]
    versionConflict?: { expectedVersionNumber: number }
  }> {
    const errors: string[] = []
    const observationYear = survey.observation_year
    const versionNumber = survey.version_number
    const surveyParcelIds = await this.repository.getSurveyParcelIds(db, survey.id)
    const parcelIds =
      surveyParcelIds.length > 0 ? surveyParcelIds : survey.parcel_id ? [survey.parcel_id] : []

    if (parcelIds.length === 0) {
      errors.push("parcel_ids is required for submit")
    }
    if (!observationYear) {
      errors.push("observation_year is required for submit")
    }
    if (!versionNumber) {
      errors.push("version_number is required for submit")
    }

    if (errors.length > 0 || parcelIds.length === 0 || !observationYear || !versionNumber) {
      return {
        code: "parcel_required",
        errors,
      }
    }

    const parcelExists = await db.query<{ parcel_id: string }>(
      `SELECT parcel_id
       FROM parcels
       WHERE parcel_id = ANY($1::text[])`,
      [parcelIds],
    )

    if (parcelExists.rows.length !== parcelIds.length) {
      return {
        code: "parcel_invalid",
        errors: ["one or more parcel_ids do not exist in parcel registry"],
      }
    }

    for (const parcelId of parcelIds) {
      const expectedVersionNumber = await this.getDefaultVersionNumber(db, parcelId, survey.id)
      if (versionNumber !== expectedVersionNumber) {
        return {
          errors: [],
          versionConflict: {
            expectedVersionNumber,
          },
        }
      }
    }

    return {
      errors: [],
    }
  }
}
