#!/usr/bin/env bash
#
# Pull-based deployment for the VPS.
#
# This host polls the registry and updates itself rather than being deployed
# into. Nothing has to be stored on GitHub — no SSH key, no deployment token —
# and the machine needs no inbound access beyond what Caddy already serves.
#
# Install it with the systemd units next to this script; see README.md.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/cortege}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/cortege.env}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/v1/health}"
COMPOSE_FILE="$REPO_DIR/infra/docker-compose.vps.yml"
SELF="$REPO_DIR/infra/vps/update-stack.sh"

log() { printf '%s %s\n' "$(date -Is)" "$*"; }

[ -d "$REPO_DIR/.git" ] || { log "ERROR: $REPO_DIR is not a git clone"; exit 1; }
[ -f "$ENV_FILE" ] || { log "ERROR: $ENV_FILE is missing"; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# Fingerprint of this script before the fast-forward, to notice an update.
self_before="$(sha256sum "$SELF" 2>/dev/null | cut -d' ' -f1 || echo none)"

# Track main without ever discarding local work: --ff-only fails loudly rather
# than rewriting anything if this clone was modified by hand.
log "fetching main"
git -C "$REPO_DIR" fetch --quiet origin main
git -C "$REPO_DIR" merge --ff-only --quiet origin/main

# bash keeps executing the copy it started with, so a change to this script
# pulled just now would otherwise only apply on the next run (phase 01.7 D-21).
# git writes the new version as a new file, which leaves this process
# undisturbed; the variable makes a second re-exec impossible.
if [ -z "${CORTEGE_UPDATE_STACK_REEXEC:-}" ] &&
  [ "$(sha256sum "$SELF" | cut -d' ' -f1)" != "$self_before" ]; then
  log "update-stack.sh changed, re-executing the new copy"
  export CORTEGE_UPDATE_STACK_REEXEC=1
  exec bash "$SELF" "$@"
fi

before="$(docker image inspect --format '{{.Id}}' ghcr.io/florianlepont/cortege:latest 2>/dev/null || echo none)"
log "pulling image"
compose pull --quiet api
after="$(docker image inspect --format '{{.Id}}' ghcr.io/florianlepont/cortege:latest 2>/dev/null || echo none)"

# Compare with the image the API container actually runs, not only with the
# one present before the pull: a deploy refused by the configuration check
# leaves the new image pulled but not running, and the next run must retry it
# once the env file is fixed (phase 01.7 D-18).
running="$(docker inspect --format '{{.Image}}' cortege-api 2>/dev/null || echo none)"
if [ "$running" = "$after" ]; then
  log "the API already runs the latest image, nothing to do"
  exit 0
fi
if [ "$before" = "$after" ]; then
  log "image already pulled but not running yet, retrying the deploy"
fi

# Check the configuration with the new image and the exact environment the API
# will get (env file plus the compose environment block). On failure the old
# stack keeps serving; the check's French report lines go to the journal.
log "checking configuration against the new image"
if ! compose run --rm --no-deps api node api/dist/config/check-config.js; then
  log "ERROR: configuration check failed; the stack was NOT restarted and the previous API keeps serving. Fix $ENV_FILE and wait for the next run (or: sudo systemctl start cortege-deploy.service)"
  exit 1
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
