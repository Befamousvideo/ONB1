#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-db/onb1.sqlite}"
mkdir -p "$(dirname "$DB_PATH")"

sqlite3 "$DB_PATH" <<'SQL'
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL

for migration in $(find migrations -maxdepth 1 -type f -name '*.sql' | sort); do
    version="$(basename "$migration")"
    applied="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")"
    if [[ "$applied" == "0" ]]; then
        echo "Applying $version"
        sqlite3 "$DB_PATH" < "$migration"
        sqlite3 "$DB_PATH" "INSERT INTO schema_migrations(version) VALUES('$version');"
    else
        echo "Skipping $version (already applied)"
    fi
done

echo "Migrations complete for $DB_PATH"
