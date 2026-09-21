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
                  ┌──────────────── VPS ─────────────────┐
  mobile app ──►  │  Caddy :443                          │
                  │    api.algernon.ovh   → :3000  api   │
                  │    files.algernon.ovh → :9000  minio │
                  │                                      │
                  │  postgres (no published port)        │
                  └──────────────────────────────────────┘
```

Deployment is **pull-based**: a systemd timer polls the registry every five
minutes and restarts the stack when the image digest changes. Nothing is stored
on GitHub — no SSH key, no deployment token.

## Attachments

Attachment URLs are **presigned by the API**, so the mobile app fetches objects
from MinIO directly. The signature covers the `Host` header, which means
`OBJECT_STORAGE_ENDPOINT` must be the public name clients call —
`https://files.algernon.ovh`, never `http://minio:9000`. Caddy forwards the
original `Host` by default, so MinIO validates the signature correctly.

The previous Freebox configuration used the internal address, so attachment
downloads could not have worked from a phone.

## Install

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu   # log out and back in

# The clone and the runtime environment
git clone https://github.com/florianlepont/IBP-app.git /home/ubuntu/cortege
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
  exec api node scripts/migrate.js

# Automatic updates
sudo cp infra/vps/cortege-deploy.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortege-deploy.timer
```

The MinIO bucket named in `OBJECT_STORAGE_BUCKET` must exist — create it from
the console on `127.0.0.1:9001` through an SSH tunnel, or with `mc`.

## Operating it

```bash
systemctl list-timers cortege-deploy.timer   # when it next fires
journalctl -u cortege-deploy.service -n 50   # what the last run did
sudo systemctl start cortege-deploy.service  # deploy now, without waiting
docker compose -f infra/docker-compose.vps.yml logs -f api
```

## Sharing the machine

This VPS has 2 cores and 3.7 GB of RAM, and runs other projects. The stack caps
itself at 768 MB for PostgreSQL, 768 MB for the API and 384 MB for MinIO, so it
cannot starve its neighbours. Raise the limits in the compose file if the API
starts being OOM-killed under load.
