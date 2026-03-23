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

- Prospect intake flow is implemented as a local-first MVP before OAuth, payments, and RAG.
- The backend uses a FastAPI state machine with local in-memory persistence for conversation progress.
- The frontend uses a single App Router intake UI that resumes from browser-local conversation state.
- Slack handoff is stubbed locally unless a real webhook is provided through environment configuration.
- Existing-client mode is intentionally a placeholder until authentication is added.

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

- 2026-02-23: Added RAG Intelligence Layer for voice agent (Sarah) personalization
- 2026-03-22: Implemented the local-first prospect intake MVP with FastAPI state transitions and a Next.js App Router UI.
- 2026-03-23: Added ROI-audit interview guidance, business-type pain-point inference requirements, and Orange County scheduling rules.
- 2026-03-23: Added the chatbot knowledge-base playbook for offer ladder, business-type automation recommendations, and local/private AI positioning.
- 2026-03-23: Refined the recommendation model around 9 archetypes, subtype branching, and the private-AI overlay.
