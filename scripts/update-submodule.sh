#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

readonly SUBMODULE_PATH="$1"                    # knowledges/git, knowledges/gitea, knowledges/sc/api
readonly REPO_URL="$2"                          # URL репозитория submodule
readonly SPARSE_PATTERNS="$3"                   # строки разделённые новой строкой, например: '/en/\n/figures/\n'

if [[ -z "${SUBMODULE_PATH}" || -z "${REPO_URL}" || -z "${SPARSE_PATTERNS}" ]]; then
    echo "Usage: $0 <submodule-path> <repo-url> <sparse-checkout-patterns>"
    echo "Example: $0 knowledges/git https://github.com/progit/progit2.git '/en/\n/figures/\n'"
    exit 1
fi

readonly SUBMODULE="${REPO_ROOT}/${SUBMODULE_PATH}"

echo "Updating submodule: ${SUBMODULE_PATH}"

if ! git -C "${REPO_ROOT}" submodule status "${SUBMODULE_PATH}" >/dev/null 2>&1; then
    echo "Adding new submodule: ${REPO_URL} -> ${SUBMODULE_PATH}"
    git -C "${REPO_ROOT}" submodule add "${REPO_URL}" "${SUBMODULE_PATH}"
fi

if git -C "${REPO_ROOT}" submodule status | grep -q "^[+- ] .*/${SUBMODULE_PATH}$"; then
    git -C "${REPO_ROOT}" submodule update --remote "${SUBMODULE_PATH}"
else
    git -C "${REPO_ROOT}" submodule update --init --remote "${SUBMODULE_PATH}"
fi

git -C "${SUBMODULE}" sparse-checkout init --no-cone
printf "%b" "${SPARSE_PATTERNS}" | git -C "${SUBMODULE}" sparse-checkout set --stdin

echo "Submodule updated. Sparse-checkout patterns applied:"
echo "  Path: ${SUBMODULE}"
echo "  Only the following paths are materialized in the working tree:"
echo "${SPARSE_PATTERNS}"