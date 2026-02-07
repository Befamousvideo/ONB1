-- 0003_slack_handoff.sql
-- Track Slack handoff status for conversations

BEGIN;

ALTER TABLE conversations
  ADD COLUMN slack_posted_at timestamptz,
  ADD COLUMN slack_post_id text;

COMMIT;
