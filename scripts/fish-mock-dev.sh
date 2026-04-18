#!/usr/bin/env bash
# Local mock Big Bass Bash data (no Docker, no live scrape). Top 45 payout heuristic.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

info() { echo "[fish-mock] $*"; }
fail() { echo "[fish-mock] ERROR: $*" >&2; exit 1; }

TARGET_PORT="${FISH_DEV_PORT:-8787}"

info "Checking TCP ${TARGET_PORT} is free..."
if (echo >/dev/tcp/127.0.0.1/"${TARGET_PORT}") >/dev/null 2>&1; then
  fail "Port ${TARGET_PORT} is in use. Stop it or set FISH_DEV_PORT."
fi

info "Installing npm dependencies (if needed)..."
npm install

export USE_MOCK_LEADERBOARD=1
export PAYOUT_PLACES_HEURISTIC=45
export PORT="${TARGET_PORT}"

info "Smoke test (mock leaderboard, no DynamoDB)..."
npm run start:mock &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${TARGET_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "Server exited early."
  fi
  sleep 1
done

HEALTH="$(curl -sf "http://127.0.0.1:${TARGET_PORT}/api/health")" || fail "GET /api/health failed"
echo "$HEALTH" | grep -q '"mockLeaderboard":true' || fail "Expected mockLeaderboard true: $HEALTH"
echo "$HEALTH" | grep -q '"payoutPlacesHeuristic":45' || fail "Expected payoutPlacesHeuristic 45: $HEALTH"

HTML="$(curl -sfL "http://127.0.0.1:${TARGET_PORT}/fish/")" || fail "GET /fish/ failed"
echo "$HTML" | grep -q "Big Bass Bash" || fail "GET /fish/ unexpected body"

LB="$(curl -sf "http://127.0.0.1:${TARGET_PORT}/api/leaderboard")" || fail "GET /api/leaderboard failed"
echo "$LB" | grep -q 'mock://' || fail "Expected leaderboard sourceUrl to contain mock://"

info "Mock smoke tests passed."
cleanup
trap - EXIT

info "Starting watch server: http://127.0.0.1:${TARGET_PORT}/fish/"
exec env USE_MOCK_LEADERBOARD=1 PAYOUT_PLACES_HEURISTIC=45 PORT="${TARGET_PORT}" npm run dev:mock
