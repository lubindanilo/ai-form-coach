#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "${ROOT_DIR}"

echo "[deploy] pulling latest code"
git pull --ff-only

echo "[deploy] starting docker services"
cd infra
docker compose up --build -d

echo "[deploy] health checks"
curl -fsS http://127.0.0.1:3000/health >/dev/null
curl -fsS http://127.0.0.1:3000/ready >/dev/null || true

echo "[deploy] done"
