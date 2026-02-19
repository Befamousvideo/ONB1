# ONB1 Database Contract

This project defines a SQLite-first database contract using SQL migrations in `migrations/` and a lightweight migration runner in `scripts/migrate.sh`.

## Migration files

- **001_schema.sql**: Creates all core tables, constraints, and indexes.
- **002_seed_demo.sql**: Inserts a demo account, contacts, project, and related records.

## Tables and key fields

### accounts
- id (PK)
- name
- email (unique)
- timezone, currency, status
- created_at, updated_at

### contacts
- id (PK)
- account_id (FK → accounts.id)
- first_name, last_name, email
- phone, role, is_primary
- Unique on (account_id, email)

### projects
- id (PK)
- account_id (FK → accounts.id)
- primary_contact_id (FK → contacts.id)
- name, description, status
- budget_cents, start_date, end_date

### conversations
- id (PK)
- account_id (FK → accounts.id)
- project_id (FK → projects.id)
- contact_id (FK → contacts.id)
- channel, subject, status, last_message_at

### messages
- id (PK)
- conversation_id (FK → conversations.id)
- sender_type, sender_contact_id (FK → contacts.id)
- body, sent_at

### intake_briefs
- id (PK)
- account_id (FK → accounts.id)
- project_id (FK → projects.id)
- submitted_by_contact_id (FK → contacts.id)
- title, problem_statement, goals, requirements
- timeline_expectation, budget_min_cents, budget_max_cents, status

### requests
- id (PK)
- account_id (FK → accounts.id)
- project_id (FK → projects.id)
- requested_by_contact_id (FK → contacts.id)
- title, description, priority, status, due_date

### estimates
- id (PK)
- account_id (FK → accounts.id)
- project_id (FK → projects.id)
- request_id (FK → requests.id)
- version (unique within project), status
- total_cents, currency, valid_until, sent_at

### invoices
- id (PK)
- account_id (FK → accounts.id)
- project_id (FK → projects.id)
- estimate_id (FK → estimates.id)
- invoice_number (unique)
- status, subtotal_cents, tax_cents, total_cents, currency
- issued_at, due_at, paid_at

### approvals
- id (PK)
- account_id (FK → accounts.id)
- project_id (FK → projects.id)
- estimate_id (FK → estimates.id, optional)
- invoice_id (FK → invoices.id, optional)
- approved_by_contact_id (FK → contacts.id)
- status, decision_note, decided_at
- Check constraint requiring at least one of estimate_id or invoice_id

## Seed data

002_seed_demo.sql inserts:
- 1 demo account (acct_demo)
- 2 contacts
- 1 active project
- 1 intake brief
- 1 conversation + 2 messages
- 1 approved request
- 1 accepted estimate
- 1 issued invoice
- 1 approval record

## Run migrations

```bash
./scripts/migrate.sh
```

Optional custom DB path:

```bash
./scripts/migrate.sh db/my_custom.sqlite
```
