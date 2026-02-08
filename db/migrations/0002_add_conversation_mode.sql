ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'prospect';
