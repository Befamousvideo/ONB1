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
- `conversations`: id, account_id, contact_id, channel, subject, mode, state, normalized_fields, summary, ended_at, slack_posted_at, slack_post_id, created_at
- `messages`: id, conversation_id, sender_type, sender_contact_id, body, created_at
- `projects`: id, account_id, name, status, start_date, end_date, created_at, updated_at
- `intake_briefs`: id, account_id, project_id, summary, goals, constraints, scheduling_option, booking_url, preferred_times, timezone, created_at
- `attachments`: id, conversation_id, intake_brief_id, request_id, file_name, content_type, size_bytes, storage_key, storage_url, created_at
- `auth_codes`: id, account_id, email, code_hash, expires_at, used_at, attempts, created_at
- `auth_sessions`: id, account_id, token, expires_at, created_at
- `audit_logs`: id, event_type, conversation_id, metadata, created_at
- `requests`: id, project_id, requester_contact_id, title, description, status, request_type, impact, urgency, slack_channel, slack_ts, created_at, updated_at
- `estimates`: id, request_id, amount_cents, currency, status, expires_at, created_at, updated_at
- `invoices`: id, project_id, estimate_id, amount_cents, currency, status, due_date, paid_at, created_at, updated_at
- `approvals`: id, estimate_id, approver_contact_id, status, approved_at, created_at

## Documentation Discipline
- Any changes under `server/` or `db/` must include an update to `ONB1.md`.
- Architectural decisions are recorded in `docs/decisions.md`.

## API Contract
- `POST /api/conversations`: Create a conversation with optional intake brief.
- `GET /api/conversations/{id}`: Fetch a conversation (polling helper).
- `POST /api/conversations/{id}/message`: Append a message to a conversation.
- `POST /api/conversations/{id}/end-and-send`: Close a conversation and emit final output.
- `POST /api/uploads/presign`: Return a presigned upload link for client uploads.
- `POST /api/auth/request-otp`: Request a one-time code for existing clients.
- `POST /api/auth/verify-otp`: Verify code and issue a bearer token.
- `GET /api/projects`: List projects for an authenticated client.
- `POST /api/requests`: Create a client request.
- `POST /api/requests/{id}/updates`: Post an update to the request (Slack thread).
- `POST /api/handoff/slack` (internal): Send a conversation summary to Slack.

## State Machine (Prospect Mode)
States: `WELCOME → MODE_SELECT → IDENTITY → BUSINESS_CONTEXT → NEEDS → SCHEDULING(optional) → SUMMARY → SUBMIT`.

Required fields by state (submitted via message `fields`):
- MODE_SELECT: `mode`
- IDENTITY: `full_name`, `email`
- BUSINESS_CONTEXT: `business_name`
- NEEDS: `needs_summary` (can set `skip_scheduling=true`)
- SCHEDULING: either `scheduling_option=link` or `preferred_times` + `timezone` (default `America/Los_Angeles`)
- SUMMARY: `summary`

Scheduling rules:
- Option A: show booking link (from `BOOKING_URL`) and store `scheduling_option=link` + `booking_url`.
- Option B: collect `preferred_times` + `timezone` and store `scheduling_option=times`.

End & Send Now:
- `POST /api/conversations/{id}/end-and-send` forces `SUBMIT` from any state and stores the summary.

Client mode entry:
- MODE_SELECT accepts `mode=client` to route existing clients to auth + request intake.

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
- Attachments (if present): linked file names
- Admin link: `{ADMIN_BASE_URL}/conversations/{conversation_id}`

Reliability:
- Retries up to 3 attempts with backoff.
- Idempotent: only one Slack post per conversation (tracked in DB).

## UX (Prospect Intake)
Screenshots description:
- Mobile: single-column chat with stacked bubbles, sticky End & Send Now button, and compact progress badge.
- Desktop: two-column header with progress badge, chat panel centered with pill chips for quick replies.

Behaviors:
- One-question-at-a-time flow with validated email/phone inputs.
- Quick reply chips for mode, urgency, budget band, and preferred channel.
- Progress indicator shows step count and approximate time remaining.
- End & Send Now available from any state.
- Attachments can be uploaded during summary (PNG/JPEG/PDF, size-limited).

## Client Auth (Existing Clients)
Flow:
- `POST /api/auth/request-otp` with email to generate a one-time code.
- `POST /api/auth/verify-otp` to exchange code for a bearer token.
- `GET /api/projects` lists projects for the authenticated account.

## Client Request Intake
Steps:
- Pick project → classify (bug/change/new) → describe → impact/urgency → attach files → submit.

Slack:
- Creates a new post in `#onb1-intake` and stores the Slack thread timestamp on the request.
- Subsequent updates post to the same thread.

Data:
- Requests are stored in `requests` with type/impact/urgency and Slack thread metadata.
- Attachments are stored in `attachments` and linked to the request.

## Storage (Uploads)
- Provider: Amazon S3 with presigned `PUT` URLs.
- Env: `AWS_REGION`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL` (optional), `MAX_UPLOAD_BYTES`, `ALLOWED_UPLOAD_TYPES`.
- Limits: max size enforced server-side (`MAX_UPLOAD_BYTES`), allowlist enforced by content type.

## Security
Protections:
- Rate limiting by IP for conversation creation and message posting.
- Optional CAPTCHA gate for anonymous prospect creation.
- Email/phone encrypted at rest in `normalized_fields` using `ENCRYPTION_KEY`.
- Audit logs recorded on submit events.

PII handling:
- `email` and `phone` are stored encrypted and decrypted only for response/Slack.
- Message bodies should avoid sensitive fields; UI posts PII in fields, not body.

## Changelog
- 2026-02-07: Added local Postgres dev environment (Docker Compose), migration/seed scripts, and db README steps.
- 2026-02-07: Defined OpenAPI contract v1 and added backend route stubs.
- 2026-02-07: Added prospect state machine v1, DB storage for state/fields, and state machine docs.
- 2026-02-07: Added git status/log/push helper script under scripts/.
- 2026-02-07: Added Slack handoff posting for prospect intake submissions.
- 2026-02-07: Added prospect intake chat UI with polling and validated inputs.
- 2026-02-07: Added S3 presigned uploads and attachment metadata for prospect intake.
- 2026-02-07: Added rate limiting, optional CAPTCHA, PII encryption, and submit audit logs.
- 2026-02-07: Added client OTP auth and client request intake with Slack threading.
- 2026-02-07: Added client request flow with Slack threads and request-linked attachments.
