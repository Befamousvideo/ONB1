BEGIN;

-- conversations: required by main.py SELECT/INSERT/UPDATE
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'WELCOME';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS normalized_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS slack_posted_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS slack_post_id TEXT;

-- intake_briefs: required by persist_intake_brief()
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS scheduling_option TEXT;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS booking_url TEXT;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS preferred_times JSONB;
ALTER TABLE intake_briefs ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMIT;
