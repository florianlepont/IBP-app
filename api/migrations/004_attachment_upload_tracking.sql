ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS upload_token TEXT;

UPDATE attachments
SET upload_token = id
WHERE upload_token IS NULL;

ALTER TABLE attachments
  ALTER COLUMN upload_token SET NOT NULL;

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
