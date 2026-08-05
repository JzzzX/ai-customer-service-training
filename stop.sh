#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
runtime_dir="$project_dir/.runtime"

stop_pid_file() {
  pid_file=$1
  test -f "$pid_file" || return 0
  pid=$(sed -n '1p' "$pid_file")
  case "$pid" in
    ''|*[!0-9]*) echo "忽略无效 PID 文件: $pid_file" >&2 ;;
    *) kill "$pid" 2>/dev/null || true ;;
  esac
  rm -f "$pid_file"
}

stop_pid_file "$runtime_dir/backend.pid"
stop_pid_file "$runtime_dir/frontend.pid"
