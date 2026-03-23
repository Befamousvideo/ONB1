# ONB1 Local-First MVP

ONB1 is a StorenTech AI onboarding intake app. The current repo now runs a local-first prospect intake MVP with:

- `web/` — Next.js 14 App Router frontend for the interview flow
- `server/` — FastAPI backend with a local in-memory conversation/state machine
- `docs/question-flow.md` — source flow for the MVP interview steps
- `ONB1.md` — living specification and implementation notes

OAuth, payments, and RAG are intentionally deferred until the intake flow is stable locally.

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+

## Local Run

Backend:

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd web
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` if you are not using the default backend URL.

## Validation

Backend tests:

```bash
cd server
source .venv/bin/activate
python -m pytest tests -q
```

Frontend checks:

```bash
cd web
npm run lint
npm run build
```

## Current MVP Scope

- Prospect mode intake with one-question-at-a-time state transitions
- Local handoff summary generation and a Slack-ready stub
- Existing-client mode held as a placeholder until OAuth is added
- Scheduling captured as preference text instead of calendar integration

## Documentation Discipline Gate

CI fails pull requests when files under `server/` or `db/` change without also updating `ONB1.md`.
