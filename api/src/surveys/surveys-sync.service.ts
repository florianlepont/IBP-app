import { BadRequestException, HttpException, Injectable, Logger } from "@nestjs/common"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { IbpRulesService } from "./ibp-rules.service"
import { mapSyncError } from "./sync-error.utils"
import {
  SyncChangeAttachment,
  SyncChangeEvent,
  SyncChangeSurvey,
  SyncOperationResult,
} from "./surveys.types"
import {
  buildChangesCursor,
  extractAttachmentId,
  normalizeChangesLimit,
  parseChangesCursor,
} from "./surveys-normalize.utils"
import { SurveysService } from "./surveys.service"
import { SurveysAttachmentsService } from "./surveys-attachments.service"
import { SyncBatchDto, SyncOperationEnvelopeDto } from "./dtos/sync-batch.dto"
import {
  AttachmentDeletePayloadDto,
  SurveyDeletePayloadDto,
  SurveyVisibilityPayloadDto,
} from "./dtos/sync-payloads.dto"
import { CreateAttachmentDto } from "./dtos/create-attachment.dto"
import { SurveyUpsertDto } from "./dtos/survey-upsert.dto"
import { validateSyncDto } from "./sync-operation-validation"

@Injectable()
export class SurveysSyncService {
  private readonly logger = new Logger(SurveysSyncService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService,
    private readonly surveysService: SurveysService,
    private readonly attachmentsService: SurveysAttachmentsService,
  ) {}

  async syncBatch(
    user: AuthenticatedUser,
    body: SyncBatchDto,
  ): Promise<{ results: SyncOperationResult[] }> {
    const operations = body.operations

    const results: SyncOperationResult[] = []

    for (const operation of operations) {
      const rawClientRef =
        operation && typeof operation === "object"
          ? (operation as { client_ref?: unknown }).client_ref
          : undefined
      const clientRef =
        typeof rawClientRef === "string" && rawClientRef.trim() ? rawClientRef : null
      const rawEntity =
        operation && typeof operation === "object"
          ? (operation as { entity?: unknown }).entity
          : undefined
      const rawAction =
        operation && typeof operation === "object"
          ? (operation as { action?: unknown }).action
          : undefined
      const entity = typeof rawEntity === "string" ? rawEntity : "unknown"
      const action = typeof rawAction === "string" ? rawAction : "unknown"

      try {
        const envelope = await validateSyncDto(SyncOperationEnvelopeDto, operation)

        if (envelope.entity === "survey" && envelope.action === "upsert") {
          const payload = await validateSyncDto(SurveyUpsertDto, envelope.payload)
          const data = await this.surveysService.upsertForUser(user, payload)
          results.push({
            client_ref: clientRef,
            entity: envelope.entity,
            action: envelope.action,
            status: "synced",
            data: data as unknown as Record<string, unknown>,
          })
          continue
        }

        if (envelope.entity === "survey" && envelope.action === "delete") {
          const payload = await validateSyncDto(SurveyDeletePayloadDto, envelope.payload ?? {})
          const surveyId = envelope.survey_id ?? payload.id
          if (!surveyId) {
            throw badRequest("survey_id is required for survey delete")
          }

          const data = await this.surveysService.deleteSurvey(user, surveyId, {
            allowMissing: true,
          })
          results.push({
            client_ref: clientRef,
            entity: envelope.entity,
            action: envelope.action,
            status: "synced",
            data: data as unknown as Record<string, unknown>,
          })
          continue
        }

        if (envelope.entity === "survey" && envelope.action === "visibility_update") {
          if (!envelope.survey_id) {
            throw badRequest("survey_id is required for survey visibility_update")
          }
          const payload = await validateSyncDto(SurveyVisibilityPayloadDto, envelope.payload)

          const data = await this.surveysService.patchSurveyVisibility(user, envelope.survey_id, {
            visibility: payload.visibility,
          })
          results.push({
            client_ref: clientRef,
            entity: envelope.entity,
            action: envelope.action,
            status: "synced",
            data: data as unknown as Record<string, unknown>,
          })
          continue
        }

        if (envelope.entity === "attachment" && envelope.action === "create") {
          if (!envelope.survey_id) {
            throw badRequest("survey_id is required for attachment create")
          }
          const payload = await validateSyncDto(CreateAttachmentDto, envelope.payload)
          const data = await this.attachmentsService.createAttachment(
            user,
            envelope.survey_id,
            payload,
          )
          results.push({
            client_ref: clientRef,
            entity: envelope.entity,
            action: envelope.action,
            status: "synced",
            data: data as unknown as Record<string, unknown>,
          })
          continue
        }

        if (envelope.entity === "attachment" && envelope.action === "delete") {
          if (!envelope.survey_id) {
            throw badRequest("survey_id is required for attachment delete")
          }
          const payload = await validateSyncDto(AttachmentDeletePayloadDto, envelope.payload)

          const data = await this.attachmentsService.deleteAttachment(
            user,
            envelope.survey_id,
            payload.attachment_id,
            {
              allowMissing: true,
            },
          )
          results.push({
            client_ref: clientRef,
            entity: envelope.entity,
            action: envelope.action,
            status: "synced",
            data: data as unknown as Record<string, unknown>,
          })
          continue
        }

        throw badRequest(`Unsupported sync operation: ${envelope.entity}.${envelope.action}`)
      } catch (error) {
        if (!isHttpException(error)) {
          const pgCode =
            typeof error === "object" && error !== null && "code" in error
              ? (error as { code?: unknown }).code
              : undefined
          const message = error instanceof Error ? error.message : String(error)
          this.logger.warn(
            `sync operation failed (entity=${entity}, action=${action}${pgCode ? `, pg_code=${String(pgCode)}` : ""}): ${message}`,
          )
        }
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
    const limit = normalizeChangesLimit(limitRaw)
    const parsedCursor = parseChangesCursor(cursor)

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
            .map((event) => extractAttachmentId(event.payload))
            .filter((value): value is string => Boolean(value)),
        ),
      )

      const surveys = surveyIds.length ? await this.loadSyncChangeSurveys(user.id, surveyIds) : []
      const attachments = attachmentIds.length
        ? await this.loadSyncChangeAttachmentsByIds(user.id, attachmentIds)
        : []

      const lastEvent = events[events.length - 1]
      const cursorOut = buildChangesCursor(lastEvent.created_at, lastEvent.id)

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
        ? buildChangesCursor(
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
}

function badRequest(message: string): BadRequestException {
  return new BadRequestException(message)
}

function isHttpException(error: unknown): error is HttpException {
  return error instanceof HttpException
}
