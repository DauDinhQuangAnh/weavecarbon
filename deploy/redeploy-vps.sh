#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.vps"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.vps.yml"
PROJECT_NAME="weavecarbon"
DEPLOY_MODE="full"

compose() {
  COMPOSE_BAKE=false docker compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

usage() {
  cat <<'EOF'
Usage: ./deploy/redeploy-vps.sh [--frontend-only|--backend-only]

Options:
  --frontend-only  Pulls the configured frontend image and restarts only the frontend service.
  --backend-only   Pulls the configured backend image and restarts only the backend service.
  -h, --help       Show this help message.
EOF
}

retry_command() {
  local attempts="$1"
  local delay_seconds="$2"
  shift 2

  local attempt=1
  local exit_code=0

  while (( attempt <= attempts )); do
    if "$@"; then
      return 0
    else
      exit_code=$?
    fi

    if (( attempt == attempts )); then
      echo "Command failed after ${attempts} attempts: $*"
      return "${exit_code}"
    fi

    echo "Command failed (attempt ${attempt}/${attempts}): $*"
    echo "Retrying in ${delay_seconds}s..."
    sleep "${delay_seconds}"
    attempt=$((attempt + 1))
  done

  return "${exit_code}"
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

fetch_url() {
  local url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 20 "${url}"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- "${url}"
    return
  fi

  echo "Neither curl nor wget is available on this host, so post-deploy URL verification cannot run."
  return 127
}

acquire_deploy_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>/tmp/weavecarbon-deploy.lock
    echo "Waiting for deploy lock..."
    flock -w 900 9
    echo "Deploy lock acquired."
  fi
}

pull_images() {
  if [[ "$#" -eq 0 ]]; then
    return 0
  fi

  echo "Pulling prebuilt images: $*"
  retry_command 3 20 compose pull "$@"
}

wait_for_service_health() {
  local service="$1"
  local timeout_seconds="${2:-120}"
  local interval_seconds=5
  local elapsed_seconds=0
  local container_id status

  container_id="$(compose ps -q "${service}")"
  if [[ -z "${container_id}" ]]; then
    echo "No container found for service: ${service}"
    return 1
  fi

  echo "Waiting for ${service} to become healthy..."
  while (( elapsed_seconds <= timeout_seconds )); do
    status="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "${container_id}" 2>/dev/null || true
    )"

    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      echo "${service} is ${status}."
      return 0
    fi

    echo "${service} status: ${status:-unknown}; waiting ${interval_seconds}s..."
    sleep "${interval_seconds}"
    elapsed_seconds=$((elapsed_seconds + interval_seconds))
  done

  echo "${service} did not become healthy within ${timeout_seconds}s."
  docker logs --tail 80 "${container_id}" || true
  return 1
}

cleanup_legacy_containers() {
  mapfile -t legacy_container_ids < <(
    docker ps -a --format '{{.ID}}\t{{.Names}}' | awk -F '\t' '
      $2 == "weavecarbon-db" ||
      $2 == "weavecarbon-be" ||
      $2 == "weavecarbon-rag" ||
      $2 == "weavecarbon-fe" ||
      $2 == "weavecarbon-proxy" ||
      $2 ~ /^weavecarbon_(db|be|rag|fe|proxy)_[0-9]+$/ ||
      $2 ~ /^[[:alnum:]_.-]+_weavecarbon_(db|be|rag|fe|proxy)_[0-9]+$/ ||
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

cleanup_docker_disk() {
  echo "Docker disk usage before cleanup:"
  docker system df || true

  echo "Pruning unused Docker build cache, stopped containers, networks, and dangling images..."
  docker builder prune -af || true
  docker system prune -af || true
  docker volume prune -f || true

  echo "Docker disk usage after cleanup:"
  docker system df || true
}

docker_containers_using_port() {
  local port="$1"
  docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Labels}}' | awk -F '\t' -v port="${port}" '
    $2 ~ (":" port "->") {
      print $1 "\t" $2 "\t" $3
    }
  '
}

docker_project_containers_using_port() {
  local port="$1"
  docker_containers_using_port "${port}" | awk -F '\t' -v project="${PROJECT_NAME}" '
    $3 ~ ("(^|,)com.docker.compose.project=" project "($|,)") {
      print $1 "\t" $2
    }
  '
}

docker_other_containers_using_port() {
  local port="$1"
  docker_containers_using_port "${port}" | awk -F '\t' -v project="${PROJECT_NAME}" '
    $3 !~ ("(^|,)com.docker.compose.project=" project "($|,)") {
      print $1 "\t" $2
    }
  '
}

describe_port_usage() {
  local port="$1"
  local docker_output=""
  local socket_output=""

  docker_output="$(docker_containers_using_port "${port}" | awk -F '\t' '{ print $1 "\t" $2 }' || true)"

  if command -v ss >/dev/null 2>&1; then
    socket_output="$(ss -ltnp | awk -v port=":${port}" '$4 ~ port "$" || $4 ~ "\\*:" substr(port, 2) "$" || $4 ~ "\\[::\\]:" substr(port, 2) "$" { print }' || true)"
  elif command -v lsof >/dev/null 2>&1; then
    socket_output="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  fi

  if [[ -n "${docker_output}" ]]; then
    echo "Docker containers already using port ${port}:"
    echo "${docker_output}" | sed 's/^/  /'
  fi

  if [[ -n "${socket_output}" ]]; then
    echo "Host listeners currently bound to port ${port}:"
    echo "${socket_output}" | sed 's/^/  /'
  fi

  if [[ -z "${docker_output}" && -z "${socket_output}" ]]; then
    echo "Port ${port} is already allocated, but the owning process could not be detected automatically."
  fi
}

ensure_proxy_ports_available() {
  local http_port https_port
  local current_project_docker_output other_docker_output
  http_port="$(get_env_value "PROXY_HTTP_PORT" "80")"
  https_port="$(get_env_value "PROXY_HTTPS_PORT" "443")"

  for port in "${http_port}" "${https_port}"; do
    current_project_docker_output="$(docker_project_containers_using_port "${port}")"
    other_docker_output="$(docker_other_containers_using_port "${port}")"

    if [[ -n "${other_docker_output}" ]]; then
      echo "Cannot start the proxy because host port ${port} is already in use."
      describe_port_usage "${port}"
      echo
      echo "Stop the conflicting service, or set PROXY_HTTP_PORT / PROXY_HTTPS_PORT in ${ENV_FILE} if another reverse proxy owns ports 80/443."
      return 1
    fi

    if [[ -n "${current_project_docker_output}" ]]; then
      continue
    fi

    if command -v ss >/dev/null 2>&1; then
      if ss -ltn | awk -v port=":${port}" '$4 ~ port "$" || $4 ~ "\\*:" substr(port, 2) "$" || $4 ~ "\\[::\\]:" substr(port, 2) "$" { found = 1 } END { exit(found ? 0 : 1) }'; then
        echo "Cannot start the proxy because host port ${port} is already in use."
        describe_port_usage "${port}"
        echo
        echo "Stop the conflicting service, or set PROXY_HTTP_PORT / PROXY_HTTPS_PORT in ${ENV_FILE} if another reverse proxy owns ports 80/443."
        return 1
      fi
    elif command -v lsof >/dev/null 2>&1; then
      if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Cannot start the proxy because host port ${port} is already in use."
        describe_port_usage "${port}"
        echo
        echo "Stop the conflicting service, or set PROXY_HTTP_PORT / PROXY_HTTPS_PORT in ${ENV_FILE} if another reverse proxy owns ports 80/443."
        return 1
      fi
    fi
  done
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Create it before running deploy."
  exit 1
fi

for arg in "$@"; do
  case "${arg}" in
    --frontend-only)
      DEPLOY_MODE="frontend-only"
      ;;
    --backend-only)
      DEPLOY_MODE="backend-only"
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

cd "${ROOT_DIR}"

acquire_deploy_lock
compose config >/dev/null
cleanup_legacy_containers
cleanup_docker_disk
ensure_proxy_ports_available

if [[ "${DEPLOY_MODE}" == "frontend-only" ]]; then
  echo "Deploy mode: frontend-only"
  pull_images fe
  retry_command 3 20 compose up -d --no-deps fe
  wait_for_service_health fe 180
elif [[ "${DEPLOY_MODE}" == "backend-only" ]]; then
  echo "Deploy mode: backend-only"
  pull_images be
  retry_command 3 20 compose up -d --no-deps be
  wait_for_service_health be 180
else
  echo "Deploy mode: full stack"
  pull_images be fe
  retry_command 3 20 compose up -d --build --remove-orphans
  wait_for_service_health db 180
  wait_for_service_health be 180
  wait_for_service_health rag 240
  wait_for_service_health fe 180
fi

cleanup_docker_disk
compose ps
