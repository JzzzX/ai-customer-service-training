# 当前系统验收基线

本文记录当前 Vue/FastAPI/MySQL 系统的工程验收基线。它不代表真实数据库、域名或生产切换已经完成；生产状态以 [Roadmap](ROADMAP.md) 和 [Phase 6 验收报告](superpowers/reports/2026-08-06-phase6-acceptance.md) 为准。

## 工程能力

| 范围 | 验收要求 | 当前证据 |
| --- | --- | --- |
| 身份与权限 | 飞书身份、JWT Cookie、学员/管理员边界、跨用户资源拒绝 | `backend/tests/test_auth_api.py`、`backend/tests/test_security.py` |
| 知识与题库 | 版本、来源、审核、题组顺序、服务端判分、答题记录 | `backend/tests/test_catalog_api.py`、`backend/tests/test_quiz_attempt_api.py` |
| 情景训练 | 可恢复会话、消息顺序、风险、报告 SSE、重试和历史 | `backend/tests/test_scenario_api.py`、`frontend/tests/e2e/company-stack-phase4.spec.js` |
| 管理端 | 任务创建、题目审核/发布、场景草稿、报告复核、审计 | `backend/tests/test_phase5_admin.py`、`frontend/src/views/Admin*.vue` |
| 浏览器闭环 | 登录、个人中心、答题、情景、管理员页面 | `frontend/tests/e2e/` |

## 可重复命令

```bash
./build.sh
bash scripts/test_phase6_scripts.sh
npm --prefix frontend run test:e2e:company-stack
```

## 迁移与生产门槛

- PostgreSQL → MySQL 必须使用 `backend/scripts/migrate_legacy.py`，完成两次隔离数据库演练。
- 对账必须覆盖逐表数量、外键孤儿、关键字段 SHA-256、题组顺序、任务归属、消息数、报告数和用户抽样。
- 生产切换需要维护窗口冻结写入、最终快照、对账、代表性冒烟、DNS 切换和观察期。
- 任一对账或冒烟失败，都保持旧入口并恢复旧系统写入；旧源码只从 `legacy-next-final-bb8d164` 标签恢复。

因此，工程测试全部通过不等于生产切换通过；整体 100% 只在 [ROADMAP.md](ROADMAP.md) 三条轨道均完成后成立。
