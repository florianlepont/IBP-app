import { BadRequestException, Injectable, UnprocessableEntityException } from "@nestjs/common"
import { randomUUID } from "crypto"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService, Queryable } from "../database/database.service"
import { CadastreProviderService } from "./cadastre-provider.service"
import { ParcelRow, SurveyRow } from "./surveys.types"
import {
  normalizeCentroid,
  normalizeParcelHistoryLimit,
  normalizeParcelId,
  parseParcelIdentifier,
  toFiniteNumber,
} from "./surveys-normalize.utils"

export type ParcelSubmitValidation = {
  code?: "parcel_required" | "parcel_invalid"
  errors: string[]
  versionConflict?: { expectedVersionNumber: number }
}

/**
 * Parcel resolution, history, parcel-id registration, display location and the parcel part
 * of submit validation (D-07). Moved out of SurveysService; routes and responses are
 * unchanged. Writes are batched (D-10): the number of statements does not grow with the
 * number of parcels.
 */
@Injectable()
export class ParcelsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cadastreProvider: CadastreProviderService,
  ) {}

  async resolveParcelByCoordinates(input?: { lat?: string; lng?: string }): Promise<{
    parcel: {
      parcel_id: string
      commune_code: string
      section: string
      number: string
      centroid: { lat: number; lng: number }
    }
  }> {
    const lat = toFiniteNumber(input?.lat)
    const lng = toFiniteNumber(input?.lng)
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

    const centroid = normalizeCentroid(parcel.centroid)
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
    const parcelId = normalizeParcelId(parcelIdRaw)
    if (!parcelId) {
      throw new BadRequestException("parcel_id is required")
    }

    const limit = normalizeParcelHistoryLimit(limitRaw)
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

  /**
   * The survey's map position in one query (D-10): the average of its linked parcels'
   * centroids, else the centroid of `fallbackParcelId` (the legacy single parcel), else null.
   * Reads the generated centroid_lat/centroid_lng columns (migration 015), which are NULL for
   * malformed or out-of-range centroids.
   */
  async displayLocation(
    db: Queryable,
    surveyId: string,
    fallbackParcelId?: string | null,
  ): Promise<{ lat: number; lng: number } | null> {
    const result = await db.query<{
      lat: number | null
      lng: number | null
      fallback_lat: number | null
      fallback_lng: number | null
    }>(
      `SELECT
         linked.lat,
         linked.lng,
         fallback.centroid_lat AS fallback_lat,
         fallback.centroid_lng AS fallback_lng
       FROM (
         SELECT AVG(p.centroid_lat) AS lat, AVG(p.centroid_lng) AS lng
         FROM survey_parcels sp
         JOIN parcels p
           ON p.parcel_id = sp.parcel_id
         WHERE sp.survey_id = $1
       ) linked
       LEFT JOIN parcels fallback
         ON fallback.parcel_id = $2::text`,
      [surveyId, normalizeParcelId(fallbackParcelId)],
    )

    const row = result.rows[0]
    if (!row) {
      return null
    }
    return (
      normalizeCentroid({ lat: row.lat, lng: row.lng }) ??
      normalizeCentroid({ lat: row.fallback_lat, lng: row.fallback_lng })
    )
  }

  /**
   * Registers every parcel id with one statement (D-10) and returns the normalised,
   * de-duplicated ids in input order. Unknown ids get the same placeholder row as before
   * (commune/section/number from parseParcelIdentifier, empty geometry and centroid, source
   * "manual"); existing rows are left untouched.
   */
  async ensureParcelIds(db: Queryable, parcelIds: string[]): Promise<string[]> {
    const output: string[] = []
    const seen = new Set<string>()
    for (const raw of parcelIds) {
      const normalized = normalizeParcelId(raw)
      if (!normalized || seen.has(normalized)) {
        continue
      }
      seen.add(normalized)
      output.push(normalized)
    }

    if (output.length === 0) {
      return []
    }

    // Rows are inserted in parcel_id order so two concurrent calls wait on each other's
    // unique-index entries in the same order instead of deadlocking.
    const rows = [...output].sort().map((parcelId) => ({
      parcelId,
      ...parseParcelIdentifier(parcelId),
    }))
    await db.query(
      `INSERT INTO parcels (id, parcel_id, commune_code, section, number, geometry, centroid, source)
       SELECT input.id, input.parcel_id, input.commune_code, input.section, input.number,
              '{}'::jsonb, '{}'::jsonb, 'manual'
       FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[])
         AS input(id, parcel_id, commune_code, section, number)
       ON CONFLICT (parcel_id) DO NOTHING`,
      [
        rows.map(() => randomUUID()),
        rows.map((row) => row.parcelId),
        rows.map((row) => row.communeCode),
        rows.map((row) => row.section),
        rows.map((row) => row.number),
      ],
    )

    return output
  }

  async getDefaultVersionNumber(
    db: Queryable,
    parcelId: string,
    surveyIdToExclude?: string,
  ): Promise<number> {
    const result = await db.query<{ next_version: number }>(
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

  /**
   * The parcel checks of a submit, in one GROUP BY query (D-10): every parcel must exist, and
   * the survey's version must equal the next version of each parcel (the highest submitted
   * version of the parcel's other surveys, plus one). The first parcel in `surveyParcelIds`
   * order whose next version differs is reported, as the old per-parcel loop did.
   *
   * `surveyParcelIds` is the list submitSurvey already read (and locked) in this transaction.
   */
  async validateParcelSubmit(
    db: Queryable,
    survey: SurveyRow,
    surveyParcelIds: string[],
  ): Promise<ParcelSubmitValidation> {
    const errors: string[] = []
    const observationYear = survey.observation_year
    const versionNumber = survey.version_number
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

    const result = await db.query<{ parcel_id: string; next_version: number }>(
      `SELECT p.parcel_id, COALESCE(MAX(s.version_number), 0) + 1 AS next_version
       FROM parcels p
       LEFT JOIN survey_parcels sp
         ON sp.parcel_id = p.parcel_id
       LEFT JOIN surveys s
         ON s.id = sp.survey_id
        AND s.deleted_at IS NULL
        AND s.status = 'submitted'
        AND s.id <> $2
       WHERE p.parcel_id = ANY($1::text[])
       GROUP BY p.parcel_id`,
      [parcelIds, survey.id],
    )

    if (result.rows.length !== parcelIds.length) {
      return {
        code: "parcel_invalid",
        errors: ["one or more parcel_ids do not exist in parcel registry"],
      }
    }

    const nextVersionByParcel = new Map(
      result.rows.map((row) => [row.parcel_id, Number(row.next_version)]),
    )
    for (const parcelId of parcelIds) {
      const expectedVersionNumber = nextVersionByParcel.get(parcelId) ?? 1
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
}
