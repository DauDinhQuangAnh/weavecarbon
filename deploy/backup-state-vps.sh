#!/usr/bin/env bash

set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.vps.yml"
PROJECT_NAME="weavecarbon"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="${ROOT_DIR}/backups"
FINAL_DIR="${BACKUP_ROOT}/state-${TIMESTAMP}"
WORK_DIR="${BACKUP_ROOT}/.partial-state-${TIMESTAMP}-$$"
BE_WAS_RUNNING=0
RAG_WAS_RUNNING=0
SERVICES_QUIESCED=0

compose() {
  docker compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

fail() {
  echo "Backup failed: $*" >&2
  exit 1
}

cleanup_partial() {
  if [[ -n "${WORK_DIR:-}" && -d "${WORK_DIR}" ]]; then
    case "${WORK_DIR}" in
      "${BACKUP_ROOT}"/.partial-state-*) rm -rf -- "${WORK_DIR}" ;;
      *) echo "Refusing to remove unexpected partial path: ${WORK_DIR}" >&2 ;;
    esac
  fi
}

resume_application_services() {
  [[ "${SERVICES_QUIESCED}" -eq 1 ]] || return 0

  local services=()
  [[ "${BE_WAS_RUNNING}" -eq 1 ]] && services+=(be)
  [[ "${RAG_WAS_RUNNING}" -eq 1 ]] && services+=(rag)
  if [[ "${#services[@]}" -gt 0 ]]; then
    echo "Resuming application services: ${services[*]}"
    compose start "${services[@]}" >/dev/null
  fi
  SERVICES_QUIESCED=0
}

finish() {
  local exit_code=$?
  resume_application_services || true
  cleanup_partial
  exit "${exit_code}"
}

write_database_counts() {
  local output_file="$1"

  compose exec -T db sh -lc \
    'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    > "${output_file}" <<'SQL'
CREATE TEMP TABLE backup_table_counts (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
);
DO $$
DECLARE
  item record;
  item_count bigint;
BEGIN
  FOR item IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', item.schemaname, item.tablename)
      INTO item_count;
    INSERT INTO backup_table_counts(table_name, row_count)
    VALUES (format('%I.%I', item.schemaname, item.tablename), item_count);
  END LOOP;
END
$$;
COPY (
  SELECT table_name, row_count
  FROM backup_table_counts
  ORDER BY table_name
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\t', HEADER true);
SQL
}

trap finish EXIT

[[ -f "${ENV_FILE}" ]] || fail "missing ${ENV_FILE}; create it before running backup commands"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is not installed"
command -v tar >/dev/null 2>&1 || fail "tar is not installed"

compose config >/dev/null
[[ -n "$(compose ps -q db 2>/dev/null || true)" ]] || fail "database service is not running"
docker volume inspect "${PROJECT_NAME}_be_uploads" >/dev/null 2>&1 || \
  fail "evidence volume ${PROJECT_NAME}_be_uploads does not exist"
docker volume inspect "${PROJECT_NAME}_rag_data" >/dev/null 2>&1 || \
  fail "RAG index volume ${PROJECT_NAME}_rag_data does not exist"

[[ -n "$(compose ps -q be 2>/dev/null || true)" ]] && BE_WAS_RUNNING=1
[[ -n "$(compose ps -q rag 2>/dev/null || true)" ]] && RAG_WAS_RUNNING=1

echo "Quiescing backend and RAG writes for a consistent backup..."
SERVICES_QUIESCED=1
compose stop be rag >/dev/null

mkdir -p "${BACKUP_ROOT}"
BACKUP_ROOT="$(cd "${BACKUP_ROOT}" && pwd -P)"
FINAL_DIR="${BACKUP_ROOT}/state-${TIMESTAMP}"
WORK_DIR="${BACKUP_ROOT}/.partial-state-${TIMESTAMP}-$$"
[[ ! -e "${FINAL_DIR}" ]] || fail "backup destination already exists: ${FINAL_DIR}"
mkdir "${WORK_DIR}"

echo "Creating PostgreSQL custom-format dump..."
compose exec -T db sh -lc \
  'exec pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "${WORK_DIR}/database.dump"
[[ -s "${WORK_DIR}/database.dump" ]] || fail "database dump is empty"

compose exec -T db sh -lc 'exec pg_restore --list' \
  < "${WORK_DIR}/database.dump" > "${WORK_DIR}/database-catalog.txt"
[[ -s "${WORK_DIR}/database-catalog.txt" ]] || fail "pg_restore could not read the dump catalog"

echo "Recording exact database table counts..."
write_database_counts "${WORK_DIR}/database-counts.tsv"

echo "Archiving customer evidence and generated files from /app/uploads..."
compose run --rm --no-deps -T --entrypoint sh be -lc \
  'test -d /app/uploads && cd /app/uploads && exec tar -czf - .' \
  > "${WORK_DIR}/uploads.tar.gz"
tar -tzf "${WORK_DIR}/uploads.tar.gz" > "${WORK_DIR}/uploads-members.txt"

echo "Archiving the quiesced RAG index as a recoverable secondary copy..."
compose run --rm --no-deps -T --entrypoint sh \
  -v "${PROJECT_NAME}_rag_data:/snapshot:ro" be -lc \
  'test -d /snapshot && cd /snapshot && exec tar -czf - .' \
  > "${WORK_DIR}/rag-data.tar.gz"
tar -tzf "${WORK_DIR}/rag-data.tar.gz" > "${WORK_DIR}/rag-data-members.txt"

SOURCE_DATABASE="$(compose exec -T db sh -lc 'printf "%s" "$POSTGRES_DB"' | tr -d '\r')"
TABLE_COUNT="$(awk 'NR > 1 { count++ } END { print count + 0 }' "${WORK_DIR}/database-counts.tsv")"
TOTAL_ROWS="$(awk 'NR > 1 { total += $2 } END { print total + 0 }' "${WORK_DIR}/database-counts.tsv")"
UPLOAD_MEMBER_COUNT="$(wc -l < "${WORK_DIR}/uploads-members.txt" | tr -d ' ')"
RAG_MEMBER_COUNT="$(wc -l < "${WORK_DIR}/rag-data-members.txt" | tr -d ' ')"

cat > "${WORK_DIR}/metadata.env" <<EOF
FORMAT_VERSION=1
CREATED_AT_UTC=${TIMESTAMP}
SOURCE_DATABASE=${SOURCE_DATABASE}
POSTGRES_IMAGE=postgres:16-alpine
DATABASE_DUMP_FORMAT=custom
DATABASE_TABLE_COUNT=${TABLE_COUNT}
DATABASE_TOTAL_ROWS=${TOTAL_ROWS}
UPLOAD_ARCHIVE_PATH=/app/uploads
UPLOAD_ARCHIVE_MEMBER_COUNT=${UPLOAD_MEMBER_COUNT}
APPLICATION_WRITES_QUIESCED=true
RAG_INDEX_INCLUDED=true
RAG_ARCHIVE_PATH=/app/db
RAG_ARCHIVE_MEMBER_COUNT=${RAG_MEMBER_COUNT}
EOF

(
  cd "${WORK_DIR}"
  sha256sum \
    database.dump \
    database-catalog.txt \
    database-counts.tsv \
    uploads.tar.gz \
    uploads-members.txt \
    rag-data.tar.gz \
    rag-data-members.txt \
    metadata.env \
    > SHA256SUMS
)

mv "${WORK_DIR}" "${FINAL_DIR}"
WORK_DIR=""
resume_application_services
trap - EXIT

echo "Verified backup bundle created at ${FINAL_DIR}"
echo "Next safety step: ./deploy/restore-state-drill-vps.sh --bundle '${FINAL_DIR}'"
