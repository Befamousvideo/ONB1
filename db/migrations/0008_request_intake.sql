-- 0008_request_intake.sql
-- Extend requests for client intake + Slack thread

BEGIN;

ALTER TABLE requests
  ADD COLUMN request_type text,
  ADD COLUMN impact text,
  ADD COLUMN urgency text,
  ADD COLUMN slack_channel text,
  ADD COLUMN slack_ts text;

COMMIT;
