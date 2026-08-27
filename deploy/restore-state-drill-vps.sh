#!/usr/bin/env bash

set -euo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.vps.yml"
PROJECT_NAME="weavecarbon"
BUNDLE_DIR=""
TARGET_DATABASE=""
RESTORE_ROOT="${ROOT_DIR}/restore-drills"

compose() {
  docker compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

usage() {
  cat <<'EOF'
Usage: ./deploy/restore-state-drill-vps.sh --bundle PATH [--target-db NAME]

Restores a verified bundle into a brand-new isolated PostgreSQL database and a
new local evidence directory. It refuses to overwrite the configured database,
an existing database, or an existing evidence directory.
EOF
}

fail() {
  echo "Restore drill failed: $*" >&2
  exit 1
}

write_database_counts() {
  local database="$1"
  local output_file="$2"

  compose exec -T db psql -X -q -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER}" -d "${database}" > "${output_file}" <<'SQL'
CREATE TEMP TABLE restore_table_counts (
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
    INSERT INTO restore_table_counts(table_name, row_count)
    VALUES (format('%I.%I', item.schemaname, item.tablename), item_count);
  END LOOP;
END
$$;
COPY (
  SELECT table_name, row_count
  FROM restore_table_counts
  ORDER BY table_name
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\t', HEADER true);
SQL
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle)
      [[ $# -ge 2 ]] || fail "--bundle requires a path"
      BUNDLE_DIR="$2"
      shift 2
      ;;
    --target-db)
      [[ $# -ge 2 ]] || fail "--target-db requires a name"
      TARGET_DATABASE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

[[ -n "${BUNDLE_DIR}" ]] || { usage; fail "--bundle is required"; }
[[ -d "${BUNDLE_DIR}" ]] || fail "bundle directory does not exist: ${BUNDLE_DIR}"
[[ -f "${ENV_FILE}" ]] || fail "missing ${ENV_FILE}"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is not installed"
command -v tar >/dev/null 2>&1 || fail "tar is not installed"
command -v diff >/dev/null 2>&1 || fail "diff is not installed"

BUNDLE_DIR="$(cd "${BUNDLE_DIR}" && pwd -P)"
for required_file in database.dump database-counts.tsv uploads.tar.gz uploads-members.txt \
  rag-data.tar.gz rag-data-members.txt SHA256SUMS metadata.env; do
  [[ -f "${BUNDLE_DIR}/${required_file}" ]] || fail "bundle is missing ${required_file}"
done

echo "Verifying bundle checksums and archive formats..."
(cd "${BUNDLE_DIR}" && sha256sum --check SHA256SUMS)
compose exec -T db sh -lc 'exec pg_restore --list' < "${BUNDLE_DIR}/database.dump" >/dev/null
tar -tzf "${BUNDLE_DIR}/uploads.tar.gz" >/dev/null
tar -tzf "${BUNDLE_DIR}/rag-data.tar.gz" >/dev/null
for archive in uploads.tar.gz rag-data.tar.gz; do
  if tar -tzf "${BUNDLE_DIR}/${archive}" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    fail "${archive} contains an unsafe path"
  fi
done

POSTGRES_USER="$(compose exec -T db sh -lc 'printf "%s" "$POSTGRES_USER"' | tr -d '\r')"
SOURCE_DATABASE="$(compose exec -T db sh -lc 'printf "%s" "$POSTGRES_DB"' | tr -d '\r')"
if [[ -z "${TARGET_DATABASE}" ]]; then
  TARGET_DATABASE="weavecarbon_restore_$(date -u +%Y%m%d_%H%M%S)"
fi

[[ "${TARGET_DATABASE}" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || \
  fail "target database must match ^[a-z][a-z0-9_]{0,62}$"
[[ "${TARGET_DATABASE}" != "${SOURCE_DATABASE}" ]] || \
  fail "target database must not be the configured live database"
[[ -n "$(compose ps -q db 2>/dev/null || true)" ]] || fail "database service is not running"

DATABASE_EXISTS="$(compose exec -T db psql -X -qAt -U "${POSTGRES_USER}" -d postgres \
  -c "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DATABASE}'" | tr -d '\r')"
[[ -z "${DATABASE_EXISTS}" ]] || fail "target database already exists; refusing to overwrite it"

RESTORE_ROOT_ABS="${RESTORE_ROOT}"
mkdir -p "${RESTORE_ROOT_ABS}"
RESTORE_ROOT_ABS="$(cd "${RESTORE_ROOT_ABS}" && pwd -P)"
RESTORE_DIR="${RESTORE_ROOT_ABS}/${TARGET_DATABASE}"
[[ ! -e "${RESTORE_DIR}" ]] || fail "restore directory already exists: ${RESTORE_DIR}"
mkdir "${RESTORE_DIR}"

echo "Creating isolated database ${TARGET_DATABASE}..."
compose exec -T db createdb -U "${POSTGRES_USER}" --template=template0 "${TARGET_DATABASE}"
if ! compose exec -T db pg_restore --exit-on-error --no-owner --no-privileges \
  -U "${POSTGRES_USER}" -d "${TARGET_DATABASE}" < "${BUNDLE_DIR}/database.dump"; then
  fail "database restore failed; inspect ${TARGET_DATABASE}, then remove only that isolated database"
fi

write_database_counts "${TARGET_DATABASE}" "${RESTORE_DIR}/database-counts.tsv"
if ! diff -u "${BUNDLE_DIR}/database-counts.tsv" "${RESTORE_DIR}/database-counts.tsv" \
  > "${RESTORE_DIR}/database-counts.diff"; then
  fail "restored database counts differ; see ${RESTORE_DIR}/database-counts.diff"
fi
rm "${RESTORE_DIR}/database-counts.diff"

mkdir "${RESTORE_DIR}/uploads"
tar -xzf "${BUNDLE_DIR}/uploads.tar.gz" -C "${RESTORE_DIR}/uploads"
tar -tzf "${BUNDLE_DIR}/uploads.tar.gz" > "${RESTORE_DIR}/uploads-members.txt"
diff -u "${BUNDLE_DIR}/uploads-members.txt" "${RESTORE_DIR}/uploads-members.txt" >/dev/null

mkdir "${RESTORE_DIR}/rag-data"
tar -xzf "${BUNDLE_DIR}/rag-data.tar.gz" -C "${RESTORE_DIR}/rag-data"
tar -tzf "${BUNDLE_DIR}/rag-data.tar.gz" > "${RESTORE_DIR}/rag-data-members.txt"
diff -u "${BUNDLE_DIR}/rag-data-members.txt" "${RESTORE_DIR}/rag-data-members.txt" >/dev/null

cat > "${RESTORE_DIR}/restore-report.txt" <<EOF
status=PASS
source_bundle=${BUNDLE_DIR}
isolated_database=${TARGET_DATABASE}
isolated_uploads=${RESTORE_DIR}/uploads
isolated_rag_data=${RESTORE_DIR}/rag-data
verified=sha256,dump_catalog,exact_table_counts,archive_paths,archive_members
completed_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "Restore drill PASS. No live database or upload volume was overwritten."
echo "Report: ${RESTORE_DIR}/restore-report.txt"
echo "After inspection, remove only the isolated database with:"
echo "  docker compose --project-name ${PROJECT_NAME} --env-file .env.vps -f docker-compose.vps.yml exec -T db dropdb -U ${POSTGRES_USER} ${TARGET_DATABASE}"
