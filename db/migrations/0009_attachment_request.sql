-- 0009_attachment_request.sql
-- Allow attachments for client requests

BEGIN;

ALTER TABLE attachments
  ALTER COLUMN conversation_id DROP NOT NULL,
  ADD COLUMN request_id uuid REFERENCES requests(id) ON DELETE CASCADE;

CREATE INDEX idx_attachments_request_id ON attachments(request_id);

COMMIT;
