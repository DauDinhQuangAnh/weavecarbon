#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${ROOT_DIR}/backups"
BACKUP_FILE="${BACKUP_DIR}/postgres-${TIMESTAMP}.sql"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it before running DB commands."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx 'weavecarbon-db'; then
  echo "Container weavecarbon-db is not running. Start the stack before backing up."
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

docker exec weavecarbon-db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "${BACKUP_FILE}"

echo "Database backup created at ${BACKUP_FILE}"
