-- Migration 011: Replace custom auth with Auth0
--
-- Auth0 now handles authentication (passwords, sessions, email verification).
-- We store only the Auth0 subject identifier (auth0_sub) to link Auth0 users to our DB.

-- Add auth0_sub to link our users to Auth0 identities
ALTER TABLE users ADD COLUMN auth0_sub TEXT UNIQUE;
CREATE INDEX idx_users_auth0_sub ON users(auth0_sub);

-- Remove columns now managed by Auth0
ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS email_verification_token,
  DROP COLUMN IF EXISTS email_verification_expires_at,
  DROP COLUMN IF EXISTS pending_email,
  DROP COLUMN IF EXISTS email_change_token,
  DROP COLUMN IF EXISTS email_change_expires_at;

-- Drop custom session table (Auth0 handles sessions)
DROP TABLE IF EXISTS auth_sessions;
