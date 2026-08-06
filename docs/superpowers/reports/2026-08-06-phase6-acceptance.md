# Phase 6 验收报告：彻底迁移与旧技术栈退役

日期：2026-08-06
分支：`main`
旧系统快照：`legacy-next-final-bb8d164` → `bb8d164b51412b193e5d9e4513bce5e15b501186`

## 结论

Phase 6 的代码级迁移已经完成主要收口：`main` 只保留 Vue/FastAPI/SQLAlchemy/Alembic/MySQL 目标运行代码，旧前端、旧 ORM、根 TypeScript/TSX 运行代码和旧构建配置已删除；旧源码仍可从双远程标签恢复。

数据迁移和生产切换尚未宣称完成。当前环境没有公司 PostgreSQL/MySQL、飞书、Ark、DNS 和维护窗口权限，因此不能把本地 SQLite、单元测试或代码审查冒充真实生产验收。

## 轨道一：代码级重构

状态：**通过（代码级）**

- 目标模型补齐 `question_reviews`、`quiz_set_questions`、来源类型、旧 ID/时间/版本/任务/消息/报告/审核关系字段。
- Alembic 支持空库升级、旧版升级、降级再升级路径；新增迁移位于 `backend/alembic/versions/20260806phase6_*.py`。
- `backend/scripts/migrate_legacy.py` 提供 `export`、`import`、`reconcile` 三个命令，连接串只读取 `LEGACY_DATABASE_URL` 和 `DATABASE_URL`。
- 快照为版本化 JSONL，文件 `0600`，不提交 Git；导入默认拒绝非空目标，逐表事务并保护重复导入。
- 导入后从事实表重建 `knowledge_progress` 与 `scenario_progress_summaries`，并在报告中记录题组顺序、任务归属、消息位置、报告数量和脱敏用户聚合 SHA-256 对账证据。
- 功能等价接口和页面已覆盖学员任务、管理员任务、题目审核/发布、Ark 场景草稿和报告复核；旧 `/practice/*` 书签有 Vue 显式跳转。
- Playwright 配置与测试已迁入 `frontend/` 并转换为 JavaScript。
- `git ls-files '*.ts' '*.tsx'` 应为空；前端依赖只位于 `frontend/package.json`。

验证记录：

| 命令 | 结果 |
| --- | --- |
| `cd backend && .venv/bin/python -m pytest -q` | 100 passed |
| `npm --prefix frontend test -- --run` | 39 passed |
| `npm --prefix frontend run build` | Vite production build passed |
| `npm --prefix frontend run test:e2e:company-stack` | 6 passed |
| `bash scripts/test_phase6_scripts.sh` | 通过 |
| `cd backend && .venv/bin/alembic upgrade head → downgrade -1 → upgrade head` | 通过（隔离 SQLite） |

## 轨道二：PostgreSQL/MySQL 演练

状态：**未完成，等待公司环境**

已完成本地代码验证：

- 旧表导出头包含 `schema_version=1`、导出时间和旧提交 SHA。
- 旧题组题目关系可映射到 `quiz_set_questions`，专题答题可合并到统一 `quiz_attempts/quiz_answers` 并保留来源类型。
- 密码哈希被明确排除；用户 ID、邮箱、姓名、角色和业务事实保留。
- 导入非空目标、坏快照、重复导入和脱敏报告均有测试。

仍需公司人员在 PostgreSQL 16 + MySQL 8.0（或实际版本）完成两次隔离演练，并把两次报告归档。每次报告必须包含逐表数量、外键孤儿、关键字段 SHA-256、题组顺序、任务归属、会话消息数、报告数和抽样用户聚合；两次结果必须一致。

## 轨道三：生产切换

状态：**未开始**

需要公司开发、DBA、运维和飞书管理员共同完成：

1. 配置隔离 PostgreSQL/MySQL、飞书 OAuth、Ark、域名、Nginx、systemd 和密钥管理。
2. 维护窗口冻结旧写入，生成最终快照并导入 MySQL。
3. 对账失败立即恢复旧写入，不切 DNS；对账成功后执行学员、管理员、答题、训练、报告和审核冒烟。
4. 切换 DNS，观察认证失败率、API 5xx、数据库连接、Ark 超时、SSE 完成率。
5. 观察期通过后确认旧系统下线；源码只保留在 `legacy-next-final-bb8d164` 标签。

## 通过标准

只有三条轨道均为“通过”时，Roadmap 才能把整体迁移标记为 100%。在此之前，当前结论是“代码级重构完成，真实数据迁移和生产切换待公司环境”。
