-- 0004_intake_scheduling.sql
-- Add scheduling preference fields to intake briefs

BEGIN;

ALTER TABLE intake_briefs
  ADD COLUMN IF NOT EXISTS scheduling_option text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS preferred_times jsonb,
  ADD COLUMN IF NOT EXISTS timezone text;

COMMIT;
