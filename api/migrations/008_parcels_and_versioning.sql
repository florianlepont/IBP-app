CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY,
  parcel_id TEXT NOT NULL UNIQUE,
  commune_code TEXT NOT NULL,
  section TEXT NOT NULL,
  number TEXT NOT NULL,
  geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  centroid JSONB NOT NULL DEFAULT '{}'::jsonb,
  area_m2 DOUBLE PRECISION,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS parcel_id TEXT,
  ADD COLUMN IF NOT EXISTS observation_year INTEGER,
  ADD COLUMN IF NOT EXISTS version_number INTEGER,
  ADD COLUMN IF NOT EXISTS previous_survey_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_surveys_observation_year_range'
      AND conrelid = 'surveys'::regclass
  ) THEN
    ALTER TABLE surveys
      ADD CONSTRAINT chk_surveys_observation_year_range
      CHECK (observation_year IS NULL OR observation_year BETWEEN 1900 AND 2200);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_surveys_version_number_positive'
      AND conrelid = 'surveys'::regclass
  ) THEN
    ALTER TABLE surveys
      ADD CONSTRAINT chk_surveys_version_number_positive
      CHECK (version_number IS NULL OR version_number >= 1);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_surveys_parcel_id ON surveys(parcel_id);
CREATE INDEX IF NOT EXISTS idx_surveys_parcel_year_version ON surveys(parcel_id, observation_year, version_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_surveys_submitted_parcel_version_unique
  ON surveys(parcel_id, observation_year, version_number)
  WHERE deleted_at IS NULL
    AND status = 'submitted'
    AND parcel_id IS NOT NULL
    AND observation_year IS NOT NULL
    AND version_number IS NOT NULL;
