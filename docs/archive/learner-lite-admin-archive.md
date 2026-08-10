# 学员轻量版前的完整应用归档

- 归档标签：`archive/full-app-before-learner-lite-20260810`
- 归档提交：`4e4a2c0`
- 目的：保留原 Next.js 全功能应用，供迁移窗口内查阅或恢复管理端能力。

## 恢复方法

```bash
git switch --detach archive/full-app-before-learner-lite-20260810
```

如需在新分支恢复完整应用：

```bash
git switch -c restore/full-app archive/full-app-before-learner-lite-20260810
```

## 已从活跃学员端移除的模块

- `/admin/**`：任务分配、知识维护、题库审核、场景维护、人工复核和审计历史页面与 Actions。
- `/practice/assignments` 与个人中心任务标签页。
- `src/lib/training/**`、任务与人工复核 Repository、以及相关页面和单元测试。
- 登录页角色选择、会话角色 Claim、管理员重定向和 `requireAdmin` 守卫。
- 题库审核写入端的运行时组合；学员端改为只读 `PublishedQuizStore`。

## 仍保留的学员闭环

- 邮箱密码登录、知识小测、题目即时解析、个人进度和历史。
- AI 情景训练、报告与个人会话记录。
- `KnowledgeQueryStore`，用于按已发布知识版本为 AI 场景装载上下文。

数据库 schema 和旧 PostgreSQL 内容发布归档实现将在 SQLite 数据层迁移任务中统一替换；本次不修改表结构。
