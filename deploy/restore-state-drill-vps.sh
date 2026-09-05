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
RPO_TARGET_SECONDS="${RPO_TARGET_SECONDS:-86400}"
RTO_TARGET_SECONDS="${RTO_TARGET_SECONDS:-3600}"
DRILL_STARTED_EPOCH="$(date -u +%s)"
DRILL_STARTED_AT_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DRILL_SUFFIX="$(date -u +%Y%m%d%H%M%S)-$$"
DRILL_NETWORK="weavecarbon-restore-${DRILL_SUFFIX}"
DB_CONTAINER="wc-restore-db-${DRILL_SUFFIX}"
BE_CONTAINER="wc-restore-be-${DRILL_SUFFIX}"
RAG_CONTAINER="wc-restore-rag-${DRILL_SUFFIX}"
FE_CONTAINER="wc-restore-fe-${DRILL_SUFFIX}"
RESTORE_DIR=""
BE_ENV_FILE=""
RAG_ENV_FILE=""
FE_ENV_FILE=""

compose() {
  docker compose --project-name "${PROJECT_NAME}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

usage() {
  cat <<'EOF'
Usage: ./deploy/restore-state-drill-vps.sh --bundle PATH [--target-db NAME]

Restores a verified state bundle into a disposable PostgreSQL container and
starts disposable backend, RAG and frontend containers against the restored
data. Live databases, volumes and containers are never modified.
EOF
}

fail() {
  echo "Restore drill failed: $*" >&2
  exit 1
}

cleanup() {
  local exit_code=$?
  for container in "${FE_CONTAINER}" "${RAG_CONTAINER}" "${BE_CONTAINER}" "${DB_CONTAINER}"; do
    docker rm --force "${container}" >/dev/null 2>&1 || true
  done
  docker network rm "${DRILL_NETWORK}" >/dev/null 2>&1 || true
  for secret_file in "${BE_ENV_FILE}" "${RAG_ENV_FILE}" "${FE_ENV_FILE}"; do
    [[ -n "${secret_file}" && -f "${secret_file}" ]] && rm -f -- "${secret_file}"
  done
  exit "${exit_code}"
}
trap cleanup EXIT

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 30); do
    if docker exec "${DB_CONTAINER}" pg_isready -U "${POSTGRES_USER}" -d postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "isolated PostgreSQL did not become ready"
}

wait_for_http() {
  local container="$1"
  local runtime="$2"
  local url="$3"
  local attempts="$4"
  local attempt
  for attempt in $(seq 1 "${attempts}"); do
    if [[ "${runtime}" == "node" ]]; then
      if docker exec "${container}" node -e "fetch('${url}').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        return 0
      fi
    elif docker exec "${container}" python -c "import urllib.request; urllib.request.urlopen('${url}', timeout=3).read()" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  docker logs --tail 80 "${container}" || true
  fail "${container} did not pass ${url} readiness"
}

write_database_counts() {
  local output_file="$1"
  docker exec -i "${DB_CONTAINER}" psql -X -q -v ON_ERROR_STOP=1 \
    -U "${POSTGRES_USER}" -d "${TARGET_DATABASE}" > "${output_file}" <<'SQL'
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
      AND schemaname NOT LIKE 'pg_temp_%'
      AND schemaname NOT LIKE 'pg_toast_temp_%'
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
  SELECT table_name, row_count FROM restore_table_counts ORDER BY table_name
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\t', HEADER true);
SQL
}

copy_container_environment() {
  local source_container="$1"
  local target_file="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${source_container}" > "${target_file}"
  chmod 600 "${target_file}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle) [[ $# -ge 2 ]] || fail "--bundle requires a path"; BUNDLE_DIR="$2"; shift 2 ;;
    --target-db) [[ $# -ge 2 ]] || fail "--target-db requires a name"; TARGET_DATABASE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
done

[[ -n "${BUNDLE_DIR}" ]] || { usage; fail "--bundle is required"; }
[[ -d "${BUNDLE_DIR}" ]] || fail "bundle directory does not exist: ${BUNDLE_DIR}"
[[ -f "${ENV_FILE}" ]] || fail "missing ${ENV_FILE}"
for command_name in docker sha256sum tar diff date awk; do
  command -v "${command_name}" >/dev/null 2>&1 || fail "${command_name} is not installed"
done
for limit in "${RPO_TARGET_SECONDS}" "${RTO_TARGET_SECONDS}"; do
  [[ "${limit}" =~ ^[1-9][0-9]*$ ]] || fail "RPO/RTO targets must be positive integer seconds"
done

BUNDLE_DIR="$(cd "${BUNDLE_DIR}" && pwd -P)"
for required_file in database.dump database-counts.tsv uploads.tar.gz uploads-members.txt \
  rag-data.tar.gz rag-data-members.txt deployment-manifest.env SHA256SUMS metadata.env; do
  [[ -f "${BUNDLE_DIR}/${required_file}" ]] || fail "bundle is missing ${required_file}"
done

echo "Verifying bundle checksums, dump and archive safety..."
(cd "${BUNDLE_DIR}" && sha256sum --check SHA256SUMS)
DB_IMAGE="$(awk -F= '$1 == "DB_IMAGE" { sub(/^[^=]*=/, ""); print }' "${BUNDLE_DIR}/deployment-manifest.env")"
BE_IMAGE="$(awk -F= '$1 == "BE_IMAGE" { sub(/^[^=]*=/, ""); print }' "${BUNDLE_DIR}/deployment-manifest.env")"
RAG_IMAGE="$(awk -F= '$1 == "RAG_IMAGE" { sub(/^[^=]*=/, ""); print }' "${BUNDLE_DIR}/deployment-manifest.env")"
FE_IMAGE="$(awk -F= '$1 == "FE_IMAGE" { sub(/^[^=]*=/, ""); print }' "${BUNDLE_DIR}/deployment-manifest.env")"
for image_ref in "${DB_IMAGE}" "${BE_IMAGE}" "${RAG_IMAGE}" "${FE_IMAGE}"; do
  [[ -n "${image_ref}" ]] || fail "deployment manifest is missing a required image"
  docker image inspect "${image_ref}" >/dev/null 2>&1 || docker pull "${image_ref}"
done
docker run --rm -i "${DB_IMAGE}" pg_restore --list < "${BUNDLE_DIR}/database.dump" >/dev/null
for archive in uploads.tar.gz rag-data.tar.gz; do
  tar -tzf "${BUNDLE_DIR}/${archive}" >/dev/null
  if tar -tzf "${BUNDLE_DIR}/${archive}" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    fail "${archive} contains an unsafe path"
  fi
done

RECOVERY_POINT_AT_UTC="$(awk -F= '$1 == "RECOVERY_POINT_AT_UTC" { print $2 }' "${BUNDLE_DIR}/metadata.env")"
[[ -n "${RECOVERY_POINT_AT_UTC}" ]] || RECOVERY_POINT_AT_UTC="$(awk -F= '$1 == "CREATED_AT_UTC" { print $2 }' "${BUNDLE_DIR}/metadata.env")"
RECOVERY_POINT_EPOCH="$(date -u -d "${RECOVERY_POINT_AT_UTC}" +%s 2>/dev/null || true)"
[[ "${RECOVERY_POINT_EPOCH}" =~ ^[0-9]+$ ]] || fail "bundle has an invalid recovery point timestamp"
RPO_SECONDS="$(( DRILL_STARTED_EPOCH - RECOVERY_POINT_EPOCH ))"
(( RPO_SECONDS >= 0 )) || fail "bundle recovery point is in the future"

POSTGRES_USER="$(compose exec -T db sh -lc 'printf "%s" "$POSTGRES_USER"' | tr -d '\r')"
[[ -n "${POSTGRES_USER}" ]] || fail "could not resolve PostgreSQL user"
if [[ -z "${TARGET_DATABASE}" ]]; then
  TARGET_DATABASE="weavecarbon_restore_$(date -u +%Y%m%d_%H%M%S)"
fi
[[ "${TARGET_DATABASE}" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || fail "unsafe target database name"

SOURCE_BE="$(compose ps -q be)"
SOURCE_RAG="$(compose ps -q rag)"
SOURCE_FE="$(compose ps -q fe)"
[[ -n "${SOURCE_BE}" && -n "${SOURCE_RAG}" && -n "${SOURCE_FE}" ]] || \
  fail "backend, RAG and frontend must be running so their immutable images can be drilled"
mkdir -p "${RESTORE_ROOT}"
RESTORE_ROOT="$(cd "${RESTORE_ROOT}" && pwd -P)"
RESTORE_DIR="${RESTORE_ROOT}/${TARGET_DATABASE}"
[[ ! -e "${RESTORE_DIR}" ]] || fail "restore directory already exists: ${RESTORE_DIR}"
mkdir "${RESTORE_DIR}" "${RESTORE_DIR}/uploads" "${RESTORE_DIR}/rag-data" "${RESTORE_DIR}/rag-cache"
BE_ENV_FILE="${RESTORE_DIR}/.be.env"
RAG_ENV_FILE="${RESTORE_DIR}/.rag.env"
FE_ENV_FILE="${RESTORE_DIR}/.fe.env"
copy_container_environment "${SOURCE_BE}" "${BE_ENV_FILE}"
copy_container_environment "${SOURCE_RAG}" "${RAG_ENV_FILE}"
copy_container_environment "${SOURCE_FE}" "${FE_ENV_FILE}"

tar -xzf "${BUNDLE_DIR}/uploads.tar.gz" -C "${RESTORE_DIR}/uploads"
tar -xzf "${BUNDLE_DIR}/rag-data.tar.gz" -C "${RESTORE_DIR}/rag-data"
tar -tzf "${BUNDLE_DIR}/uploads.tar.gz" > "${RESTORE_DIR}/uploads-members.txt"
tar -tzf "${BUNDLE_DIR}/rag-data.tar.gz" > "${RESTORE_DIR}/rag-data-members.txt"
diff -u "${BUNDLE_DIR}/uploads-members.txt" "${RESTORE_DIR}/uploads-members.txt" >/dev/null
diff -u "${BUNDLE_DIR}/rag-data-members.txt" "${RESTORE_DIR}/rag-data-members.txt" >/dev/null

docker network create "${DRILL_NETWORK}" >/dev/null
POSTGRES_PASSWORD="restore-${DRILL_SUFFIX}"
docker run -d --name "${DB_CONTAINER}" --network "${DRILL_NETWORK}" \
  --security-opt no-new-privileges:true \
  -e POSTGRES_DB=postgres -e POSTGRES_USER="${POSTGRES_USER}" -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  "${DB_IMAGE}" >/dev/null
wait_for_postgres
docker exec "${DB_CONTAINER}" createdb -U "${POSTGRES_USER}" --template=template0 "${TARGET_DATABASE}"
docker exec -i "${DB_CONTAINER}" pg_restore --exit-on-error --no-owner --no-privileges \
  -U "${POSTGRES_USER}" -d "${TARGET_DATABASE}" < "${BUNDLE_DIR}/database.dump"
write_database_counts "${RESTORE_DIR}/database-counts.tsv"
diff -u "${BUNDLE_DIR}/database-counts.tsv" "${RESTORE_DIR}/database-counts.tsv" >/dev/null

docker run --rm --user 0:0 -v "${RESTORE_DIR}/uploads:/restore" "${BE_IMAGE}" \
  sh -c 'chown -R 1000:1000 /restore'
docker run --rm --user 0:0 -v "${RESTORE_DIR}/rag-data:/rag-data" -v "${RESTORE_DIR}/rag-cache:/rag-cache" "${RAG_IMAGE}" \
  sh -c 'chown -R 10001:10001 /rag-data /rag-cache && chmod -R u+rwX /rag-data /rag-cache'

docker run -d --name "${BE_CONTAINER}" --network "${DRILL_NETWORK}" --env-file "${BE_ENV_FILE}" \
  -e DB_HOST="${DB_CONTAINER}" -e DB_PORT=5432 -e DB_NAME="${TARGET_DATABASE}" \
  -e DB_USER="${POSTGRES_USER}" -e DB_PASSWORD="${POSTGRES_PASSWORD}" -e PORT=4000 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --security-opt no-new-privileges:true \
  -v "${RESTORE_DIR}/uploads:/app/uploads" "${BE_IMAGE}" >/dev/null
wait_for_http "${BE_CONTAINER}" node http://127.0.0.1:4000/ready 90

docker exec -i "${BE_CONTAINER}" node --input-type=module - <<'NODE'
const base = 'http://127.0.0.1:4000';
async function json(path, options = {}) {
  const response = await fetch(base + path, options);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}
const demo = await json('/api/auth/demo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'b2b', demo_scenario: 'sample_data' })
});
const token = demo?.data?.tokens?.access_token;
if (!token) throw new Error('restored auth flow did not issue a token');
const headers = { Authorization: `Bearer ${token}` };
await json('/api/dashboard/overview?trend_months=12', { headers });
await json('/api/products?page=1&page_size=5', { headers });
await json('/api/evidence?page=1&page_size=5', { headers });
NODE

docker run -d --name "${RAG_CONTAINER}" --network "${DRILL_NETWORK}" --env-file "${RAG_ENV_FILE}" \
  -e DB_HOST="${DB_CONTAINER}" -e DB_PORT=5432 -e DB_NAME="${TARGET_DATABASE}" \
  -e DB_USER="${POSTGRES_USER}" -e DB_PASSWORD="${POSTGRES_PASSWORD}" -e CHROMA_DB_PATH=/app/db \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=128m --security-opt no-new-privileges:true \
  -v "${RESTORE_DIR}/rag-data:/app/db" -v "${RESTORE_DIR}/rag-cache:/app/.cache" "${RAG_IMAGE}" >/dev/null
wait_for_http "${RAG_CONTAINER}" python http://127.0.0.1:8000/ready 120

docker run -d --name "${FE_CONTAINER}" --network "${DRILL_NETWORK}" --env-file "${FE_ENV_FILE}" \
  -e PORT=3000 -e HOSTNAME=0.0.0.0 -e BACKEND_HEALTH_URL="http://${BE_CONTAINER}:4000/ready" \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m --security-opt no-new-privileges:true \
  "${FE_IMAGE}" >/dev/null
wait_for_http "${FE_CONTAINER}" node http://127.0.0.1:3000/health 60

DRILL_COMPLETED_AT_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RTO_SECONDS="$(( $(date -u +%s) - DRILL_STARTED_EPOCH ))"
STATUS="PASS"
(( RPO_SECONDS <= RPO_TARGET_SECONDS )) || STATUS="FAIL"
(( RTO_SECONDS <= RTO_TARGET_SECONDS )) || STATUS="FAIL"

rm -f -- "${BE_ENV_FILE}" "${RAG_ENV_FILE}" "${FE_ENV_FILE}"
BE_ENV_FILE=""; RAG_ENV_FILE=""; FE_ENV_FILE=""
cat > "${RESTORE_DIR}/restore-report.txt" <<EOF
status=${STATUS}
production_data_touched=false
source_bundle=${BUNDLE_DIR}
recovery_point_at_utc=${RECOVERY_POINT_AT_UTC}
drill_started_at_utc=${DRILL_STARTED_AT_UTC}
completed_at_utc=${DRILL_COMPLETED_AT_UTC}
rpo_seconds=${RPO_SECONDS}
rpo_target_seconds=${RPO_TARGET_SECONDS}
rto_seconds=${RTO_SECONDS}
rto_target_seconds=${RTO_TARGET_SECONDS}
isolated_database=${TARGET_DATABASE}
backend_image=${BE_IMAGE}
rag_image=${RAG_IMAGE}
frontend_image=${FE_IMAGE}
verified=sha256,dump_catalog,exact_table_counts,archive_paths,archive_members,auth,dashboard,products,evidence,rag_ready,frontend_health
EOF

[[ "${STATUS}" == "PASS" ]] || fail "integrity passed but RPO/RTO target was exceeded; see ${RESTORE_DIR}/restore-report.txt"
echo "Full isolated restore drill PASS. Live database, volumes and containers were not modified."
echo "Report: ${RESTORE_DIR}/restore-report.txt"
