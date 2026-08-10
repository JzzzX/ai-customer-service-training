# 公司 Linux + MySQL 部署与运维

Phase 5 的生产形态是 Nginx 提供 `frontend/dist`、systemd 管理仅监听本机
`127.0.0.1:8005` 的 Uvicorn，FastAPI 使用 `mysql+pymysql` 和 `utf8mb4`。旧系统仍保留
为回滚入口，维护窗口的真实只读、最终增量和 DNS 操作由值班人员按门禁执行。

## Linux 安装与启动

```bash
./install.sh
APP_ENV=production ./build.sh
sudo install -m 0644 deploy/systemd/ai-customer-service-training.service \
  /etc/systemd/system/ai-customer-service-training.service
sudo install -m 0644 deploy/nginx/ai-customer-service-training.conf \
  /etc/nginx/conf.d/ai-customer-service-training.conf
sudo install -m 0600 deploy/env/backend.env.example \
  /etc/ai-customer-service-training/backend.env
sudo systemctl daemon-reload
sudo systemctl enable --now ai-customer-service-training
sudo nginx -t && sudo systemctl reload nginx
```

`backend.env` 必须替换模板中的数据库、JWT、飞书和 Ark 凭据；密钥不进入 Git。

## 迁移演练与切换预检

迁移 CLI 按稳定的外键顺序复制所有账号、内容、题库、任务、场景、会话、消息、报告、
复核和管理审计表，并比较行数、孤儿外键和确定性 SHA-256。两次本地隔离演练：

```bash
tmpdir=$(mktemp -d)
(cd backend && .venv/bin/python scripts/rehearse_phase5.py \
  --root "$tmpdir" --report "$tmpdir/phase5-rehearsal.json")
```

公司测试库可通过 `--source-url-1/--target-url-1`、`--source-url-2/--target-url-2`（或对应
`PHASE5_REHEARSAL_*` 环境变量）运行两组隔离 `mysql+pymysql` 演练。正式维护窗口前先运行：

```bash
APP_ENV=production DATABASE_URL='mysql+pymysql://...?charset=utf8mb4' \
JWT_SECRET='至少32字符的随机值' FEISHU_APP_CLIENT_ID='...' FEISHU_APP_CLIENT_SECRET='...' \
PHASE5_ALLOW_DIRTY=true ./scripts/phase5_preflight.sh --manifest phase5-report.json
./scripts/phase5_cutover.sh --dry-run --manifest phase5-report.json
```

`phase5_cutover.sh` 默认只允许 dry-run；真实门禁还需要人工设置
`PHASE5_CONFIRM_CUTOVER=I_UNDERSTAND`，脚本不会自动删除旧系统、重置 Git 或切换 DNS。

## 旧 Next.js + Vercel 回滚参考

以下内容只服务于维护窗口前的旧系统回滚，不是 Phase 5 新系统的生产部署方式。

- Web：Vercel Production
- 数据库：Neon PostgreSQL
- 认证：Auth.js Credentials（MVP 临时入口）
- AI：Vercel AI Gateway 或 OpenAI 兼容接口
- 本地要求：Node.js 24、pnpm 10.33

Vercel 免费版足够承载 Web MVP。网页托管额度与模型调用费用是两条独立链路；免费
托管不等于 AI 推理免费。

生产环境禁止使用本地文件 Store 和本地测试账号回退。训练知识、题库、场景、练习记录和报告必须来自 Neon。

## 生产环境变量

在 Vercel Production 配置以下变量，不把值提交到 Git：

```text
DATABASE_URL
AUTH_SECRET
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
SEED_LEARNER_EMAIL
SEED_LEARNER_PASSWORD
```

当前免费 Web 托管的推荐生产配置是关闭 Vercel AI Gateway，直接使用从 Vercel 函数区域
可达的公网 OpenAI 兼容接口：

```text
SCENARIO_AI_MODE=real
AI_GATEWAY_ENABLED=false
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

Vercel 免费版可以运行 Web Functions，但不能替模型服务承担网络可达性或模型费用。
当前项目的外部接口使用自定义 `35772` 端口，并解析到 `198.18.0.0/15` 保留地址；
本机之所以能调用，是因为请求经过本机 `utun6` VPN 路由。Vercel 函数不在这条 VPN
网络内，因此在 `hkg1` 调用会在客户端 60 秒后超时。生产接入前必须提供公网 HTTPS
443 转发入口，或在 Vercel 与模型服务之间部署可公网访问的代理；仅登录 Vercel CLI
不会把 Vercel 运行时接入本机 VPN。

如果改用 Vercel AI Gateway，将 `AI_GATEWAY_ENABLED` 设为 `true` 并配置
`AI_GATEWAY_MODEL`；项目账户还必须具备 Gateway 可用账单/额度，当前账户曾返回 403。

## 空数据库初始化

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

其中 `quiz:publish:db` 会在40题通过知识版本、来源和冲突校验后自动发布正式题组，
人工逐题复核不是 MVP 阻塞项。若使用从 Vercel 拉取的环境文件，可运行：

```bash
DOTENV_CONFIG_PATH=.env.production.local pnpm quiz:publish:db
DOTENV_CONFIG_PATH=.env.production.local pnpm production:verify:data --formal
```

`--formal` 现在检查正式题组是否已发布且引用活动知识版本，不再要求 40/40 人工审核：

```bash
pnpm production:verify:data --formal
```

## 验收顺序

```bash
pnpm check
pnpm test:e2e
pnpm test:e2e:live
```

线上 AI 冒烟会使用现有测试学员完成 3 轮上下文对话、刷新恢复和报告生成；它不是常规 CI 测试，不应在每次提交中自动消耗模型额度。

## 故障处理

- `403 AI Gateway ... credit card`：网页托管仍可用；关闭 Gateway 改用从 Vercel 函数区域可达的外部 OpenAI 兼容接口，或配置 Gateway 账单/额度。
- `Request timed out`：页面会统一显示中文兜底提示；先确认 `OPENAI_BASE_URL` 的公网 HTTPS、端口和上游白名单。当前自定义 `35772` 端口在 Vercel `hkg1` 超时，不能只凭本机请求成功判定生产可达。
- AI 服务失败：页面应展示通用中文提示，不展示网关、密钥、URL 或内部错误细节。
- 题库为空：先确认活动知识版本和 `DOTENV_CONFIG_PATH=.env.production.local pnpm quiz:publish:db` 是否完成。
- 生产数据异常：先运行 `pnpm production:verify:data`，不要直接修改数据库中的版本指针。

## 回滚原则

优先在 Vercel 控制台将 Production 切回上一个 Ready 部署；Neon 迁移和版本发布均为不可变/幂等流程，禁止通过删除历史数据回滚。
