#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "backup-db-vps.sh now creates the complete PostgreSQL + evidence bundle."
exec "${ROOT_DIR}/deploy/backup-state-vps.sh" "$@"
