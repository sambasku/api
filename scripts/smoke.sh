#!/usr/bin/env bash
# Smoke fase 1: /health + /api/v1/ping + container healthy.
# Acuan: docs/api/DOCKERIZE_STAGING_HOMELAB.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BIND_HOST="${APP_BIND_HOST:-127.0.0.1}"
BASE_URL="${SMOKE_BASE_URL:-http://${BIND_HOST}:8181}"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK: $*"; }

echo "==> compose ps"
docker compose -f compose.yaml ps

echo "==> tunggu health (max ~90s)"
healthy=0
for _ in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' sambasku-api-staging 2>/dev/null || echo missing)"
  if [[ "$status" == "healthy" ]]; then
    healthy=1
    break
  fi
  if [[ "$status" == "missing" ]]; then
    fail "container sambasku-api-staging tidak ada - jalankan ./scripts/staging-up.sh dulu"
  fi
  sleep 3
done
[[ "$healthy" -eq 1 ]] || fail "container belum healthy (status=$status)"
ok "container healthy"

echo "==> GET $BASE_URL/health"
health_body="$(curl -fsS "$BASE_URL/health")" || fail "curl /health gagal"
echo "$health_body" | grep -q '"status":"ok"' || fail "/health bukan ok: $health_body"
echo "$health_body" | grep -q '"database":"up"' || fail "/health database bukan up: $health_body"
ok "/health 200 database=up"

echo "==> GET $BASE_URL/api/v1/ping"
ping_body="$(curl -fsS "$BASE_URL/api/v1/ping")" || fail "curl /api/v1/ping gagal"
echo "$ping_body" | grep -q '"pong":true' || fail "ping tanpa pong: $ping_body"
echo "$ping_body" | grep -q '"runtime":"node"' || fail "runtime bukan node: $ping_body"
ok "/api/v1/ping runtime=node"

restart_policy="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' sambasku-api-staging)"
[[ "$restart_policy" == "unless-stopped" ]] || fail "restart policy=$restart_policy (harus unless-stopped)"
ok "restart policy unless-stopped"

echo
echo "SMOKE PASS (fase 1 health + ping)"
