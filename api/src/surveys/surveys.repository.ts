import { Injectable, NotFoundException } from "@nestjs/common"
import { Queryable } from "../database/database.service"
import { SurveyRow } from "./surveys.types"
import { normalizeParcelIds } from "./surveys-normalize.utils"

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
