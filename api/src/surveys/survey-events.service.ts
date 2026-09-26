import { BadRequestException, Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService, Queryable } from "../database/database.service"
import { decodeListCursor, ListCursor } from "./list-cursor"
import { ListPage, SurveysRepository, toListPage } from "./surveys.repository"
import { SurveyEventRow } from "./surveys.types"

// D-07: the only place in api/src that spells the survey_events insert. seq and xid are
// column defaults (migration 014) and are never named here.
export const SURVEY_EVENT_INSERT_SQL =
  "INSERT INTO survey_events (id, survey_id, actor_id, event_type, payload)"

// D-11: seq is a bigint identity, carried as its decimal text in the cursor.
export const EVENT_CURSOR_ID_PATTERN = /^\d{1,19}$/
const BIGINT_MAX = BigInt("9223372036854775807")

// D-12: the strict list cursor, plus a bigint range check so a 19-digit id above the bigint
// maximum answers 400 instead of failing the `$3::bigint` cast (22003).
export function decodeEventListCursor(raw: string | undefined): ListCursor | null {
  const cursor = decodeListCursor(raw, { idPattern: EVENT_CURSOR_ID_PATTERN })
  if (cursor && BigInt(cursor.i) > BIGINT_MAX) {
    throw new BadRequestException("Invalid cursor")
  }
  return cursor
}

type SurveyEventListRow = SurveyEventRow & { seq: string }

/**
 * D-11: the GET /surveys/:id/events query. Unpaginated it is the pre-D-11 select plus the
 * `seq DESC` tiebreaker and a `seq::text` column the service strips before answering. The
 * keyset is on (created_at, seq) inside `survey_id = $1`; the caller has already checked
 * ownership. Cursor fields and the limit are bound parameters (T-01.7-45).
 */
export function buildEventListQuery(
  surveyId: string,
  page: ListPage,
): { text: string; values: unknown[] } {
  const values: unknown[] = [surveyId]
  let keyset = ""
  if (page.after) {
    values.push(page.after.t, page.after.i)
    keyset = `
         AND (created_at, seq) < ($2::timestamptz, $3::bigint)`
  }
  let limitClause = ""
  if (page.limit !== null) {
    values.push(page.limit + 1)
    limitClause = `
       LIMIT $${values.length}`
  }
  const text = `SELECT id, survey_id, actor_id, event_type, payload, created_at::text, seq::text
       FROM survey_events
       WHERE survey_id = $1${keyset}
       ORDER BY created_at DESC, seq DESC${limitClause}`
  return { text, values }
}

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

  // D-11: without page.limit every event is returned, newest first, with next_cursor null; the
  // item shape is unchanged (installed apps call this route without parameters).
  async listForSurvey(
    user: AuthenticatedUser,
    surveyId: string,
    page: ListPage = { limit: null, after: null },
  ): Promise<{ items: SurveyEventRow[]; next_cursor: string | null }> {
    await this.repository.findOwnedOrThrow(this.db, surveyId, user.id, {
      activeOnly: true,
      columns: "ownership",
    })

    const query = buildEventListQuery(surveyId, page)
    const events = await this.db.query<SurveyEventListRow>(query.text, query.values)

    return toListPage(
      events.rows,
      page.limit,
      (row) => ({ t: row.created_at, i: row.seq }),
      ({ seq: _seq, ...item }) => item,
    )
  }
}
