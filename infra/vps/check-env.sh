#!/usr/bin/env bash
#
# Vérifie le fichier d'environnement du VPS avec les mêmes règles de production
# que l'API (phase 01.7, D-05, D-17, D-18), sans Node ni Docker.
#
# Usage, sur le VPS, avant la fusion (voir README.md) :
#   git -C /home/ubuntu/cortege fetch -q origin <branche> && \
#     git -C /home/ubuntu/cortege show origin/<branche>:infra/vps/check-env.sh \
#     | bash -s -- /home/ubuntu/cortege.env
#
# Le fichier n'est jamais exécuté (ni source, ni eval) : chaque ligne
# CLE=VALEUR est lue comme du texte. Le script n'affiche jamais une valeur,
# seulement des noms de variables.
#
# Les valeurs imposées par le bloc `environment:` de
# infra/docker-compose.vps.yml remplacent celles du fichier, comme pour l'API :
# NODE_ENV=production, POSTGRES_HOST=postgres, POSTGRES_PORT=5432,
# OBJECT_STORAGE_MODE=minio, OBJECT_STORAGE_SECRET_KEY <- MINIO_SECRET_KEY,
# OBJECT_STORAGE_ACCESS_KEY <- MINIO_ACCESS_KEY (non vérifiée : « minio » est
# accepté). La parité avec l'API est prouvée par
# api/test/check-env-parity.spec.ts.
#
# Code de sortie : 0 si tout est bon, 1 sinon.

set -euo pipefail

ENV_FILE="${1:-/home/ubuntu/cortege.env}"

# Variables supprimées en phase 01.7 (D-04) : sans effet, les lignes peuvent partir.
DEAD_VARIABLES=(
  ACCESS_TOKEN_SECRET
  REFRESH_TOKEN_SECRET
  ACCESS_TOKEN_EXPIRES_IN
  REFRESH_TOKEN_EXPIRES_IN
  AUTH_DEV_EXPOSE_EMAIL_TOKEN
  AUTH_LOGIN_OR_CREATE_ENABLED
)

REASON_REQUIRED="doit être renseignée en production."
REASON_DEFAULT_SECRET="vide, valeur par défaut de développement ou exemple CHANGE_ME : définissez un secret propre à la production."

problems=0

error() {
  printf 'ERREUR : %s : %s\n' "$1" "$2"
  problems=$((problems + 1))
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

if [ ! -r "$ENV_FILE" ] || [ -d "$ENV_FILE" ]; then
  printf 'ERREUR : %s : fichier introuvable ou illisible.\n' "$ENV_FILE"
  printf 'À corriger avant la fusion : 1 problème(s).\n'
  exit 1
fi

declare -A ENV=()

while IFS= read -r raw_line || [ -n "$raw_line" ]; do
  line="$(trim "$raw_line")"
  if [ -z "$line" ] || [ "${line:0:1}" = "#" ]; then
    continue
  fi
  if [ "${line:0:7}" = "export " ]; then
    line="$(trim "${line:7}")"
  fi
  case "$line" in
    *=*) ;;
    *) continue ;;
  esac
  key="$(trim "${line%%=*}")"
  value="$(trim "${line#*=}")"
  if ! [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    continue
  fi
  if [ "${#value}" -ge 2 ]; then
    first="${value:0:1}"
    last="${value: -1}"
    if { [ "$first" = '"' ] && [ "$last" = '"' ]; } || { [ "$first" = "'" ] && [ "$last" = "'" ]; }; then
      value="${value:1:${#value}-2}"
    fi
  fi
  ENV["$key"]="$value"
done < "$ENV_FILE"

# Valeur du fichier, ou vide si la variable est absente.
get() {
  if [ -n "${ENV[$1]+set}" ]; then
    printf '%s' "${ENV[$1]}"
  fi
}

is_blank() {
  [ -z "$(trim "$1")" ]
}

# Même règle que isKnownDefaultSecret (api/src/config/production-rules.ts).
is_default_secret() {
  local value
  value="$(trim "$1")"
  value="${value,,}"
  [ -z "$value" ] && return 0
  case "$value" in
    ibp | minio | minio123) return 0 ;;
  esac
  [[ "$value" =~ ^change[-_]?me ]]
}

# Même règle que corsProblem (api/src/config/production-rules.ts).
check_cors() {
  local value lowered entry count=0 placeholder=0 malformed=0
  local -a parts=()
  value="$(trim "$1")"
  if [ -z "$value" ]; then
    error CORS_ORIGIN "doit être renseignée en production : « none » pour désactiver CORS, ou une liste d'origines https://hôte séparées par des virgules."
    return
  fi
  lowered="${value,,}"
  if [ "$lowered" = "none" ]; then
    return
  fi
  IFS=',' read -r -a parts <<< "$value"
  for entry in "${parts[@]}"; do
    entry="$(trim "$entry")"
    [ -z "$entry" ] && continue
    count=$((count + 1))
    if [[ "${entry,,}" =~ change[-_]me ]]; then
      placeholder=1
    fi
    if ! [[ "$entry" =~ ^https?://[^/[:space:]]+$ ]]; then
      malformed=1
    fi
  done
  if [ "$count" -eq 0 ]; then
    error CORS_ORIGIN "ne contient aucune origine : utilisez « none » ou une liste d'origines https://hôte."
  elif [ "$placeholder" -eq 1 ]; then
    error CORS_ORIGIN "contient encore l'exemple CHANGE_ME : remplacez-le par l'origine réelle, ou par « none »."
  elif [ "$malformed" -eq 1 ]; then
    error CORS_ORIGIN "chaque origine doit être de la forme https://hôte (sans chemin ni barre finale), ou la valeur entière « none »."
  fi
}

# PostgreSQL : POSTGRES_HOST et POSTGRES_PORT viennent du fichier compose.
for variable in POSTGRES_USER POSTGRES_DB; do
  if is_blank "$(get "$variable")"; then
    error "$variable" "$REASON_REQUIRED"
  fi
done
if is_default_secret "$(get POSTGRES_PASSWORD)"; then
  error POSTGRES_PASSWORD "$REASON_DEFAULT_SECRET"
fi

# Stockage : le fichier compose impose OBJECT_STORAGE_MODE=minio.
if is_blank "$(get OBJECT_STORAGE_ENDPOINT)"; then
  error OBJECT_STORAGE_ENDPOINT "$REASON_REQUIRED"
fi
if is_default_secret "$(get MINIO_SECRET_KEY)"; then
  error MINIO_SECRET_KEY "$REASON_DEFAULT_SECRET (L'API la reçoit sous le nom OBJECT_STORAGE_SECRET_KEY.)"
fi

for variable in AUTH0_DOMAIN AUTH0_AUDIENCE; do
  if is_blank "$(get "$variable")"; then
    error "$variable" "$REASON_REQUIRED"
  fi
done

check_cors "$(get CORS_ORIGIN)"

if [ "$problems" -eq 0 ]; then
  printf 'OK : le fichier %s respecte les règles de production de l’API.\n' "$ENV_FILE"
fi

for variable in AUTH0_MGMT_CLIENT_ID AUTH0_MGMT_CLIENT_SECRET; do
  mgmt="$(trim "$(get "$variable")")"
  if [ -z "$mgmt" ] || [[ "${mgmt,,}" =~ ^change[-_]?me ]]; then
    printf 'ATTENTION : %s : vide ou exemple CHANGE_ME : la suppression de compte côté Auth0 ne fonctionnera pas.\n' "$variable"
  fi
done

for variable in "${DEAD_VARIABLES[@]}"; do
  if [ -n "${ENV[$variable]+set}" ]; then
    printf 'INFO : %s : ligne inutile, peut être supprimée.\n' "$variable"
  fi
done

if [ "$problems" -gt 0 ]; then
  printf 'À corriger avant la fusion : %d problème(s).\n' "$problems"
  exit 1
fi
exit 0
