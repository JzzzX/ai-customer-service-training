#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
service="$project_dir/deploy/nextjs/ai-customer-service-training.service"
nginx="$project_dir/deploy/nextjs/ai-customer-service-training.nginx.conf"
environment="$project_dir/deploy/nextjs/app.env.example"

contains() {
  grep -Fq -- "$2" "$1"
}

contains "$service" "User=ai-training"
contains "$service" "WorkingDirectory=/opt/ai-customer-service-training"
contains "$service" "EnvironmentFile=/etc/ai-customer-service-training/app.env"
contains "$service" "--hostname 127.0.0.1 --port 3001"
contains "$service" "StandardOutput=journal"
contains "$service" "Restart=on-failure"

contains "$nginx" "listen 35769"
contains "$nginx" "proxy_pass http://127.0.0.1:3001"
contains "$nginx" "location = /api/health"
contains "$nginx" "location = /api/ready"
contains "$nginx" "location ^~ /api/scenario/complete/"
contains "$nginx" "proxy_buffering off"
contains "$nginx" "proxy_cache off"
contains "$nginx" "proxy_read_timeout 300s"
contains "$nginx" "proxy_send_timeout 300s"
contains "$nginx" "X-Accel-Buffering no"

contains "$environment" "SCENARIO_AI_MODE=real"
contains "$environment" "AI_GATEWAY_ENABLED=false"
contains "$environment" "SQLITE_PATH=/var/lib/ai-customer-service-training/training.sqlite"

if grep -Eq 'OPENAI_API_KEY=.+|FEISHU_APP_CLIENT_SECRET=.+' "$environment"; then
  echo "deployment example must not contain credentials" >&2
  exit 1
fi

echo "Next.js production deployment assets are consistent."
