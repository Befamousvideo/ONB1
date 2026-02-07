-- 0005_attachments.sql
-- Store uploaded file metadata

BEGIN;

CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  intake_brief_id uuid REFERENCES intake_briefs(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text NOT NULL,
  storage_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_conversation_id ON attachments(conversation_id);
CREATE INDEX idx_attachments_intake_brief_id ON attachments(intake_brief_id);

COMMIT;
