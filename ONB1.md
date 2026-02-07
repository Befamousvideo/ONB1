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

## Changelog
- (empty)
