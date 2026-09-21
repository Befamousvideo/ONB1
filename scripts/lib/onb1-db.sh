# Postgres bootstrap for durable staff identity.
# Uses DATABASE_URL when it already works; otherwise Docker Compose or a local
# apt PostgreSQL cluster.

ONB1_DB_USER="${POSTGRES_USER:-onb1}"
ONB1_DB_PASSWORD="${POSTGRES_PASSWORD:-onb1_dev_password}"
ONB1_DB_NAME="${POSTGRES_DB:-onb1}"
ONB1_DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
ONB1_DB_PORT="${POSTGRES_PORT:-5432}"
DATABASE_URL="${DATABASE_URL:-postgresql://${ONB1_DB_USER}:${ONB1_DB_PASSWORD}@${ONB1_DB_HOST}:${ONB1_DB_PORT}/${ONB1_DB_NAME}}"
export DATABASE_URL

onb1_db_ping() {
  local url="${1:-$DATABASE_URL}"
  PYTHONPATH="${ONB1_ROOT}/server/.deps${PYTHONPATH:+:$PYTHONPATH}" python3 - "$url" <<'PY'
import sys
try:
    import psycopg
except ImportError:
    sys.exit(1)
url = sys.argv[1]
try:
    with psycopg.connect(url, connect_timeout=3) as conn:
        conn.execute("SELECT 1")
except Exception:
    sys.exit(1)
PY
}

onb1_ensure_psycopg() {
  onb1_ensure_api_python
  PYTHONPATH="${ONB1_ROOT}/server/.deps${PYTHONPATH:+:$PYTHONPATH}" python3 -c "import psycopg" 2>/dev/null \
    || python3 -m pip install -q "psycopg[binary]==3.2.9" --target "${ONB1_ROOT}/server/.deps"
}

onb1_grant_app_role() {
  if id postgres >/dev/null 2>&1 && sudo -n -u postgres true 2>/dev/null; then
    sudo -u postgres psql -d "$ONB1_DB_NAME" -v ON_ERROR_STOP=1 <<SQL >/tmp/onb1-pg-grant.log 2>&1 || true
GRANT ALL ON SCHEMA public TO ${ONB1_DB_USER};
GRANT ALL ON ALL TABLES IN SCHEMA public TO ${ONB1_DB_USER};
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${ONB1_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${ONB1_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${ONB1_DB_USER};
SQL
  fi
}

onb1_migrate() {
  onb1_ensure_psycopg
  if id postgres >/dev/null 2>&1 && sudo -n -u postgres true 2>/dev/null; then
    sudo -u postgres env DATABASE_URL="postgresql:///${ONB1_DB_NAME}" \
      PYTHONPATH="${ONB1_ROOT}/server/.deps${PYTHONPATH:+:$PYTHONPATH}" \
      python3 "${ONB1_ROOT}/scripts/migrate.py" || return 1
    onb1_grant_app_role
  else
    PYTHONPATH="${ONB1_ROOT}/server/.deps${PYTHONPATH:+:$PYTHONPATH}" \
      python3 "${ONB1_ROOT}/scripts/migrate.py" || return 1
  fi
}

onb1_start_docker_postgres() {
  command -v docker >/dev/null 2>&1 || return 1
  (cd "$ONB1_ROOT" && docker compose up -d postgres) || return 1
  local i
  for i in $(seq 1 40); do
    if onb1_db_ping; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

onb1_start_local_postgres() {
  if ! command -v psql >/dev/null 2>&1 && ! command -v pg_isready >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
      echo "Installing local PostgreSQL ..."
      sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-client >/tmp/onb1-pg-apt.log
    else
      return 1
    fi
  fi

  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -q || sudo pg_ctlcluster --all start 2>/dev/null || sudo service postgresql start 2>/dev/null || true
  fi

  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/tmp/onb1-pg-bootstrap.log 2>&1 || true
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${ONB1_DB_USER}') THEN
    CREATE ROLE ${ONB1_DB_USER} LOGIN PASSWORD '${ONB1_DB_PASSWORD}';
  ELSE
    ALTER ROLE ${ONB1_DB_USER} LOGIN PASSWORD '${ONB1_DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${ONB1_DB_NAME} OWNER ${ONB1_DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${ONB1_DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${ONB1_DB_NAME} TO ${ONB1_DB_USER};
SQL

  sudo -u postgres psql -d "$ONB1_DB_NAME" -v ON_ERROR_STOP=1 <<SQL >>/tmp/onb1-pg-bootstrap.log 2>&1 || true
CREATE EXTENSION IF NOT EXISTS pgcrypto;
GRANT ALL ON SCHEMA public TO ${ONB1_DB_USER};
ALTER SCHEMA public OWNER TO ${ONB1_DB_USER};
SQL

  # Allow password auth from localhost for the smoke/dev user.
  local hba
  hba="$(sudo -u postgres psql -tAc "SHOW hba_file" 2>/dev/null | tr -d '[:space:]')"
  if [[ -n "$hba" && -f "$hba" ]]; then
    if ! sudo grep -q "onb1_smoke_md5" "$hba" 2>/dev/null; then
      echo "host all ${ONB1_DB_USER} 127.0.0.1/32 md5 # onb1_smoke_md5" | sudo tee -a "$hba" >/dev/null
      sudo pg_ctlcluster --all reload 2>/dev/null || sudo service postgresql reload 2>/dev/null || true
    fi
  fi

  onb1_db_ping
}

onb1_ensure_postgres() {
  onb1_ensure_psycopg
  if onb1_db_ping; then
    echo "Using existing Postgres at ${ONB1_DB_HOST}:${ONB1_DB_PORT}/${ONB1_DB_NAME}"
    return 0
  fi
  echo "Starting Postgres for durable staff identity ..."
  if onb1_start_docker_postgres; then
    echo "Postgres via Docker Compose"
    return 0
  fi
  if onb1_start_local_postgres; then
    echo "Postgres via local cluster"
    return 0
  fi
  echo "Could not reach Postgres at $DATABASE_URL" >&2
  echo "Set DATABASE_URL or start docker compose / local PostgreSQL." >&2
  return 1
}
