-- 0004_intake_scheduling.sql
-- Add scheduling preference fields to intake briefs

BEGIN;

ALTER TABLE intake_briefs
  ADD COLUMN scheduling_option text,
  ADD COLUMN booking_url text,
  ADD COLUMN preferred_times text,
  ADD COLUMN timezone text;

COMMIT;
