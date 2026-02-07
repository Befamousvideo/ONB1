# ONB1

Living spec for the ONB1 repository. This file is mandatory for architectural and structural changes.

## Purpose
Provide a clear, evolving specification for the ONB1 system before implementation begins.

## Architecture Overview
- Front-end: Next.js (TypeScript) SPA/SSR application.
- Backend API: FastAPI (Python) providing REST endpoints.
- Database: PostgreSQL (schema defined in `db/migrations/0001_init.sql`).
- Integration: Front-end calls the API over HTTP; OpenAPI spec maintained in `openapi.yaml`.

## Chosen Stack
- Front-end: Next.js + React + TypeScript
- Backend: FastAPI (Python)
- API contract: OpenAPI 3.0 (`/openapi.yaml`)
- Tooling: GitHub Actions for docs discipline

## Folder Structure
- `web/` Next.js front-end
- `server/` FastAPI backend
- `db/` database artifacts and migrations
- `docs/` documentation and decision records
- `openapi.yaml` API contract stub

## Database Schema (Initial)
- `accounts`: id, name, status, created_at, updated_at
- `contacts`: id, account_id, full_name, email, phone, role, created_at, updated_at
- `conversations`: id, account_id, contact_id, channel, subject, created_at
- `messages`: id, conversation_id, sender_type, sender_contact_id, body, created_at
- `projects`: id, account_id, name, status, start_date, end_date, created_at, updated_at
- `intake_briefs`: id, account_id, project_id, summary, goals, constraints, created_at
- `requests`: id, project_id, requester_contact_id, title, description, status, created_at, updated_at
- `estimates`: id, request_id, amount_cents, currency, status, expires_at, created_at, updated_at
- `invoices`: id, project_id, estimate_id, amount_cents, currency, status, due_date, paid_at, created_at, updated_at
- `approvals`: id, estimate_id, approver_contact_id, status, approved_at, created_at

## Documentation Discipline
- Any changes under `server/` or `db/` must include an update to `ONB1.md`.
- Architectural decisions are recorded in `docs/decisions.md`.

## API Contract
- `POST /api/conversations`: Create a conversation with optional intake brief.
- `POST /api/conversations/{id}/message`: Append a message to a conversation.
- `POST /api/conversations/{id}/end-and-send`: Close a conversation and emit final output.
- `POST /api/uploads/presign`: Return a presigned upload link for client uploads.
- `POST /api/handoff/slack` (internal): Send a conversation summary to Slack.

## State Machine (Prospect Mode)
States: `WELCOME → MODE_SELECT → IDENTITY → BUSINESS_CONTEXT → NEEDS → SCHEDULING(optional) → SUMMARY → SUBMIT`.

Required fields by state (submitted via message `fields`):
- MODE_SELECT: `mode`
- IDENTITY: `full_name`, `email`
- BUSINESS_CONTEXT: `business_name`
- NEEDS: `needs_summary` (can set `skip_scheduling=true`)
- SCHEDULING: `preferred_times`
- SUMMARY: `summary`

End & Send Now:
- `POST /api/conversations/{id}/end-and-send` forces `SUBMIT` from any state and stores the summary.

## Slack Handoff (Prospect Brief)
Trigger:
- On normal `SUBMIT` transition.
- On `End & Send Now`.

Message format:
- Header: `Prospect Intake`
- Contact: `full_name` (+ email if present)
- Company: `business_name`
- Summary bullets (if present): `needs_summary`, `urgency`, `budget_band`, `summary`
- Preferences (if present): `preferred_contact_channel`, `preferred_times`
- Admin link: `{ADMIN_BASE_URL}/conversations/{conversation_id}`

Reliability:
- Retries up to 3 attempts with backoff.
- Idempotent: only one Slack post per conversation (tracked in DB).

## Changelog
- 2026-02-07: Added local Postgres dev environment (Docker Compose), migration/seed scripts, and db README steps.
- 2026-02-07: Defined OpenAPI contract v1 and added backend route stubs.
- 2026-02-07: Added prospect state machine v1, DB storage for state/fields, and state machine docs.
- 2026-02-07: Added git status/log/push helper script under scripts/.
- 2026-02-07: Added Slack handoff posting for prospect intake submissions.
