#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.vps.yml"

usage() {
  cat <<'EOF'
Usage: ./deploy/reset-db-vps.sh --yes [--skip-backup]

Resets only the Postgres data volume, then recreates the stack so
DATABASE_SCHEMA.sql is applied again on a fresh database.

Options:
  --yes          Required safety flag.
  --skip-backup  Do not create a SQL backup before resetting.
EOF
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it before running DB commands."
  exit 1
fi

CONFIRM_RESET=0
SKIP_BACKUP=0

for arg in "$@"; do
  case "${arg}" in
    --yes)
      CONFIRM_RESET=1
      ;;
    --skip-backup)
      SKIP_BACKUP=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}"
      usage
      exit 1
      ;;
  esac
done

if [[ "${CONFIRM_RESET}" -ne 1 ]]; then
  echo "Refusing to reset DB without --yes."
  usage
  exit 1
fi

cd "${ROOT_DIR}"

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config >/dev/null

DB_VOLUME_NAME="$(docker inspect weavecarbon-db --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"

if [[ -z "${DB_VOLUME_NAME}" ]]; then
  PROJECT_NAME="$(basename "${ROOT_DIR}" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')"
  DB_VOLUME_NAME="${PROJECT_NAME}_postgres_data"
fi

if [[ "${SKIP_BACKUP}" -ne 1 ]] && docker ps --format '{{.Names}}' | grep -qx 'weavecarbon-db'; then
  "${ROOT_DIR}/deploy/backup-db-vps.sh"
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" down

if docker volume inspect "${DB_VOLUME_NAME}" >/dev/null 2>&1; then
  docker volume rm "${DB_VOLUME_NAME}"
else
  echo "Postgres volume ${DB_VOLUME_NAME} does not exist yet. Continuing."
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo
echo "Database reset completed."
echo "A fresh database was created from ${ROOT_DIR}/../BE_Carbon-main/DATABASE_SCHEMA.sql"
