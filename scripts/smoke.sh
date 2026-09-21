#!/usr/bin/env bash
# Local-first intake smoke against the in-memory FastAPI API.
# Required checks: health, create conversation, identity (name/email), get conversation.
# Optional: --with-web also asserts the App Router intake page is reachable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/onb1-api.sh
ONB1_ROOT="$ROOT"
. "$ROOT/scripts/lib/onb1-api.sh"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
API_BASE="${API_BASE:-http://${API_HOST}:${API_PORT}}"
WEB_BASE="${WEB_BASE:-http://127.0.0.1:3000}"
WITH_WEB=0
STARTED_API=0
API_PID=""
SMOKE_NAME="Smoke Tester"
SMOKE_EMAIL="smoke@example.com"

usage() {
  cat <<'EOF'
Usage: scripts/smoke.sh [--with-web]

  Proves the in-memory FastAPI intake API:
    GET  /health
    POST /api/conversations
    POST /api/conversations/{id}/message  (WELCOME -> MODE_SELECT -> IDENTITY)
    GET  /api/conversations/{id}

  Reuses a healthy API on API_BASE, or starts in-memory uvicorn
  (server/.venv, or server/.deps if python3-venv is unavailable).

  --with-web   Also GET WEB_BASE (default http://127.0.0.1:3000) and require
               the App Router intake markers. Does not start Next.js.

Environment:
  API_BASE   default http://127.0.0.1:8000
  API_PORT   default 8000 (used when starting uvicorn)
  WEB_BASE   default http://127.0.0.1:3000
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    --with-web)
      WITH_WEB=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cleanup() {
  if [[ "$STARTED_API" == "1" && -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "ok  $*"
}

http_json() {
  # args: method url [json_body]
  python3 - "$@" <<'PY'
import json
import sys
import urllib.error
import urllib.request

method = sys.argv[1]
url = sys.argv[2]
body = sys.argv[3].encode() if len(sys.argv) > 3 else None
headers = {"Accept": "application/json"}
if body is not None:
    headers["Content-Type"] = "application/json"
request = urllib.request.Request(url, data=body, method=method, headers=headers)
try:
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = response.read().decode()
        print(json.dumps({"status": response.status, "body": payload}))
except urllib.error.HTTPError as exc:
    payload = exc.read().decode()
    print(json.dumps({"status": exc.code, "body": payload}))
    sys.exit(1)
except Exception as exc:
    print(json.dumps({"status": 0, "body": str(exc)}))
    sys.exit(1)
PY
}

json_field() {
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); print(data.get(sys.argv[1], ""))' "$1"
}

json_nested() {
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); print(data.get("normalized_fields", {}).get(sys.argv[1], ""))' "$1"
}

health_ok() {
  local raw status body
  raw="$(http_json GET "$API_BASE/health" 2>/dev/null || true)"
  status="$(printf '%s' "$raw" | json_field status)"
  body="$(printf '%s' "$raw" | json_field body)"
  [[ "$status" == "200" && "$body" == *'"status"'*'"ok"'* ]]
}

start_api() {
  onb1_ensure_api_python
  echo "Starting in-memory FastAPI on ${API_HOST}:${API_PORT} ..."
  onb1_run_uvicorn "$API_HOST" "$API_PORT" >/tmp/onb1-smoke-api.log 2>&1 &
  API_PID=$!
  STARTED_API=1

  for _ in $(seq 1 40); do
    if health_ok; then
      return 0
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      fail "API process exited during startup. See /tmp/onb1-smoke-api.log"
    fi
    sleep 0.25
  done
  fail "API did not become healthy at $API_BASE/health. See /tmp/onb1-smoke-api.log"
}

if health_ok; then
  pass "reusing healthy API at $API_BASE"
else
  start_api
  pass "started in-memory API at $API_BASE"
fi

health_raw="$(http_json GET "$API_BASE/health")"
health_status="$(printf '%s' "$health_raw" | json_field status)"
health_body="$(printf '%s' "$health_raw" | json_field body)"
[[ "$health_status" == "200" ]] || fail "health status $health_status"
printf '%s' "$health_body" | python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); assert data.get("status")=="ok"' \
  || fail "health body was not {status: ok}: $health_body"
pass "GET /health"

create_raw="$(http_json POST "$API_BASE/api/conversations" '{"mode":"prospect"}')"
create_status="$(printf '%s' "$create_raw" | json_field status)"
create_body="$(printf '%s' "$create_raw" | json_field body)"
[[ "$create_status" == "201" ]] || fail "create conversation status $create_status body=$create_body"
CONV_ID="$(printf '%s' "$create_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["id"])')"
[[ -n "$CONV_ID" ]] || fail "create conversation missing id"
pass "POST /api/conversations id=$CONV_ID"

welcome_raw="$(http_json POST "$API_BASE/api/conversations/${CONV_ID}/message" '{"content":"Ready to start.","fields":{}}')"
welcome_status="$(printf '%s' "$welcome_raw" | json_field status)"
[[ "$welcome_status" == "201" ]] || fail "welcome advance status $welcome_status"

mode_raw="$(http_json POST "$API_BASE/api/conversations/${CONV_ID}/message" '{"content":"New prospect","fields":{"mode":"prospect"}}')"
mode_status="$(printf '%s' "$mode_raw" | json_field status)"
mode_body="$(printf '%s' "$mode_raw" | json_field body)"
[[ "$mode_status" == "201" ]] || fail "mode select status $mode_status body=$mode_body"
mode_state="$(printf '%s' "$mode_body" | json_field state)"
[[ "$mode_state" == "IDENTITY" ]] || fail "expected IDENTITY after mode select, got $mode_state"

identity_payload="$(python3 -c 'import json; print(json.dumps({"content":"Smoke Tester | smoke@example.com","fields":{"full_name":"Smoke Tester","email":"smoke@example.com"}}))')"
identity_raw="$(http_json POST "$API_BASE/api/conversations/${CONV_ID}/message" "$identity_payload")"
identity_status="$(printf '%s' "$identity_raw" | json_field status)"
identity_body="$(printf '%s' "$identity_raw" | json_field body)"
[[ "$identity_status" == "201" ]] || fail "identity status $identity_status body=$identity_body"
pass "POST identity name=$SMOKE_NAME email=$SMOKE_EMAIL"

get_raw="$(http_json GET "$API_BASE/api/conversations/${CONV_ID}")"
get_status="$(printf '%s' "$get_raw" | json_field status)"
get_body="$(printf '%s' "$get_raw" | json_field body)"
[[ "$get_status" == "200" ]] || fail "get conversation status $get_status body=$get_body"

got_name="$(printf '%s' "$get_body" | json_field participant_name)"
got_email="$(printf '%s' "$get_body" | json_field participant_email)"
got_field_name="$(printf '%s' "$get_body" | json_nested full_name)"
got_field_email="$(printf '%s' "$get_body" | json_nested email)"
[[ "$got_name" == "$SMOKE_NAME" ]] || fail "participant_name expected $SMOKE_NAME got $got_name"
[[ "$got_email" == "$SMOKE_EMAIL" ]] || fail "participant_email expected $SMOKE_EMAIL got $got_email"
[[ "$got_field_name" == "$SMOKE_NAME" ]] || fail "normalized_fields.full_name expected $SMOKE_NAME got $got_field_name"
[[ "$got_field_email" == "$SMOKE_EMAIL" ]] || fail "normalized_fields.email expected $SMOKE_EMAIL got $got_field_email"
pass "GET /api/conversations/{id} identity persisted"

if [[ "$WITH_WEB" == "1" ]]; then
  web_html="$(python3 - "$WEB_BASE" <<'PY'
import sys
import urllib.error
import urllib.request

url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=8) as response:
        print(response.read().decode(errors="replace"))
except Exception as exc:
    sys.stderr.write(f"web fetch failed for {url}: {exc}\n")
    sys.exit(1)
PY
)" || fail "web is not reachable at $WEB_BASE (start ./scripts/dev.sh, then rerun --with-web)"
printf '%s' "$web_html" | grep -q "Prospect intake" || fail "web page at $WEB_BASE is missing App Router intake copy (is Pages /local still shadowing /?)"
printf '%s' "$web_html" | grep -q "No active intake yet" || fail "web page at $WEB_BASE is missing the empty intake state"
pass "GET $WEB_BASE App Router intake"
else
  if python3 - "$WEB_BASE" <<'PY' >/dev/null 2>&1
import sys, urllib.request
urllib.request.urlopen(sys.argv[1], timeout=2)
PY
  then
    web_html="$(python3 - "$WEB_BASE" <<'PY'
import sys, urllib.request
print(urllib.request.urlopen(sys.argv[1], timeout=8).read().decode(errors="replace"))
PY
)"
    if printf '%s' "$web_html" | grep -q "Prospect intake"; then
      pass "GET $WEB_BASE App Router intake (optional, web already running)"
    else
      echo "note  web is running at $WEB_BASE but did not look like the App Router intake"
    fi
  else
    echo "note  web not running at $WEB_BASE (API smoke passed). Start ./scripts/dev.sh and rerun with --with-web."
  fi
fi

echo
echo "SMOKE PASSED"
