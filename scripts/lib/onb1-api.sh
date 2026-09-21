# Shared API bootstrap for Linux/WSL launch + smoke.
# Prefers server/.venv; falls back to server/.deps when python3-venv/ensurepip is missing.

onb1_ensure_api_python() {
  local server="${ONB1_ROOT}/server"
  local venv="$server/.venv"
  local deps="$server/.deps"
  local req="$server/requirements-dev.txt"

  if [[ -x "$venv/bin/python" ]] && "$venv/bin/python" -c "import fastapi, uvicorn" 2>/dev/null; then
    ONB1_API_PYTHON="$venv/bin/python"
    return 0
  fi

  if python3 -m venv "$venv" >/tmp/onb1-venv.log 2>&1 && [[ -x "$venv/bin/pip" ]]; then
    "$venv/bin/pip" install -q -r "$req"
    ONB1_API_PYTHON="$venv/bin/python"
    return 0
  fi
  rm -rf "$venv"

  if ! PYTHONPATH="$deps${PYTHONPATH:+:$PYTHONPATH}" python3 -c "import fastapi, uvicorn" 2>/dev/null; then
    echo "Installing API dependencies into server/.deps (python3-venv unavailable) ..."
    python3 -m pip install -q -r "$req" --target "$deps"
  fi
  export PYTHONPATH="$deps${PYTHONPATH:+:$PYTHONPATH}"
  ONB1_API_PYTHON="python3"
}

onb1_run_uvicorn() {
  local host="$1"
  local port="$2"
  shift 2
  cd "${ONB1_ROOT}/server"
  exec "$ONB1_API_PYTHON" -m uvicorn app.main:app --host "$host" --port "$port" "$@"
}
