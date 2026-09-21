# ONB1 Living Specification

## Purpose

This document is the single source of truth for project scope, architecture, and implementation decisions during early bootstrapping.

## Architecture Overview

- Frontend: Next.js (App Router) + TypeScript under web/.
- Backend API: FastAPI (Python) under server/.
- API Contract: openapi.yaml at repository root (initial stub).
- Documentation: Project docs in docs/.
- Data Layer: Reserved db/ directory for schema/migrations.

## Local-First MVP Baseline

- Two first-class discovery modes are implemented as a local-first MVP before OAuth, payments, and RAG.
- The backend uses a FastAPI state machine. When `DATABASE_URL` is set (smoke and `./scripts/dev.sh` now try to provide it), staff conversations persist in Postgres. Unit tests still use the in-memory store.
- The frontend uses a single App Router discovery UI (`web/app/page.tsx`, route `/`) that resumes from browser-local conversation state.
- API and UI share port **8000** for FastAPI (`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`). The previous UI fallback of `8011` is retired.
- Slack handoff is stubbed locally unless a real webhook is provided through environment configuration.
- Staff mode is the default (`?mode=staff`). Exploring mode is `?mode=prospect` on the API key only.

## Employee / ROIA Discovery Copy (PR2)

- `mode: "staff"` (aliases: omitted / `employee`) is the Red-O default. `mode: "prospect"` is the exploring / pre-hire path.
- URL `?mode=staff|prospect` plus optional “How are you joining today?” chips select the audience. Staff UI never shows the word “prospect”.
- Staff path: role chips including Owner/CEO, Admin/Ops, Sales, HR/People, Finance, FOH, BOH, Other. Role-aware `STATE_PROMPTS` overlays (default Admin/Ops). No budget or timeline chips.
- Exploring path: separate hero/chrome and `PROSPECT_STATE_PROMPTS`. Budget, timing, and sales-path scheduling copy are restored only here. Staff Owner/CEO copy is not reused.
- Interview states: `WELCOME → MODE_SELECT → IDENTITY → BUSINESS_CONTEXT → ARCHETYPE → PAIN_POINTS → SCHEDULING → SUMMARY → SUBMIT`. `NEEDS` remains an alias of `PAIN_POINTS`.
- Category/subtype labels stay the 9 ONB1 archetypes. This pass is chrome + prompts only — no Diggler deep question packs.
- Staff identity is durable in Postgres (`DATABASE_URL`): name, email, required `work_phone`, role, company/location, and conversation answers survive an API restart. `db/migrations/0016_staff_work_phone.sql` adds `contacts.work_phone`. Exploring mode may still persist when Postgres is on; staff is the required path.
- `./scripts/smoke.sh` starts/uses Postgres, applies `db/migrations`, and proves a fresh API process can reload the same staff conversation.

## Local Launch And Smoke (PR1)

- Supported launch (Linux/WSL): `./scripts/dev.sh` starts in-memory FastAPI on `:8000` and Next.js on `:3000`. API deps use `server/.venv` when `python3-venv` exists, otherwise a local `server/.deps` pip target.
- Supported smoke: `./scripts/smoke.sh` (API: health, create conversation, identity name/email, get conversation). Add `--with-web` when the UI is already running.
- Quarantined: Pages Router `/local` (`web/legacy/pages-local-ux/`) and `smoke_test.ps1` (stale `account_id` / `sender_type` contract). `/local` now serves a notice that links to `/`.
- Dual `web/next.config.js` + `web/next.config.mjs` collapsed to `web/next.config.mjs` so Next.js has one config.

## Chosen Stack

- Frontend: Next.js 14, React 18, TypeScript 5.
- Backend: FastAPI + Uvicorn, Python 3.11+.
- CI/CD: GitHub Actions workflow for documentation discipline.

## Folder Structure

- web/ — Next.js frontend scaffold.
- server/ — FastAPI API scaffold.
- db/ — placeholder for database artifacts.
- docs/ — architecture/decision documents.
- .github/workflows/ — CI checks.
- openapi.yaml — API spec stub.
- .env.example — planned environment variables.

## Development Rules

- No feature work should begin until this document and decision logs are updated.
- Any change under server/ or db/ must include an ONB1.md update.

## Interview Intelligence Direction

- The intake must capture the individual contact, company name, business type, and enough location context to route scheduling.
- The recommendation engine should work in three layers: archetype, subtype, then business-model questions.
- Discovery should focus on repetitive work, lost business from inefficiencies, and operational pain points rather than generic feature interest alone.
- The assistant should infer 3 to 5 likely automation opportunities from the business type and user answers, then recommend the first one to solve for the strongest ROI.
- The assistant should use a reusable business-type playbook for likely offers, qualifying questions, and ROI indicators.
- The next sales motion after intake should be a detailed ROI audit.
- Scheduling should prefer an in-person ROI audit for Orange County, California prospects when geography and availability allow; otherwise it should default to phone unless the user requests something different.
- The handoff must email `vincent@storentech.com` with the intake summary and any appointment details.
- If a prospect raises privacy, security, or IP concerns, the assistant should introduce local/private AI options such as dedicated OpenClaw environments, local databases, and DGX Spark-backed deployments when appropriate.

## Business-Type Recommendation Source

- Use `docs/chatbot-knowledge-base.md` as the recommendation source for service tiers, business-type starter plays, qualifying questions, and local/private AI triggers.
- Prioritize the 9 ONB1 archetypes instead of building dozens of disconnected industry branches first.

## ROI Audit Phase 2

- After ONB1 qualifies a prospect, the default next step is the paid StorenTech ROI Audit.
- The ROI Audit fee range is typically `$500-$1000`.
- The fee may be credited toward the first implementation engagement when approved.
- In-person ROI audit appointments run Monday through Thursday from `9:00 AM - 3:00 PM`.
- Voice-call ROI audit appointments run Monday through Thursday from `8:00 AM - 4:00 PM`.
- Exceptions require approval, with voice-call exceptions specifically requiring owner Vincent approval.
- Use `docs/roi-audit-playbook.md` as the shared source of truth for all assistants covering audit framing, questions, scoring, 30-day ROI proof, and the final audit summary.

## RAG Intelligence Layer (Voice Agent Enhancement)

### Overview
ONB1's voice agent (Sarah) integrates a RAG (Retrieval Augmented Generation) system
to deliver hyper-personalized, industry-aware conversations with prospects.

### How It Works
```
Prospect calls Sarah
       ↓
Sarah asks qualifying questions (see script below)
       ↓
Answers trigger RAG query against ChromaDB knowledge base
       ↓
Business name found? → Web search for real intel on that specific business
Industry identified? → Pull industry pain points, benchmarks, case studies
Neither? → Fall back to general pain points for identified vertical
       ↓
Sarah responds with specific, current, relevant intelligence
       ↓
Prospect hears an agent that knows their world
```

### Sarah's Qualifying Question Script (Early in Call)
```
1. "What type of business do you run?" (industry detection)
2. "And what's the name of your business?" (specific intel trigger)
3. "How long have you been in business?" (maturity context)
4. "What's your biggest operational challenge right now?" (pain point confirmation)
```

### RAG Query Logic
```python
# Step 1: Try specific business lookup
if business_name:
    results = web_search(business_name)  # Live search for real intel
    results += knowledge_base.query(f"{business_name} {industry}", n_results=3)

# Step 2: Industry knowledge base
if industry:
    results += knowledge_base.query(
        query=f"challenges opportunities solutions for {industry}",
        n_results=5,
        max_age_days=30  # Refresh if stale
    )

# Step 3: Inject into Sarah's context
sarah_context = f"""
Prospect: {business_name or 'unknown business'} — {industry}
Intelligence: {results}
Use this to sound like an expert in their specific industry.
Reference their business by name if known.
"""
```

### Knowledge Base Categories (ChromaDB Collections)
- `industries` — pain points, benchmarks, trends per vertical
- `case_studies` — success stories by industry
- `solutions` — what ONB1 offers per problem type
- `competitors` — market positioning intel
- `pricing` — benchmarks per industry/service type

### Freshness Rules
- Industry research: refresh if > 30 days old
- Specific business intel: always do live search
- Case studies: refresh if > 90 days old

### Tech Stack Addition
- **ChromaDB** — local vector database (Docker)
- **LangChain** — RAG pipeline (under CrewAI)
- **Ollama** — local embedding model (nomic-embed-text)
- **Brave Search API** — live business lookup

### Example Interaction
```
Sarah: "What type of business do you run?"
Prospect: "I have a dental practice"
Sarah: "Oh great — what's the name of your practice?"
Prospect: "Smile Bright Dental in Austin"

[RAG fires: searches "Smile Bright Dental Austin" + dental industry KB]

Sarah: "Perfect. Dental practices like yours typically struggle with
patient scheduling, insurance verification, and appointment reminders.
We've helped several Austin-area practices cut front desk admin time
by 40% using our onboarding automation. Is scheduling a pain point
for you too?"

Prospect: "...how did you know that?"
```

### Implementation Priority
1. ChromaDB setup (Docker)
2. Industry knowledge base population (research agents)
3. Embedding pipeline (nomic-embed-text via Ollama)
4. Sarah prompt injection on qualifying answers
5. Live business search integration

## Changelog

- 2026-09-21: PR2 employee/ROIA discovery copy (Tony v1–v3) plus durable staff identity. Staff vs exploring modes, role chips including Owner/CEO, role-aware staff `STATE_PROMPTS`, prospect-only budget/timeline, default `mode=staff`. Postgres persistence for staff name/email/`work_phone`/answers; smoke proves restart resume.
- 2026-09-21: PR1 reproducible Linux/WSL launch + smoke. Aligned API/UI to port 8000, quarantined Pages `/local` and `smoke_test.ps1`, added `scripts/dev.sh` and `scripts/smoke.sh` for the in-memory intake API.
- 2026-02-23: Added RAG Intelligence Layer for voice agent (Sarah) personalization
- 2026-03-22: Implemented the local-first prospect intake MVP with FastAPI state transitions and a Next.js App Router UI.
- 2026-03-23: Added ROI-audit interview guidance, business-type pain-point inference requirements, and Orange County scheduling rules.
- 2026-03-23: Added the chatbot knowledge-base playbook for offer ladder, business-type automation recommendations, and local/private AI positioning.
- 2026-03-23: Refined the recommendation model around 9 archetypes, subtype branching, and the private-AI overlay.
- 2026-03-23: Added the shared ROI Audit playbook with scheduling windows, fee guidance, scoring model, and phase-2 handoff rules.
