# 根 Next.js 生产部署与故障排查

本文件适用于公司内网的根 Next.js + SQLite 应用。正式环境固定为单个 Node.js 实例、单个持久 SQLite 文件和 systemd 守护；`DEMO_MODE=true` 只用于候选实例的 Mock 冒烟。

## 正式运行约束

- 运行用户：`ai-training`；工作目录：`/opt/ai-customer-service-training`。
- 环境文件：`/etc/ai-customer-service-training/app.env`，权限建议 `root:ai-training 0640`。
- SQLite：`/var/lib/ai-customer-service-training/training.sqlite`，文件和父目录必须由 `ai-training` 可写。
- 应用只监听 `127.0.0.1:3001`，由 Nginx `35769` 反向代理。
- 真实 AI 使用公司 OpenAI 兼容网关：`SCENARIO_AI_MODE=real`、`AI_GATEWAY_ENABLED=false`。
- 凭据、OAuth token、完整提示词、学员消息和数据库备份不得进入 Git 或诊断日志。

模板位于 [`deploy/nextjs/`](../deploy/nextjs/)。`deploy/` 根目录中的 FastAPI/Vue 文件是历史样例，不能用于当前应用。

## 首次故障取证

在修改进程、数据库或构建前先记录证据：

```bash
cd /opt/ai-customer-service-training
date -Is
git rev-parse HEAD
test -r .next/BUILD_ID && cat .next/BUILD_ID
pgrep -af 'next-server|next start'
ss -lntp | grep ':3001'
systemctl status ai-customer-service-training --no-pager
journalctl -u ai-customer-service-training --since '-30 min' --no-pager
stat /var/lib/ai-customer-service-training /var/lib/ai-customer-service-training/training.sqlite
sudo -u ai-training pnpm db:verify
```

点击“开始模拟接待”后，用页面显示的 `incidentId` 在 journald 中关联检索。日志只应包含 route、operation、用户/资源内部 ID、异常类别、SQLite/HTTP 状态和 incidentId。

常见根因按原始异常处理：

| 原始异常 | 处理原则 |
|---|---|
| `FOREIGN KEY constraint failed` | 核对 `users`、活动知识版本、已发布场景版本；只用正式导入、发布和 migration CLI 修复，不直接手改生产行 |
| `database is locked` | 确认只剩一个 Next.js 写实例；当前 Client 已启用 WAL 和 5 秒 `busy_timeout` |
| `SQLITE_READONLY` | 修正 SQLite 文件及父目录的 `ai-training` 所有权和写权限 |
| `Failed to find Server Action` | 核对 BUILD_ID；停止混合构建实例，切换完整构建产物后一次性重启 |

## 环境文件

以 [`deploy/nextjs/app.env.example`](../deploy/nextjs/app.env.example) 为模板。真实模式必须配置：

```text
DEMO_MODE=false
SQLITE_PATH=/var/lib/ai-customer-service-training/training.sqlite
SCENARIO_AI_MODE=real
AI_GATEWAY_ENABLED=false
OPENAI_BASE_URL=<公司 OpenAI 兼容入口>
OPENAI_API_KEY=<服务器凭据>
OPENAI_MODEL=<已批准模型>
```

同时配置 `AUTH_SECRET`、`FEISHU_APP_CLIENT_ID` 和 `FEISHU_APP_CLIENT_SECRET`。OAuth 的绑定规则保持为 `union_id → feishu_identities.user_id → users.id → JWT`。

## 固定部署顺序

以下步骤必须在维护窗口执行。推荐先在独立 release 目录完整安装和构建，再原子切换 `/opt/ai-customer-service-training` 符号链接，避免旧进程读取到新旧混合 `.next`。

1. 备份并校验当前库：

   ```bash
   cd /opt/ai-customer-service-training
   pnpm db:backup -- --output /var/backups/ai-training/training-$(date +%Y%m%d-%H%M%S).sqlite
   pnpm db:verify
   pnpm production:verify:data
   ```

2. 在候选 release 中安装、迁移测试副本并完整构建：

   ```bash
   pnpm install --frozen-lockfile
   pnpm db:migrate
   pnpm db:verify
   pnpm check
   pnpm test:deploy
   ```

   migration 必须针对候选/恢复副本先验证；若生产 Schema 需要升级，在停旧实例后再对已备份的正式库执行同一 migration。

3. 用候选构建启动 `DEMO_MODE=true`、`SCENARIO_AI_MODE=mock` 的临时单元和独立内存库，完成登录、开始训练、三轮对话、刷新和报告冒烟；不要让候选进程连接正式 SQLite。

4. 正式环境文件切为真实 AI 后，在服务器运行无业务数据预检：

   ```bash
   set -a
   . /etc/ai-customer-service-training/app.env
   set +a
   pnpm ai:verify
   ```

   预检覆盖配置、DNS/TLS/连接、认证、模型和最小聊天响应。失败时先处理认证、限流、超时、上游 5xx、空响应或格式异常；不得自动降级 Mock。

5. 停止并确认旧 `nohup`/Node 进程，原子切换完整 release，再安装并启动 systemd：

   ```bash
   sudo install -m 0644 deploy/nextjs/ai-customer-service-training.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now ai-customer-service-training
   systemctl status ai-customer-service-training --no-pager
   ```

   停旧进程前必须用 `pgrep -af` 和监听端口确认精确 PID；不要使用会误杀其他 Node 服务的宽泛命令。

6. 验证应用与 Nginx：

   ```bash
   curl --fail http://127.0.0.1:3001/api/health
   curl --fail http://127.0.0.1:3001/api/ready
   sudo nginx -t
   curl --fail http://127.0.0.1:35769/api/ready
   ```

`/api/health` 只证明进程存活；`/api/ready` 校验环境、SQLite Schema/完整性/外键和基础查询，不会在探测时调用付费 AI。

## 上线验收与回滚

- 用已绑定的飞书测试账号连续完成三次：三轮上下文对话、刷新恢复、主动结束和 AI 报告。
- 确认失败 AI 轮次没有入库、没有 Mock 回复，已成功轮次仍可恢复。
- 确认日志没有密钥、OAuth token、提示词或学员消息，并核对测试库只新增预期会话。
- 核对 Nginx、systemd、readiness 以及 GitHub/Gitea 分支 SHA。

回滚时停止服务、把应用符号链接切回完整的已知良好 release，并只在 migration 不兼容时恢复部署前 SQLite 备份；不得用 `git reset --hard` 或强推改写共享历史。
