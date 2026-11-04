#!/usr/bin/env bash
# Up API production: default pull GHCR :production.
# Pin: API_IMAGE=ghcr.io/sambasku/api:v0.1.0 ./scripts/production-up.sh
# Acuan: docs/api/DOCKERIZE_STAGING_HOMELAB.md (§8)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE=compose.production.yaml
ENV_FILE=.env.production

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: api/$ENV_FILE belum ada. Salin secret production ke situ." >&2
  echo "  contoh: DATABASE_URL=http://host.docker.internal:8080" >&2
  exit 1
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true

db_url="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$db_url" ]]; then
  echo "error: DATABASE_URL kosong di $ENV_FILE" >&2
  exit 1
fi
if [[ "$db_url" == https://db-sambasku-staging.iamutaki.com* ]] \
  || [[ "$db_url" == *staging*turso* ]]; then
  echo "error: DATABASE_URL mengarah ke staging: $db_url" >&2
  exit 1
fi
if [[ "$db_url" != http://host.docker.internal:* ]] \
  && [[ "$db_url" != http://127.0.0.1:* ]] \
  && [[ "$db_url" != http://localhost:* ]] \
  && [[ "$db_url" != http://100.* ]]; then
  echo "warn: DATABASE_URL bukan hop lokal: $db_url" >&2
  echo "  di VPS sebaiknya sqld di host yang sama (host.docker.internal)." >&2
fi

echo "==> docker compose -f $COMPOSE_FILE up (bind ${APP_BIND_HOST:-127.0.0.1}:8181)"

export API_IMAGE="${API_IMAGE:-ghcr.io/sambasku/api:production}"
export PULL_POLICY="${PULL_POLICY:-always}"

if [[ "${LOCAL_BUILD:-}" == "1" ]]; then
  echo "==> LOCAL_BUILD=1 → build lokal sambasku-api:local-production"
  export API_IMAGE=sambasku-api:local-production
  export PULL_POLICY=never
  docker compose -f "$COMPOSE_FILE" up -d --build
else
  echo "==> pull $API_IMAGE"
  docker compose -f "$COMPOSE_FILE" pull app
  docker compose -f "$COMPOSE_FILE" up -d --no-build
fi

echo "==> status"
docker compose -f "$COMPOSE_FILE" ps
echo "==> smoke: COMPOSE_FILE=$COMPOSE_FILE CONTAINER_NAME=sambasku-api-production ./scripts/smoke.sh"
