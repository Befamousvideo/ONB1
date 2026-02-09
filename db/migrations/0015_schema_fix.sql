-- 0015_schema_fix.sql
-- Ensure schema matches API expectations

BEGIN;

-- conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'prospect';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'WELCOME';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS normalized_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS slack_posted_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS slack_post_id text;

-- intake_briefs
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS scheduling_option text;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS preferred_times jsonb;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS timezone text;

-- attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  intake_brief_id uuid REFERENCES intake_briefs(id) ON DELETE SET NULL,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text NOT NULL,
  storage_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE attachments ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES requests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_attachments_intake_brief_id ON attachments(intake_brief_id);
CREATE INDEX IF NOT EXISTS idx_attachments_request_id ON attachments(request_id);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  conversation_id uuid NULL REFERENCES conversations(id) ON DELETE SET NULL,
  request_id uuid NULL REFERENCES requests(id) ON DELETE SET NULL,
  actor_type text NULL,
  actor_id uuid NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id uuid NULL REFERENCES requests(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type text NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id uuid NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_audit_logs_conversation_id ON audit_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);

-- requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_type text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS impact text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS urgency text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS slack_channel text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS slack_ts text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS addon_flag boolean NOT NULL DEFAULT false;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS addon_rationale text;

-- projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- estimate templates
CREATE TABLE IF NOT EXISTS estimate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  line_items jsonb NOT NULL,
  min_total_cents bigint NOT NULL,
  max_total_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider_invoice_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider_invoice_url text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- auth tables
CREATE TABLE IF NOT EXISTS auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);

COMMIT;
