PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    timezone    TEXT NOT NULL DEFAULT 'UTC',
    currency    TEXT NOT NULL DEFAULT 'USD',
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contacts (
    id          TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    role        TEXT,
    is_primary  INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE (account_id, email)
);

CREATE TABLE projects (
    id                  TEXT PRIMARY KEY,
    account_id          TEXT NOT NULL,
    primary_contact_id  TEXT,
    name                TEXT NOT NULL,
    description         TEXT,
    status              TEXT NOT NULL DEFAULT 'planning'
                        CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    budget_cents        INTEGER CHECK (budget_cents >= 0),
    start_date          TEXT,
    end_date            TEXT,
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (primary_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE conversations (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    project_id      TEXT,
    contact_id      TEXT,
    channel         TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'in_app')),
    subject         TEXT,
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed', 'archived')),
    last_message_at TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE messages (
    id                  TEXT PRIMARY KEY,
    conversation_id     TEXT NOT NULL,
    sender_type         TEXT NOT NULL CHECK (sender_type IN ('account_user', 'contact', 'system')),
    sender_contact_id   TEXT,
    body                TEXT NOT NULL,
    sent_at             TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE intake_briefs (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL,
    project_id              TEXT,
    submitted_by_contact_id TEXT,
    title                   TEXT NOT NULL,
    problem_statement       TEXT,
    goals                   TEXT,
    requirements            TEXT,
    timeline_expectation    TEXT,
    budget_min_cents        INTEGER CHECK (budget_min_cents >= 0),
    budget_max_cents        INTEGER CHECK (budget_max_cents >= budget_min_cents),
    status                  TEXT NOT NULL DEFAULT 'submitted'
                            CHECK (status IN ('draft', 'submitted', 'reviewed', 'accepted', 'rejected')),
    submitted_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (submitted_by_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE requests (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL,
    project_id              TEXT NOT NULL,
    requested_by_contact_id TEXT,
    title                   TEXT NOT NULL,
    description             TEXT,
    priority                TEXT NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status                  TEXT NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'in_review', 'approved', 'rejected', 'fulfilled')),
    due_date                TEXT,
    created_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE estimates (
    id          TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL,
    project_id  TEXT NOT NULL,
    request_id  TEXT,
    version     INTEGER NOT NULL DEFAULT 1,
    status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'accepted', 'expired', 'rejected')),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    currency    TEXT NOT NULL DEFAULT 'USD',
    valid_until TEXT,
    sent_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL,
    UNIQUE (project_id, version)
);

CREATE TABLE invoices (
    id              TEXT PRIMARY KEY,
    account_id      TEXT NOT NULL,
    project_id      TEXT NOT NULL,
    estimate_id     TEXT,
    invoice_number  TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'issued', 'paid', 'void', 'overdue')),
    subtotal_cents  INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents       INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
    currency        TEXT NOT NULL DEFAULT 'USD',
    issued_at       TEXT,
    due_at          TEXT,
    paid_at         TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE SET NULL
);

CREATE TABLE approvals (
    id                      TEXT PRIMARY KEY,
    account_id              TEXT NOT NULL,
    project_id              TEXT NOT NULL,
    estimate_id             TEXT,
    invoice_id              TEXT,
    approved_by_contact_id  TEXT,
    status                  TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    decision_note           TEXT,
    decided_at              TEXT,
    created_at              TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    CHECK (estimate_id IS NOT NULL OR invoice_id IS NOT NULL)
);

CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_conversations_account_project ON conversations(account_id, project_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_intake_briefs_account_project ON intake_briefs(account_id, project_id);
CREATE INDEX idx_requests_project_status ON requests(project_id, status);
CREATE INDEX idx_estimates_project_status ON estimates(project_id, status);
CREATE INDEX idx_invoices_project_status ON invoices(project_id, status);
CREATE INDEX idx_approvals_project_status ON approvals(project_id, status);

COMMIT;
