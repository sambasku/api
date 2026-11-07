#!/usr/bin/env bash
# Stop API production compose.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose -f compose.production.yaml down
echo "==> down selesai"
