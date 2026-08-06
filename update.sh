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
git fetch gitea "$current_branch"
origin_sha=$(git rev-parse "origin/$current_branch")
gitea_sha=$(git rev-parse "gitea/$current_branch")
test "$origin_sha" = "$gitea_sha" || {
  echo "origin/$current_branch 与 gitea/$current_branch 已分叉，停止更新" >&2
  exit 1
}
git merge --ff-only "origin/$current_branch"
