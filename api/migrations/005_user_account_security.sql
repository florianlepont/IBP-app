ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_storage_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_mime_type TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pending_email_unique
  ON users(pending_email)
  WHERE pending_email IS NOT NULL;
