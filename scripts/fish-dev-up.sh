#!/usr/bin/env bash
# One-shot setup + verification for Big Bass Bash /fish (API + static on PORT, default 8080).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

info() { echo "[fish-dev] $*"; }
fail() { echo "[fish-dev] ERROR: $*" >&2; exit 1; }

# Default 8787 avoids clashing with other dev servers commonly bound to 8080.
# Use: FISH_DEV_PORT=8080 npm run fish:dev
TARGET_PORT="${FISH_DEV_PORT:-8787}"

command -v docker >/dev/null 2>&1 || fail "Docker is required (Docker Desktop or docker CLI). Install it and retry."

info "Checking TCP ${TARGET_PORT} is free (set FISH_DEV_PORT to change)..."
if (echo >/dev/tcp/127.0.0.1/"${TARGET_PORT}") >/dev/null 2>&1; then
  fail "Port ${TARGET_PORT} is already in use. Stop that process (see: lsof -nP -iTCP:${TARGET_PORT} -sTCP:LISTEN) or pick another port, e.g. FISH_DEV_PORT=9888 npm run fish:dev"
fi

info "Starting DynamoDB Local (docker compose)..."
docker compose up -d

info "Waiting for DynamoDB Local on port 8000..."
ready=""
for _ in $(seq 1 90); do
  if (echo >/dev/tcp/127.0.0.1/8000) >/dev/null 2>&1; then
    ready="1"
    break
  fi
  sleep 1
done
[ -n "$ready" ] || fail "Nothing is listening on 127.0.0.1:8000. Is Docker running? Try: docker compose logs"

if [ ! -f .env ]; then
  info "Creating .env from .env.example"
  cp .env.example .env
fi

info "Installing npm dependencies..."
npm install

# Load .env then force PORT for this workflow (same server serves /api and /fish/).
set -a
# shellcheck disable=SC1091
. ./.env
set +a
export PORT="$TARGET_PORT"

info "Creating DynamoDB table if needed..."
npm run ddb:create-table

info "Smoke-testing API and /fish/ on http://127.0.0.1:${TARGET_PORT} (temporary server)..."
npm run start &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${TARGET_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "Server exited before becoming healthy. Run: npm run start (see errors above)."
  fi
  sleep 1
done

HEALTH="$(curl -sf "http://127.0.0.1:${TARGET_PORT}/api/health")" || fail "GET /api/health failed"
echo "$HEALTH" | grep -q '"ok":true' || fail "Unexpected /api/health body: $HEALTH"

HTML="$(curl -sfL "http://127.0.0.1:${TARGET_PORT}/fish/")" || fail "GET /fish/ failed — static files not served (check server static root)."
echo "$HTML" | grep -q "Big Bass Bash" || fail "GET /fish/ did not include expected content. First bytes were: $(echo "$HTML" | head -c 120 | tr '\n' ' ')"

info "Smoke tests passed:"
info "  GET http://127.0.0.1:${TARGET_PORT}/api/health -> ok"
info "  GET http://127.0.0.1:${TARGET_PORT}/fish/ -> HTML ok"

cleanup
trap - EXIT

info "Starting dev server (watch mode) on http://127.0.0.1:${TARGET_PORT}/fish/"
exec env PORT="$TARGET_PORT" npm run dev
