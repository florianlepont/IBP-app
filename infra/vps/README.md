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

## MinIO: sauvegarde du volume et passage à pgsty/minio

### Pourquoi l'image change

Les images MinIO officielles ne sont plus servies : quay.io répond 401 et
`minio/minio` a disparu de Docker Hub. Un VPS neuf ou un `docker image prune`
laisserait donc le stockage sans image. Les deux fichiers compose utilisent
maintenant `pgsty/minio`, le fork maintenu déjà utilisé par la CI, épinglé par
le même digest.

Le changement se fait **tout seul au premier déploiement après le merge** :
`update-stack.sh` avance le dépôt, puis `compose up -d` télécharge la nouvelle
image et recrée MinIO sur le même volume. Il n'y a rien à lancer à la main pour
le changement d'image, mais **la sauvegarde du volume doit être faite avant le
merge**.

### Sauvegarder le volume (avant le merge)

Compose préfixe le volume par le nom du projet ; on le retrouve donc par son
suffixe au lieu d'écrire le préfixe en dur.

```bash
# Arrêter le timer, pour qu'un déploiement ne redémarre pas MinIO pendant la copie
sudo systemctl stop cortege-deploy.timer
cd /home/ubuntu/cortege

VOL=$(docker volume ls -q | grep 'cortege_minio_data$')
echo "$VOL"   # doit afficher exactement un nom

docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env stop minio
docker run --rm -v "$VOL":/data:ro -v /home/ubuntu:/backup alpine \
  tar czf /backup/minio-data-$(date +%F).tgz -C /data .
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env start minio

# L'archive ne doit pas être vide
ls -lh /home/ubuntu/minio-data-*.tgz

sudo systemctl start cortege-deploy.timer
```

### Restaurer le volume

```bash
sudo systemctl stop cortege-deploy.timer
cd /home/ubuntu/cortege

VOL=$(docker volume ls -q | grep 'cortege_minio_data$')
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env stop minio

# Vider le volume puis y extraire l'archive (remplacer la date)
docker run --rm -v "$VOL":/data -v /home/ubuntu:/backup alpine \
  sh -c 'find /data -mindepth 1 -delete && tar xzf /backup/minio-data-AAAA-MM-JJ.tgz -C /data'

docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env start minio
sudo systemctl start cortege-deploy.timer
```

### Vérifier après le déploiement

```bash
cd /home/ubuntu/cortege

# Doit afficher 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:9000/minio/health/live

# La colonne IMAGE doit montrer pgsty/minio
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env ps minio
```

## Vérification de la configuration (avant fusion et à chaque déploiement)

### Ce que l'API refuse en production

Avec `NODE_ENV=production` (imposé par le fichier compose), l'API refuse de
démarrer et nomme la variable en cause, sans jamais afficher sa valeur, si :

- `POSTGRES_USER` ou `POSTGRES_DB` est vide ou absente ;
- `POSTGRES_PASSWORD` ou `MINIO_SECRET_KEY` est vide, vaut une valeur de
  développement (`ibp`, `minio`, `minio123`) ou commence par `CHANGE_ME` /
  `change-me` ;
- `OBJECT_STORAGE_ENDPOINT`, `AUTH0_DOMAIN` ou `AUTH0_AUDIENCE` est vide ;
- `CORS_ORIGIN` est vide ou absente : mettre `none` (l'app mobile n'utilise pas
  CORS) ou une liste d'origines `https://hôte` séparées par des virgules.

`AUTH0_MGMT_CLIENT_ID` et `AUTH0_MGMT_CLIENT_SECRET` vides donnent seulement un
avertissement (la suppression de compte côté Auth0 ne marchera pas). Les lignes
`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`,
`REFRESH_TOKEN_EXPIRES_IN`, `AUTH_DEV_EXPOSE_EMAIL_TOKEN` et
`AUTH_LOGIN_OR_CREATE_ENABLED` ne servent plus et peuvent être supprimées.

### Vérifier le fichier avant la fusion

`infra/vps/check-env.sh` applique les mêmes règles à `/home/ubuntu/cortege.env`,
sans Node ni Docker, et ne fait que lire le fichier. On le prend directement
dans la branche à fusionner (remplacer `<branche>`) :

```bash
git -C /home/ubuntu/cortege fetch -q origin <branche> && git -C /home/ubuntu/cortege show origin/<branche>:infra/vps/check-env.sh | bash -s -- /home/ubuntu/cortege.env
```

Il affiche une ligne `ERREUR : <VARIABLE> : <raison>` par problème, puis
`OK : …` ou `À corriger avant la fusion : N problème(s).` Corriger le fichier
et relancer jusqu'à obtenir `OK`.

### Garde au déploiement

À chaque nouvelle image, `update-stack.sh` lance d'abord la vérification de la
nouvelle image avec l'environnement réel de l'API :

```bash
docker compose -f infra/docker-compose.vps.yml --env-file /home/ubuntu/cortege.env \
  run --rm --no-deps api node api/dist/config/check-config.js
```

- Si elle échoue, la pile n'est **pas** redémarrée : l'ancienne API continue de
  servir. Le journal contient les lignes `ERREUR` et le message
  `configuration check failed; the stack was NOT restarted` :
  `journalctl -u cortege-deploy -n 50`.
- Après correction de `/home/ubuntu/cortege.env`, le passage suivant du timer
  (5 minutes au plus) relance la vérification puis le déploiement, car le
  script compare l'image téléchargée à celle du conteneur en service. Pour ne
  pas attendre : `sudo systemctl start cortege-deploy.service`.

Quand la fusion modifie `update-stack.sh` lui-même, le script relance aussitôt
sa nouvelle version (une seule fois, variable `CORTEGE_UPDATE_STACK_REEXEC`) :
une nouvelle garde s'applique donc dès le déploiement qui l'apporte.

### Premier déploiement de la phase 01.7

La copie de `update-stack.sh` présente aujourd'hui sur le VPS date d'avant la
garde et la relance automatique. Au premier passage après la fusion, c'est elle
qui s'exécuterait : elle redémarrerait la pile sans vérifier la configuration.
Une seule fois, il faut donc arrêter le timer avant la fusion et faire avancer
le dépôt à la main, pour que ce soit le nouveau script qui déploie :

1. Sauvegarder le volume MinIO (section « Sauvegarder le volume » ci-dessus).
2. Mettre `CORS_ORIGIN=none` dans `/home/ubuntu/cortege.env`.
3. Lancer `check-env.sh` (commande ci-dessus) jusqu'à obtenir `OK`.
4. Arrêter le timer :

   ```bash
   sudo systemctl stop cortege-deploy.timer
   ```

5. Fusionner la PR sur GitHub.
6. Attendre la fin du job d'image de la CI sur `main` (3 à 5 minutes).
7. Faire avancer le dépôt du VPS :

   ```bash
   git -C /home/ubuntu/cortege fetch origin main && git -C /home/ubuntu/cortege merge --ff-only origin/main
   ```

8. Relancer le timer (ou `sudo systemctl start cortege-deploy.service` pour
   déployer tout de suite) ; le nouveau script, avec la garde, fait le
   déploiement :

   ```bash
   sudo systemctl start cortege-deploy.timer
   ```

Ensuite, chaque déploiement est protégé sans intervention.

## Sharing the machine

This VPS has 2 cores and 3.7 GB of RAM, and runs other projects. The stack caps
itself at 768 MB for PostgreSQL, 768 MB for the API and 384 MB for MinIO, so it
cannot starve its neighbours. Raise the limits in the compose file if the API
starts being OOM-killed under load.
