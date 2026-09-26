-- Migration 015: Public-route indexes, generated centroid columns, index cleanup (D-13)
-- The public map and parcel-status queries get a partial index on public submitted surveys and
-- btree-indexed centroid_lat/centroid_lng; a nested CASE turns bad centroids into NULL so one
-- bad row cannot abort the deploy. No PostGIS: generated columns plus btree, owner decision.
-- Runs inside the runner's BEGIN/COMMIT, so no CREATE INDEX CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_surveys_public_submitted
  ON surveys (submitted_at DESC)
  WHERE status = 'submitted' AND visibility = 'public' AND deleted_at IS NULL;

-- Only CASE orders evaluation before the cast. The regex has no exponent and at most 3 integer
-- digits, so every matching string casts to double precision without overflow.
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS centroid_lat double precision GENERATED ALWAYS AS (
    CASE WHEN (centroid ->> 'lat') ~ '^\s*-?[0-9]{1,3}(\.[0-9]{1,30})?\s*$'
      THEN CASE WHEN (centroid ->> 'lat')::double precision BETWEEN -90 AND 90
                THEN (centroid ->> 'lat')::double precision END
    END) STORED,
  ADD COLUMN IF NOT EXISTS centroid_lng double precision GENERATED ALWAYS AS (
    CASE WHEN (centroid ->> 'lng') ~ '^\s*-?[0-9]{1,3}(\.[0-9]{1,30})?\s*$'
      THEN CASE WHEN (centroid ->> 'lng')::double precision BETWEEN -180 AND 180
                THEN (centroid ->> 'lng')::double precision END
    END) STORED;
CREATE INDEX IF NOT EXISTS idx_parcels_centroid_lat_lng ON parcels (centroid_lat, centroid_lng);

CREATE INDEX IF NOT EXISTS idx_survey_events_actor_id
  ON survey_events (actor_id) WHERE actor_id IS NOT NULL;

-- Unfiltered GET /reports keyset order; idx_reports_status_created only serves the status filter.
CREATE INDEX IF NOT EXISTS idx_reports_created_id ON reports (created_at DESC, id DESC);

DROP INDEX IF EXISTS idx_users_auth0_sub;          -- duplicate of UNIQUE users_auth0_sub_key
DROP INDEX IF EXISTS idx_surveys_parcel_id;        -- prefix of idx_surveys_parcel_year_version
DROP INDEX IF EXISTS idx_survey_parcels_survey_id; -- prefix of survey_parcels_pkey (survey_id, parcel_id)

DROP TABLE IF EXISTS auth_sessions CASCADE;        -- already dropped by 011; idempotent safety
