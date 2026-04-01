import { BadRequestException, Injectable } from "@nestjs/common"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { IbpRulesService } from "./ibp-rules.service"
import { mapSyncError } from "./sync-error.utils"
import {
  CreateAttachmentBody,
  SyncBatchBody,
  SyncChangeAttachment,
  SyncChangeEvent,
  SyncChangeSurvey,
  SyncOperationResult,
  SurveyUpsertBody,
} from "./surveys.types"
import {
  buildChangesCursor,
  extractAttachmentId,
  normalizeChangesLimit,
  parseChangesCursor,
} from "./surveys-normalize.utils"
import { SurveysService } from "./surveys.service"
import { SurveysAttachmentsService } from "./surveys-attachments.service"

@Injectable()
export class SurveysSyncService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ibpRules: IbpRulesService,
    private readonly surveysService: SurveysService,
    private readonly attachmentsService: SurveysAttachmentsService,
  ) {}

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
          const data = await this.surveysService.upsertForUser(
            user,
            operation.payload as SurveyUpsertBody,
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

          const data = await this.surveysService.deleteSurvey(user, surveyId, {
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

          const data = await this.surveysService.patchSurveyVisibility(user, operation.survey_id, {
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
          const data = await this.attachmentsService.createAttachment(
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

          const data = await this.attachmentsService.deleteAttachment(
            user,
            operation.survey_id,
            payloadAttachmentId,
            {
              allowMissing: true,
            },
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
