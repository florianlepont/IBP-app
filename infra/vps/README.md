# VPS deployment

The API runs on the VPS, alongside the other projects already hosted there. The
host's Caddy is the only thing listening on 80/443; the stack publishes
everything on the loopback.

## Why not the Freebox

Hosting moved off the home machine. The self-hosted runner that used to deploy
it became unsafe once the repository went public — a pull request from a fork
can make such a runner execute its code — and the runner had in fact been
unregistered since May, so nothing had reached production for months without
anything reporting it. A residential connection with a dynamic address was
never the right place for this anyway.

## Shape of the deployment

```
                  ┌──────────────────── VPS ─────────────────────┐
  mobile app ──►  │  Caddy :443                                  │
                  │    cortege.algernon.ovh       → :3000  api   │
                  │    cortege-files.algernon.ovh → :9000  minio │
                  │                                              │
                  │  postgres (no published port)                │
                  └──────────────────────────────────────────────┘
```

Deployment is **pull-based**: a systemd timer polls the registry every five
minutes and restarts the stack when the image digest changes. Nothing is stored
on GitHub — no SSH key, no deployment token.

## Attachments

Attachment URLs are **presigned by the API**, so the mobile app fetches objects
from MinIO directly. The signature covers the `Host` header, which means
`OBJECT_STORAGE_ENDPOINT` must be the public name clients call —
`https://cortege-files.algernon.ovh`, never `http://minio:9000`. Caddy forwards the
original `Host` by default, so MinIO validates the signature correctly.

The previous Freebox configuration used the internal address, so attachment
downloads could not have worked from a phone.

## Install

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu   # log out and back in

# The clone and the runtime environment
git clone https://github.com/florianlepont/cortege.git /home/ubuntu/cortege
cp /home/ubuntu/cortege/infra/vps/env.example /home/ubuntu/cortege.env
chmod 600 /home/ubuntu/cortege.env
# then fill in every CHANGE_ME

# Caddy: append the two blocks, once both names resolve to this VPS
cat /home/ubuntu/cortege/infra/vps/Caddyfile.snippet | sudo tee -a /etc/caddy/Caddyfile
sudo systemctl reload caddy

# First start
cd /home/ubuntu/cortege
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env up -d

# Database schema
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env \
  exec api node api/scripts/migrate.js

# Automatic updates
sudo cp infra/vps/cortege-deploy.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortege-deploy.timer
```

The API creates the MinIO bucket named in `OBJECT_STORAGE_BUCKET` on first use
if it is missing; you can also create it from the console on `127.0.0.1:9001`
through an SSH tunnel, or with `mc`. Attachments and profile pictures both live
in that bucket.

## Operating it

```bash
systemctl list-timers cortege-deploy.timer   # when it next fires
journalctl -u cortege-deploy.service -n 50   # what the last run did
sudo systemctl start cortege-deploy.service  # deploy now, without waiting
docker compose -f infra/docker-compose.vps.yml logs -f api
```

## Rolling back

Every `main` build is also tagged `ghcr.io/florianlepont/cortege:sha-<commit>`. The
image runs as the non-root `node` user and reports Docker health from
`/v1/health`.

To roll back to a known-good commit:

```bash
# Stop the timer first, or the next poll re-pulls the bad :latest
sudo systemctl stop cortege-deploy.timer

docker pull ghcr.io/florianlepont/cortege:sha-<good-commit>
docker tag ghcr.io/florianlepont/cortege:sha-<good-commit> ghcr.io/florianlepont/cortege:latest
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env up -d api

# Re-enable the timer only once the fix has landed on main
sudo systemctl start cortege-deploy.timer
```

## Restoring the database

The sync changes feed (`GET /v1/sync/changes`) orders events by the id of the
transaction that wrote them (`survey_events.xid8`) and only serves events older
than the oldest running transaction. Those ids belong to the cluster that wrote
them. After restoring a **logical dump** (`pg_dump`/`pg_restore`, a new VPS, a
major PostgreSQL upgrade by dump), the new cluster's counter starts lower, the
restored events look like they come from the future, and the feed would withhold
all of them from every device.

So after any logical restore, and before starting the API, run this once:

```bash
# Keep the API stopped (and the deploy timer, which would restart it)
sudo systemctl stop cortege-deploy.timer
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env stop api

# ... restore the dump into the postgres service ...

docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env \
  exec postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "BEGIN; UPDATE survey_events SET xid8 = pg_current_xact_id(); COMMIT;"'

docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env up -d api
sudo systemctl start cortege-deploy.timer
```

Every event then carries the restore transaction's id and keeps its `seq` order.
Phones holding an older cursor get the whole feed again from the beginning (the
API detects a cursor from the future and restarts it). A physical copy of the
data directory or a volume move keeps the same cluster and needs none of this.
Background: `docs/technical/sync-conflict-resolution-v1.md`, "Database restore".

## Sharing the machine

This VPS has 2 cores and 3.7 GB of RAM, and runs other projects. The stack caps
itself at 768 MB for PostgreSQL, 768 MB for the API and 384 MB for MinIO, so it
cannot starve its neighbours. Raise the limits in the compose file if the API
starts being OOM-killed under load.
