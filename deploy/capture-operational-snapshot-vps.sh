#!/usr/bin/env bash

set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.vps.yml"
PROJECT_NAME="weavecarbon"
OUTPUT_FILE="${1:-${ROOT_DIR}/artifacts/operations/snapshot-$(date -u +%Y%m%dT%H%M%SZ).txt}"

compose() {
  docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

[[ -f "${ENV_FILE}" ]] || { echo "Missing ${ENV_FILE}" >&2; exit 1; }
mkdir -p "$(dirname "${OUTPUT_FILE}")"
OUTPUT_FILE="$(cd "$(dirname "${OUTPUT_FILE}")" && pwd -P)/$(basename "${OUTPUT_FILE}")"

BE_CONTAINER="$(compose ps -q be)"
RAG_CONTAINER="$(compose ps -q rag)"
DB_CONTAINER="$(compose ps -q db)"
[[ -n "${BE_CONTAINER}" && -n "${RAG_CONTAINER}" && -n "${DB_CONTAINER}" ]] || {
  echo "Database, backend and RAG must be running." >&2
  exit 1
}

{
  echo "captured_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "project=${PROJECT_NAME}"
  echo
  echo "[container_resources]"
  docker stats --no-stream --format '{{json .}}' "${DB_CONTAINER}" "${BE_CONTAINER}" "${RAG_CONTAINER}"
  echo
  echo "[database_activity]"
  compose exec -T db sh -lc \
    'psql -X -qAt -F "|" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT datname,numbackends,xact_commit,xact_rollback,blks_read,blks_hit,temp_files,deadlocks FROM pg_stat_database WHERE datname=current_database(); SELECT state,count(*) FROM pg_stat_activity WHERE datname=current_database() GROUP BY state ORDER BY state;"'
  echo
  echo "[operational_queue_depth]"
  compose exec -T db sh -lc \
    'psql -X -qAt -F "|" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT status,count(*) FROM operational_jobs GROUP BY status ORDER BY status;"'
  echo
  echo "[backend_prometheus]"
  docker exec "${BE_CONTAINER}" node -e \
    "fetch('http://127.0.0.1:4000/metrics').then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(console.log)"
  echo
  echo "[rag_prometheus]"
  docker exec "${RAG_CONTAINER}" python -c \
    "import os,urllib.request; r=urllib.request.Request('http://127.0.0.1:8000/metrics',headers={'X-Internal-API-Key':os.environ['RAG_INTERNAL_API_KEY']}); print(urllib.request.urlopen(r,timeout=5).read().decode())"
} > "${OUTPUT_FILE}"

echo "Operational snapshot written to ${OUTPUT_FILE}"
