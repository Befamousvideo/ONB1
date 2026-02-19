PRAGMA foreign_keys = ON;

BEGIN;

INSERT INTO accounts (id, name, email, timezone, currency, status)
VALUES ('acct_demo', 'Demo Account', 'demo@onb1.local', 'America/New_York', 'USD', 'active');

INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, role, is_primary)
VALUES
  ('contact_amy', 'acct_demo', 'Amy', 'Anderson', 'amy@clientco.com', '+1-212-555-0100', 'Owner', 1),
  ('contact_ben', 'acct_demo', 'Ben', 'Brown',    'ben@clientco.com', '+1-212-555-0101', 'Operations', 0);

INSERT INTO projects (id, account_id, primary_contact_id, name, description, status, budget_cents, start_date)
VALUES (
  'proj_demo_rebrand', 'acct_demo', 'contact_amy',
  'ClientCo Website Rebrand',
  'End-to-end redesign and launch of the marketing site.',
  'active', 750000, '2026-01-15'
);

INSERT INTO intake_briefs (
  id, account_id, project_id, submitted_by_contact_id,
  title, problem_statement, goals, requirements,
  timeline_expectation, budget_min_cents, budget_max_cents, status
) VALUES (
  'brief_demo', 'acct_demo', 'proj_demo_rebrand', 'contact_amy',
  'Website Rebrand Brief',
  'Current website does not reflect the new positioning and has low conversion.',
  'Modernize brand presentation and improve lead conversion by 20%.',
  'New design system, CMS migration, and analytics instrumentation.',
  'Launch by end of Q2.', 500000, 900000, 'submitted'
);

INSERT INTO conversations (id, account_id, project_id, contact_id, channel, subject, status, last_message_at)
VALUES (
  'conv_kickoff', 'acct_demo', 'proj_demo_rebrand', 'contact_amy',
  'email', 'Kickoff logistics', 'open', CURRENT_TIMESTAMP
);

INSERT INTO messages (id, conversation_id, sender_type, sender_contact_id, body)
VALUES
  ('msg_1', 'conv_kickoff', 'contact',      'contact_amy', 'Excited to kick this off next week.'),
  ('msg_2', 'conv_kickoff', 'account_user', NULL,          'Great—sharing agenda and milestones by EOD.');

INSERT INTO requests (
  id, account_id, project_id, requested_by_contact_id,
  title, description, priority, status, due_date
) VALUES (
  'req_homepage_redesign', 'acct_demo', 'proj_demo_rebrand', 'contact_ben',
  'Homepage redesign',
  'Create responsive homepage concepts with new messaging hierarchy.',
  'high', 'approved', '2026-02-10'
);

INSERT INTO estimates (
  id, account_id, project_id, request_id, version,
  status, total_cents, currency, valid_until, sent_at
) VALUES (
  'est_demo_v1', 'acct_demo', 'proj_demo_rebrand', 'req_homepage_redesign',
  1, 'accepted', 220000, 'USD', '2026-02-20', '2026-01-25'
);

INSERT INTO invoices (
  id, account_id, project_id, estimate_id, invoice_number,
  status, subtotal_cents, tax_cents, total_cents, currency, issued_at, due_at
) VALUES (
  'inv_demo_001', 'acct_demo', 'proj_demo_rebrand', 'est_demo_v1',
  'INV-2026-001', 'issued', 220000, 17600, 237600, 'USD', '2026-01-26', '2026-02-25'
);

INSERT INTO approvals (
  id, account_id, project_id, estimate_id, invoice_id,
  approved_by_contact_id, status, decision_note, decided_at
) VALUES (
  'apr_estimate_demo', 'acct_demo', 'proj_demo_rebrand', 'est_demo_v1', NULL,
  'contact_amy', 'approved', 'Approved to proceed with implementation.', '2026-01-27'
);

COMMIT;
