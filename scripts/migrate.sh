#!/usr/bin/env bash
# Lightweight SQLite migration runner
# Usage: ./scripts/migrate.sh [db_path]
set -euo pipefail

DB="${1:-db/onb1.sqlite}"
MIGRATIONS_DIR="$(dirname "$0")/../migrations"

mkdir -p "$(dirname "$DB")"

# Ensure schema_migrations table exists
sqlite3 "$DB" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
SQL

# Apply each migration in order, exactly once
for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    fname="$(basename "$f")"
    already=$(sqlite3 "$DB" "SELECT COUNT(*) FROM schema_migrations WHERE filename='$fname';")
    if [ "$already" -eq 0 ]; then
        echo "Applying $fname ..."
        sqlite3 "$DB" < "$f"
        sqlite3 "$DB" "INSERT INTO schema_migrations (filename) VALUES ('$fname');"
    else
        echo "Skipping $fname (already applied)"
    fi
done

echo "Done. DB: $DB"
