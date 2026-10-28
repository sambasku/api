#!/usr/bin/env bash
# Up API staging: default pull GHCR (package public); LOCAL_BUILD=1 untuk build lokal.
# Tidak butuh PAT/GHCR_TOKEN tambahan - push CI pakai GITHUB_TOKEN bawaan.
# Acuan: docs/api/DOCKERIZE_STAGING_HOMELAB.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "error: api/.env belum ada. Salin secret staging, lalu set DATABASE_URL lokal." >&2
  echo "  contoh: DATABASE_URL=http://host.docker.internal:8080" >&2
  exit 1
fi

chmod 600 .env 2>/dev/null || true

# Compose ikut baca .env untuk interpolasi; pastikan hop DB bukan URL publik.
db_url="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$db_url" ]]; then
  echo "error: DATABASE_URL kosong di .env" >&2
  exit 1
fi
if [[ "$db_url" == https://db-sambasku-staging.iamutaki.com* ]] \
  || [[ "$db_url" == https://*iamutaki.com* ]] \
  || [[ "$db_url" == *turso.io* ]]; then
  echo "error: DATABASE_URL masih remote/publik: $db_url" >&2
  echo "  untuk container di mesin yang sama dengan sqld, pakai:" >&2
  echo "  DATABASE_URL=http://host.docker.internal:8080" >&2
  echo "  (atau http://100.71.13.88:8080 jika sqld listen di Tailscale)" >&2
  exit 1
fi
if [[ "$db_url" != http://host.docker.internal:* ]] \
  && [[ "$db_url" != http://100.71.13.* ]] \
  && [[ "$db_url" != http://127.0.0.1:* ]] \
  && [[ "$db_url" != http://localhost:* ]]; then
  echo "warn: DATABASE_URL tidak terlihat hop lokal: $db_url" >&2
  echo "  lanjut tetap diizinkan; pastikan ini sqld staging di mesin ini." >&2
fi

echo "==> docker compose up (bind ${APP_BIND_HOST:-127.0.0.1}:8181)"

if [[ "${LOCAL_BUILD:-}" == "1" ]]; then
  echo "==> LOCAL_BUILD=1 → build lokal (tag sebagai image compose)"
  export PULL_POLICY=never
  docker compose -f compose.yaml up -d --build
else
  echo "==> pull ${API_IMAGE:-ghcr.io/sambasku/api:staging} (package public - tanpa login)"
  export PULL_POLICY="${PULL_POLICY:-always}"
  docker compose -f compose.yaml pull app
  docker compose -f compose.yaml up -d --no-build
fi

echo "==> status"
docker compose -f compose.yaml ps
