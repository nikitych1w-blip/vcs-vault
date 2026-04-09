#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

readonly SUBMODULE_PATH="knowledges/gitea"
readonly REPO_URL="https://github.com/go-gitea/gitea.git"    # замени при необходимости
readonly SPARSE_PATTERNS='/docs/\n'

./scripts/update-submodule.sh \
    "${SUBMODULE_PATH}" \
    "${REPO_URL}" \
    "${SPARSE_PATTERNS}"

echo "Gitea docs updated. They are at: knowledges/gitea/docs/"
