#!/bin/sh
set -eu

APP_DB_USER="${APP_DB_USER:-cekikilami}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-}"
POSTGRES_DB="${POSTGRES_DB:-music_game}"

if [ -z "$APP_DB_PASSWORD" ]; then
  echo "APP_DB_PASSWORD is required" >&2
  exit 1
fi

case "$APP_DB_USER" in
  *[!A-Za-z0-9_]*|'')
    echo "APP_DB_USER contains unsupported characters" >&2
    exit 1
    ;;
esac

escaped_password=$(printf '%s' "$APP_DB_PASSWORD" | sed "s/'/''/g")

role_exists=$(psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$APP_DB_USER'" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")

if [ "$role_exists" = "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "ALTER ROLE \"$APP_DB_USER\" WITH LOGIN PASSWORD '$escaped_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;"
else
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "CREATE ROLE \"$APP_DB_USER\" WITH LOGIN PASSWORD '$escaped_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;"
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "ALTER DATABASE \"$POSTGRES_DB\" OWNER TO \"$APP_DB_USER\";"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "GRANT ALL ON SCHEMA public TO \"$APP_DB_USER\";"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "ALTER SCHEMA public OWNER TO \"$APP_DB_USER\";"

echo "Application database role '$APP_DB_USER' is ready."
