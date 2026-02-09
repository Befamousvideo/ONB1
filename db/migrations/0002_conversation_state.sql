-- 0002_conversation_state.sql
-- Add state machine fields to conversations

BEGIN;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'WELCOME',
  ADD COLUMN IF NOT EXISTS normalized_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS summary text;

COMMIT;
