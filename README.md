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

## Local Dev (All-in-One)
```powershell
.\dev.ps1
```
This brings up Postgres, applies migrations + seed, sets env vars, and starts the API.

## Smoke Test
```powershell
.\smoke_test.ps1
```

## Docs Discipline
Changes under `server/` or `db/` must update `ONB1.md`.

## Local UX
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000/local` for the minimal local API UI.
