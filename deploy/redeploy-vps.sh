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

cleanup_legacy_containers() {
  mapfile -t legacy_container_ids < <(
    docker ps -aq --format '{{.ID}} {{.Names}}' | awk '
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

cd "${ROOT_DIR}"

compose config >/dev/null
cleanup_legacy_containers
ensure_proxy_ports_available
compose up -d --build --remove-orphans
compose ps
