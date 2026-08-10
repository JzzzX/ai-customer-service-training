# 学员轻量版工程交接

最后更新：2026-08-10。当前实现位于 `codex/learner-lite-sqlite`，是独立候选分支；`main` 的 Vercel + Neon 应用保持生产基线。

## 已交付边界

- 学员 Credentials 登录（仅有效账号）、专题练习、已发布正式题、个人历史。
- 已发布情景的 Mock/公司 OpenAI 兼容对话、刷新恢复和训练报告。
- Drizzle + `better-sqlite3` 的 16 张学员闭环表，启动时启用外键、WAL、5 秒 busy timeout、schema/integrity 校验。
- CSV 导入/停用/密码重置，知识/题库/场景 CLI 发布，SQLite 校验与手工备份。
- Neon 基础数据 Bundle：只迁移有效学员与发布内容，不含训练流水。

没有网页管理端、任务、审题、场景编辑、人工复核或自助注册。不要重新引入管理员角色；未来飞书 OAuth 只替换身份入口，不能绕过账号启用状态。

## 代码地图

| 修改目标 | 位置 |
| --- | --- |
| SQLite schema/client/migrations | `src/db/schema.ts`、`src/db/client.ts`、`drizzle/` |
| 学员答题/情景 Repository | `src/db/repositories/` |
| 运行时组合与 AI 网关 | `src/lib/runtime/services.ts`、`src/lib/scenario/ai-providers.ts` |
| 账号与内容 CLI | `scripts/` |
| 数据迁移 Bundle | `src/db/migration/`、`scripts/export-neon-base-data.ts`、`scripts/import-base-data.ts` |
| Mock E2E 与并发烟测 | `tests/e2e/learner-lite-smoke.spec.ts`、`tests/load/sqlite-concurrency.ts` |

## 开发和验收

```bash
pnpm db:migrate
pnpm learners:import -- --file learners.csv
pnpm db:verify
pnpm check
pnpm test:e2e
pnpm test:sqlite:concurrency
```

E2E 会重建 `.tmp/learner-lite-e2e.sqlite`，其中只有测试账号和 Mock 内容，不会读取本地业务数据。真实 AI 验收需要授权的公司网关凭据，单独执行 `pnpm test:e2e:live`。

## 部署与未决项

首版只能部署到持久可写磁盘上的单 Node.js 实例；SQLite 不能部署到 Vercel Serverless 或横向扩容实例。服务器、备案/域名、TLS、进程守护、监控、定时/异地备份及正式切流尚未决策。

真实 Neon 基础数据导出也未执行，因为本地没有 `NEON_EXPORT_DATABASE_URL`。切换前由维护窗口提供只读凭据，导入空 SQLite 后校验数量、活动指针、哈希和外键。旧完整能力始终可从 `archive/full-app-before-learner-lite-20260810` 恢复。
