#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
CHILD_ID="${CHILD_ID:-stage-demo-child}"
TIMEOUT="${TIMEOUT:-20}"
MEMORY_CHECK="${MEMORY_CHECK:-best-effort}"
REQUIRE_REAL_PROVIDER="${REQUIRE_REAL_PROVIDER:-1}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
DOCKER_SERVICE="${DOCKER_SERVICE:-backend}"
BASE_URL="${BASE_URL%/}"

health_output="$(mktemp)"
vivo_output="$(mktemp)"
consultation_output="$(mktemp)"

cleanup() {
  rm -f "$health_output" "$vivo_output" "$consultation_output"
}
trap cleanup EXIT

print_header() {
  printf '\n== %s ==\n' "$1"
}

print_output() {
  if [ -s "$1" ]; then
    cat "$1"
    printf '\n'
  fi
}

read_json_field() {
  local file_path="$1"
  local field_name="$2"
  "$PYTHON_BIN" - "$file_path" "$field_name" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
field_name = sys.argv[2]

try:
    payload = json.loads(path.read_text(encoding="utf-8"))
except Exception:
    print("unknown")
    raise SystemExit(0)

value = payload.get(field_name, "unknown")
if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("unknown")
else:
    print(value)
PY
}

health_status="fail"
vivo_status="fail"
consultation_status="fail"
memory_status="unknown"
transport_status="unknown"
overall_status=0

print_header "1. health"
if curl -fsS "$BASE_URL/health" >"$health_output" 2>&1; then
  if "$PYTHON_BIN" - "$health_output" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
raise SystemExit(0 if payload.get("status") == "ok" else 1)
PY
  then
    health_status="pass"
  else
    overall_status=1
  fi
else
  overall_status=1
fi
print_output "$health_output"

print_header "2. vivo_llm strict"
if "$PYTHON_BIN" scripts/vivo_llm_smoke.py --runner docker --compose-service "$DOCKER_SERVICE" --strict >"$vivo_output" 2>&1; then
  vivo_status="real"
else
  overall_status=1
  fallback_value="$(read_json_field "$vivo_output" "fallback")"
  if [ "$fallback_value" = "true" ]; then
    vivo_status="fallback"
  fi
fi
print_output "$vivo_output"

consultation_args=(
  "$PYTHON_BIN"
  "scripts/consultation_sse_smoke.py"
  "--runner"
  "docker"
  "--compose-service"
  "$DOCKER_SERVICE"
  "--base-url"
  "$BASE_URL"
  "--child-id"
  "$CHILD_ID"
  "--timeout"
  "$TIMEOUT"
  "--memory-check"
  "$MEMORY_CHECK"
)

if [ "$REQUIRE_REAL_PROVIDER" = "1" ]; then
  consultation_args+=("--require-real-provider")
fi

print_header "3. consultation SSE"
if "${consultation_args[@]}" >"$consultation_output" 2>&1; then
  consultation_status="pass"
else
  consultation_status="fail"
  overall_status=1
fi
memory_status="$(read_json_field "$consultation_output" "memory_check")"
transport_status="$(read_json_field "$consultation_output" "transport")"
print_output "$consultation_output"

print_header "4. teacher walkthrough"
printf '%s\n' "Open /teacher/high-risk-consultation?trace=debug and confirm providerTrace, memoryMeta, the three SSE stages, and the final recommendation cards."

print_header "Summary"
printf '%s\n' "health: $health_status"
printf '%s\n' "vivo_strict: $vivo_status"
printf '%s\n' "consultation_sse: $consultation_status"
printf '%s\n' "transport: $transport_status"
printf '%s\n' "memory: $memory_status"

exit "$overall_status"
