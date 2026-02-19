-- 002_seed_demo.sql  –  Demo data for a complete sample flow
PRAGMA foreign_keys = ON;

-- Account
INSERT INTO accounts (id, name, email, timezone, currency, status)
VALUES ('acct_demo', 'Demo Agency', 'hello@demo-agency.com', 'America/Los_Angeles', 'USD', 'active');

-- Contacts
INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, role, is_primary)
VALUES
  ('ctc_alice', 'acct_demo', 'Alice', 'Johnson', 'alice@clientco.com', '+15551234567', 'CEO', 1),
  ('ctc_bob',   'acct_demo', 'Bob',   'Smith',   'bob@clientco.com',   '+15559876543', 'CTO', 0);

-- Project
INSERT INTO projects (id, account_id, primary_contact_id, name, description, status, budget_cents, start_date, end_date)
VALUES ('proj_web', 'acct_demo', 'ctc_alice', 'Website Redesign', 'Full redesign of corporate site', 'active', 5000000, '2025-01-15', '2025-06-30');

-- Intake brief
INSERT INTO intake_briefs (id, account_id, project_id, submitted_by_contact_id, title, problem_statement, goals, requirements, timeline_expectation, budget_min_cents, budget_max_cents, status)
VALUES ('ib_001', 'acct_demo', 'proj_web', 'ctc_alice', 'Website Redesign Brief',
        'Current site is outdated and slow',
        'Modern look, fast load, mobile-first',
        'Next.js, headless CMS, analytics',
        '6 months', 3000000, 6000000, 'accepted');

-- Conversation + messages
INSERT INTO conversations (id, account_id, project_id, contact_id, channel, subject, status, last_message_at)
VALUES ('conv_001', 'acct_demo', 'proj_web', 'ctc_alice', 'email', 'Kick-off discussion', 'open', '2025-01-16T10:30:00Z');

INSERT INTO messages (id, conversation_id, sender_type, sender_contact_id, body, sent_at)
VALUES
  ('msg_001', 'conv_001', 'client', 'ctc_alice', 'Hi, excited to get started on the redesign!', '2025-01-16T10:00:00Z'),
  ('msg_002', 'conv_001', 'agent',  NULL,         'Welcome Alice! I''ve reviewed the brief — let''s schedule a kick-off call.', '2025-01-16T10:30:00Z');

-- Request
INSERT INTO requests (id, account_id, project_id, requested_by_contact_id, title, description, priority, status, due_date)
VALUES ('req_001', 'acct_demo', 'proj_web', 'ctc_alice', 'Homepage wireframes', 'Need wireframes for new homepage layout', 'high', 'approved', '2025-02-01');

-- Estimate
INSERT INTO estimates (id, account_id, project_id, request_id, version, status, total_cents, currency, valid_until, sent_at)
VALUES ('est_001', 'acct_demo', 'proj_web', 'req_001', 1, 'accepted', 1500000, 'USD', '2025-02-15', '2025-01-20T09:00:00Z');

-- Invoice
INSERT INTO invoices (id, account_id, project_id, estimate_id, invoice_number, status, subtotal_cents, tax_cents, total_cents, currency, issued_at, due_at)
VALUES ('inv_001', 'acct_demo', 'proj_web', 'est_001', 'INV-2025-0001', 'issued', 1500000, 135000, 1635000, 'USD', '2025-01-25T00:00:00Z', '2025-02-25T00:00:00Z');

-- Approval
INSERT INTO approvals (id, account_id, project_id, estimate_id, approved_by_contact_id, status, decision_note, decided_at)
VALUES ('appr_001', 'acct_demo', 'proj_web', 'est_001', 'ctc_alice', 'approved', 'Looks good, let''s proceed.', '2025-01-21T14:00:00Z');
