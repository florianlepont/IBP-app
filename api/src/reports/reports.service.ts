import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { randomUUID } from "crypto"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { SurveyEventsService } from "../surveys/survey-events.service"
import { encodeListCursor } from "../surveys/list-cursor"
import { ListPage } from "../surveys/surveys.repository"
import { CreateReportBody, PatchReportBody, ReportRow, ReportStatus } from "./reports.types"

// D-11: report ids are server randomUUID() values; the cursor id must be one.
export const REPORT_CURSOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * D-11: the GET /reports query. Unpaginated it is the pre-D-11 SQL (already ordered by
 * `created_at DESC, id DESC`). The keyset (created_at, id) is appended after the optional status
 * filter, so idx_reports_created_id serves the unfiltered list and idx_reports_status_created
 * the filtered one. reports.id is TEXT, so the id is compared as text, in the same collation as
 * the ORDER BY. Cursor fields and the limit are bound parameters (T-01.7-45).
 */
export function buildReportListQuery(
  status: ReportStatus | null,
  page: ListPage,
): { text: string; values: unknown[] } {
  const filters: string[] = []
  const values: unknown[] = []
  if (status) {
    values.push(status)
    filters.push(`status = $${values.length}`)
  }
  if (page.after) {
    values.push(page.after.t, page.after.i)
    filters.push(`(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`)
  }
  let limitClause = ""
  if (page.limit !== null) {
    values.push(page.limit + 1)
    limitClause = `
       LIMIT $${values.length}`
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""
  const text = `SELECT
         id,
         survey_id,
         reporter_user_id,
         reason,
         status,
         created_at::text,
         reviewed_at::text,
         reviewed_by::text
       FROM reports
       ${whereClause}
       ORDER BY created_at DESC, id DESC${limitClause}`
  return { text, values }
}

type ReportedSurveyRow = {
  id: string
  user_id: string
  visibility: "private" | "public"
  deleted_at: string | null
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DatabaseService,
    // D-07: the single survey event writer, from SurveysDataModule.
    private readonly events: SurveyEventsService,
  ) {}

  async createReport(
    user: AuthenticatedUser,
    body: CreateReportBody,
  ): Promise<{ id: string; status: ReportStatus }> {
    const surveyId = body.survey_id?.trim()
    if (!surveyId) {
      throw new BadRequestException("survey_id is required")
    }

    const reason = body.reason?.trim()
    if (!reason) {
      throw new BadRequestException("reason is required")
    }

    const survey = await this.findSurveyForReport(surveyId)
    if (!survey) {
      throw new NotFoundException("Survey not found")
    }
    if (survey.deleted_at) {
      throw new NotFoundException("Survey not found")
    }
    if (!this.canReportSurvey(user, survey)) {
      throw new ForbiddenException("Survey is not reportable by this user")
    }

    const reportId = randomUUID()
    const report = await this.db.transaction(async (db) => {
      const result = await db.query<Pick<ReportRow, "id" | "status">>(
        `INSERT INTO reports (id, survey_id, reporter_user_id, reason, status)
         VALUES ($1, $2, $3, $4, 'open')
         RETURNING id, status`,
        [reportId, surveyId, user.id, reason],
      )

      // 01.2 A-M6: reported events never carry the reporter's identity, so the actor is null.
      await this.events.insert(db, surveyId, null, "reported", { report_id: reportId })

      return result.rows[0]
    })

    return {
      id: report.id,
      status: report.status,
    }
  }

  // D-11: every report without page.limit (next_cursor null); keyset pages otherwise. The
  // reviewer role check runs before any cursor is used (T-01.7-44).
  async listReports(
    user: AuthenticatedUser,
    statusRaw?: string,
    page: ListPage = { limit: null, after: null },
  ): Promise<{ items: ReportRow[]; next_cursor: string | null }> {
    this.assertCanReviewReports(user)

    const status = this.normalizeStatusFilter(statusRaw)
    const query = buildReportListQuery(status, page)
    const result = await this.db.query<ReportRow>(query.text, query.values)

    if (page.limit === null || result.rows.length <= page.limit) {
      return { items: result.rows, next_cursor: null }
    }
    const items = result.rows.slice(0, page.limit)
    const last = items[items.length - 1]
    return { items, next_cursor: encodeListCursor({ t: last.created_at, i: last.id }) }
  }

  async reviewReport(
    user: AuthenticatedUser,
    reportId: string,
    body: PatchReportBody,
  ): Promise<{ id: string; status: ReportStatus; reviewed_at: string | null }> {
    this.assertCanReviewReports(user)

    const requestedStatus = (body.status ?? "").trim().toLowerCase()
    if (requestedStatus !== "reviewed") {
      throw new BadRequestException("status must be reviewed")
    }

    const result = await this.db.query<Pick<ReportRow, "id" | "status" | "reviewed_at">>(
      `UPDATE reports
       SET status = 'reviewed',
           reviewed_at = COALESCE(reviewed_at, NOW()),
           reviewed_by = COALESCE(reviewed_by, $2)
       WHERE id = $1
       RETURNING id, status, reviewed_at::text`,
      [reportId, user.id],
    )

    const report = result.rows[0]
    if (!report) {
      throw new NotFoundException("Report not found")
    }

    return {
      id: report.id,
      status: report.status,
      reviewed_at: report.reviewed_at,
    }
  }

  private async findSurveyForReport(surveyId: string): Promise<ReportedSurveyRow | null> {
    const result = await this.db.query<ReportedSurveyRow>(
      `SELECT id, user_id, visibility, deleted_at::text
       FROM surveys
       WHERE id = $1`,
      [surveyId],
    )
    return result.rows[0] ?? null
  }

  private canReportSurvey(user: AuthenticatedUser, survey: ReportedSurveyRow): boolean {
    if (user.role === "moderator" || user.role === "admin") {
      return true
    }
    if (survey.user_id === user.id) {
      return false
    }
    return survey.visibility === "public"
  }

  private assertCanReviewReports(user: AuthenticatedUser): void {
    if (user.role === "moderator" || user.role === "admin") {
      return
    }
    throw new ForbiddenException("Moderator or admin role required")
  }

  private normalizeStatusFilter(statusRaw?: string): ReportStatus | null {
    if (!statusRaw || typeof statusRaw !== "string" || statusRaw.trim().length === 0) {
      return null
    }

    const normalized = statusRaw.trim().toLowerCase()
    if (normalized === "open" || normalized === "reviewed") {
      return normalized
    }

    throw new BadRequestException("status must be open or reviewed")
  }
}
