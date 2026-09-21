#!/usr/bin/env bash
#
# Pull-based deployment for the Freebox host.
#
# The repository is public, so GitHub Actions no longer reaches into this
# machine to deploy: a self-hosted runner on a public repository can be made to
# execute code from a fork. The direction is reversed instead — this host polls
# the registry and updates itself, which needs no inbound access, no runner and
# no credentials stored on GitHub.
#
# Install it with the systemd units next to this script; see README.md.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/freebox/cortege}"
ENV_FILE="${ENV_FILE:-/home/freebox/.env.freebox}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/v1/health}"
COMPOSE_FILE="$REPO_DIR/infra/docker-compose.freebox.yml"

log() { printf '%s %s\n' "$(date -Is)" "$*"; }

[ -d "$REPO_DIR/.git" ] || { log "ERROR: $REPO_DIR is not a git clone"; exit 1; }
[ -f "$ENV_FILE" ] || { log "ERROR: $ENV_FILE is missing"; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# Track main without ever discarding local work: --ff-only fails loudly rather
# than rewriting anything if this clone was modified by hand.
log "fetching main"
git -C "$REPO_DIR" fetch --quiet origin main
git -C "$REPO_DIR" merge --ff-only --quiet origin/main

before="$(docker image inspect --format '{{.Id}}' ghcr.io/florianlepont/cortege:latest 2>/dev/null || echo none)"
log "pulling image"
compose pull --quiet api
after="$(docker image inspect --format '{{.Id}}' ghcr.io/florianlepont/cortege:latest 2>/dev/null || echo none)"

if [ "$before" = "$after" ]; then
  log "image unchanged, nothing to do"
  exit 0
fi

log "image changed, restarting the stack"
compose up -d

for attempt in $(seq 1 12); do
  status="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$status" = "200" ]; then
    log "API healthy after $attempt attempt(s)"
    # Reclaim the superseded image; keeps the Freebox disk from filling up.
    docker image prune --force --filter "until=24h" >/dev/null || true
    exit 0
  fi
  log "waiting for the API (attempt $attempt, status $status)"
  sleep 5
done

log "ERROR: the API did not become healthy, last 50 log lines follow"
docker logs cortege-api --tail 50 || true
exit 1
