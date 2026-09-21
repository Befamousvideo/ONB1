# ONB1 Local-First MVP

ONB1 is a StorenTech AI onboarding discovery app. The current repo runs a local-first staff/exploring MVP with:

- `web/` — Next.js 14 App Router frontend (`web/app/page.tsx`, route `/`)
- `server/` — FastAPI backend with a **local in-memory** conversation/state machine (not durable Postgres)
- `docs/question-flow.md` — source flow for the MVP interview steps
- `ONB1.md` — living specification and implementation notes

OAuth, payments, RAG, Diggler, red-o pack, ROIA export, LLM, mic, Stripe, OTP, and deploy are out of scope for this launch path.

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+
- Linux or WSL is the supported launch environment

## Quick start (Linux / WSL)

One command starts the in-memory API on port **8000** and the intake UI on port **3000**:

```bash
./scripts/dev.sh
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000). Staff links always include a client/invoice id, e.g. `/?mode=staff&client=red-o&invoice=202609-22-RED-111`. Exec-only CEO: `?invite=exec`. Use `?mode=prospect` for the exploring path. **doNotSend:** do not send staff links to Red O.

Manual equivalent (two terminals):

```bash
# Terminal 1 — in-memory API
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
# Terminal 2 — App Router intake
cd web
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

The UI defaults to `http://<hostname>:8000` when `NEXT_PUBLIC_API_BASE_URL` is unset, so WSL/LAN browsers still hit the same API host. Do not use port 8011.

## Smoke

From the repo root, against the in-memory API:

```bash
./scripts/smoke.sh
```

This exits 0 only after:

1. `GET /health` with `persistence=postgres`
2. `GET /api/staff-packs` v1.2.0 (all role packs + Vince locations)
3. `POST /api/conversations` staff with `client` / `invoice` + `pack=staff_admin`
4. Pack Q1 → Q2 identity (name, email, HQ `work_phone`)
5. `GET /api/conversations/{id}` showing that identity and `client_invoice_id`
6. A fresh API process still returns the same staff conversation
7. FOH pack advances Q2 without `work_phone`; exec invite locks `staff_ceo`
8. Exploring `mode: "prospect"` starts without breaking staff

Smoke starts Postgres (Docker Compose or a local cluster) and applies `db/migrations` when `DATABASE_URL` is not already reachable.

`./scripts/smoke.sh` starts a temporary API if nothing healthy is listening on `API_BASE` (default `http://127.0.0.1:8000`). API deps install into `server/.venv` when `python3-venv` is available, otherwise into `server/.deps`.

To also require the web intake page (after `./scripts/dev.sh` is running):

```bash
./scripts/smoke.sh --with-web
```

## Quarantined / do not use for intake

| Path | Why |
| --- | --- |
| `/local` | Old Pages Router tools. Stale API body (`account_id` / `sender_type`). Now a notice that links to `/`. Source moved to `web/legacy/pages-local-ux/`. |
| `smoke_test.ps1` | Same stale contract. Exits 1 and points here. Original copy: `scripts/legacy/smoke_test.ps1`. |
| `dev.ps1` | Boots Docker Postgres. Not the local-first in-memory path. |

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

- Staff (`mode: "staff"`) v1.2 pack walker (7 role packs + other) and exploring (`mode: "prospect"`) linear path
- Vince locks: locations, FOH/BOH soft-optional phone, exec-only CEO, named-default quotes, client/invoice on every staff link
- Durable Postgres staff identity so answers survive API restart
- Nora `staff_quotes` / `guest_friction` / `software_stack` export — no invented $ savings
- Local handoff summary generation and a Slack-ready stub (`invitePolicy.doNotSend=true`)

## Documentation Discipline Gate

CI fails pull requests when files under `server/` or `db/` change without also updating `ONB1.md`.
