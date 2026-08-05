#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if test -n "${PROJECT_PYTHON_BIN:-}"; then
  python_bin=$PROJECT_PYTHON_BIN
elif command -v python3.12 >/dev/null 2>&1; then
  python_bin=$(command -v python3.12)
elif command -v python3 >/dev/null 2>&1; then
  python_bin=$(command -v python3)
else
  echo "需要 Python 3.12+" >&2
  exit 1
fi

"$python_bin" -c 'import sys; raise SystemExit(sys.version_info < (3, 12))' || {
  echo "需要 Python 3.12+，可通过 PROJECT_PYTHON_BIN 指定解释器" >&2
  exit 1
}

test -d "$project_dir/backend/.venv" || "$python_bin" -m venv "$project_dir/backend/.venv"
"$project_dir/backend/.venv/bin/pip" install -r "$project_dir/backend/requirements-dev.txt"
npm --prefix "$project_dir/frontend" install
