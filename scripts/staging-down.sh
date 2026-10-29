#!/usr/bin/env bash
# Stop API staging compose.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose -f compose.yaml down
echo "==> down selesai"
