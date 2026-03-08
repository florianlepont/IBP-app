CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'contributor',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Contributor',
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  site_name TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  region_version TEXT,
  vegetation_stage TEXT,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  sync_version INTEGER NOT NULL,
  last_sync_error TEXT,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_surveys_status CHECK (status IN ('draft','submitted','synced','error','expired')),
  CONSTRAINT chk_surveys_visibility CHECK (visibility IN ('private','public'))
);

CREATE INDEX IF NOT EXISTS idx_surveys_user_updated ON surveys(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_user_status ON surveys(user_id, status);

CREATE TABLE IF NOT EXISTS survey_events (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  actor_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_events_survey ON survey_events(survey_id, created_at DESC);

-- Forward-compatible patch for existing databases created before password hardening.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
