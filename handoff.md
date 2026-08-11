# 演示模式审核交接

最后更新：2026-08-11

## 当前状态

- 当前分支：`main`，演示模式提交：`d584498`。
- Vercel Production 已部署：<https://ai-customer-service-training.vercel.app/login>
- Production 环境当前为 `DEMO_MODE=true`、`SCENARIO_AI_MODE=mock`。
- 登录页提供「直接进入演示」，进入固定身份「演示学员」。
- 演示数据库是内存 SQLite，冷启动/重启后重置，不保存真实业务数据。

## 演示范围

- 题库、专题练习、售前 Mock AI 情景、报告流程可用于展示。
- 演示 fixture 只写入一个「售前 / 幼宠主粮咨询」场景；物流、破损少货、客诉只在正常内容数据中支持，当前演示不代表它们缺失。
- 正常模式仍要求持久化 `SQLITE_PATH` 和已导入的正式 SQLite 数据；真实 Neon → SQLite 导入尚未执行。

## 主要代码位置

- 登录开关与身份：`src/lib/runtime/mode.ts`、`src/auth.ts`、`src/app/login/`
- 演示 SQLite：`src/db/demo-fixture.ts`、`src/db/client.ts`
- 演示 E2E：`tests/e2e/demo-mode.spec.ts`
- 部署说明：`README.md`、`docs/DEPLOYMENT.md`

## 已验证

- Vitest：64 个文件、191 个测试通过。
- ESLint、TypeScript、Drizzle migration check、Next.js production build 通过。
- Production demo E2E：免登录进入 `/practice`，售前情景页和 Mock 流程可用。
- SQLite 并发烟测：30 workers、1500 条写入，无锁错误、重复记录或外键损坏。

## 请审核的重点

1. `DEMO_MODE` 未开启时，登录页不得出现演示入口，且正常登录路径不应被绕过。
2. 演示身份只能在 `DEMO_MODE=true` 时签发；演示数据不能写入持久 SQLite。
3. `DEMO_MODE=true` 不应作为正式学员部署配置；切回正常模式前需准备持久磁盘、`SQLITE_PATH` 和正式数据导入。
4. 若需要演示四类情景，应扩充 `demo-fixture.ts`，不要误把演示 fixture 当作正式数据迁移结果。

## 注意

工作区中的 `next-env.d.ts` 和 `pnpm-workspace.yaml` 是既有生成/控制文件，审核或提交时不要纳入本次文档提交。
