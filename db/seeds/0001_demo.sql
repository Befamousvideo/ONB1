-- 0001_demo.sql
-- Demo seed data for ONB1

BEGIN;

INSERT INTO accounts (id, name, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Account', 'active');

INSERT INTO contacts (id, account_id, full_name, email, phone, role)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Jamie Rivera', 'jamie@demo.local', '555-0100', 'owner');

INSERT INTO projects (id, account_id, name, status, start_date)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Demo Project', 'active', CURRENT_DATE);

INSERT INTO intake_briefs (id, account_id, project_id, summary, goals, constraints)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'Initial demo intake for the project.',
  'Ship a minimal viable demo.',
  'Keep scope tight.'
);

INSERT INTO conversations (id, account_id, contact_id, channel, subject)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'email', 'Kickoff');

INSERT INTO messages (id, conversation_id, sender_type, sender_contact_id, body)
VALUES ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'contact', '22222222-2222-2222-2222-222222222222', 'Excited to get started.');

INSERT INTO requests (id, project_id, requester_contact_id, title, description, status)
VALUES (
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'Discovery Sprint',
  'Define scope and timeline.',
  'open'
);

INSERT INTO estimates (id, request_id, amount_cents, currency, status, expires_at)
VALUES (
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777',
  150000,
  'USD',
  'sent',
  CURRENT_DATE + INTERVAL '30 days'
);

INSERT INTO approvals (id, estimate_id, approver_contact_id, status, approved_at)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  '88888888-8888-8888-8888-888888888888',
  '22222222-2222-2222-2222-222222222222',
  'approved',
  now()
);

INSERT INTO invoices (id, project_id, estimate_id, amount_cents, currency, status, due_date)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333',
  '88888888-8888-8888-8888-888888888888',
  150000,
  'USD',
  'issued',
  CURRENT_DATE + INTERVAL '14 days'
);

COMMIT;
