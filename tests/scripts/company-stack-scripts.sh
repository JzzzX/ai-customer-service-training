#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$project_dir"

for script in start.sh stop.sh install.sh build.sh update.sh; do
  test -f "$script"
  bash -n "$script"
done

if rg -n 'git reset --hard|git clean -f|rm -rf /' update.sh build.sh; then
  echo "发现禁止的破坏性命令" >&2
  exit 1
fi

rg -n '8005' start.sh >/dev/null
rg -n '8006' start.sh >/dev/null
rg -n 'git merge --ff-only' update.sh >/dev/null
