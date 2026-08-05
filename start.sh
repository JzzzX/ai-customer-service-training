#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
runtime_dir="$project_dir/.runtime"
mkdir -p "$runtime_dir"

test -x "$project_dir/backend/.venv/bin/python" || {
  echo "请先运行 ./install.sh" >&2
  exit 1
}
test -d "$project_dir/frontend/node_modules" || {
  echo "请先运行 ./install.sh" >&2
  exit 1
}

APP_ENV=${APP_ENV:-development} "$project_dir/backend/.venv/bin/python" \
  -m uvicorn main:app --app-dir "$project_dir/backend" \
  --host 127.0.0.1 --port 8005 &
backend_pid=$!
npm --prefix "$project_dir/frontend" run dev -- --host 127.0.0.1 --port 8006 &
frontend_pid=$!

printf '%s\n' "$backend_pid" > "$runtime_dir/backend.pid"
printf '%s\n' "$frontend_pid" > "$runtime_dir/frontend.pid"

cleanup() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  rm -f "$runtime_dir/backend.pid" "$runtime_dir/frontend.pid"
}
trap cleanup EXIT INT TERM

echo "FastAPI: http://127.0.0.1:8005"
echo "Vue: http://127.0.0.1:8006"
wait "$backend_pid" "$frontend_pid"
