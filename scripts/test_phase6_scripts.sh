#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fail() { echo "断言失败：$1" >&2; exit 1; }
contains() { rg -F --quiet -- "$2" "$1" || fail "$1 缺少 $2"; }

for script in phase6_preflight.sh phase6_cutover.sh; do
  test -x "$project_dir/scripts/$script" || fail "$script 必须可执行"
  bash -n "$project_dir/scripts/$script"
done
bash -n "$project_dir/start.sh" "$project_dir/stop.sh" "$project_dir/install.sh" "$project_dir/build.sh" "$project_dir/update.sh"

contains "$project_dir/deploy/systemd/ai-customer-service-training.service" "--host 127.0.0.1"
contains "$project_dir/deploy/systemd/ai-customer-service-training.service" "--port 8005"
contains "$project_dir/deploy/systemd/ai-customer-service-training.service" "EnvironmentFile"
contains "$project_dir/deploy/nginx/ai-customer-service-training.conf" "proxy_buffering off"
contains "$project_dir/deploy/nginx/ai-customer-service-training.conf" "127.0.0.1:8005"
contains "$project_dir/scripts/phase6_cutover.sh" "I_UNDERSTAND"
if rg -F --quiet "git reset --hard" "$project_dir/update.sh"; then
  fail "update.sh 不得执行 git reset --hard"
fi
contains "$project_dir/update.sh" "git fetch gitea"
contains "$project_dir/update.sh" "git merge --ff-only"

manifest=$(mktemp)
trap 'rm -f "$manifest"' EXIT
printf '%s\n' '{"match":true,"reconciled":true,"source":{"hash":"same"},"target":{"hash":"mapped"}}' >"$manifest"

if APP_ENV=production DATABASE_URL=sqlite+pysqlite:///unsafe.db JWT_SECRET=short \
  FEISHU_APP_CLIENT_ID=demo FEISHU_APP_CLIENT_SECRET=demo \
  PHASE6_ALLOW_DIRTY=true "$project_dir/scripts/phase6_preflight.sh" --manifest "$manifest" >/dev/null 2>&1; then
  fail "生产预检必须拒绝 SQLite 和短 JWT"
fi

APP_ENV=production DATABASE_URL='mysql+pymysql://user:pass@localhost/db?charset=utf8mb4' \
  JWT_SECRET=12345678901234567890123456789012 \
  FEISHU_APP_CLIENT_ID=demo FEISHU_APP_CLIENT_SECRET=demo \
  PHASE6_ALLOW_DIRTY=true "$project_dir/scripts/phase6_preflight.sh" --manifest "$manifest" >/dev/null

output=$(PHASE6_ALLOW_DIRTY=true "$project_dir/scripts/phase6_cutover.sh" --dry-run --manifest "$manifest")
contains <(printf '%s' "$output") "旧系统切换为只读"
contains <(printf '%s' "$output") "最终增量"

if PHASE6_ALLOW_DIRTY=true "$project_dir/scripts/phase6_cutover.sh" --manifest "$manifest" >/dev/null 2>&1; then
  fail "非 dry-run 必须要求人工确认"
fi

echo "phase6 deployment scripts passed"
