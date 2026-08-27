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

get_env_value() {
  local key="$1"
  local default_value="${2:-}"
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" | tail -n 1 || true)"

  if [[ -z "${line}" ]]; then
    printf '%s\n' "${default_value}"
    return
  fi

  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s\n' "${line}"
}

usage() {
  cat <<'EOF'
Usage: ./deploy/reset-db-vps.sh --yes [--skip-backup]

Resets only the Postgres data volume, then recreates the stack so
DATABASE_SCHEMA.sql is applied again on a fresh database.

Options:
  --yes          Required safety flag.
  --skip-backup  Do not create a PostgreSQL + evidence backup bundle before resetting.
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

compose config >/dev/null

DB_VOLUME_NAME="${PROJECT_NAME}_postgres_data"

if [[ "${SKIP_BACKUP}" -ne 1 ]] && [[ -n "$(compose ps -q db 2>/dev/null || true)" ]]; then
  "${ROOT_DIR}/deploy/backup-db-vps.sh"
fi

compose down

if docker volume inspect "${DB_VOLUME_NAME}" >/dev/null 2>&1; then
  docker volume rm "${DB_VOLUME_NAME}"
else
  echo "Postgres volume ${DB_VOLUME_NAME} does not exist yet. Continuing."
fi

compose pull be fe
compose up -d --build
compose ps

echo
echo "Database reset completed."
echo "A fresh database was created from $(get_env_value "BACKEND_SCHEMA_PATH" "../BE_Carbon-main/DATABASE_SCHEMA.sql")"
