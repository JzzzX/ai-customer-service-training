#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
manifest=""
while (($#)); do
  case "$1" in
    --manifest) manifest=${2:-}; shift 2 ;;
    *) echo "用法：$0 --manifest <迁移报告.json>" >&2; exit 2 ;;
  esac
done

test -n "$manifest" && test -f "$manifest" || {
  echo "缺少迁移对账报告：--manifest <path>" >&2
  exit 2
}

python3 - "$manifest" <<'PY'
import json
import sys

path = sys.argv[1]
data = json.loads(open(path, encoding="utf-8").read())
if data.get("match") is not True:
    raise SystemExit("迁移报告未通过 match=true")
source = data.get("source", {})
target = data.get("target", {})
if source.get("hash") != target.get("hash"):
    raise SystemExit("迁移报告 source/target hash 不一致")
for side in (source, target):
    if side.get("foreign_key_orphans"):
        raise SystemExit("迁移报告包含外键孤儿记录")
PY

test "${APP_ENV:-}" = "production" || {
  echo "生产预检必须设置 APP_ENV=production" >&2
  exit 1
}
case "${DATABASE_URL:-}" in
  mysql+pymysql://*charset=utf8mb4*) ;;
  mysql+pymysql://*) echo "DATABASE_URL 必须显式包含 charset=utf8mb4" >&2; exit 1 ;;
  *) echo "生产 DATABASE_URL 必须使用 mysql+pymysql://" >&2; exit 1 ;;
esac
test "${#JWT_SECRET}" -ge 32 || {
  echo "生产 JWT_SECRET 至少需要 32 个字符" >&2
  exit 1
}
test -n "${FEISHU_APP_CLIENT_ID:-}" && test -n "${FEISHU_APP_CLIENT_SECRET:-}" || {
  echo "生产飞书 OAuth 配置不完整" >&2
  exit 1
}

if test "${PHASE5_ALLOW_DIRTY:-false}" != "true"; then
  test -z "$(git -C "$project_dir" status --porcelain)" || {
    echo "工作区不干净，生产预检停止" >&2
    exit 1
  }
fi

echo "Phase5 production preflight passed"
