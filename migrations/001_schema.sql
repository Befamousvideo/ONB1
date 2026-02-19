-- 001_schema.sql  –  Core tables, constraints, indexes
PRAGMA foreign_keys = ON;

------------------------------------------------------------------------
-- accounts
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    timezone    TEXT NOT NULL DEFAULT 'UTC',
    currency    TEXT NOT NULL DEFAULT 'USD',
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended','closed')),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

------------------------------------------------------------------------
-- contacts
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id          TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL REFERENCES accounts(id),
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    role        TEXT,
    is_primary  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE (account_id, email)
);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);

------------------------------------------------------------------------
-- projects
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id                  TEXT PRIMARY KEY,
    account_id          TEXT NOT NULL REFERENCES accounts(id),
    primary_contact_id  TEXT REFERENCES contacts(id),
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft','active','on_hold','completed','cancelled')),
    budget_cents        INTEGER,
    start_date          TEXT,
    end_date            TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_account ON projects(account_id);

------------------------------------------------------------------------
-- conversations
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id),
    project_id      TEXT REFERENCES projects(id),
    contact_id      TEXT REFERENCES contacts(id),
    channel         TEXT NOT NULL DEFAULT 'email'
                    CHECK (channel IN ('email','sms','chat','phone','portal')),
    subject         TEXT,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','closed','archived')),
    last_message_at TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);

------------------------------------------------------------------------
-- messages
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id                  TEXT PRIMARY KEY,
    conversation_id     TEXT NOT NULL REFERENCES conversations(id),
    sender_type         TEXT NOT NULL CHECK (sender_type IN ('client','agent','system')),
    sender_contact_id   TEXT REFERENCES contacts(id),
    body                TEXT NOT NULL,
    sent_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

------------------------------------------------------------------------
-- intake_briefs
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intake_briefs (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES accounts(id),
    project_id              TEXT REFERENCES projects(id),
    submitted_by_contact_id TEXT REFERENCES contacts(id),
    title                   TEXT NOT NULL,
    problem_statement       TEXT,
    goals                   TEXT,
    requirements            TEXT,
    timeline_expectation    TEXT,
    budget_min_cents        INTEGER,
    budget_max_cents        INTEGER,
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','submitted','reviewed','accepted','rejected')),
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_intake_briefs_account ON intake_briefs(account_id);

------------------------------------------------------------------------
-- requests
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES accounts(id),
    project_id              TEXT REFERENCES projects(id),
    requested_by_contact_id TEXT REFERENCES contacts(id),
    title                   TEXT NOT NULL,
    description             TEXT,
    priority                TEXT NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low','medium','high','urgent')),
    status                  TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','in_progress','approved','completed','cancelled')),
    due_date                TEXT,
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_requests_account ON requests(account_id);

------------------------------------------------------------------------
-- estimates
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimates (
    id          TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL REFERENCES accounts(id),
    project_id  TEXT REFERENCES projects(id),
    request_id  TEXT REFERENCES requests(id),
    version     INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','accepted','rejected','expired')),
    total_cents INTEGER NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'USD',
    valid_until TEXT,
    sent_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE (project_id, version)
);
CREATE INDEX IF NOT EXISTS idx_estimates_account ON estimates(account_id);

------------------------------------------------------------------------
-- invoices
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL REFERENCES accounts(id),
    project_id      TEXT REFERENCES projects(id),
    estimate_id     TEXT REFERENCES estimates(id),
    invoice_number  TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','issued','paid','overdue','cancelled','void')),
    subtotal_cents  INTEGER NOT NULL,
    tax_cents       INTEGER NOT NULL DEFAULT 0,
    total_cents     INTEGER NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'USD',
    issued_at       TEXT,
    due_at          TEXT,
    paid_at         TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id);

------------------------------------------------------------------------
-- approvals
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL REFERENCES accounts(id),
    project_id              TEXT REFERENCES projects(id),
    estimate_id             TEXT REFERENCES estimates(id),
    invoice_id              TEXT REFERENCES invoices(id),
    approved_by_contact_id  TEXT NOT NULL REFERENCES contacts(id),
    status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected')),
    decision_note           TEXT,
    decided_at              TEXT,
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    CHECK (estimate_id IS NOT NULL OR invoice_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_approvals_account ON approvals(account_id);
