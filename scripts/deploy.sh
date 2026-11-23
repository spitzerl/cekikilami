#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker est requis." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Le plugin Docker Compose est requis." >&2
  exit 1
fi

umask 077
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

get_env() {
  sed -n "s/^${1}=//p" "$ENV_FILE" | tail -n 1
}

set_value() {
  key="$1"
  value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    escaped=$(printf '%s' "$value" | sed 's/[\\/&|]/\\&/g')
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_default() {
  key="$1"
  value="$2"
  if [ -z "$(get_env "$key")" ]; then
    set_value "$key" "$value"
  fi
}

ensure_secret() {
  key="$1"
  if [ -z "$(get_env "$key")" ]; then
    set_default "$key" "$(generate_secret)"
  fi
}

EXISTING_GATEWAY_PORT=$(get_env GATEWAY_PORT)
EXISTING_GATEWAY_BIND=$(get_env GATEWAY_BIND)
EXISTING_APP_URL=$(get_env APP_URL)

GATEWAY_PORT_VALUE="${GATEWAY_PORT:-${EXISTING_GATEWAY_PORT:-8080}}"
GATEWAY_BIND_VALUE="${GATEWAY_BIND:-${EXISTING_GATEWAY_BIND:-127.0.0.1}}"
APP_URL_VALUE="${APP_URL:-${EXISTING_APP_URL:-http://localhost:${GATEWAY_PORT_VALUE}}}"

set_default POSTGRES_ADMIN_USER postgres
set_default POSTGRES_DB music_game
set_default APP_DB_USER cekikilami
ensure_secret POSTGRES_PASSWORD
ensure_secret APP_DB_PASSWORD
ensure_secret REDIS_PASSWORD
if [ -n "${CORS_ORIGIN:-}" ]; then
  set_value CORS_ORIGIN "$CORS_ORIGIN"
elif [ -n "${APP_URL:-}" ]; then
  set_value CORS_ORIGIN "$APP_URL_VALUE"
else
  set_default CORS_ORIGIN "$APP_URL_VALUE"
fi

if [ -n "${TRUST_PROXY:-}" ]; then
  set_value TRUST_PROXY "$TRUST_PROXY"
else
  set_default TRUST_PROXY 1
fi

set_default MAX_SESSIONS 500

if [ -n "${GATEWAY_BIND:-}" ]; then
  set_value GATEWAY_BIND "$GATEWAY_BIND_VALUE"
else
  set_default GATEWAY_BIND "$GATEWAY_BIND_VALUE"
fi

if [ -n "${GATEWAY_PORT:-}" ]; then
  set_value GATEWAY_PORT "$GATEWAY_PORT_VALUE"
else
  set_default GATEWAY_PORT "$GATEWAY_PORT_VALUE"
fi

if [ -n "${APP_URL:-}" ]; then
  set_value APP_URL "$APP_URL_VALUE"
else
  set_default APP_URL "$APP_URL_VALUE"
fi

set_default VITE_API_URL /api
set_default VITE_SOCKET_URL ""

if ! docker network inspect proxy >/dev/null 2>&1; then
  docker network create proxy >/dev/null
  echo "Réseau Docker 'proxy' créé (utile pour un reverse proxy TLS optionnel)."
fi

echo "Démarrage de la stack Cékikilami..."
docker compose up -d --build --remove-orphans

HEALTH_HOST="$GATEWAY_BIND_VALUE"
case "$HEALTH_HOST" in
  0.0.0.0|::) HEALTH_HOST=127.0.0.1 ;;
esac
HEALTH_URL="http://${HEALTH_HOST}:${GATEWAY_PORT_VALUE}/health"

echo "Attente de la passerelle..."
index=0
while [ "$index" -lt 30 ]; do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then break; fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -qO- "$HEALTH_URL" >/dev/null 2>&1; then break; fi
  else
    break
  fi
  index=$((index + 1))
  sleep 2
done

docker compose ps

echo
echo "Déploiement terminé."
echo "Application : ${APP_URL_VALUE}"
echo "Passerelle : ${GATEWAY_BIND_VALUE}:${GATEWAY_PORT_VALUE}"
echo "Réseau proxy : proxy (proxy TLS externe optionnel)"
echo
echo "Pour utiliser un domaine HTTPS, relancez avec APP_URL=https://votre-domaine ./scripts/deploy.sh"
echo "et faites pointer votre reverse proxy TLS vers cekikilami-gateway:8080 ou vers le port publié."
