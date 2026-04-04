#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.vps.yml"
PROJECT_NAME="weavecarbon"

compose() {
  docker compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

cleanup_legacy_containers() {
  mapfile -t legacy_container_ids < <(
    docker ps -aq --format '{{.ID}} {{.Names}}' | awk '
      $2 == "weavecarbon-db" ||
      $2 == "weavecarbon-be" ||
      $2 == "weavecarbon-rag" ||
      $2 == "weavecarbon-fe" ||
      $2 == "weavecarbon-proxy" ||
      $2 ~ /^[[:alnum:]]+_weavecarbon-(db|be|rag|fe|proxy)$/ {
        print $1
      }
    '
  )

  if [[ "${#legacy_container_ids[@]}" -gt 0 ]]; then
    echo "Removing legacy containers: ${legacy_container_ids[*]}"
    docker rm -f "${legacy_container_ids[@]}"
  fi
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it before running deploy."
  exit 1
fi

cd "${ROOT_DIR}"

compose config >/dev/null
cleanup_legacy_containers
compose up -d --build --remove-orphans
compose ps
