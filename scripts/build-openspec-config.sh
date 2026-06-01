#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# build-openspec-config.sh
# Собирает openspec/config.yaml из vault/skills/ без внешних зависимостей
#
# vault/skills/common/  → context (все роли)
# vault/skills/sa/      → rules: proposal, sa-specs
# vault/skills/be/      → rules: be-design, be-tasks
# vault/skills/fe/      → rules: fe-design
# vault/skills/qa/      → rules: qa-plan, qaa-tasks
# vault/skills/qaa/     → rules: qaa-tasks (дополнительно)
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAULT="$REPO_ROOT/vault/skills"
OUTPUT="$REPO_ROOT/openspec/config.yaml"
MAX_BYTES=51200

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $*"; }

# Читаем все .md из папки, склеиваем через ---
read_dir() {
    local dir="$1"
    [[ -d "$dir" ]] || { log_warn "Папка не найдена: $dir"; echo ""; return; }
    local result="" first=1
    while IFS= read -r -d '' file; do
        local content
        content="$(cat "$file")"
        if [[ $first -eq 1 ]]; then
            result="$content"
            first=0
        else
            result="$result

---

$content"
        fi
    done < <(find "$dir" -maxdepth 1 -name "*.md" -print0 | sort -z)
    printf '%s' "$result"
}

# Экранируем строку для YAML literal block scalar (|)
# Каждую строку отбиваем двумя пробелами
indent2() {
    sed 's/^/  /'
}

# Пишем одно правило в rules как элемент списка с literal block scalar
write_rule() {
    local label="$1"
    local skills="$2"
    printf '  - |\n'
    printf '    %s\n' "$label"
    if [[ -n "$skills" ]]; then
        printf '  - |\n'
        printf '%s\n' "$skills" | sed 's/^/    /'
    fi
}

# ---------------------------------------------------------------------------
# Читаем скиллы
# ---------------------------------------------------------------------------
COMMON="$(read_dir "$VAULT/common")"
SA="$(read_dir "$VAULT/sa")"
BE="$(read_dir "$VAULT/be")"
FE="$(read_dir "$VAULT/fe")"
QA="$(read_dir "$VAULT/qa")"
QAA="$(read_dir "$VAULT/qaa")"

CONTEXT_SIZE=$(printf '%s' "$COMMON" | wc -c | tr -d ' ')
if [[ "$CONTEXT_SIZE" -gt "$MAX_BYTES" ]]; then
    log_err "context: ${CONTEXT_SIZE} байт > ${MAX_BYTES} байт (лимит openspec)"
    exit 1
fi

# Склеиваем qa + qaa для qaa-tasks
QAA_COMBINED="$QA"
if [[ -n "$QAA" ]]; then
    QAA_COMBINED="${QAA_COMBINED:+$QAA_COMBINED

---

}$QAA"
fi

# ---------------------------------------------------------------------------
# Генерируем config.yaml
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "$OUTPUT")"

{
printf 'schema: vcs\n'
printf 'context: |\n'
printf '%s\n' "$COMMON" | sed 's/^/  /'

printf 'rules:\n'

for artifact in proposal sa-specs; do
    printf '  %s:\n' "$artifact"
    write_rule "Ты — Системный аналитик (SA)." "$SA"
done

for artifact in be-design be-tasks; do
    printf '  %s:\n' "$artifact"
    write_rule "Ты — Backend-разработчик (BE). Стек: Go, Gitea." "$BE"
done

printf '  fe-design:\n'
write_rule "Ты — Frontend-разработчик (FE)." "$FE"

printf '  qa-plan:\n'
write_rule "Ты — Тестировщик (QA)." "$QA"

printf '  qaa-tasks:\n'
write_rule "Ты — QA Automation Engineer (QAA)." "$QAA_COMBINED"

} > "$OUTPUT"

# ---------------------------------------------------------------------------
# Отчёт
# ---------------------------------------------------------------------------
log_ok "$OUTPUT обновлён"
log_ok "context: $(( CONTEXT_SIZE / 1024 )) KB / 50 KB"
echo ""
echo "  context (common/):"
find "$VAULT/common" -maxdepth 1 -name "*.md" 2>/dev/null | sort | \
    while read -r f; do echo "    + $(basename "$f")"; done

for role in sa be fe qa qaa; do
    dir="$VAULT/$role"
    files=$(find "$dir" -maxdepth 1 -name "*.md" 2>/dev/null | sort)
    [[ -n "$files" ]] || continue
    echo "  rules ($role/):"
    echo "$files" | while read -r f; do echo "    + $(basename "$f")"; done
done
