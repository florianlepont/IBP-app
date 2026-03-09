ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS factor_results JSONB NOT NULL DEFAULT '{}'::jsonb;
