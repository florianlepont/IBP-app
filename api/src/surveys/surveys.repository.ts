import { Injectable, NotFoundException } from "@nestjs/common"
import { Queryable } from "../database/database.service"
import { SurveyRow } from "./surveys.types"
import { normalizeParcelIds, normalizeSurveyStatusFilter } from "./surveys-normalize.utils"
import { normalizeDateInput } from "./public-map.utils"
import { encodeListCursor, ListCursor } from "./list-cursor"

export type OwnershipColumns = "ownership" | "full"

export type SurveyOwnershipRow = Pick<
  SurveyRow,
  "id" | "user_id" | "status" | "visibility" | "sync_version" | "deleted_at"
>

export type FindOwnedOptions<C extends OwnershipColumns> = {
  activeOnly: boolean
  forUpdate?: boolean
  columns: C
}

export type OwnedRow<C extends OwnershipColumns> = C extends "full" ? SurveyRow : SurveyOwnershipRow

// D-07: the column list is chosen from this constant by the enum and never built from input
// (T-01.7-34). "ownership" reads only what an existence, status or version check needs.
const OWNED_SURVEY_SELECT: Record<OwnershipColumns, string> = {
  ownership: "SELECT id, user_id, status, visibility, sync_version, deleted_at",
  full: "SELECT *",
}

// D-11: one page request. limit null means unpaginated (today's answer); after is the decoded
// keyset cursor, or null for the first page.
export type ListPage = { limit: number | null; after: ListCursor | null }

export type SurveyListFilters = { status?: string; from?: string; to?: string; q?: string }

export type SurveyListItem = Pick<
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

/**
 * D-11 paging rule shared by the three lists. Unpaginated (limit null): every row, next_cursor
 * null. Limited: the query fetched limit + 1 rows; when the extra row came back it is dropped
 * and next_cursor points after the last kept row, otherwise this is the last page.
 */
export function toListPage<Row, Item = Row>(
  rows: Row[],
  limit: number | null,
  cursorOf: (row: Row) => ListCursor,
  toItem: (row: Row) => Item = (row) => row as unknown as Item,
): { items: Item[]; next_cursor: string | null } {
  if (limit === null || rows.length <= limit) {
    return { items: rows.map(toItem), next_cursor: null }
  }
  const kept = rows.slice(0, limit)
  return {
    items: kept.map(toItem),
    next_cursor: encodeListCursor(cursorOf(kept[kept.length - 1])),
  }
}

// D-11: the ORDER BY columns are table-qualified on purpose. The select list outputs
// `updated_at::text` under the name updated_at, and an unqualified ORDER BY name resolves to
// the output column first: the rows would sort as text, out of step with the timestamp keyset,
// and no index could serve the order.
/**
 * D-11: the GET /surveys query. Without a page limit and cursor the SQL is the pre-D-11 one plus
 * the `id DESC` tiebreaker. The keyset predicate is appended after `user_id = $1`, so a
 * replayed cursor never widens the caller's scope (T-01.7-44), and the cursor fields and the
 * limit are always bound parameters (T-01.7-45). A limited page fetches limit + 1 rows so the
 * caller can tell whether another page exists.
 */
export function buildListForUserQuery(
  userId: string,
  filters: SurveyListFilters | undefined,
  page: ListPage,
): { text: string; values: unknown[] } {
  const conditions: string[] = ["user_id = $1", "deleted_at IS NULL"]
  const values: unknown[] = [userId]

  const normalizedStatus = normalizeSurveyStatusFilter(filters?.status)
  if (normalizedStatus) {
    values.push(normalizedStatus)
    conditions.push(`status = $${values.length}`)
  }

  const fromDate = normalizeDateInput(filters?.from)
  if (fromDate) {
    values.push(fromDate)
    conditions.push(`updated_at::date >= $${values.length}::date`)
  }

  const toDate = normalizeDateInput(filters?.to)
  if (toDate) {
    values.push(toDate)
    conditions.push(`updated_at::date <= $${values.length}::date`)
  }

  const query = filters?.q?.trim()
  if (query) {
    values.push(`%${query}%`)
    conditions.push(`(site_name ILIKE $${values.length} OR parcel_id ILIKE $${values.length})`)
  }

  if (page.after) {
    values.push(page.after.t, page.after.i)
    conditions.push(`(updated_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`)
  }

  let limitClause = ""
  if (page.limit !== null) {
    values.push(page.limit + 1)
    limitClause = `
       LIMIT $${values.length}`
  }

  const text = `SELECT id, site_name, status, visibility, parcel_id, observation_year, version_number, updated_at::text, sync_version
       FROM surveys
       WHERE ${conditions.join(" AND ")}
       ORDER BY surveys.updated_at DESC, surveys.id DESC${limitClause}`

  return { text, values }
}

/**
 * Survey data access shared by the surveys and reports modules (D-07). Every method takes the
 * caller's Queryable so it runs inside the caller's transaction (01.4 D-06).
 */
@Injectable()
export class SurveysRepository {
  // D-07: the single ownership lookup. `WHERE id = $1 AND user_id = $2` is kept in every mode
  // (T-01.7-31).
  async findOwned<C extends OwnershipColumns>(
    db: Queryable,
    id: string,
    userId: string,
    options: FindOwnedOptions<C>,
  ): Promise<OwnedRow<C> | null> {
    const select = OWNED_SURVEY_SELECT[options.columns]
    const activeClause = options.activeOnly ? "AND deleted_at IS NULL" : ""
    const forUpdateClause = options.forUpdate ? "FOR UPDATE" : ""
    const result = await db.query<OwnedRow<C>>(
      `${select}
       FROM surveys
       WHERE id = $1 AND user_id = $2 ${activeClause}
       ${forUpdateClause}`,
      [id, userId],
    )
    return result.rows[0] ?? null
  }

  async findOwnedOrThrow<C extends OwnershipColumns>(
    db: Queryable,
    id: string,
    userId: string,
    options: FindOwnedOptions<C>,
  ): Promise<OwnedRow<C>> {
    const survey = await this.findOwned(db, id, userId, options)
    if (!survey) {
      throw new NotFoundException("Survey not found")
    }
    return survey
  }

  async listForUser(
    db: Queryable,
    userId: string,
    filters: SurveyListFilters | undefined,
    page: ListPage,
  ): Promise<{ items: SurveyListItem[]; next_cursor: string | null }> {
    const query = buildListForUserQuery(userId, filters, page)
    const result = await db.query<SurveyListItem>(query.text, query.values)
    return toListPage(result.rows, page.limit, (row) => ({ t: row.updated_at, i: row.id }))
  }

  async getSurveyParcelIds(db: Queryable, surveyId: string): Promise<string[]> {
    const result = await db.query<{ parcel_id: string }>(
      `SELECT parcel_id
       FROM survey_parcels
       WHERE survey_id = $1
       ORDER BY parcel_id ASC`,
      [surveyId],
    )
    return result.rows.map((row) => row.parcel_id)
  }

  async syncSurveyParcels(db: Queryable, surveyId: string, parcelIds: string[]): Promise<void> {
    const normalized = normalizeParcelIds(parcelIds)
    await db.query(`DELETE FROM survey_parcels WHERE survey_id = $1`, [surveyId])
    if (normalized.length === 0) {
      return
    }
    await db.query(
      `INSERT INTO survey_parcels (survey_id, parcel_id)
       SELECT $1, unnest($2::text[])
       ON CONFLICT (survey_id, parcel_id) DO NOTHING`,
      [surveyId, normalized],
    )
  }
}
