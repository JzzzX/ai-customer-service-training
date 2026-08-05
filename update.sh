#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$project_dir"

test -z "$(git status --porcelain)" || {
  echo "工作区不干净，停止更新" >&2
  exit 1
}
current_branch=$(git branch --show-current)
test -n "$current_branch" || {
  echo "当前处于 detached HEAD，停止更新" >&2
  exit 1
}

git fetch origin "$current_branch"
git merge --ff-only "origin/$current_branch"
