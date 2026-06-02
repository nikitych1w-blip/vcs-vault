#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  openspec-flow.sh --change <name> [options]

Options:
  --change <name>        Change name (required)
  --openspec <path>      OpenSpec binary path (default: $OPENSPEC or $HOME/.npm-global/bin/openspec)
  --auto-sync <0|1>      Run config rebuild + schema validate before flow (default: 1)
  --auto-archive <0|1>   Skip archive confirmation gate (default: 0)
  --state-dir <path>     Flow state dir (default: .openspec-flow)
  --resume               Resume mode (restores from current filesystem state)
  -h, --help             Show help

Examples:
  openspec-flow.sh --change vcs-10012-add-reactions
  openspec-flow.sh --change vcs-10012-add-reactions --resume
  openspec-flow.sh --change vcs-10012-add-reactions --auto-archive 1
EOF
}

log() {
    printf '[openspec-flow] %s\n' "$*"
}

warn() {
    printf '[openspec-flow][warn] %s\n' "$*" >&2
}

err() {
    printf '[openspec-flow][error] %s\n' "$*" >&2
}

normalize_bool() {
    case "${1,,}" in
        1|true|yes|y|on) echo "1" ;;
        0|false|no|n|off) echo "0" ;;
        *)
            err "Expected boolean value (0/1/true/false), got: $1"
            exit 1
            ;;
    esac
}

is_interactive() {
    [[ -t 0 && -t 1 ]]
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-y}"
    local auto_yes="${3:-0}"
    local hint answer normalized

    if [[ "$auto_yes" == "1" ]]; then
        log "$prompt -> yes (auto)"
        return 0
    fi

    if ! is_interactive; then
        [[ "$default" == "y" ]]
        return $?
    fi

    if [[ "$default" == "y" ]]; then
        hint="Y/n"
    else
        hint="y/N"
    fi

    while true; do
        read -r -p "$prompt [$hint] " answer
        answer="${answer:-$default}"
        normalized="${answer,,}"
        case "$normalized" in
            y|yes) return 0 ;;
            n|no) return 1 ;;
            *)
                warn "Please answer y or n."
                ;;
        esac
    done
}

expand_home_path() {
    local input="$1"
    if [[ "$input" == "~/"* ]]; then
        printf '%s\n' "${HOME}/${input#~/}"
    else
        printf '%s\n' "$input"
    fi
}

CHANGE=""
OPENSPEC_BIN="${OPENSPEC_BIN:-}"
AUTO_SYNC="${AUTO_SYNC:-1}"
AUTO_ARCHIVE="${AUTO_ARCHIVE:-0}"
STATE_DIR_INPUT="${FLOW_STATE_DIR:-.openspec-flow}"
RESUME=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --change)
            [[ $# -ge 2 ]] || { err "Missing value for --change"; exit 1; }
            CHANGE="$2"
            shift 2
            ;;
        --openspec)
            [[ $# -ge 2 ]] || { err "Missing value for --openspec"; exit 1; }
            OPENSPEC_BIN="$2"
            shift 2
            ;;
        --auto-sync)
            [[ $# -ge 2 ]] || { err "Missing value for --auto-sync"; exit 1; }
            AUTO_SYNC="$2"
            shift 2
            ;;
        --auto-archive)
            [[ $# -ge 2 ]] || { err "Missing value for --auto-archive"; exit 1; }
            AUTO_ARCHIVE="$2"
            shift 2
            ;;
        --state-dir)
            [[ $# -ge 2 ]] || { err "Missing value for --state-dir"; exit 1; }
            STATE_DIR_INPUT="$2"
            shift 2
            ;;
        --resume)
            RESUME=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            err "Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

[[ -n "$CHANGE" ]] || { err "Change name is required. Use --change <name>."; exit 1; }
AUTO_SYNC="$(normalize_bool "$AUTO_SYNC")"
AUTO_ARCHIVE="$(normalize_bool "$AUTO_ARCHIVE")"

if [[ -z "$OPENSPEC_BIN" ]]; then
    OPENSPEC_BIN="${OPENSPEC:-$HOME/.npm-global/bin/openspec}"
fi
OPENSPEC_BIN="$(expand_home_path "$OPENSPEC_BIN")"

if [[ "$OPENSPEC_BIN" == */* ]]; then
    [[ -x "$OPENSPEC_BIN" ]] || { err "OpenSpec binary is not executable: $OPENSPEC_BIN"; exit 1; }
else
    OPENSPEC_BIN="$(command -v "$OPENSPEC_BIN" || true)"
    [[ -n "$OPENSPEC_BIN" ]] || { err "OpenSpec binary not found in PATH."; exit 1; }
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHANGES_ROOT="$REPO_ROOT/openspec/changes"
CHANGE_DIR="$CHANGES_ROOT/$CHANGE"

[[ -d "$CHANGES_ROOT" ]] || { err "Changes directory not found: $CHANGES_ROOT"; exit 1; }

if [[ "$STATE_DIR_INPUT" = /* ]]; then
    STATE_ROOT="$STATE_DIR_INPUT/$CHANGE"
else
    STATE_ROOT="$CHANGE_DIR/$STATE_DIR_INPUT"
fi

INSTRUCTIONS_DIR="$STATE_ROOT/instructions"
PROMPTS_DIR="$STATE_ROOT/prompts"
STATUS_DIR="$STATE_ROOT/status"
STATE_FILE="$STATE_ROOT/flow.state"
LATEST_STATUS_JSON="$STATE_ROOT/status.latest.json"

write_state() {
    local stage="$1"
    local note="${2:-}"

    mkdir -p "$STATE_ROOT"
    {
        printf 'stage=%s\n' "$stage"
        printf 'updated_at=%s\n' "$(date -Iseconds)"
        if [[ -n "$note" ]]; then
            printf 'note=%s\n' "$note"
        fi
    } > "$STATE_FILE"
}

pause_flow() {
    local reason="$1"
    write_state "paused" "$reason"
    log "Flow paused: $reason"
    log "Resume with: make openspec-flow-resume CHANGE=$CHANGE"
    exit 0
}

refresh_status_json() {
    "$OPENSPEC_BIN" status --change "$CHANGE" --json > "$LATEST_STATUS_JSON"
    cp "$LATEST_STATUS_JSON" "$STATUS_DIR/$(date +%Y%m%d-%H%M%S)-status.json"
}

artifact_status() {
    local artifact_id="$1"
    python3 - "$LATEST_STATUS_JSON" "$artifact_id" <<'PY'
import json
import sys

status_file, artifact_id = sys.argv[1], sys.argv[2]
with open(status_file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

for artifact in payload.get("artifacts", []):
    if artifact.get("id") == artifact_id:
        print(artifact.get("status", "unknown"))
        sys.exit(0)

print("missing")
PY
}

artifact_missing_deps() {
    local artifact_id="$1"
    python3 - "$LATEST_STATUS_JSON" "$artifact_id" <<'PY'
import json
import sys

status_file, artifact_id = sys.argv[1], sys.argv[2]
with open(status_file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

for artifact in payload.get("artifacts", []):
    if artifact.get("id") == artifact_id:
        deps = artifact.get("missingDeps", [])
        print(", ".join(deps))
        sys.exit(0)

print("")
PY
}

apply_missing_requirements() {
    python3 - "$LATEST_STATUS_JSON" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

statuses = {item.get("id"): item.get("status") for item in payload.get("artifacts", [])}
missing = [item for item in payload.get("applyRequires", []) if statuses.get(item) != "done"]
print(", ".join(missing))
PY
}

incomplete_artifacts_list() {
    python3 - "$LATEST_STATUS_JSON" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

items = [a.get("id") for a in payload.get("artifacts", []) if a.get("status") != "done"]
print(", ".join(items))
PY
}

create_prompt_markdown() {
    local json_file="$1"
    local prompt_file="$2"

    python3 - "$json_file" "$prompt_file" <<'PY'
import json
import sys
from pathlib import Path

json_path, output_path = sys.argv[1], sys.argv[2]
payload = json.loads(Path(json_path).read_text(encoding="utf-8"))
lines = []

def add_header(title: str) -> None:
    lines.append(f"## {title}")

def add_text_block(title: str, value: str) -> None:
    if value is None:
        return
    text = str(value).strip()
    if not text:
        return
    add_header(title)
    lines.append("````text")
    lines.append(text)
    lines.append("````")
    lines.append("")

lines.append("# OpenSpec Session Prompt")
lines.append("")

for key, label in [
    ("changeName", "Change"),
    ("schemaName", "Schema"),
    ("artifactId", "Artifact"),
    ("outputPath", "Output"),
    ("changeDir", "Change Directory"),
    ("state", "Apply State"),
]:
    value = payload.get(key)
    if value:
        lines.append(f"- **{label}**: `{value}`")

progress = payload.get("progress")
if isinstance(progress, dict):
    total = progress.get("total", 0)
    complete = progress.get("complete", 0)
    remaining = progress.get("remaining", 0)
    lines.append(f"- **Progress**: `{complete}/{total}` complete, `{remaining}` remaining")

lines.append("")

description = payload.get("description")
if description:
    add_text_block("Description", description)

instruction = payload.get("instruction")
if instruction:
    add_text_block("Instruction", instruction)

template = payload.get("template")
if template:
    add_text_block("Template", template)

dependencies = payload.get("dependencies")
if isinstance(dependencies, list) and dependencies:
    add_header("Dependencies")
    for dep in dependencies:
        if isinstance(dep, dict):
            dep_id = dep.get("id", "unknown")
            dep_done = dep.get("done", False)
            dep_path = dep.get("path", "")
            dep_desc = dep.get("description", "")
            lines.append(f"- `{dep_id}` | done=`{dep_done}` | path=`{dep_path}`")
            if dep_desc:
                lines.append(f"  - {dep_desc}")
        else:
            lines.append(f"- {dep}")
    lines.append("")

context_files = payload.get("contextFiles")
if isinstance(context_files, dict) and context_files:
    add_header("Context Files")
    for key, values in context_files.items():
        if isinstance(values, list):
            for path in values:
                lines.append(f"- `{key}` -> `{path}`")
        else:
            lines.append(f"- `{key}` -> `{values}`")
    lines.append("")

tasks = payload.get("tasks")
if isinstance(tasks, list) and tasks:
    add_header("Tasks")
    for task in tasks:
        if isinstance(task, dict):
            title = task.get("title") or task.get("content") or "task"
            status = task.get("status", "unknown")
            lines.append(f"- [{status}] {title}")
        else:
            lines.append(f"- {task}")
    lines.append("")

missing_artifacts = payload.get("missingArtifacts")
if isinstance(missing_artifacts, list) and missing_artifacts:
    add_header("Missing Artifacts")
    for item in missing_artifacts:
        lines.append(f"- `{item}`")
    lines.append("")

rules = payload.get("rules")
if isinstance(rules, list) and rules:
    add_header("Rules")
    for idx, rule in enumerate(rules, start=1):
        lines.append(f"### Rule {idx}")
        lines.append("````text")
        lines.append(str(rule).strip())
        lines.append("````")
        lines.append("")
elif isinstance(rules, str) and rules.strip():
    add_text_block("Rules", rules)

context = payload.get("context")
if context:
    add_text_block("Context", context)

Path(output_path).write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
PY
}

json_field() {
    local json_file="$1"
    local key="$2"
    python3 - "$json_file" "$key" <<'PY'
import json
import sys

json_file, key = sys.argv[1], sys.argv[2]
with open(json_file, "r", encoding="utf-8") as fh:
    payload = json.load(fh)

value = payload.get(key, "")
if value is None:
    value = ""
if isinstance(value, (dict, list)):
    print("")
else:
    print(str(value))
PY
}

generate_instruction_bundle() {
    local artifact="$1"
    local json_out="$INSTRUCTIONS_DIR/${artifact}.json"
    local prompt_out="$PROMPTS_DIR/${artifact}.prompt.md"
    local output_path output_dir

    if [[ "$artifact" == "apply" ]]; then
        "$OPENSPEC_BIN" instructions apply --change "$CHANGE" --json > "$json_out"
    else
        "$OPENSPEC_BIN" instructions "$artifact" --change "$CHANGE" --json > "$json_out"
    fi

    create_prompt_markdown "$json_out" "$prompt_out"

    output_path="$(json_field "$json_out" "outputPath")"

    log "Saved JSON: $json_out"
    log "Saved prompt: $prompt_out"
    if [[ -n "$output_path" ]]; then
        # For concrete file paths (no glob patterns), ensure role folders exist.
        if [[ "$output_path" != *"*"* && "$output_path" != *"?"* && "$output_path" != *"["* ]]; then
            output_dir="$CHANGE_DIR/$(dirname "$output_path")"
            mkdir -p "$output_dir"
        fi
        log "Expected artifact output: $CHANGE_DIR/$output_path"
    fi
}

wait_for_artifact_done() {
    local artifact="$1"
    local status missing

    while true; do
        refresh_status_json
        status="$(artifact_status "$artifact")"
        if [[ "$status" == "done" ]]; then
            log "Artifact '$artifact' is done."
            return 0
        fi

        missing="$(artifact_missing_deps "$artifact")"
        warn "Artifact '$artifact' status: $status"
        if [[ -n "$missing" ]]; then
            warn "Missing dependencies: $missing"
        fi

        if ! is_interactive; then
            warn "Non-interactive session. Cannot wait for manual completion."
            return 1
        fi

        read -r -p "Complete '$artifact' then press Enter to re-check (type 'skip' or 'pause'): " action
        case "${action,,}" in
            pause|p|quit|q) return 2 ;;
            skip|s) return 1 ;;
            *) ;;
        esac
    done
}

count_unchecked_tasks() {
    local tasks_file="$1"
    if [[ ! -f "$tasks_file" ]]; then
        echo "0"
        return 0
    fi
    awk '/^- \[ \]/{count++} END{print count+0}' "$tasks_file"
}

run_sync_if_needed() {
    if [[ "$AUTO_SYNC" != "1" ]]; then
        log "Skipping sync (AUTO_SYNC=0)"
        return 0
    fi

    log "Running openspec config rebuild..."
    bash "$REPO_ROOT/scripts/build-openspec-config.sh"

    log "Validating schema vcs..."
    "$OPENSPEC_BIN" schema validate vcs >/dev/null
    log "Schema validation completed."
}

CORE_ARTIFACT_ORDER=(proposal sa-specs be-design fe-design qa-plan be-tasks fe-tasks)

list_status_artifacts() {
    python3 - "$LATEST_STATUS_JSON" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    payload = json.load(fh)

for artifact in payload.get("artifacts", []):
    artifact_id = artifact.get("id")
    if artifact_id:
        print(artifact_id)
PY
}

contains_item() {
    local needle="$1"
    shift || true
    local item
    for item in "$@"; do
        if [[ "$item" == "$needle" ]]; then
            return 0
        fi
    done
    return 1
}

build_artifact_order() {
    local -a status_artifacts merged_order
    local artifact

    mapfile -t status_artifacts < <(list_status_artifacts)

    if [[ ${#status_artifacts[@]} -eq 0 ]]; then
        ARTIFACT_ORDER=("${CORE_ARTIFACT_ORDER[@]}")
        return 0
    fi

    for artifact in "${CORE_ARTIFACT_ORDER[@]}"; do
        if contains_item "$artifact" "${status_artifacts[@]}"; then
            merged_order+=("$artifact")
        fi
    done

    for artifact in "${status_artifacts[@]}"; do
        if ! contains_item "$artifact" "${merged_order[@]}"; then
            merged_order+=("$artifact")
        fi
    done

    ARTIFACT_ORDER=("${merged_order[@]}")
}

log "Change: $CHANGE"
log "OpenSpec: $OPENSPEC_BIN"

run_sync_if_needed

if [[ -d "$CHANGE_DIR" ]]; then
    log "Using existing change directory: $CHANGE_DIR"
else
    log "Creating change: $CHANGE"
    "$OPENSPEC_BIN" new change "$CHANGE" --schema vcs
fi

mkdir -p "$INSTRUCTIONS_DIR" "$PROMPTS_DIR" "$STATUS_DIR"

refresh_status_json
build_artifact_order
log "Artifact order: ${ARTIFACT_ORDER[*]}"

if [[ "$RESUME" == "1" && -f "$STATE_FILE" ]]; then
    last_stage="$(awk -F= '$1=="stage"{print $2; exit}' "$STATE_FILE")"
    if [[ -z "$last_stage" ]]; then
        last_stage="unknown"
    fi
    log "Resume mode. Last stage: $last_stage"
fi

write_state "started"

for artifact in "${ARTIFACT_ORDER[@]}"; do
    refresh_status_json
    current_status="$(artifact_status "$artifact")"

    case "$current_status" in
        done)
            log "[$artifact] already done, skipping."
            write_state "artifact-$artifact-done"
            continue
            ;;
        ready)
            if ! ask_yes_no "Stage '$artifact' is ready. Generate instruction bundle?" "y" "0"; then
                pause_flow "stopped before $artifact"
            fi

            generate_instruction_bundle "$artifact"
            write_state "artifact-$artifact-instructions-saved"

            if ask_yes_no "Wait until '$artifact' becomes done?" "y" "0"; then
                if wait_for_artifact_done "$artifact"; then
                    write_state "artifact-$artifact-done"
                else
                    rc=$?
                    if [[ $rc -eq 2 ]]; then
                        pause_flow "paused while waiting for $artifact"
                    fi
                    warn "Continuing flow without done status for '$artifact'."
                fi
            fi
            ;;
        blocked)
            missing="$(artifact_missing_deps "$artifact")"
            warn "[$artifact] is blocked by: ${missing:-unknown dependencies}"
            if ask_yes_no "Generate instruction bundle for blocked stage '$artifact' anyway?" "y" "0"; then
                generate_instruction_bundle "$artifact"
                write_state "artifact-$artifact-instructions-saved"
            fi
            if ! ask_yes_no "Continue to the next stage anyway?" "y" "0"; then
                pause_flow "blocked at $artifact"
            fi
            ;;
        *)
            warn "[$artifact] unexpected status: $current_status"
            if ! ask_yes_no "Continue despite unexpected status?" "n" "0"; then
                pause_flow "unexpected status at $artifact"
            fi
            ;;
    esac
done

refresh_status_json
missing_apply="$(apply_missing_requirements)"
if [[ -n "$missing_apply" ]]; then
    warn "Apply stage is not ready. Missing apply requirements: $missing_apply"
    pause_flow "apply blocked"
fi

if ! ask_yes_no "Apply gate: generate 'apply' instruction bundle now?" "y" "0"; then
    pause_flow "stopped before apply instructions"
fi

generate_instruction_bundle "apply"
write_state "apply-instructions-saved"

apply_state="$(json_field "$INSTRUCTIONS_DIR/apply.json" "state")"
if [[ "$apply_state" == "blocked" ]]; then
    warn "OpenSpec reports apply state=blocked. Complete missing artifacts and resume."
    pause_flow "apply json state blocked"
fi

if ! ask_yes_no "Archive gate: archive this change now?" "n" "$AUTO_ARCHIVE"; then
    pause_flow "waiting for archive confirmation"
fi

refresh_status_json
incomplete="$(incomplete_artifacts_list)"
pending_tasks="$(count_unchecked_tasks "$CHANGE_DIR/be/tasks.md")"

if [[ -n "$incomplete" ]]; then
    warn "Not all artifacts are done: $incomplete"
fi
if [[ "$pending_tasks" -gt 0 ]]; then
    warn "Unchecked tasks in be/tasks.md: $pending_tasks"
fi

if [[ -n "$incomplete" || "$pending_tasks" -gt 0 ]]; then
    if ! ask_yes_no "Archive with warnings?" "n" "$AUTO_ARCHIVE"; then
        pause_flow "archive cancelled due to warnings"
    fi
fi

log "Archiving change '$CHANGE'..."
"$OPENSPEC_BIN" archive "$CHANGE"
write_state "archived"
log "Flow complete."
