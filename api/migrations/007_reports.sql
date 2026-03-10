CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_reports_status CHECK (status IN ('open', 'reviewed')),
  CONSTRAINT chk_reports_reason_non_empty CHECK (char_length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_survey
  ON reports(survey_id);

CREATE INDEX IF NOT EXISTS idx_reports_reporter
  ON reports(reporter_user_id, created_at DESC);
