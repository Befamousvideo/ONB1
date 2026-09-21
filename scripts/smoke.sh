#!/usr/bin/env bash
# Staff/exploring smoke against FastAPI + durable Postgres.
# Required: health, v1.2 staff packs, staff create with client/invoice,
# Q1→Q2 identity (name/email/work_phone for HQ), get, restart-resume,
# FOH without phone, exec invite, exploring create. Optional --with-web.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/onb1-api.sh
ONB1_ROOT="$ROOT"
. "$ROOT/scripts/lib/onb1-api.sh"
# shellcheck source=lib/onb1-db.sh
. "$ROOT/scripts/lib/onb1-db.sh"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
API_BASE="${API_BASE:-http://${API_HOST}:${API_PORT}}"
WEB_BASE="${WEB_BASE:-http://127.0.0.1:3000}"
WITH_WEB=0
STARTED_API=0
API_PID=""
SMOKE_NAME="Smoke Tester"
SMOKE_EMAIL="smoke@example.com"
SMOKE_PHONE="555-0100"
SMOKE_CLIENT="red-o"
SMOKE_INVOICE="202609-22-RED-111"

usage() {
  cat <<'EOF'
Usage: scripts/smoke.sh [--with-web]

  Proves v1.2 staff packs + durable identity + exploring mode:
    GET  /health (persistence=postgres)
    GET  /api/staff-packs (v1.2.0, 8 packs, Vince locations)
    POST /api/conversations staff with client/invoice + pack=staff_admin
    POST .../message  (Q1 welcome -> Q2 identity with work_phone)
    GET  /api/conversations/{id}
    Restart still returns the same staff identity + client/invoice id
    FOH pack advances Q2 without work_phone
    Exec invite locks staff_ceo
    POST /api/conversations prospect (starts, does not break staff)

  Starts Postgres (Docker or local) when DATABASE_URL is not already reachable,
  applies db/migrations, then uvicorn (server/.venv or server/.deps).

  --with-web   Also GET WEB_BASE (default http://127.0.0.1:3000) and require
               the App Router staff discovery markers. Does not start Next.js.

Environment:
  API_BASE       default http://127.0.0.1:8000
  API_PORT       default 8000 (used when starting uvicorn)
  DATABASE_URL   default postgresql://onb1:onb1_dev_password@127.0.0.1:5432/onb1
  WEB_BASE       default http://127.0.0.1:3000
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
  echo "Starting FastAPI on ${API_HOST}:${API_PORT} (DATABASE_URL set, persistence=postgres) ..."
  DATABASE_URL="$DATABASE_URL" onb1_run_uvicorn "$API_HOST" "$API_PORT" >/tmp/onb1-smoke-api.log 2>&1 &
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

onb1_ensure_postgres || fail "Postgres is required for staff identity durability"
onb1_migrate || fail "db/migrations failed. See migrate output above"

if health_ok; then
  existing_persistence="$(http_json GET "$API_BASE/health" | json_field body | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("persistence",""))')"
  if [[ "$existing_persistence" != "postgres" ]]; then
    fail "API at $API_BASE is memory-only. Stop it so smoke can start a Postgres-backed API."
  fi
  pass "reusing Postgres-backed API at $API_BASE"
else
  start_api
  pass "started Postgres-backed API at $API_BASE"
fi

health_raw="$(http_json GET "$API_BASE/health")"
health_status="$(printf '%s' "$health_raw" | json_field status)"
health_body="$(printf '%s' "$health_raw" | json_field body)"
[[ "$health_status" == "200" ]] || fail "health status $health_status"
printf '%s' "$health_body" | python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); assert data.get("status")=="ok"; assert data.get("persistence")=="postgres"' \
  || fail "health body was not {status: ok, persistence: postgres}: $health_body"
pass "GET /health persistence=postgres"

packs_raw="$(http_json GET "$API_BASE/api/staff-packs")"
packs_status="$(printf '%s' "$packs_raw" | json_field status)"
packs_body="$(printf '%s' "$packs_raw" | json_field body)"
[[ "$packs_status" == "200" ]] || fail "staff-packs status $packs_status body=$packs_body"
printf '%s' "$packs_body" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); assert d.get("version")=="1.2.0"; ids=[p["id"] for p in d["packs"]]; assert ids==["staff_ceo","staff_hr","staff_sales","staff_finance","staff_admin","staff_foh","staff_boh","staff_other"]; assert "Fashion Island" in d["locations"]; assert d.get("doNotSend") is True; assert d["invitePolicy"]["staff_ceo"]=="execOnly"' \
  || fail "staff-packs catalog was not v1.2 Vince-locked: $packs_body"
pass "GET /api/staff-packs v1.2.0 encodeAll + Vince locks"

create_payload="$(python3 -c 'import json; print(json.dumps({"mode":"staff","pack":"staff_admin","client_id":"red-o","invoice_id":"202609-22-RED-111"}))')"
create_raw="$(http_json POST "$API_BASE/api/conversations" "$create_payload")"
create_status="$(printf '%s' "$create_raw" | json_field status)"
create_body="$(printf '%s' "$create_raw" | json_field body)"
[[ "$create_status" == "201" ]] || fail "create conversation status $create_status body=$create_body"
CONV_ID="$(printf '%s' "$create_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["id"])')"
[[ -n "$CONV_ID" ]] || fail "create conversation missing id"
create_mode="$(printf '%s' "$create_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("normalized_fields", {}).get("mode", ""))')"
create_state="$(printf '%s' "$create_body" | json_field state)"
create_invoice="$(printf '%s' "$create_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("staff_link", {}).get("client_invoice_id",""))')"
[[ "$create_mode" == "staff" ]] || fail "staff create expected mode=staff got $create_mode"
[[ "$create_state" == "Q1" ]] || fail "staff create expected Q1 got $create_state"
[[ "$create_invoice" == "${SMOKE_CLIENT}/${SMOKE_INVOICE}" ]] || fail "staff create missing client/invoice got $create_invoice"
pass "POST /api/conversations staff id=$CONV_ID client/invoice=$create_invoice"

welcome_raw="$(http_json POST "$API_BASE/api/conversations/${CONV_ID}/message" '{"content":"Begin discovery","fields":{}}')"
welcome_status="$(printf '%s' "$welcome_raw" | json_field status)"
welcome_body="$(printf '%s' "$welcome_raw" | json_field body)"
[[ "$welcome_status" == "201" ]] || fail "Q1 advance status $welcome_status body=$welcome_body"
welcome_state="$(printf '%s' "$welcome_body" | json_field state)"
[[ "$welcome_state" == "Q2" ]] || fail "expected Q2 after Q1, got $welcome_state"

identity_payload="$(python3 -c 'import json; print(json.dumps({"content":"Smoke Tester | smoke@example.com","fields":{"full_name":"Smoke Tester","email":"smoke@example.com","work_phone":"555-0100"}}))')"
identity_raw="$(http_json POST "$API_BASE/api/conversations/${CONV_ID}/message" "$identity_payload")"
identity_status="$(printf '%s' "$identity_raw" | json_field status)"
identity_body="$(printf '%s' "$identity_raw" | json_field body)"
[[ "$identity_status" == "201" ]] || fail "identity status $identity_status body=$identity_body"
identity_state="$(printf '%s' "$identity_body" | json_field state)"
[[ "$identity_state" == "Q3" ]] || fail "expected Q3 after Q2, got $identity_state"
pass "POST Q2 identity name=$SMOKE_NAME email=$SMOKE_EMAIL work_phone=$SMOKE_PHONE"

get_raw="$(http_json GET "$API_BASE/api/conversations/${CONV_ID}")"
get_status="$(printf '%s' "$get_raw" | json_field status)"
get_body="$(printf '%s' "$get_raw" | json_field body)"
[[ "$get_status" == "200" ]] || fail "get conversation status $get_status body=$get_body"

got_name="$(printf '%s' "$get_body" | json_field participant_name)"
got_email="$(printf '%s' "$get_body" | json_field participant_email)"
got_field_name="$(printf '%s' "$get_body" | json_nested full_name)"
got_field_email="$(printf '%s' "$get_body" | json_nested email)"
got_field_phone="$(printf '%s' "$get_body" | json_nested work_phone)"
got_field_role="$(printf '%s' "$get_body" | json_nested role)"
[[ "$got_name" == "$SMOKE_NAME" ]] || fail "participant_name expected $SMOKE_NAME got $got_name"
[[ "$got_email" == "$SMOKE_EMAIL" ]] || fail "participant_email expected $SMOKE_EMAIL got $got_email"
[[ "$got_field_name" == "$SMOKE_NAME" ]] || fail "normalized_fields.full_name expected $SMOKE_NAME got $got_field_name"
[[ "$got_field_email" == "$SMOKE_EMAIL" ]] || fail "normalized_fields.email expected $SMOKE_EMAIL got $got_field_email"
[[ "$got_field_phone" == "$SMOKE_PHONE" ]] || fail "normalized_fields.work_phone expected $SMOKE_PHONE got $got_field_phone"
[[ "$got_field_role" == "Admin / Ops" ]] || fail "normalized_fields.role expected Admin / Ops got $got_field_role"
pass "GET /api/conversations/{id} staff identity persisted"

assert_identity_from() {
  local base="$1"
  local raw status body name email phone role
  raw="$(http_json GET "${base}/api/conversations/${CONV_ID}")"
  status="$(printf '%s' "$raw" | json_field status)"
  body="$(printf '%s' "$raw" | json_field body)"
  [[ "$status" == "200" ]] || fail "resume GET status $status body=$body"
  name="$(printf '%s' "$body" | json_field participant_name)"
  email="$(printf '%s' "$body" | json_field participant_email)"
  phone="$(printf '%s' "$body" | json_nested work_phone)"
  role="$(printf '%s' "$body" | json_nested role)"
  [[ "$name" == "$SMOKE_NAME" ]] || fail "resume participant_name expected $SMOKE_NAME got $name"
  [[ "$email" == "$SMOKE_EMAIL" ]] || fail "resume participant_email expected $SMOKE_EMAIL got $email"
  [[ "$phone" == "$SMOKE_PHONE" ]] || fail "resume work_phone expected $SMOKE_PHONE got $phone"
  [[ "$role" == "Admin / Ops" ]] || fail "resume role expected Admin / Ops got $role"
}

RESUME_PORT=8099
RESUME_BASE="http://127.0.0.1:${RESUME_PORT}"
echo "Proving staff identity survives a fresh API process on :${RESUME_PORT} ..."
DATABASE_URL="$DATABASE_URL" onb1_run_uvicorn 127.0.0.1 "$RESUME_PORT" >/tmp/onb1-smoke-resume.log 2>&1 &
RESUME_PID=$!
resume_ok=0
for _ in $(seq 1 40); do
  if python3 - "$RESUME_BASE" <<'PY' >/dev/null 2>&1
import sys, urllib.request
urllib.request.urlopen(f"{sys.argv[1]}/health", timeout=1)
PY
  then
    resume_ok=1
    break
  fi
  if ! kill -0 "$RESUME_PID" 2>/dev/null; then
    fail "resume API exited. See /tmp/onb1-smoke-resume.log"
  fi
  sleep 0.25
done
[[ "$resume_ok" == "1" ]] || fail "resume API did not become healthy. See /tmp/onb1-smoke-resume.log"
assert_identity_from "$RESUME_BASE"
kill "$RESUME_PID" 2>/dev/null || true
wait "$RESUME_PID" 2>/dev/null || true
pass "staff identity durable after API restart (work_phone + role)"

prospect_raw="$(http_json POST "$API_BASE/api/conversations" '{"mode":"prospect"}')"
prospect_status="$(printf '%s' "$prospect_raw" | json_field status)"
prospect_body="$(printf '%s' "$prospect_raw" | json_field body)"
[[ "$prospect_status" == "201" ]] || fail "prospect create status $prospect_status body=$prospect_body"
prospect_mode="$(printf '%s' "$prospect_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("normalized_fields", {}).get("mode", ""))')"
[[ "$prospect_mode" == "prospect" ]] || fail "prospect create expected mode=prospect got $prospect_mode"
prospect_welcome="$(printf '%s' "$prospect_body" | python3 -c 'import json,sys; msgs=json.loads(sys.stdin.read()).get("messages", []); print(msgs[0]["content"] if msgs else "")')"
printf '%s' "$prospect_welcome" | grep -q "Automation ROI Analysis" || fail "prospect WELCOME did not use exploring pack"
pass "POST /api/conversations prospect mode=prospect starts"

foh_payload="$(python3 -c 'import json; print(json.dumps({"mode":"staff","pack":"staff_foh","client_id":"red-o","invoice_id":"202609-22-RED-111"}))')"
foh_raw="$(http_json POST "$API_BASE/api/conversations" "$foh_payload")"
foh_id="$(printf '%s' "$foh_raw" | json_field body | python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["id"])')"
http_json POST "$API_BASE/api/conversations/${foh_id}/message" '{"content":"Begin discovery","fields":{}}' >/dev/null
foh_q2_payload="$(python3 -c 'import json; print(json.dumps({"content":"Pat | pat@example.com","fields":{"full_name":"Pat","email":"pat@example.com"}}))')"
foh_q2_raw="$(http_json POST "$API_BASE/api/conversations/${foh_id}/message" "$foh_q2_payload")"
foh_q2_status="$(printf '%s' "$foh_q2_raw" | json_field status)"
foh_q2_state="$(printf '%s' "$foh_q2_raw" | json_field body | json_field state)"
[[ "$foh_q2_status" == "201" ]] || fail "FOH Q2 without phone should not block, status $foh_q2_status"
[[ "$foh_q2_state" == "Q3" ]] || fail "FOH Q2 expected Q3 got $foh_q2_state"
pass "FOH work_phone soft-optional (Q2 advances without phone)"

exec_payload="$(python3 -c 'import json; print(json.dumps({"mode":"staff","invite":"exec","client_id":"red-o","invoice_id":"202609-22-RED-111"}))')"
exec_raw="$(http_json POST "$API_BASE/api/conversations" "$exec_payload")"
exec_body="$(printf '%s' "$exec_raw" | json_field body)"
exec_role="$(printf '%s' "$exec_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("normalized_fields",{}).get("staff_role",""))')"
exec_invite="$(printf '%s' "$exec_body" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("staff_link",{}).get("invite",""))')"
[[ "$exec_role" == "staff_ceo" ]] || fail "exec invite expected staff_ceo got $exec_role"
[[ "$exec_invite" == "exec" ]] || fail "exec invite expected invite=exec got $exec_invite"
pass "exec invite path locks staff_ceo (not general staff)"

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
printf '%s' "$web_html" | grep -q "Your seat. Your workflow" || fail "web page at $WEB_BASE is missing staff discovery copy (is Pages /local still shadowing /?)"
printf '%s' "$web_html" | grep -q "start discovery. Pause and resume" || fail "web page at $WEB_BASE is missing the empty discovery state"
pass "GET $WEB_BASE App Router discovery"
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
    if printf '%s' "$web_html" | grep -q "Your seat. Your workflow"; then
      pass "GET $WEB_BASE App Router discovery (optional, web already running)"
    else
      echo "note  web is running at $WEB_BASE but did not look like the App Router discovery UI"
    fi
  else
    echo "note  web not running at $WEB_BASE (API smoke passed). Start ./scripts/dev.sh and rerun with --with-web."
  fi
fi

echo
echo "SMOKE PASSED"
