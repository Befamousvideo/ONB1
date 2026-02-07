-- 0006_audit_logs.sql
-- Audit logging for submission events

BEGIN;

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_conversation_id ON audit_logs(conversation_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);

COMMIT;
