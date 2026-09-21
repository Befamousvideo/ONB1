-- 0016_staff_work_phone.sql
-- Durable staff identity: required work phone + conversation columns the API persists.

BEGIN;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS work_phone text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_location text;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_name text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_email text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE conversations ALTER COLUMN mode SET DEFAULT 'staff';

ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS payload jsonb;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_contacts_work_phone ON contacts(work_phone);
CREATE INDEX IF NOT EXISTS idx_intake_briefs_conversation_id ON intake_briefs(conversation_id);

COMMIT;
