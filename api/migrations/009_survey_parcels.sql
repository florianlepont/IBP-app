CREATE TABLE IF NOT EXISTS survey_parcels (
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  parcel_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (survey_id, parcel_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_parcels_parcel_id
  ON survey_parcels(parcel_id);

CREATE INDEX IF NOT EXISTS idx_survey_parcels_survey_id
  ON survey_parcels(survey_id);

INSERT INTO survey_parcels (survey_id, parcel_id)
SELECT s.id, s.parcel_id
FROM surveys s
WHERE s.parcel_id IS NOT NULL
ON CONFLICT (survey_id, parcel_id) DO NOTHING;
