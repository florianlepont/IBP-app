-- Migration 013: Stop exposing the reporter to the reported survey's owner (A-M6)
-- Scrub actor_id and reason from existing 'reported' survey_events rows; the reporter
-- identity and reason remain in the access-controlled `reports` table.
UPDATE survey_events SET actor_id = NULL, payload = COALESCE(payload, '{}'::jsonb) - 'reason' - 'actor_id' WHERE event_type = 'reported';
