#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

cd "$project_dir/backend"
.venv/bin/python -m pytest -q
cd "$project_dir"
npm --prefix frontend test
npm --prefix frontend run build

if test -n "${DEPLOY_DIR:-}"; then
  deploy_target=$DEPLOY_DIR
  case "$deploy_target" in
    /|.|..|"") echo "拒绝不安全的 DEPLOY_DIR" >&2; exit 1 ;;
    /*) ;;
    *) echo "DEPLOY_DIR 必须是绝对路径" >&2; exit 1 ;;
  esac
  mkdir -p "$deploy_target"
  rsync -a --delete "$project_dir/frontend/dist/" "$deploy_target/"
fi
