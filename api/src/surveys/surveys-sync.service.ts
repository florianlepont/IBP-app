import { BadRequestException, HttpException, Injectable, Logger } from "@nestjs/common"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { IbpRulesService } from "./ibp-rules.service"
import { mapSyncError } from "./sync-error.utils"
import {
  SyncChangeAttachment,
  SyncChangeEvent,
  SyncChangeEventRow,
  SyncChangeSurvey,
  SyncOperationResult,
} from "./surveys.types"
import {
  buildSyncChangesCursor,
  extractAttachmentId,
  normalizeChangesLimit,
  parseSyncChangesCursor,
  SyncChangesCursor,
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
    const parsedCursor = parseSyncChangesCursor(cursor)
    const start = await this.resolveSyncChangesStart(user.id, parsedCursor)

    // Commit-safe order (D-02, D-12). Filtering on xid8 below the current snapshot's xmin keeps
    // only events whose writing transaction has finished, and any event that becomes visible later
    // has an xid8 >= that minimum, so it sorts after everything already returned when paging on
    // (xid8, seq). Paging on seq alone would skip it (a transaction that took its xid early can
    // insert a higher seq and commit first). The minimum is cluster-wide: a long-running writer
    // anywhere in the cluster delays the feed, but never makes it skip an event.
    const rawEvents = await this.db.query<SyncChangeEventRow>(
      `SELECT e.id, e.survey_id, e.actor_id, e.event_type, e.payload, e.created_at::text,
              e.xid8::text AS xid8, e.seq::text AS seq
       FROM survey_events e
       JOIN surveys s ON s.id = e.survey_id
       WHERE s.user_id = $1
         AND (e.xid8, e.seq) > ($2::xid8, $3::bigint)
         AND e.xid8 < pg_snapshot_xmin(pg_current_snapshot())
       ORDER BY e.xid8 ASC, e.seq ASC
       LIMIT $4`,
      [user.id, start.xid8, start.seq, limit + 1],
    )

    const hasMoreEvents = rawEvents.rows.length > limit
    const eventRows = hasMoreEvents ? rawEvents.rows.slice(0, limit) : rawEvents.rows

    if (eventRows.length === 0) {
      // No new event: keep the client where it is. A legacy cursor is answered with its
      // translated v2 position so the app switches format (it persists cursor_out only when it
      // differs). The old fallback that re-sent event-less surveys on every poll is gone (D-03).
      return {
        cursor_in: parsedCursor.original,
        cursor_out:
          parsedCursor.kind === "none" ? null : buildSyncChangesCursor(start.xid8, start.seq),
        has_more: false,
        events: [],
        surveys: [],
        attachments: [],
      }
    }

    const events: SyncChangeEvent[] = eventRows.map(({ xid8: _xid8, seq: _seq, ...event }) => event)
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

    const lastEvent = eventRows[eventRows.length - 1]

    return {
      cursor_in: parsedCursor.original,
      cursor_out: buildSyncChangesCursor(lastEvent.xid8, lastEvent.seq),
      has_more: hasMoreEvents,
      events,
      surveys,
      attachments,
    }
  }

  // Resolves the (xid8, seq) position the feed resumes after. Values stay strings end to end.
  private async resolveSyncChangesStart(
    userId: string,
    parsedCursor: SyncChangesCursor,
  ): Promise<{ xid8: string; seq: string }> {
    if (parsedCursor.kind === "none") {
      return FEED_START
    }

    if (parsedCursor.kind === "legacy") {
      // Legacy `<created_at>|<id>` cursors (D-13, C-6). The id may be a survey id (the removed
      // fallback emitted those), so translate with `<=` rather than an exact match: resume after
      // the last event at or before that point, or from the beginning if there is none.
      let translated: { rows: Array<{ xid8: string; seq: string }> }
      try {
        translated = await this.db.query<{ xid8: string; seq: string }>(
          `SELECT e.xid8::text AS xid8, e.seq::text AS seq
           FROM survey_events e
           JOIN surveys s ON s.id = e.survey_id
           WHERE s.user_id = $1
             AND (e.created_at, e.id) <= ($2::timestamptz, $3)
           ORDER BY e.xid8 DESC, e.seq DESC
           LIMIT 1`,
          [userId, parsedCursor.timestamp, parsedCursor.eventId],
        )
      } catch (error) {
        // D-12 backstop for the 01.6 malformed-legacy-cursor todo: the strict parser
        // (isStrictTimestamp) is the first line of defence; if a timestamp it accepted is still
        // refused by the `$2::timestamptz` cast, the client sent a bad cursor, so answer 400
        // instead of 500. Every other error (a statement timeout, a lost connection) is rethrown
        // untouched so it stays retryable.
        if (isTimestampCastError(error)) {
          throw badRequest("Invalid sync cursor")
        }
        throw error
      }
      return translated.rows[0] ?? FEED_START
    }

    // A cursor at or past the next xid to be assigned cannot come from this cluster's history:
    // after a dump/restore the xid counter restarts lower than the xid8 stored in old cursors,
    // and resuming from it would hide every new event. Restart from the beginning instead.
    const guard = await this.db.query<{ future: boolean }>(
      `SELECT $1::xid8 >= pg_snapshot_xmax(pg_current_snapshot()) AS future`,
      [parsedCursor.xid8],
    )
    if (guard.rows[0]?.future) {
      this.logger.warn(
        `Changes cursor beyond the current transaction id for user ${userId}; restarting the feed`,
      )
      return FEED_START
    }

    return { xid8: parsedCursor.xid8, seq: parsedCursor.seq }
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
}

const FEED_START = { xid8: "0", seq: "0" } as const

function badRequest(message: string): BadRequestException {
  return new BadRequestException(message)
}

// SQLSTATEs a `::timestamptz` cast raises on bad input: 22007 invalid_datetime_format,
// 22008 datetime_field_overflow, 22009 invalid_time_zone_displacement_value.
const TIMESTAMP_CAST_SQLSTATES = new Set(["22007", "22008", "22009"])

function isTimestampCastError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    !(error instanceof HttpException) &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    TIMESTAMP_CAST_SQLSTATES.has((error as { code: string }).code)
  )
}

function isHttpException(error: unknown): error is HttpException {
  return error instanceof HttpException
}
