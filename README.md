# ONB1

Repo bootstrap with documentation gate.

## Requirements
- Node.js 18+ (for Next.js)
- Python 3.11+ (for FastAPI)

## Front-end (Next.js)
```bash
cd web
npm install
npm run dev
```

## Backend (FastAPI)
```bash
cd server
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Docs Discipline
Changes under `server/` or `db/` must update `ONB1.md`.
