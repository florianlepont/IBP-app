CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  captured_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_attachments_survey_created
  ON attachments(survey_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attachments_survey_active
  ON attachments(survey_id)
  WHERE deleted_at IS NULL;
