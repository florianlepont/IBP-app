import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService, Queryable } from "../database/database.service"
import { SurveysRepository } from "./surveys.repository"
import { SurveyEventRow } from "./surveys.types"

// D-07: the only place in api/src that spells the survey_events insert. seq and xid are
// column defaults (migration 014) and are never named here.
export const SURVEY_EVENT_INSERT_SQL =
  "INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)"

@Injectable()
export class SurveyEventsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repository: SurveysRepository,
  ) {}

  /**
   * D-07: the single survey event writer. It runs on the caller's Queryable so the event
   * commits or rolls back with the row it describes (01.4 D-06). actorId is null for reported
   * events, which never carry the reporter's identity (01.2 A-M6).
   */
  async insert(
    db: Queryable,
    surveyId: string,
    actorId: string | null,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await db.query(`${SURVEY_EVENT_INSERT_SQL} VALUES ($1, $2, $3, $4, $5::jsonb)`, [
      randomUUID(),
      surveyId,
      actorId,
      eventType,
      JSON.stringify(payload),
    ])
  }

  async listForSurvey(
    user: AuthenticatedUser,
    surveyId: string,
  ): Promise<{ items: SurveyEventRow[] }> {
    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

    const events = await this.db.query<SurveyEventRow>(
      `SELECT id, survey_id, actor_id, event_type, payload, created_at::text
       FROM survey_events
       WHERE survey_id = $1
       ORDER BY created_at DESC`,
      [surveyId],
    )

    return { items: events.rows }
  }
}
