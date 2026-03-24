import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomUUID } from "crypto"
import { mkdir, rm, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { CadastreProviderService } from "./cadastre-provider.service"
import { IbpRulesService } from "./ibp-rules.service"
import { extensionFromMime, isAllowedMimeType } from "../common/file.utils"
import { normalizeDateInput, PublicMapDbRow, toPublicMapItem } from "./public-map.utils"
import { mapSyncError } from "./sync-error.utils"
import {
  AttachmentRow,
  CreateAttachmentBody,
  ParcelRow,
  SurveyEventRow,
  SurveyPatchBody,
  SurveyVisibilityPatchBody,
  SurveyRow,
  SurveyUpsertBody,
  SyncBatchBody,
  SyncChangeAttachment,
  SyncChangeEvent,
  SyncChangeSurvey,
  SyncOperationResult,
} from "./surveys.types"

@Injectable()
export class SurveysService {
  private readonly objectStorageMode: "local" | "minio"
  private readonly s3Bucket: string
  private readonly s3Client?: S3Client
  private s3BucketReady = false
  private readonly uploadsRootDir: string
  private readonly useIgnParcelWfs: boolean
  private readonly ignParcelWfsUrl: string
  private readonly ignParcelWfsTypeName: string
  private readonly ignParcelWfsCount: number
  private readonly ignParcelWfsTimeoutMs: number

  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService,
    private readonly cadastreProvider: CadastreProviderService,
  ) {
    this.objectStorageMode =
      (process.env.OBJECT_STORAGE_MODE ?? "local") === "minio" ? "minio" : "local"
    this.s3Bucket = process.env.OBJECT_STORAGE_BUCKET ?? "ibp-surveys"
    this.uploadsRootDir = process.env.ATTACHMENTS_UPLOAD_DIR ?? "/tmp/ibp-uploads"
    this.useIgnParcelWfs =
      (process.env.CADASTRE_PROVIDER ?? "synthetic").trim().toLowerCase() === "ign"
    this.ignParcelWfsUrl = process.env.CADASTRE_IGN_WFS_URL ?? "https://data.geopf.fr/wfs/ows"
    this.ignParcelWfsTypeName =
      process.env.CADASTRE_IGN_WFS_TYPENAME ?? "CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle"
    const countRaw = Number(process.env.CADASTRE_IGN_WFS_COUNT ?? 1200)
    this.ignParcelWfsCount =
      Number.isFinite(countRaw) && countRaw > 0 ? Math.min(3000, Math.trunc(countRaw)) : 1200
    const timeoutRaw = Number(process.env.CADASTRE_PROVIDER_TIMEOUT_MS ?? 2500)
    this.ignParcelWfsTimeoutMs =
      Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.trunc(timeoutRaw) : 2500

    if (this.objectStorageMode === "minio") {
      const endpoint = process.env.OBJECT_STORAGE_ENDPOINT ?? "http://localhost:9000"
      const region = process.env.OBJECT_STORAGE_REGION ?? "us-east-1"
      const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY ?? "minio"
      const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_KEY ?? "minio123"

      this.s3Client = new S3Client({
        endpoint,
        region,
        forcePathStyle: true,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    }
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

    const normalizedStatus = this.normalizeSurveyStatusFilter(input?.status)
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

  private normalizeSurveyStatusFilter(status?: string): SurveyRow["status"] | null {
    if (!status || typeof status !== "string") {
      return null
    }

    const normalized = status.trim().toLowerCase()
    if (
      normalized === "draft" ||
      normalized === "submitted" ||
      normalized === "synced" ||
      normalized === "error" ||
      normalized === "expired"
    ) {
      return normalized
    }

    return null
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
    const expiresAt =
      body.expires_at ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const computedScores = draftValidation.scores ?? {
      ibp_peuplement_gestion: 0,
      ibp_contexte: 0,
      ibp_total: 0,
    }

    const existing = await this.getSurveyForUser(body.id, user.id, false)
    const hasParcelIdsInput = Array.isArray(body.parcel_ids)
    const normalizedParcelIdsFromBody = this.normalizeParcelIds(body.parcel_ids)
    const normalizedLegacyParcelId = this.normalizeParcelId(body.parcel_id)
    const existingParcelIds = existing ? await this.getSurveyParcelIds(existing.id) : []

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

    selectedParcelIds = await this.ensureParcelIds(selectedParcelIds)
    const parcelId = selectedParcelIds[0] ?? null
    const observationYear =
      this.normalizeObservationYear(body.observation_year) ??
      existing?.observation_year ??
      (parcelId ? now.getUTCFullYear() : null)
    const versionNumberRaw =
      this.normalizeVersionNumber(body.version_number) ?? existing?.version_number ?? null
    const versionNumber =
      versionNumberRaw ?? (parcelId ? await this.getDefaultVersionNumber(parcelId, body.id) : null)
    const previousSurveyId =
      this.normalizePreviousSurveyId(body.previous_survey_id) ??
      existing?.previous_survey_id ??
      null

    if (!existing) {
      const createdAt = now.toISOString()
      const insertResult = await this.db.query<{ id: string; updated_at: string }>(
        `INSERT INTO surveys (
          id, user_id, site_name, status, visibility, parcel_id, observation_year, version_number, previous_survey_id, region_version, vegetation_stage,
          factors, factor_results, scores, location, created_at, updated_at, submitted_at, expires_at, sync_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20
        )
        RETURNING id, updated_at::text`,
        [
          body.id,
          user.id,
          body.site_name,
          body.status ?? "draft",
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
          body.sync_version,
        ],
      )
      await this.syncSurveyParcels(body.id, selectedParcelIds)

      await this.insertEvent(body.id, user.id, "created", {
        sync_version: body.sync_version,
        site_name: body.site_name,
        warnings: draftValidation.warnings,
      })

      return {
        id: insertResult.rows[0].id,
        server_status: "synced",
        updated_at: insertResult.rows[0].updated_at,
        warnings: draftValidation.warnings,
        factor_results: draftValidation.factor_results ?? undefined,
      }
    }

    if (body.sync_version < existing.sync_version) {
      throw new ConflictException({
        code: "sync_version_conflict",
        message: "Older sync_version received",
        details: {
          survey_id: body.id,
          server_sync_version: existing.sync_version,
          client_sync_version: body.sync_version,
        },
      })
    }

    if (body.sync_version === existing.sync_version) {
      return {
        id: existing.id,
        server_status: "synced",
        updated_at: existing.updated_at,
        warnings: draftValidation.warnings,
        factor_results: draftValidation.factor_results ?? undefined,
      }
    }

    const updateResult = await this.db.query<{ id: string; updated_at: string }>(
      `UPDATE surveys
       SET site_name = $3,
           status = $4,
           visibility = $5,
           parcel_id = $6,
           observation_year = $7,
           version_number = $8,
           previous_survey_id = $9,
           region_version = $10,
           vegetation_stage = $11,
           factors = $12::jsonb,
           factor_results = $13::jsonb,
           scores = $14::jsonb,
           location = $15::jsonb,
           expires_at = $16,
           sync_version = $17,
           updated_at = $18
       WHERE id = $1 AND user_id = $2
       RETURNING id, updated_at::text`,
      [
        body.id,
        user.id,
        body.site_name,
        body.status ?? existing.status,
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
        expiresAt,
        body.sync_version,
        now.toISOString(),
      ],
    )
    await this.syncSurveyParcels(body.id, selectedParcelIds)

    await this.insertEvent(body.id, user.id, "updated", {
      sync_version: body.sync_version,
      site_name: body.site_name,
      warnings: draftValidation.warnings,
    })

    return {
      id: updateResult.rows[0].id,
      server_status: "synced",
      updated_at: updateResult.rows[0].updated_at,
      warnings: draftValidation.warnings,
      factor_results: draftValidation.factor_results ?? undefined,
    }
  }

  async patchSurvey(
    user: AuthenticatedUser,
    surveyId: string,
    body: SurveyPatchBody,
  ): Promise<{ id: string; updated_at: string }> {
    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id)
    const forbiddenPostSubmitFields = this.getSubmittedReadOnlyFields(body)

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
    const normalizedParcelIdsFromPatch = this.normalizeParcelIds(body.parcel_ids)
    const normalizedLegacyParcelId = this.normalizeParcelId(body.parcel_id)
    const currentParcelIds = await this.getSurveyParcelIds(existing.id)

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
    targetParcelIds = await this.ensureParcelIds(targetParcelIds)
    const parcelIdForPatch = targetParcelIds[0] ?? null
    const observationYearForPatch =
      this.normalizeObservationYear(body.observation_year) ??
      (parcelIdForPatch && !existing.observation_year ? new Date().getUTCFullYear() : null)
    const versionNumberForPatch =
      this.normalizeVersionNumber(body.version_number) ??
      (parcelIdForPatch && !existing.version_number
        ? await this.getDefaultVersionNumber(parcelIdForPatch, surveyId)
        : null)
    const hasPreviousSurveyId = Object.prototype.hasOwnProperty.call(body, "previous_survey_id")
    const previousSurveyIdForPatch = hasPreviousSurveyId
      ? this.normalizePreviousSurveyId(body.previous_survey_id)
      : null

    const result = await this.db.query<{ id: string; updated_at: string }>(
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
        (body as SurveyPatchBody & { factor_results?: SurveyRow["factor_results"] }).factor_results
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

    await this.insertEvent(surveyId, user.id, "updated", {
      changed_fields: Object.keys(body),
    })

    if (shouldUpdateParcels) {
      await this.syncSurveyParcels(surveyId, targetParcelIds)
    }

    if (body.visibility && body.visibility !== existing.visibility) {
      await this.insertEvent(surveyId, user.id, "visibility_changed", {
        from: existing.visibility,
        to: body.visibility,
      })
    }

    return result.rows[0]
  }

  async patchSurveyVisibility(
    user: AuthenticatedUser,
    surveyId: string,
    body: SurveyVisibilityPatchBody,
  ): Promise<{ id: string; visibility: "private" | "public"; updated_at: string }> {
    if (body.visibility !== "private" && body.visibility !== "public") {
      throw new BadRequestException("visibility must be private or public")
    }

    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id)
    if (existing.visibility === body.visibility) {
      return {
        id: existing.id,
        visibility: existing.visibility,
        updated_at: existing.updated_at,
      }
    }

    const result = await this.db.query<{
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
      [surveyId, user.id, body.visibility],
    )

    if (!result.rows[0]) {
      throw new NotFoundException("Survey not found")
    }

    await this.insertEvent(surveyId, user.id, "visibility_changed", {
      from: existing.visibility,
      to: result.rows[0].visibility,
    })

    return result.rows[0]
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
    const survey = await this.getSurveyForUserOrThrow(surveyId, user.id)
    const parcelIds = await this.getSurveyParcelIds(survey.id)
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
    const existing = await this.getSurveyForUserOrThrow(surveyId, user.id)

    const validation = this.ibpRules.validateSubmit({
      region_version: existing.region_version,
      vegetation_stage: existing.vegetation_stage,
      expires_at: existing.expires_at,
      factors: existing.factors,
    })
    const parcelValidation = await this.validateParcelSubmit(existing)

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
        await this.db.query(
          `UPDATE surveys
           SET status = 'expired',
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [surveyId, user.id],
        )
        await this.insertEvent(surveyId, user.id, "expired", {
          reason: "submit_after_deadline",
          expires_at: existing.expires_at,
        })
      }

      throw new UnprocessableEntityException({
        code: parcelValidation.code,
        message: "Survey cannot be submitted",
        errors: [...validation.errors, ...parcelValidation.errors],
        warnings: validation.warnings,
      })
    }

    const result = await this.db.query<{ id: string; status: "submitted"; submitted_at: string }>(
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

    await this.insertEvent(surveyId, user.id, "submitted", {
      scores: validation.scores,
      warnings: validation.warnings,
    })

    return {
      ...result.rows[0],
      scores: validation.scores,
      warnings: validation.warnings,
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
    const existing = await this.getSurveyForUser(surveyId, user.id, false)
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

    const attachmentsResult = await this.db.query<Pick<AttachmentRow, "id" | "storage_key">>(
      `SELECT id, storage_key
       FROM attachments
       WHERE survey_id = $1
         AND deleted_at IS NULL`,
      [surveyId],
    )

    await this.db.query(
      `UPDATE attachments
       SET deleted_at = NOW()
       WHERE survey_id = $1
         AND deleted_at IS NULL`,
      [surveyId],
    )

    for (const attachment of attachmentsResult.rows) {
      await this.cleanupAttachmentStorage(attachment.storage_key)
    }

    const deletedSurvey = await this.db.query<{ id: string; deleted_at: string }>(
      `UPDATE surveys
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND deleted_at IS NULL
       RETURNING id, deleted_at::text`,
      [surveyId, user.id],
    )

    const deletedAt = deletedSurvey.rows[0]?.deleted_at ?? existing.deleted_at ?? null

    await this.insertEvent(surveyId, user.id, "deleted", {
      attachment_count_deleted: attachmentsResult.rows.length,
    })

    return {
      id: surveyId,
      deleted_at: deletedAt,
      already_deleted: false,
      missing: false,
    }
  }

  async createAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    body: CreateAttachmentBody,
  ): Promise<{
    attachment_id: string
    storage_key: string
    upload_url: string
    confirm_url: string
  }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id)

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM attachments WHERE survey_id = $1 AND deleted_at IS NULL`,
      [surveyId],
    )
    const currentCount = parseInt(countResult.rows[0]?.count ?? "0", 10)
    if (currentCount >= 10) {
      throw new BadRequestException("Survey already has the maximum of 10 attachments")
    }

    if (!body?.mime_type || typeof body.mime_type !== "string") {
      throw new BadRequestException("mime_type is required")
    }

    if (!Number.isInteger(body.size_bytes) || (body.size_bytes ?? 0) <= 0) {
      throw new BadRequestException("size_bytes must be a positive integer")
    }

    if ((body.size_bytes ?? 0) > 25 * 1024 * 1024) {
      throw new BadRequestException("size_bytes exceeds V1 max size (25MB)")
    }

    if (!isAllowedMimeType(body.mime_type)) {
      throw new BadRequestException(`Unsupported file type: ${body.mime_type}`)
    }

    const attachmentId = randomUUID()
    const uploadToken = randomUUID()
    const extension = extensionFromMime(body.mime_type)
    const storageKey = `surveys/${surveyId}/${attachmentId}${extension}`
    const confirmUrl = this.buildConfirmUrl(surveyId, attachmentId, uploadToken)
    const uploadUrl = await this.buildUploadUrl(storageKey, body.mime_type, confirmUrl)

    await this.db.query(
      `INSERT INTO attachments (id, survey_id, storage_key, mime_type, size_bytes, captured_at, metadata, upload_token, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
      [
        attachmentId,
        surveyId,
        storageKey,
        body.mime_type,
        body.size_bytes,
        body.captured_at ?? null,
        JSON.stringify(body.metadata ?? {}),
        uploadToken,
      ],
    )

    await this.insertEvent(surveyId, user.id, "attachment_created", {
      attachment_id: attachmentId,
      storage_key: storageKey,
      mime_type: body.mime_type,
      size_bytes: body.size_bytes,
    })

    return {
      attachment_id: attachmentId,
      storage_key: storageKey,
      upload_url: uploadUrl,
      confirm_url: confirmUrl,
    }
  }

  async uploadAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
    token?: string,
    file?: { buffer: Buffer; mimetype?: string; size?: number; originalname?: string },
  ): Promise<{ attachment_id: string; uploaded_at: string }> {
    if (!token) {
      throw new BadRequestException("upload token is required")
    }

    await this.getSurveyForUserOrThrow(surveyId, user.id)

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId],
    )

    if (!existing.rows[0]) {
      throw new NotFoundException("Attachment not found")
    }

    if (existing.rows[0].upload_token !== token) {
      throw new BadRequestException("invalid upload token")
    }

    if (existing.rows[0].uploaded_at) {
      return {
        attachment_id: existing.rows[0].id,
        uploaded_at: existing.rows[0].uploaded_at,
      }
    }

    if (this.objectStorageMode === "minio") {
      if (!this.s3Client) {
        throw new BadRequestException("object storage client is not configured")
      }
      // In MinIO mode, file upload is done directly via presigned URL.
      // Here we only confirm object existence before marking uploaded.
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.s3Bucket,
            Key: existing.rows[0].storage_key,
          }),
        )
      } catch {
        throw new BadRequestException("uploaded object not found in storage")
      }
    } else {
      if (!file?.buffer || file.buffer.length === 0) {
        throw new BadRequestException("file is required")
      }

      if (file.buffer.length > 25 * 1024 * 1024) {
        throw new BadRequestException("file exceeds V1 max size (25MB)")
      }

      const storagePath = join(this.uploadsRootDir, existing.rows[0].storage_key)
      await mkdir(dirname(storagePath), { recursive: true })
      await writeFile(storagePath, file.buffer)
    }

    const updated = await this.db.query<{ id: string; uploaded_at: string }>(
      `UPDATE attachments
       SET uploaded_at = NOW()
       WHERE id = $1 AND survey_id = $2
       RETURNING id, uploaded_at::text`,
      [attachmentId, surveyId],
    )

    await this.insertEvent(surveyId, user.id, "attachment_uploaded", {
      attachment_id: attachmentId,
      storage_key: existing.rows[0].storage_key,
      object_storage_mode: this.objectStorageMode,
      bytes_written: file?.buffer?.length ?? null,
    })

    return {
      attachment_id: updated.rows[0].id,
      uploaded_at: updated.rows[0].uploaded_at,
    }
  }

  async deleteAttachment(
    user: AuthenticatedUser,
    surveyId: string,
    attachmentId: string,
    options?: { allowMissing?: boolean },
  ): Promise<{ survey_id: string; attachment_id: string; missing: boolean; deleted: boolean }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id)

    const existing = await this.db.query<AttachmentRow>(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, captured_at::text, metadata, upload_token, uploaded_at::text, deleted_at::text
       FROM attachments
       WHERE id = $1 AND survey_id = $2 AND deleted_at IS NULL`,
      [attachmentId, surveyId],
    )

    if (!existing.rows[0]) {
      if (options?.allowMissing) {
        return {
          survey_id: surveyId,
          attachment_id: attachmentId,
          missing: true,
          deleted: false,
        }
      }
      throw new NotFoundException("Attachment not found")
    }

    await this.db.query(
      `UPDATE attachments
       SET deleted_at = NOW()
       WHERE id = $1 AND survey_id = $2`,
      [attachmentId, surveyId],
    )

    await this.cleanupAttachmentStorage(existing.rows[0].storage_key)

    await this.insertEvent(surveyId, user.id, "attachment_deleted", {
      attachment_id: attachmentId,
      storage_key: existing.rows[0].storage_key,
    })

    return {
      survey_id: surveyId,
      attachment_id: attachmentId,
      missing: false,
      deleted: true,
    }
  }

  async listAttachments(
    user: AuthenticatedUser,
    surveyId: string,
  ): Promise<{
    items: Array<
      Pick<
        AttachmentRow,
        | "id"
        | "survey_id"
        | "storage_key"
        | "mime_type"
        | "size_bytes"
        | "created_at"
        | "uploaded_at"
      >
    >
  }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id)

    const result = await this.db.query<
      Pick<
        AttachmentRow,
        | "id"
        | "survey_id"
        | "storage_key"
        | "mime_type"
        | "size_bytes"
        | "created_at"
        | "uploaded_at"
      >
    >(
      `SELECT id, survey_id, storage_key, mime_type, size_bytes, created_at::text, uploaded_at::text
       FROM attachments
       WHERE survey_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [surveyId],
    )

    return { items: result.rows }
  }

  async getEvents(user: AuthenticatedUser, surveyId: string): Promise<{ items: SurveyEventRow[] }> {
    await this.getSurveyForUserOrThrow(surveyId, user.id)

    const events = await this.db.query<SurveyEventRow>(
      `SELECT id, survey_id, actor_id, event_type, payload, created_at::text
       FROM survey_events
       WHERE survey_id = $1
       ORDER BY created_at DESC`,
      [surveyId],
    )

    return { items: events.rows }
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

    let deptCondition = ""
    if (input?.region && input.region.trim().length > 0) {
      values.push(`${input.region.trim().toUpperCase()}%`)
      deptCondition = `AND EXISTS (
        SELECT 1 FROM survey_parcels sp2
        JOIN parcels p2 ON p2.parcel_id = sp2.parcel_id
        WHERE sp2.survey_id = s.id
          AND p2.commune_code LIKE $${values.length}
      )`
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
       ${deptCondition}
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
    const zoom = this.toFiniteNumber(input?.zoom)
    if (zoom !== null && zoom < 15) {
      return { items: [] }
    }

    const bbox = this.parseBbox(input?.bbox)
    const year = this.normalizeObservationYear(input?.year)
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
        const centroid = this.normalizeCentroid(row.centroid)
        const geometry =
          row.geometry && Object.keys(row.geometry).length > 0
            ? row.geometry
            : centroid
              ? this.buildFallbackParcelGeometry(centroid)
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
        const key = this.buildParcelKey(row.commune_code, row.section, row.number)
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

        const communeCode = this.normalizeParcelPartToDigits(properties.code_insee, 5)
        const section = this.normalizeParcelSection(properties.section)
        const number = this.normalizeParcelPartToDigits(properties.numero, 4)
        if (!communeCode || !section || !number) {
          continue
        }

        const parcelKey = this.buildParcelKey(communeCode, section, number)
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
    const lat = this.toFiniteNumber(input?.lat)
    const lng = this.toFiniteNumber(input?.lng)
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

    const centroid = this.normalizeCentroid(parcel.centroid)
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
    const parcelId = this.normalizeParcelId(parcelIdRaw)
    if (!parcelId) {
      throw new BadRequestException("parcel_id is required")
    }

    const limit = this.normalizeParcelHistoryLimit(limitRaw)
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

  async syncBatch(
    user: AuthenticatedUser,
    body: SyncBatchBody,
  ): Promise<{ results: SyncOperationResult[] }> {
    const operations = body.operations
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new BadRequestException("operations must be a non-empty array")
    }
    if (operations.length > 100) {
      throw new BadRequestException("operations exceeds V1 batch limit (100)")
    }

    const results: SyncOperationResult[] = []

    for (const operation of operations) {
      const clientRef =
        typeof operation.client_ref === "string" && operation.client_ref.trim()
          ? operation.client_ref
          : null
      const entity = typeof operation.entity === "string" ? operation.entity : "unknown"
      const action = typeof operation.action === "string" ? operation.action : "unknown"

      try {
        if (operation.entity === "survey" && operation.action === "upsert") {
          if (!operation.payload || typeof operation.payload !== "object") {
            throw new BadRequestException("survey upsert payload is required")
          }
          const data = await this.upsertForUser(user, operation.payload as SurveyUpsertBody)
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: "synced",
            data: data as Record<string, unknown>,
          })
          continue
        }

        if (operation.entity === "survey" && operation.action === "delete") {
          const payloadSurveyId =
            operation.payload && typeof operation.payload === "object"
              ? (operation.payload as { id?: unknown }).id
              : undefined
          const surveyId =
            operation.survey_id ??
            (typeof payloadSurveyId === "string" ? payloadSurveyId : undefined)
          if (!surveyId || typeof surveyId !== "string") {
            throw new BadRequestException("survey_id is required for survey delete")
          }

          const data = await this.deleteSurvey(user, surveyId, { allowMissing: true })
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: "synced",
            data: data as Record<string, unknown>,
          })
          continue
        }

        if (operation.entity === "survey" && operation.action === "visibility_update") {
          const payloadVisibility =
            operation.payload && typeof operation.payload === "object"
              ? (operation.payload as { visibility?: unknown }).visibility
              : undefined

          if (!operation.survey_id || typeof operation.survey_id !== "string") {
            throw new BadRequestException("survey_id is required for survey visibility_update")
          }
          if (payloadVisibility !== "private" && payloadVisibility !== "public") {
            throw new BadRequestException(
              "visibility must be private or public for survey visibility_update",
            )
          }

          const data = await this.patchSurveyVisibility(user, operation.survey_id, {
            visibility: payloadVisibility,
          })
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: "synced",
            data: data as Record<string, unknown>,
          })
          continue
        }

        if (operation.entity === "attachment" && operation.action === "create") {
          if (!operation.survey_id) {
            throw new BadRequestException("survey_id is required for attachment create")
          }
          if (!operation.payload || typeof operation.payload !== "object") {
            throw new BadRequestException("attachment create payload is required")
          }
          const data = await this.createAttachment(
            user,
            operation.survey_id,
            operation.payload as CreateAttachmentBody,
          )
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: "synced",
            data: data as Record<string, unknown>,
          })
          continue
        }

        if (operation.entity === "attachment" && operation.action === "delete") {
          const payloadAttachmentId =
            operation.payload && typeof operation.payload === "object"
              ? (operation.payload as { attachment_id?: unknown }).attachment_id
              : undefined

          if (!operation.survey_id || typeof operation.survey_id !== "string") {
            throw new BadRequestException("survey_id is required for attachment delete")
          }
          if (!payloadAttachmentId || typeof payloadAttachmentId !== "string") {
            throw new BadRequestException("attachment_id is required for attachment delete")
          }

          const data = await this.deleteAttachment(user, operation.survey_id, payloadAttachmentId, {
            allowMissing: true,
          })
          results.push({
            client_ref: clientRef,
            entity: operation.entity,
            action: operation.action,
            status: "synced",
            data: data as Record<string, unknown>,
          })
          continue
        }

        throw new BadRequestException(`Unsupported sync operation: ${entity}.${action}`)
      } catch (error) {
        const mapped = mapSyncError(error)
        results.push({
          client_ref: clientRef,
          entity,
          action,
          status: mapped.status,
          error: mapped.error,
        })
      }
    }

    return { results }
  }

  async getSyncChanges(
    user: AuthenticatedUser,
    cursor?: string,
    limitRaw?: number,
  ): Promise<{
    cursor_in: string | null
    cursor_out: string | null
    has_more: boolean
    events: SyncChangeEvent[]
    surveys: SyncChangeSurvey[]
    attachments: SyncChangeAttachment[]
  }> {
    const limit = this.normalizeChangesLimit(limitRaw)
    const parsedCursor = this.parseChangesCursor(cursor)

    const rawEvents = await this.db.query<SyncChangeEvent>(
      `SELECT e.id, e.survey_id, e.actor_id, e.event_type, e.payload, e.created_at::text
       FROM survey_events e
       JOIN surveys s ON s.id = e.survey_id
       WHERE s.user_id = $1
         AND (
           e.created_at > $2::timestamptz
           OR (e.created_at = $2::timestamptz AND e.id > $3)
         )
       ORDER BY e.created_at ASC, e.id ASC
      LIMIT $4`,
      [user.id, parsedCursor.timestamp, parsedCursor.eventId, limit + 1],
    )

    const hasMoreEvents = rawEvents.rows.length > limit
    const events = hasMoreEvents ? rawEvents.rows.slice(0, limit) : rawEvents.rows

    if (events.length > 0) {
      const surveyIds = Array.from(new Set(events.map((event) => event.survey_id)))
      const attachmentIds = Array.from(
        new Set(
          events
            .map((event) => this.extractAttachmentId(event.payload))
            .filter((value): value is string => Boolean(value)),
        ),
      )

      const surveys = surveyIds.length ? await this.loadSyncChangeSurveys(user.id, surveyIds) : []
      const attachments = attachmentIds.length
        ? await this.loadSyncChangeAttachmentsByIds(user.id, attachmentIds)
        : []

      const lastEvent = events[events.length - 1]
      const cursorOut = this.buildChangesCursor(lastEvent.created_at, lastEvent.id)

      return {
        cursor_in: parsedCursor.original,
        cursor_out: cursorOut,
        has_more: hasMoreEvents,
        events,
        surveys,
        attachments,
      }
    }

    // Fallback path: include surveys changed without explicit survey_events (e.g. direct DB inserts for debug/demo).
    const rawSurveys = await this.db.query<SyncChangeSurvey>(
      `SELECT
         s.id,
         s.site_name,
         s.status,
         s.visibility,
         s.parcel_id,
         COALESCE(
           (
             SELECT array_agg(sp.parcel_id ORDER BY sp.parcel_id)
             FROM survey_parcels sp
             WHERE sp.survey_id = s.id
           ),
           ARRAY[]::text[]
         ) AS parcel_ids,
         s.observation_year,
         s.version_number,
         s.previous_survey_id,
         s.region_version,
         s.vegetation_stage,
         s.factors,
         s.factor_results,
         s.scores,
         s.created_at::text,
         s.updated_at::text,
         s.submitted_at::text,
         s.expires_at::text,
         s.sync_version,
         s.deleted_at::text
       FROM surveys s
       WHERE s.user_id = $1
         AND (
           s.updated_at > $2::timestamptz
           OR (s.updated_at = $2::timestamptz AND s.id > $3)
         )
       ORDER BY s.updated_at ASC, s.id ASC
       LIMIT $4`,
      [user.id, parsedCursor.timestamp, parsedCursor.eventId, limit + 1],
    )

    const hasMoreSurveys = rawSurveys.rows.length > limit
    const surveysByCursor = hasMoreSurveys ? rawSurveys.rows.slice(0, limit) : rawSurveys.rows
    const surveys: SyncChangeSurvey[] = [...surveysByCursor]

    if (surveys.length < limit) {
      const surveysWithoutEvents = await this.loadSyncChangeSurveysWithoutEvents(user.id, limit)
      const knownSurveyIds = new Set(surveys.map((survey) => survey.id))
      for (const survey of surveysWithoutEvents) {
        if (knownSurveyIds.has(survey.id)) {
          continue
        }
        surveys.push(survey)
        knownSurveyIds.add(survey.id)
        if (surveys.length >= limit) {
          break
        }
      }
    }

    if (surveys.length === 0) {
      return {
        cursor_in: parsedCursor.original,
        cursor_out: parsedCursor.original,
        has_more: false,
        events: [],
        surveys: [],
        attachments: [],
      }
    }

    const surveyIds = surveys.map((survey) => survey.id)
    const attachments = await this.loadSyncChangeAttachmentsBySurveyIds(user.id, surveyIds)
    const cursorOut =
      surveysByCursor.length > 0
        ? this.buildChangesCursor(
            surveysByCursor[surveysByCursor.length - 1].updated_at,
            surveysByCursor[surveysByCursor.length - 1].id,
          )
        : parsedCursor.original

    return {
      cursor_in: parsedCursor.original,
      cursor_out: cursorOut,
      has_more: surveysByCursor.length > 0 ? hasMoreSurveys : false,
      events: [],
      surveys,
      attachments,
    }
  }

  private async loadSyncChangeSurveys(
    userId: string,
    surveyIds: string[],
  ): Promise<SyncChangeSurvey[]> {
    const result = await this.db.query<SyncChangeSurvey>(
      `SELECT
         s.id,
         s.site_name,
         s.status,
         s.visibility,
         s.parcel_id,
         COALESCE(
           (
             SELECT array_agg(sp.parcel_id ORDER BY sp.parcel_id)
             FROM survey_parcels sp
             WHERE sp.survey_id = s.id
           ),
           ARRAY[]::text[]
         ) AS parcel_ids,
         s.observation_year,
         s.version_number,
         s.previous_survey_id,
         s.region_version,
         s.vegetation_stage,
         s.factors,
         s.factor_results,
         s.scores,
         s.created_at::text,
         s.updated_at::text,
         s.submitted_at::text,
         s.expires_at::text,
         s.sync_version,
         s.deleted_at::text
       FROM surveys s
       WHERE s.user_id = $1
         AND s.id = ANY($2::text[])
       ORDER BY s.updated_at ASC, s.id ASC`,
      [userId, surveyIds],
    )

    return result.rows
  }

  private async loadSyncChangeAttachmentsByIds(
    userId: string,
    attachmentIds: string[],
  ): Promise<SyncChangeAttachment[]> {
    const result = await this.db.query<SyncChangeAttachment>(
      `SELECT
         a.id,
         a.survey_id,
         a.storage_key,
         a.mime_type,
         a.size_bytes,
         a.captured_at::text,
         a.metadata,
         a.created_at::text,
         a.uploaded_at::text,
         a.deleted_at::text
       FROM attachments a
       JOIN surveys s ON s.id = a.survey_id
       WHERE s.user_id = $1
         AND a.id = ANY($2::text[])
       ORDER BY a.created_at ASC, a.id ASC`,
      [userId, attachmentIds],
    )

    return result.rows
  }

  private async loadSyncChangeAttachmentsBySurveyIds(
    userId: string,
    surveyIds: string[],
  ): Promise<SyncChangeAttachment[]> {
    const result = await this.db.query<SyncChangeAttachment>(
      `SELECT
         a.id,
         a.survey_id,
         a.storage_key,
         a.mime_type,
         a.size_bytes,
         a.captured_at::text,
         a.metadata,
         a.created_at::text,
         a.uploaded_at::text,
         a.deleted_at::text
       FROM attachments a
       JOIN surveys s ON s.id = a.survey_id
       WHERE s.user_id = $1
         AND a.survey_id = ANY($2::text[])
       ORDER BY a.created_at ASC, a.id ASC`,
      [userId, surveyIds],
    )

    return result.rows
  }

  private async loadSyncChangeSurveysWithoutEvents(
    userId: string,
    limit: number,
  ): Promise<SyncChangeSurvey[]> {
    const result = await this.db.query<SyncChangeSurvey>(
      `SELECT
         s.id,
         s.site_name,
         s.status,
         s.visibility,
         s.parcel_id,
         COALESCE(
           (
             SELECT array_agg(sp.parcel_id ORDER BY sp.parcel_id)
             FROM survey_parcels sp
             WHERE sp.survey_id = s.id
           ),
           ARRAY[]::text[]
         ) AS parcel_ids,
         s.observation_year,
         s.version_number,
         s.previous_survey_id,
         s.region_version,
         s.vegetation_stage,
         s.factors,
         s.factor_results,
         s.scores,
         s.created_at::text,
         s.updated_at::text,
         s.submitted_at::text,
         s.expires_at::text,
         s.sync_version,
         s.deleted_at::text
       FROM surveys s
       WHERE s.user_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM survey_events e
           WHERE e.survey_id = s.id
         )
       ORDER BY s.updated_at ASC, s.id ASC
       LIMIT $2`,
      [userId, limit],
    )

    return result.rows
  }

  private async getSurveyForUserOrThrow(surveyId: string, userId: string): Promise<SurveyRow> {
    const survey = await this.getSurveyForUser(surveyId, userId, true)
    if (!survey) {
      throw new NotFoundException("Survey not found")
    }
    return survey
  }

  private async getSurveyForUser(
    surveyId: string,
    userId: string,
    activeOnly: boolean,
  ): Promise<SurveyRow | null> {
    const where = activeOnly ? "AND deleted_at IS NULL" : ""
    const result = await this.db.query<SurveyRow>(
      `SELECT *
       FROM surveys
       WHERE id = $1 AND user_id = $2 ${where}`,
      [surveyId, userId],
    )
    return result.rows[0] ?? null
  }

  private getSubmittedReadOnlyFields(body: SurveyPatchBody): string[] {
    const readonlyFields: Array<keyof SurveyPatchBody> = [
      "site_name",
      "parcel_id",
      "parcel_ids",
      "observation_year",
      "version_number",
      "previous_survey_id",
      "region_version",
      "vegetation_stage",
      "factors",
      "scores",
    ]

    return readonlyFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
  }

  private async insertEvent(
    surveyId: string,
    actorId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [randomUUID(), surveyId, actorId, eventType, JSON.stringify(payload)],
    )
  }

  private buildConfirmUrl(surveyId: string, attachmentId: string, uploadToken: string): string {
    const token = encodeURIComponent(uploadToken)
    return `/surveys/${surveyId}/attachments/${attachmentId}/upload?token=${token}`
  }

  private async buildUploadUrl(
    storageKey: string,
    mimeType: string,
    fallbackUrl: string,
  ): Promise<string> {
    if (this.objectStorageMode !== "minio" || !this.s3Client) {
      return fallbackUrl
    }

    await this.ensureS3Bucket()

    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: storageKey,
      ContentType: mimeType,
    })

    return getSignedUrl(this.s3Client, command, { expiresIn: 15 * 60 })
  }

  private async cleanupAttachmentStorage(storageKey: string): Promise<void> {
    if (this.objectStorageMode === "minio") {
      if (this.s3Client) {
        await this.s3Client
          .send(
            new DeleteObjectCommand({
              Bucket: this.s3Bucket,
              Key: storageKey,
            }),
          )
          .catch(() => undefined)
      }
      return
    }

    const storagePath = join(this.uploadsRootDir, storageKey)
    await rm(storagePath, { force: true }).catch(() => undefined)
  }

  private async ensureS3Bucket(): Promise<void> {
    if (this.s3BucketReady || !this.s3Client) return

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }))
      this.s3BucketReady = true
      return
    } catch {
      // Bucket might not exist yet.
    }

    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.s3Bucket }))
      this.s3BucketReady = true
    } catch {
      // If created concurrently by another request/process, verify it exists now.
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }))
      this.s3BucketReady = true
    }
  }

  private normalizeParcelId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null
    }
    const normalized = value.trim().toUpperCase()
    return normalized.length > 0 ? normalized : null
  }

  private normalizeParcelIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    const seen = new Set<string>()
    const normalized: string[] = []
    for (const candidate of value) {
      const parcelId = this.normalizeParcelId(candidate)
      if (!parcelId || seen.has(parcelId)) {
        continue
      }
      seen.add(parcelId)
      normalized.push(parcelId)
    }
    return normalized
  }

  private async getSurveyParcelIds(surveyId: string): Promise<string[]> {
    try {
      const result = await this.db.query<{ parcel_id: string }>(
        `SELECT parcel_id
         FROM survey_parcels
         WHERE survey_id = $1
         ORDER BY parcel_id ASC`,
        [surveyId],
      )
      return result.rows.map((row) => row.parcel_id)
    } catch (error) {
      const message = (error as Error).message ?? ""
      if (message.toLowerCase().includes("survey_parcels")) {
        return []
      }
      throw error
    }
  }

  private async syncSurveyParcels(surveyId: string, parcelIds: string[]): Promise<void> {
    const normalized = this.normalizeParcelIds(parcelIds)
    try {
      await this.db.query(`DELETE FROM survey_parcels WHERE survey_id = $1`, [surveyId])
      if (normalized.length === 0) {
        return
      }
      await this.db.query(
        `INSERT INTO survey_parcels (survey_id, parcel_id)
         SELECT $1, unnest($2::text[])
         ON CONFLICT (survey_id, parcel_id) DO NOTHING`,
        [surveyId, normalized],
      )
    } catch (error) {
      const message = (error as Error).message ?? ""
      if (message.toLowerCase().includes("survey_parcels")) {
        return
      }
      throw error
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
    const centroidMany = this.normalizeCentroid({
      lat: fromMany.rows[0]?.lat,
      lng: fromMany.rows[0]?.lng,
    })
    if (centroidMany) {
      return centroidMany
    }

    const parcelId = this.normalizeParcelId(fallbackParcelId)
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
    return this.normalizeCentroid(fallback.rows[0].centroid)
  }

  private async ensureParcelIds(parcelIds: string[]): Promise<string[]> {
    if (parcelIds.length === 0) {
      return []
    }

    const output: string[] = []
    const seen = new Set<string>()
    for (const raw of parcelIds) {
      const normalized = this.normalizeParcelId(raw)
      if (!normalized || seen.has(normalized)) {
        continue
      }
      const ensured = await this.ensureParcelById(normalized)
      if (!seen.has(ensured.parcel_id)) {
        seen.add(ensured.parcel_id)
        output.push(ensured.parcel_id)
      }
    }
    return output
  }

  private normalizeObservationYear(value: unknown): number | null {
    const parsed = this.toFiniteNumber(value)
    if (parsed === null) {
      return null
    }
    const integer = Math.trunc(parsed)
    if (integer < 1900 || integer > 2200) {
      return null
    }
    return integer
  }

  private normalizeVersionNumber(value: unknown): number | null {
    const parsed = this.toFiniteNumber(value)
    if (parsed === null) {
      return null
    }
    const integer = Math.trunc(parsed)
    return integer >= 1 ? integer : null
  }

  private normalizePreviousSurveyId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null
    }
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  private normalizeCentroid(value: Record<string, unknown>): { lat: number; lng: number } | null {
    const lat = this.toFiniteNumber(value.lat)
    const lng = this.toFiniteNumber(value.lng)
    if (lat === null || lng === null) {
      return null
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null
    }
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    }
  }

  private parseParcelIdentifier(parcelId: string): {
    communeCode: string
    section: string
    number: string
  } {
    const normalized = parcelId.trim().toUpperCase()
    const match = /^(\d{5})([A-Z]{1,3})(\d{1,4})$/.exec(normalized)
    if (match) {
      return {
        communeCode: match[1],
        section: match[2].padEnd(2, "A").slice(0, 3),
        number: match[3].padStart(4, "0").slice(-4),
      }
    }
    return {
      communeCode: "00000",
      section: "AA",
      number: "0000",
    }
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

  private async ensureParcelById(parcelId: string): Promise<ParcelRow> {
    const existing = await this.db.query<ParcelRow>(
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

    const parsed = this.parseParcelIdentifier(parcelId)
    const inserted = await this.db.query<ParcelRow>(
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
    parcelId: string,
    surveyIdToExclude?: string,
  ): Promise<number> {
    const result = await this.db.query<{ next_version: number }>(
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

  private async validateParcelSubmit(survey: SurveyRow): Promise<{
    code?: "parcel_required" | "parcel_invalid"
    errors: string[]
    versionConflict?: { expectedVersionNumber: number }
  }> {
    const errors: string[] = []
    const observationYear = survey.observation_year
    const versionNumber = survey.version_number
    const surveyParcelIds = await this.getSurveyParcelIds(survey.id)
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

    const parcelExists = await this.db.query<{ parcel_id: string }>(
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
      const expectedVersionNumber = await this.getDefaultVersionNumber(parcelId, survey.id)
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

  private normalizeParcelHistoryLimit(limitRaw?: string): number {
    const parsed = this.toFiniteNumber(limitRaw)
    if (parsed === null) {
      return 20
    }
    const integer = Math.trunc(parsed)
    if (integer <= 0) {
      return 20
    }
    return Math.min(100, integer)
  }

  private parseBbox(
    raw?: string,
  ): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
    if (!raw || raw.trim().length === 0) {
      return null
    }

    const parts = raw.split(",").map((part) => part.trim())
    if (parts.length !== 4) {
      throw new BadRequestException("bbox must contain exactly 4 comma-separated numbers")
    }

    const minLng = this.toFiniteNumber(parts[0])
    const minLat = this.toFiniteNumber(parts[1])
    const maxLng = this.toFiniteNumber(parts[2])
    const maxLat = this.toFiniteNumber(parts[3])
    if (minLng === null || minLat === null || maxLng === null || maxLat === null) {
      throw new BadRequestException("bbox contains invalid coordinate values")
    }
    if (minLng >= maxLng || minLat >= maxLat) {
      throw new BadRequestException("bbox bounds are invalid")
    }

    return { minLng, minLat, maxLng, maxLat }
  }

  private buildFallbackParcelGeometry(centroid: {
    lat: number
    lng: number
  }): Record<string, unknown> {
    // Approximate 20m square used when true cadastre geometry is unavailable.
    const halfLat = 0.00009
    const halfLng = 0.00013
    const minLat = Math.max(-90, centroid.lat - halfLat)
    const maxLat = Math.min(90, centroid.lat + halfLat)
    const minLng = Math.max(-180, centroid.lng - halfLng)
    const maxLng = Math.min(180, centroid.lng + halfLng)

    return {
      type: "Polygon",
      coordinates: [
        [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ],
      ],
    }
  }

  private normalizeParcelPartToDigits(value: unknown, width: number): string | null {
    if (typeof value !== "string" && typeof value !== "number") {
      return null
    }
    const digits = String(value)
      .trim()
      .replace(/[^0-9]/g, "")
    if (digits.length === 0) {
      return null
    }
    return digits.padStart(width, "0").slice(-width)
  }

  private normalizeParcelSection(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") {
      return null
    }
    const normalized = String(value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
    if (normalized.length === 0) {
      return null
    }
    return normalized.slice(0, 3)
  }

  private buildParcelKey(communeCode: string, section: string, number: string): string {
    return `${communeCode}|${section.toUpperCase()}|${number}`
  }

  private normalizeChangesLimit(limitRaw?: number): number {
    if (!Number.isFinite(limitRaw)) return 50
    const integer = Math.trunc(limitRaw ?? 0)
    if (integer <= 0) return 50
    return Math.min(200, integer)
  }

  private parseChangesCursor(cursor?: string): {
    timestamp: string
    eventId: string
    original: string | null
  } {
    if (!cursor || cursor.trim().length === 0) {
      return {
        timestamp: "1970-01-01T00:00:00.000Z",
        eventId: "",
        original: null,
      }
    }

    const [timestampRaw, eventIdRaw] = cursor.split("|")
    if (!timestampRaw || Number.isNaN(Date.parse(timestampRaw))) {
      throw new BadRequestException("Invalid sync cursor")
    }

    return {
      timestamp: timestampRaw,
      eventId: eventIdRaw ?? "",
      original: cursor,
    }
  }

  private buildChangesCursor(timestamp: string, eventId: string): string {
    return `${timestamp}|${eventId}`
  }

  private extractAttachmentId(payload: Record<string, unknown> | null): string | null {
    if (!payload || typeof payload !== "object") {
      return null
    }
    const value = (payload as { attachment_id?: unknown }).attachment_id
    if (typeof value !== "string" || value.trim().length === 0) {
      return null
    }
    return value
  }
}
