#!/usr/bin/env bash
# Linux/WSL launch path for the local-first in-memory intake (API :8000 + web :3000).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/onb1-api.sh
ONB1_ROOT="$ROOT"
. "$ROOT/scripts/lib/onb1-api.sh"
API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
API_PUBLIC_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:${API_PORT}}"
API_PID=""

usage() {
  cat <<'EOF'
Usage: scripts/dev.sh

  Starts:
    FastAPI in-memory API on :8000
    Next.js App Router intake UI on :3000

  This is the supported local launch path. Do not use dev.ps1 (Postgres) or
  /local for PR1 intake.

  Ctrl-C stops both processes.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

cleanup() {
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! command -v python3 >/dev/null; then
  echo "python3 is required" >&2
  exit 1
fi
if ! command -v npm >/dev/null; then
  echo "npm is required" >&2
  exit 1
fi

onb1_ensure_api_python

if [[ ! -d "$ROOT/web/node_modules" ]]; then
  echo "Installing web dependencies ..."
  (cd "$ROOT/web" && npm install)
fi

echo "Starting in-memory FastAPI on ${API_HOST}:${API_PORT} ..."
onb1_run_uvicorn "$API_HOST" "$API_PORT" --reload >/tmp/onb1-dev-api.log 2>&1 &
API_PID=$!

for _ in $(seq 1 40); do
  if python3 - "$API_PORT" <<'PY' >/dev/null 2>&1
import sys, urllib.request
port = sys.argv[1]
urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
PY
  then
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API failed to start. See /tmp/onb1-dev-api.log" >&2
    exit 1
  fi
  sleep 0.25
done

echo "API healthy at http://127.0.0.1:${API_PORT}/health"
echo "Starting Next.js intake UI on :${WEB_PORT} (API ${API_PUBLIC_URL}) ..."
echo "Open http://127.0.0.1:${WEB_PORT}  —  /local is quarantined."

cd "$ROOT/web"
export NEXT_PUBLIC_API_BASE_URL="$API_PUBLIC_URL"
npm run dev -- --port "$WEB_PORT" --hostname 0.0.0.0
