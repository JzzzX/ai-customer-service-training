#!/usr/bin/env bash
set -euo pipefail

manifest=""
dry_run=false
while (($#)); do
  case "$1" in
    --manifest) manifest=${2:-}; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    *) echo "用法：$0 [--dry-run] --manifest <迁移报告.json>" >&2; exit 2 ;;
  esac
done

test -n "$manifest" && test -f "$manifest" || {
  echo "缺少迁移对账报告：--manifest <path>" >&2
  exit 2
}
python3 - "$manifest" <<'PY'
import json
import sys

data = json.loads(open(sys.argv[1], encoding="utf-8").read())
if data.get("match") is not True:
  raise SystemExit("迁移报告未通过，禁止切换")
if data.get("reconciled") is not True:
    raise SystemExit("迁移报告未完成 reconcile，禁止切换")
checks = data.get("reconciliation", {}).get("checks", {})
if checks and not all(checks.values()):
    raise SystemExit("迁移对账 checks 未全部通过，禁止切换")
if data.get("target", {}).get("foreign_key_orphans"):
    raise SystemExit("迁移报告包含外键孤儿记录，禁止切换")
PY

if test "$dry_run" = true; then
  cat <<'EOF'
Phase6 maintenance-window dry-run
1. 将旧系统切换为只读并保留回滚入口
2. 导出旧系统最终增量并导入新系统
3. 运行全量行数、外键、关键哈希和代表性页面对账
4. 通过后切换 Nginx upstream，失败则恢复旧系统写入
5. 观察认证、5xx、数据库连接、Ark 超时和报告 SSE 指标
EOF
  exit 0
fi

test "${PHASE6_CONFIRM_CUTOVER:-}" = "I_UNDERSTAND" || {
  echo "真实维护窗口必须显式设置 PHASE6_CONFIRM_CUTOVER=I_UNDERSTAND；脚本不会自动切 DNS 或删除旧系统" >&2
  exit 1
}
echo "门禁已通过；请由值班人员按 dry-run 顺序执行外部只读、增量、DNS 和观察操作。"
