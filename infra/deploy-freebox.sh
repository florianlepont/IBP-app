#!/bin/bash
# Deploy ibp-api to Freebox Ultra VM
set -e

VM="freebox@192.168.1.106"
IMAGE="ibp-api:latest"

echo "→ Building image (linux/arm64)..."
docker build --platform linux/arm64 -t "$IMAGE" "$(dirname "$0")/../api"

echo "→ Transferring image to VM..."
docker save "$IMAGE" | gzip | ssh "$VM" 'docker load'

echo "→ Restarting API container..."
ssh "$VM" "cd ~ && docker compose --env-file .env.freebox up -d api"

echo "✓ Deploy complete"
