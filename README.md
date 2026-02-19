# ONB1 Bootstrap

Initial repository scaffold for ONB1 with a Next.js frontend and FastAPI backend.

## Project layout

- web/ — Next.js + TypeScript frontend
- server/ — FastAPI backend API
- db/ — database placeholder directory
- docs/ — decision records and design docs
- openapi.yaml — API contract stub

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+

## Environment setup

Copy .env.example and fill in values before local runs:

```bash
cp .env.example .env
```

## Run frontend

```bash
cd web
npm install
npm run dev
```

Frontend will run at http://localhost:3000.

## Run backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API will run at http://localhost:8000.

## Documentation discipline gate

CI fails pull requests when files under server/ or db/ change without also updating ONB1.md.
