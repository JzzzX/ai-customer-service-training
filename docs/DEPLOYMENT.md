# 学员轻量版部署与运维

本文件适用于学员 SQLite 版本。持久模式需要单实例和持久磁盘；`DEMO_MODE=true` 是单独的临时预览例外，不能替代正式部署。

## 前提

- 单个 Node.js 实例；不能以多实例、Serverless 或无状态容器运行 SQLite。
- `SQLITE_PATH` 指向持久且可写的本地磁盘，目录由运行用户拥有；不要放到临时盘、网络共享或仓库目录。
- 部署前执行 `pnpm db:migrate`、内容发布和 `pnpm db:verify`。应用启动会校验 schema、完整性和外键，失败即停止。
- 用进程守护和 TLS/域名方案部署是后续基础设施决策；本阶段不替用户决定供应商。

## 必要变量

```text
SQLITE_PATH=/var/lib/ai-customer-service-training/training.sqlite
AUTH_SECRET=<至少32位随机值>
SCENARIO_AI_MODE=mock|real
```

真实模式还需要公司批准且从部署环境可访问的 OpenAI 兼容变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，或已获额度的 AI Gateway 配置。变量和备份文件均不得进入 Git。

## 初始化与维护

```bash
pnpm db:migrate
pnpm learners:import -- --file learners.csv
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm db:verify
pnpm db:backup -- --output /var/backups/training-$(date +%F).sqlite
```

账号、知识、题库和场景均由 CLI 维护，无网页管理端。备份频率、异地副本和恢复演练由服务器方案确定后单独制定；当前至少在升级、批量导入和内容发布前手工备份。

## 临时内存演示

测试部署可以设置：

```text
DEMO_MODE=true
AUTH_SECRET=<至少32位随机值>
SCENARIO_AI_MODE=mock
```

此模式不需要 `SQLITE_PATH`。应用会在当前 Node.js 进程创建内存 SQLite，登录页显示“直接进入演示”，并加载一个演示学员、一个售前情景和 Mock AI。答题、对话和报告只在热实例内存在，重启或 Serverless 冷启动后清空；不要在正式域名开启，也不要把演示数据解释为真实迁移或持久化验收。

## 切换与回滚

真实切换前先在维护窗口使用 `db:export:neon` 只读导出基线，再在空 SQLite 目标执行 `db:import:base` 和 `db:verify`。流水数据不在此次迁移范围内。临时 `DEMO_MODE` 预览不改变 Neon 数据，也不能替代迁移验收；若需要回到完整应用，用标签 `archive/full-app-before-learner-lite-20260810` 建立恢复分支。

真实 AI 三轮对话、刷新恢复和报告生成必须由公司网关负责人单独授权验收，不能把 Mock E2E 通过解释为生产 AI 已验收。
