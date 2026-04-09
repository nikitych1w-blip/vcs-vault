#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

readonly SUBMODULE_PATH="knowledges/git"
readonly REPO_URL="https://github.com/progit/progit2.git"   # замени на актуальный URL
readonly SPARSE_PATTERNS='/en/\n/figures/\n'

./scripts/update-submodule.sh \
    "${SUBMODULE_PATH}" \
    "${REPO_URL}" \
    "${SPARSE_PATTERNS}"

# Дополнительные преобразования для Pro Git
find "${REPO_ROOT}/knowledges/git/en" -name "*.markdown" -type f | while IFS= read -r f; do
    mv "${f}" "${f%.markdown}.md"
done

find "${REPO_ROOT}/knowledges/git/en" -name "*.md" -type f | while IFS= read -r f; do
    sed -i.bak 's|Insert \(18333fig[0-9]*\)\.png|![](../../figures/\1-tn.png)|g' "${f}"
    rm -f "${f}.bak"
done

echo "Pro Git docs updated. They are at: knowledges/git/en/"