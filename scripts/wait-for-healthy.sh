#!/bin/sh
# Tunggu sampai seluruh service healthy, lalu keluar 0.
# Dipakai oleh Jenkinsfile pada stage integration test.
set -e

MAX_WAIT=120   # detik
WAITED=0

until [ "$WAITED" -ge "$MAX_WAIT" ]; do
  STATUS=$(docker compose ps --format '{{.Name}} {{.Health}}' 2>/dev/null || true)
  echo "$STATUS"

  if echo "$STATUS" | grep -q "api" && \
     echo "$STATUS" | grep -q "db" && \
     echo "$STATUS" | grep -q "web" && \
     ! echo "$STATUS" | grep -qv "healthy"; then
    echo "[wait-for-healthy] semua service healthy."
    exit 0
  fi

  sleep 5
  WAITED=$((WAITED + 5))
done

echo "[wait-for-healthy] TIMEOUT: service tidak pernah healthy." >&2
docker compose ps || true
docker compose logs --no-color | tail -50 || true
exit 1
