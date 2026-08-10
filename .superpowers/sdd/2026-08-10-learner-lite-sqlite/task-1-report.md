# Task 1：学员单端运行时收敛报告

## 完成内容

- 删除活跃 `/admin/**` 路由、任务页、任务/人工复核服务与 Repository 及其测试。
- 认证会话只保留学员 ID；数据库查询只接受启用的 `learner` 账号，登录统一进入 `/practice`。
- 个人中心去除任务标签和管理员信息；题库与情景入口不再接收 `assignmentId`。
- 新增只读 `PublishedQuizStore`、数据库/本地只读实现和 `published-service`；学员端不再依赖审核写入 Store。
- 保留 `KnowledgeQueryStore` 和 AI 情景训练闭环；报告完成后不再进入人工复核状态。
- 新增 [管理端归档说明](../../../docs/archive/learner-lite-admin-archive.md)，记录归档标签、恢复命令与移除清单。

## TDD 证据

### RED

首先运行以下聚焦测试，得到 7 个预期失败：会话含 `role`、管理员路由分支、管理员登录跳转、登录页角色页签、个人中心默认任务页、以及缺少 `createPublishedQuizStore`。

```text
pnpm vitest run src/lib/auth/credentials.test.ts src/lib/auth/session-claims.test.ts src/lib/auth/route-access.test.ts src/app/login/continue/page.test.ts src/app/login/page.test.tsx src/app/practice/profile/page.test.tsx src/lib/runtime/services.test.ts
# 7 failed, 15 passed
```

随后针对 assignment 输入边界运行测试，得到 2 个预期失败：题库保存和场景开始均仍携带 `assignmentId`。

```text
pnpm vitest run src/app/practice/quiz/actions.test.ts src/app/practice/scenario/actions.test.ts
# 2 failed, 7 passed
```

### GREEN 与回归

```text
pnpm vitest run <11 focused files>
# 38 passed

pnpm test
# 65 files passed, 194 tests passed

pnpm typecheck
# passed

pnpm lint
# passed
```

完整测试首次发现题库页测试仍 mock 旧 `review-service`，造成真实数据库初始化。根因确认后，只将 mock 路径改为 `published-service`，单文件回归和完整测试均通过。

## 主要文件

- 新增：`src/lib/quiz/published-store.ts`、`src/lib/quiz/published-service.ts`、`src/lib/quiz/local-published-store.ts`、`src/db/repositories/db-published-quiz-store.ts`。
- 修改：认证与会话、`src/lib/runtime/services.ts`、学员个人中心、题库和情景 Actions、场景会话持久化。
- 删除：`src/app/admin/**`、`src/app/practice/assignments/**`、`src/lib/training/**`、任务/人工复核 Repository 与旧题库审核运行时组合。

## 关注事项

- 按任务边界未修改 Drizzle schema、PostgreSQL migrations 或依赖；后续 SQLite 任务负责替换遗留表和迁移链路。
- `DbQuizReviewStore` 作为旧 PostgreSQL 发布/验证脚本的归档兼容实现暂留，已不在活跃学员运行时组合中；SQLite 任务应替换并移除。
- 未暂存 `pnpm-workspace.yaml` 和 `docs/superpowers/plans/2026-08-10-learner-lite-sqlite.md`，由控制器单独处理。
