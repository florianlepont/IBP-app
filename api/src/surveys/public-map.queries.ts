// SQL of the two public map routes (D-13), shared by PublicMapService, the EXPLAIN script
// (scripts/explain-public-routes.js, through the compiled dist copy) and the EXPLAIN spec.
//
// Both routes are unauthenticated, so every query keeps the public predicate
// status = 'submitted' AND visibility = 'public' AND deleted_at IS NULL (T-01.7-42).

/**
 * The predicate of idx_surveys_public_submitted (migration 015), spelled the way the index
 * spells it: the planner only matches a partial index when the query implies its predicate.
 */
const PUBLIC_SURVEY_PREDICATE = `s.status = 'submitted' AND s.visibility = 'public' AND s.deleted_at IS NULL`

/** Rows per /public/map-items answer, unchanged since before 01.7. */
export const PUBLIC_MAP_ITEMS_LIMIT = 500

/** Rows per /public/parcels/status answer on the database path, unchanged since before 01.7. */
export const PUBLIC_PARCEL_STATUSES_LIMIT = 1000

export type PublicMapItemsFilters = {
  /** YYYY-MM-DD, already validated by normalizeDateInput. */
  from?: string | null
  /** YYYY-MM-DD, already validated by normalizeDateInput. */
  to?: string | null
  /** Trimmed, non-empty region code. */
  region?: string | null
}

/**
 * /public/map-items (D-13, RESEARCH Pattern 6 and Pitfall 12).
 *
 * Before 01.7 the query joined survey_parcels and parcels to every public survey, grouped by
 * survey and only then kept the latest 500: at 10 000 surveys (2 000 public) that meant a Seq
 * Scan on surveys and on survey_parcels plus a HashAggregate over all 2 000 surveys (23.6 ms).
 * The partial index alone still left the Seq Scan on survey_parcels (18.9 ms), because the
 * aggregate ran before the LIMIT.
 *
 * Limit first: the inner query walks idx_surveys_public_submitted (submitted_at DESC) and
 * stops after 500 rows; the LATERAL aggregate then reads the 1-3 links of each of those
 * surveys through survey_parcels_pkey and the parcels unique index (5.0 ms, no seq scan).
 * The averages read the generated centroid columns instead of casting the JSON per row.
 *
 * Optional filters are appended in the same order as before (from, to, region), so the
 * parameter list is unchanged.
 */
export function buildPublicMapItemsQuery(filters: PublicMapItemsFilters = {}): {
  text: string
  values: unknown[]
} {
  const conditions: string[] = [PUBLIC_SURVEY_PREDICATE, `s.submitted_at IS NOT NULL`]
  const values: unknown[] = []

  if (filters.from) {
    values.push(filters.from)
    conditions.push(`s.submitted_at::date >= $${values.length}::date`)
  }
  if (filters.to) {
    values.push(filters.to)
    conditions.push(`s.submitted_at::date <= $${values.length}::date`)
  }
  if (filters.region) {
    values.push(filters.region)
    conditions.push(`s.region_version = $${values.length}`)
  }

  const text = `SELECT
   s.id,
   s.region_version,
   s.scores,
   s.submitted_at::text,
   agg.parcel_centroid_lat,
   agg.parcel_centroid_lng
 FROM (
   SELECT s.id, s.region_version, s.scores, s.submitted_at
   FROM surveys s
   WHERE ${conditions.join("\n     AND ")}
   ORDER BY s.submitted_at DESC
   LIMIT ${PUBLIC_MAP_ITEMS_LIMIT}
 ) s
 LEFT JOIN LATERAL (
   SELECT
     AVG(p.centroid_lat) AS parcel_centroid_lat,
     AVG(p.centroid_lng) AS parcel_centroid_lng
   FROM survey_parcels sp
   JOIN parcels p
     ON p.parcel_id = sp.parcel_id
   WHERE sp.survey_id = s.id
 ) agg ON true
 ORDER BY s.submitted_at DESC`

  return { text, values }
}

/**
 * The latest public submitted survey of parcel p, ranked as before 01.7 (year, then version,
 * then submission time). $1 is the optional observation year ceiling. Used by the LATERAL
 * joins below: one probe of idx_survey_parcels_parcel_id per parcel, instead of a
 * ROW_NUMBER() window over every public survey of the country.
 */
const LATEST_PUBLIC_SURVEY_OF_PARCEL = `SELECT
     s.id,
     s.observation_year,
     s.scores
   FROM survey_parcels sp
   JOIN surveys s
     ON s.id = sp.survey_id
   WHERE sp.parcel_id = p.parcel_id
     AND ${PUBLIC_SURVEY_PREDICATE}
     AND ($1::integer IS NULL OR s.observation_year IS NULL OR s.observation_year <= $1::integer)
   ORDER BY s.observation_year DESC NULLS LAST, s.version_number DESC NULLS LAST, s.submitted_at DESC NULLS LAST
   LIMIT 1`

const PARCEL_STATUS_COLUMNS = `p.parcel_id,
   p.geometry,
   p.centroid,
   CASE WHEN lp.id IS NULL THEN 'not_studied' ELSE 'studied' END AS study_status,
   lp.id AS latest_submitted_survey_id,
   lp.observation_year AS latest_observation_year,
   (lp.scores ->> 'ibp_total')::integer AS latest_ibp_total`

/**
 * /public/parcels/status, database path with a bbox (D-13, RESEARCH Pattern 6).
 * $1 year ceiling or NULL, $2 minLng, $3 maxLng, $4 minLat, $5 maxLat (the pre-01.7 order).
 *
 * Before 01.7 the bbox was a JSON cast on every parcel row (Seq Scan on parcels) and the
 * latest survey came from a window over all public surveys. Now the bbox is a range on the
 * generated centroid_lat / centroid_lng columns (Bitmap Index Scan on
 * idx_parcels_centroid_lat_lng), the 1000 first parcels are kept, and only those get a
 * LATERAL latest-survey probe (1.6 ms at 10 000 surveys, no seq scan).
 *
 * A parcel whose centroid is not a number now has NULL generated columns and falls outside
 * every bbox; before 01.7 such a row made the whole query fail with a cast error.
 */
export const PUBLIC_PARCEL_STATUSES_BBOX_SQL = `SELECT
   ${PARCEL_STATUS_COLUMNS}
 FROM (
   SELECT p.parcel_id, p.geometry, p.centroid
   FROM parcels p
   WHERE p.centroid_lng BETWEEN $2::double precision AND $3::double precision
     AND p.centroid_lat BETWEEN $4::double precision AND $5::double precision
   ORDER BY p.parcel_id ASC
   LIMIT ${PUBLIC_PARCEL_STATUSES_LIMIT}
 ) p
 LEFT JOIN LATERAL (
   ${LATEST_PUBLIC_SURVEY_OF_PARCEL}
 ) lp ON true
 ORDER BY p.parcel_id ASC`

/**
 * /public/parcels/status, database path without a bbox: the first 1000 parcels by id (the
 * parcels unique index), each with its LATERAL latest-survey probe. $1 year ceiling or NULL.
 */
export const PUBLIC_PARCEL_STATUSES_SQL = `SELECT
   ${PARCEL_STATUS_COLUMNS}
 FROM (
   SELECT p.parcel_id, p.geometry, p.centroid
   FROM parcels p
   ORDER BY p.parcel_id ASC
   LIMIT ${PUBLIC_PARCEL_STATUSES_LIMIT}
 ) p
 LEFT JOIN LATERAL (
   ${LATEST_PUBLIC_SURVEY_OF_PARCEL}
 ) lp ON true
 ORDER BY p.parcel_id ASC`

/**
 * Study status for IGN features (D-08 / D-13): the latest public survey of every studied
 * parcel in the features' communes. $1 year ceiling or NULL, $2 commune codes (text[]).
 * Not bounded by centroid on purpose: parcels registered by id have an empty centroid and
 * would lose their "studied" flag (RESEARCH Pattern 7). Parcels without a public survey are
 * dropped by the inner LATERAL join.
 */
export const PUBLIC_STUDIED_BY_COMMUNES_SQL = `SELECT
   p.commune_code,
   p.section,
   p.number,
   lp.id::text AS latest_submitted_survey_id,
   lp.observation_year AS latest_observation_year,
   (lp.scores ->> 'ibp_total')::integer AS latest_ibp_total
 FROM parcels p
 JOIN LATERAL (
   ${LATEST_PUBLIC_SURVEY_OF_PARCEL}
 ) lp ON true
 WHERE p.commune_code = ANY($2::text[])`
