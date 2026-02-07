-- 0002_conversation_state.sql
-- Add state machine fields to conversations

BEGIN;

ALTER TABLE conversations
  ADD COLUMN mode text NOT NULL DEFAULT 'prospect',
  ADD COLUMN state text NOT NULL DEFAULT 'WELCOME',
  ADD COLUMN normalized_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN ended_at timestamptz,
  ADD COLUMN summary text;

COMMIT;
