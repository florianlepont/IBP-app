import { Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "crypto"
import { Queryable } from "../database/database.service"
import { SURVEY_EVENT_INSERT_SQL } from "./survey-events.sql"
import { SurveyRow } from "./surveys.types"
import {
  normalizeParcelIds,
  normalizeSurveyStatusFilter,
  parseParcelIdentifier,
} from "./surveys-normalize.utils"
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

// D-09: the upsert fast path's unlocked read. The row is the "full" SELECT *, plus the linked
// parcel ids in parcel_id order (the order getSurveyParcelIds returns) and the row's xmin as the
// CAS token of the update statement.
export type UpsertReadRow = SurveyRow & { parcel_ids: string[]; cas_token: string }

// D-09: the values one fast-path write stores. Every field is resolved in JS exactly as the
// locked path resolves it, except version_number when neither the body nor the stored row has
// one: then the statement computes the parcel's next version (versionNumber null, parcelId set)
// with the query of ParcelsService.getDefaultVersionNumber.
export type SurveyFastWriteInput = {
  surveyId: string
  userId: string
  siteName: string
  visibility: "private" | "public"
  parcelId: string | null
  parcelIds: string[]
  observationYear: number | null
  versionNumber: number | null
  previousSurveyId: string | null
  regionVersion: string | null
  vegetationStage: string | null
  factors: unknown
  factorResults: unknown
  scores: unknown
  syncVersion: number
  // ISO timestamp written to updated_at (and created_at on a create).
  now: string
  // Create only; an update never moves expires_at (D-03).
  expiresAt: string
  eventPayload: Record<string, unknown>
}

export type SurveyWriteResult = { id: string; updated_at: string }

// The next version of a parcel when the survey carries none: the highest submitted, live version
// on that parcel from any other survey, plus one (ParcelsService.getDefaultVersionNumber).
// $1 is the survey id, $5 the first parcel id, $7 the explicit version number or NULL.
const FAST_PATH_VERSION_NUMBER_SQL = `COALESCE($7::int, CASE WHEN $5::text IS NULL THEN NULL ELSE (
             SELECT COALESCE(MAX(vs.version_number), 0) + 1
             FROM surveys vs
             JOIN survey_parcels vsp ON vsp.survey_id = vs.id
             WHERE vsp.parcel_id = $5::text
               AND vs.deleted_at IS NULL
               AND vs.status = 'submitted'
               AND vs.id <> $1::text
           ) END)`

// The parcels a write links, derived as ParcelsService.ensureParcelIds derives them (normalised,
// de-duplicated, commune/section/number from parseParcelIdentifier, source 'manual'). $15..$19
// are parallel arrays sorted by parcel_id, so concurrent registrations wait in the same order.
const FAST_PATH_INPUT_PARCELS_SQL = `input_parcels AS (
         SELECT *
         FROM unnest($15::uuid[], $16::text[], $17::text[], $18::text[], $19::text[])
           AS input(id, parcel_id, commune_code, section, number)
       )`

// Gated on the survey write: a statement that writes no survey row registers no parcel.
function ensuredParcelsSql(writeCte: "ins" | "u"): string {
  return `ensured AS (
         INSERT INTO parcels (id, parcel_id, commune_code, section, number, geometry, centroid, source)
         SELECT ip.id, ip.parcel_id, ip.commune_code, ip.section, ip.number,
                '{}'::jsonb, '{}'::jsonb, 'manual'
         FROM input_parcels ip
         WHERE EXISTS (SELECT 1 FROM ${writeCte})
         ORDER BY ip.parcel_id
         ON CONFLICT (parcel_id) DO NOTHING
       )`
}

// Bound parameters of both fast-path statements. $23 is expires_at for a create and the xmin
// CAS token for an update.
export function fastWriteValues(input: SurveyFastWriteInput, casToken: string | null): unknown[] {
  const parcels = normalizeParcelIds(input.parcelIds)
    .sort()
    .map((parcelId) => ({ parcelId, ...parseParcelIdentifier(parcelId) }))
  return [
    input.surveyId,
    input.userId,
    input.siteName,
    input.visibility,
    input.parcelId,
    input.observationYear,
    input.versionNumber,
    input.previousSurveyId,
    input.regionVersion,
    input.vegetationStage,
    JSON.stringify(input.factors),
    JSON.stringify(input.factorResults),
    JSON.stringify(input.scores),
    input.syncVersion,
    parcels.map(() => randomUUID()),
    parcels.map((row) => row.parcelId),
    parcels.map((row) => row.communeCode),
    parcels.map((row) => row.section),
    parcels.map((row) => row.number),
    randomUUID(),
    JSON.stringify(input.eventPayload),
    input.now,
    casToken === null ? input.expiresAt : casToken,
  ]
}

/**
 * D-09: one atomic statement creates the survey, registers its parcels, links them and writes
 * the "created" event. On this path the explicit transaction of 01.4 D-06 becomes
 * single-statement atomicity; the invariant is unchanged (row, links and event commit together
 * or not at all). `ins` uses ON CONFLICT (id) DO NOTHING and every other part reads `ins`, so an
 * id that already exists (a concurrent create, or another user's survey) writes nothing and
 * returns no row: the caller then runs the locked path. Errors propagate (C-5).
 */
export const CREATE_SURVEY_ATOMIC_SQL = `WITH ${FAST_PATH_INPUT_PARCELS_SQL},
       ins AS (
         INSERT INTO surveys (
           id, user_id, site_name, status, visibility, parcel_id, observation_year, version_number,
           previous_survey_id, region_version, vegetation_stage, factors, factor_results, scores,
           location, created_at, updated_at, submitted_at, expires_at, sync_version
         ) VALUES (
           $1::text, $2::uuid, $3, 'draft', $4, $5::text, $6::int,
           ${FAST_PATH_VERSION_NUMBER_SQL},
           $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb,
           '{}'::jsonb, $22::timestamptz, $22::timestamptz, NULL, $23::timestamptz, $14::int
         )
         ON CONFLICT (id) DO NOTHING
         RETURNING id, updated_at::text AS updated_at
       ),
       ${ensuredParcelsSql("ins")},
       links AS (
         INSERT INTO survey_parcels (survey_id, parcel_id)
         SELECT ins.id, ip.parcel_id
         FROM ins CROSS JOIN input_parcels ip
         ON CONFLICT (survey_id, parcel_id) DO NOTHING
       ),
       ev AS (
         ${SURVEY_EVENT_INSERT_SQL}
         SELECT $20::text, ins.id, $2::uuid, 'created', $21::jsonb
         FROM ins
       )
       SELECT id, updated_at FROM ins`

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

  // D-09: statement A of an upsert. No lock: the write that follows is guarded by the CAS token.
  async readForUpsert(db: Queryable, id: string, userId: string): Promise<UpsertReadRow | null> {
    const result = await db.query<UpsertReadRow>(
      `SELECT s.*,
              s.xmin::text AS cas_token,
              COALESCE(
                (SELECT array_agg(sp.parcel_id ORDER BY sp.parcel_id)
                 FROM survey_parcels sp
                 WHERE sp.survey_id = s.id),
                '{}'::text[]
              ) AS parcel_ids
       FROM surveys s
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId],
    )
    return result.rows[0] ?? null
  }

  // D-09: the created row, or null when the id already exists (nothing was written).
  async createSurveyAtomic(
    db: Queryable,
    input: SurveyFastWriteInput,
  ): Promise<SurveyWriteResult | null> {
    const result = await db.query<SurveyWriteResult>(
      CREATE_SURVEY_ATOMIC_SQL,
      fastWriteValues(input, null),
    )
    return result.rows[0] ?? null
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
