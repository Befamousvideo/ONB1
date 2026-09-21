#!/usr/bin/env python3
"""Apply db/migrations/*.sql in name order. Safe to re-run (records applied files)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import psycopg
except ImportError as exc:  # pragma: no cover
    sys.stderr.write("psycopg is required. Install server requirements first.\n")
    raise SystemExit(2) from exc

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "db" / "migrations"


def _exec_script(conn: psycopg.Connection, sql: str) -> None:
    # libpq PQexec accepts multi-statement files (BEGIN/COMMIT, several ALTERs).
    result = conn.pgconn.exec_(sql.encode("utf-8"))
    if result is None:
        raise RuntimeError("migration produced no result")
    status = result.status
    ok = {
        getattr(psycopg.pq.ExecStatus, "COMMAND_OK", None),
        getattr(psycopg.pq.ExecStatus, "TUPLES_OK", None),
        getattr(psycopg.pq.ExecStatus, "EMPTY_QUERY", None),
    }
    if status not in ok:
        message = result.get_error_message() or conn.pgconn.error_message or "migration failed"
        raise RuntimeError(message)


def main() -> int:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        sys.stderr.write("DATABASE_URL is not set.\n")
        return 2
    if not MIGRATIONS.is_dir():
        sys.stderr.write(f"Migrations folder not found: {MIGRATIONS}\n")
        return 2

    scripts = sorted(MIGRATIONS.glob("*.sql"))
    if not scripts:
        sys.stderr.write(f"No migration files in {MIGRATIONS}\n")
        return 2

    with psycopg.connect(database_url, autocommit=True) as conn:
        _exec_script(
            conn,
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              filename text PRIMARY KEY,
              applied_at timestamptz NOT NULL DEFAULT now()
            )
            """,
        )
        applied = {row[0] for row in conn.execute("SELECT filename FROM schema_migrations")}
        for script in scripts:
            if script.name in applied:
                print(f"skip  {script.name}")
                continue
            print(f"apply {script.name}")
            _exec_script(conn, script.read_text(encoding="utf-8-sig"))
            conn.execute(
                "INSERT INTO schema_migrations (filename) VALUES (%s)",
                (script.name,),
            )
    print("migrations complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
