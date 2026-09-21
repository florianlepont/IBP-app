# Freebox deployment

The API is deployed **pull-based**: this host polls the container registry and
updates itself. GitHub never reaches into the machine.

## Why not GitHub Actions

Deployment used to run on a self-hosted runner installed here, triggered by a
successful CI run on `main`. That is unsafe now that the repository is public:
a pull request from a fork can make a self-hosted runner execute its code, on
this machine, on a home network. GitHub documents the risk and recommends
self-hosted runners only for private repositories.

Reversing the direction removes the problem entirely — no runner, no inbound
access, no deployment credentials stored on GitHub. CI publishes the image, and
this host decides when to take it.

## How it works

1. CI builds `ghcr.io/florianlepont/cortege:latest` on every `main` push that
   touches `api/**`
2. `cortege-deploy.timer` runs `update-stack.sh` every five minutes
3. The script fast-forwards the local clone, pulls the image, and **exits
   immediately if the digest has not moved**
4. When it has, it restarts the stack, waits for `/v1/health`, and prunes the
   superseded image

A deployment therefore lands within five minutes of a merge. A tick that finds
nothing costs a single registry call.

## Install

```bash
git clone https://github.com/florianlepont/IBP-app.git /home/freebox/cortege

# Runtime secrets stay on this machine, outside the clone
ls -l /home/freebox/.env.freebox

sudo cp /home/freebox/cortege/infra/freebox/cortege-deploy.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortege-deploy.timer
```

If the GHCR package is private, authenticate once — a token with `read:packages`
is enough, and it never needs write access:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u florianlepont --password-stdin
```

## Operating it

```bash
systemctl list-timers cortege-deploy.timer   # when it next fires
journalctl -u cortege-deploy.service -n 50   # what the last run did
sudo systemctl start cortege-deploy.service  # deploy now, without waiting
```

The script refuses to run rather than destroy anything: it fast-forwards with
`--ff-only`, so a clone modified by hand fails loudly instead of being reset.
