#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

readonly SUBMODULE_PATH="knowledges/sc/api"
readonly REPO_URL="https://github.com/your-organization/vcs-api.git"   # замени на свой URL
readonly SPARSE_PATTERNS='/api/\n'

./scripts/update-submodule.sh \
    "${SUBMODULE_PATH}" \
    "${REPO_URL}" \
    "${SPARSE_PATTERNS}"

echo "vcs-api submodule updated. Only /api/ is materialized at:"
echo "  ${SUBMODULE_PATH}/api/"