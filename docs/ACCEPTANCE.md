# 项目重构与生产迁移验收

最后更新：2026-08-06

## 验收结论

当前结论是：**代码级重构完成；真实 PostgreSQL/MySQL 演练和公司生产切换待执行。**

本文是当前唯一验收入口。它合并了原 MVP 工程验收基线与 Phase 6 验收结论，并严格区分本地自动化证据、真实异构数据库证据和生产环境证据。只有下列三条轨道全部通过，[Roadmap](ROADMAP.md) 才能将整体迁移标记为 100%。

| 验收轨道 | 当前状态 | 是否阻塞整体 100% |
| --- | --- | --- |
| 1. 代码级重构 | **通过** | 否 |
| 2. PostgreSQL → MySQL 真实演练 | **待公司环境** | 是 |
| 3. 公司生产切换 | **待公司执行** | 是 |

## 轨道一：代码级重构

状态：**通过（代码级）**

### 技术栈与仓库门禁

- `main` 仅保留 Python/FastAPI/SQLAlchemy/Alembic/MySQL 与 Vue/Vite/Vue Router/Pinia/Axios 运行代码。
- Next.js、React、Auth.js、Drizzle、Neon、Vercel 和根 TypeScript/TSX 运行配置已退役。
- `git ls-files '*.ts' '*.tsx'` 结果应为空。
- 旧系统只通过双远程标签 `legacy-next-final-bb8d164` 恢复，不重新合并到 `main`。

### 功能与安全能力

| 范围 | 验收要求 | 当前证据 |
| --- | --- | --- |
| 身份与权限 | 飞书身份、JWT Cookie、角色边界、跨用户资源拒绝 | `backend/tests/test_auth_api.py`、`backend/tests/test_security.py` |
| 知识与题库 | 版本、来源、审核、题组顺序、服务端判分、答题记录 | `backend/tests/test_catalog_api.py`、`backend/tests/test_quiz_attempt_api.py` |
| 情景训练 | 可恢复会话、消息顺序、风险、报告 SSE、重试和历史 | `backend/tests/test_scenario_api.py`、`frontend/tests/e2e/company-stack-phase4.spec.js` |
| 管理端 | 任务创建、题目审核/发布、场景草稿、报告复核和审计 | `backend/tests/test_phase5_admin.py`、`frontend/src/views/Admin*.vue` |
| 浏览器闭环 | 登录、个人中心、任务、答题、情景、报告与管理端 | `frontend/tests/e2e/` |
| 迁移工具 | 版本化快照、字段映射、事务、非空库门禁、幂等、脱敏对账 | `backend/tests/test_legacy_migration.py`、`scripts/test_phase6_scripts.sh` |

所有写操作必须在 FastAPI 服务端校验身份、角色、资源归属和状态。Ark 生产失败必须返回可重试错误，不允许静默回退 Mock。

### 已记录的自动化证据

| 命令 | 最近验收结果 | 证据边界 |
| --- | --- | --- |
| `cd backend && .venv/bin/python -m pytest -q` | 100 passed | 本地后端与 SQLite 行为测试 |
| `npm --prefix frontend test -- --run` | 39 passed | Vue 组件与状态测试 |
| `npm --prefix frontend run build` | passed | Vite production build |
| `npm --prefix frontend run test:e2e:company-stack` | 6 passed | 隔离 FastAPI/Vue 浏览器闭环 |
| `bash scripts/test_phase6_scripts.sh` | passed | 部署预检与切换脚本门禁 |
| `alembic upgrade head → downgrade -1 → upgrade head` | passed | 隔离 SQLite 迁移链路，不等于真实 MySQL 演练 |

交接或发布前应重新执行这些命令，不能只引用历史数字。

## 轨道二：PostgreSQL → MySQL 真实演练

状态：**未完成，等待公司 PostgreSQL/MySQL 权限与隔离环境。**

已完成的是迁移代码和自动化验证：

- `backend/scripts/migrate_legacy.py` 提供 `export`、`import`、`reconcile`。
- 快照首行记录 `schema_version=1`、导出时间和旧提交 SHA，文件权限为 `0600`。
- 连接串只从 `LEGACY_DATABASE_URL`、`DATABASE_URL` 读取。
- 导入默认拒绝非空目标库，按表事务执行，同一快照幂等或明确拒绝。
- 密码哈希不进入新认证体系；旧 ID、时间、版本、任务归属、消息顺序、分数、报告和审核关系按[迁移矩阵](PHASE6-MIGRATION-MATRIX.md)保留。
- `knowledge_progress`、`scenario_progress_summaries` 从事实表重建。

尚未完成、不得用 SQLite 替代的真实门禁：

1. 使用 PostgreSQL 16 与 MySQL 8.0，或公司的实际生产版本，建立两组彼此隔离的演练环境。
2. 对同一旧库快照独立执行两次全量导出、导入、重建和对账。
3. 核对逐表数量、外键孤儿、关键字段 SHA-256、题组顺序、任务归属、会话消息数、报告数和抽样用户聚合。
4. 两次演练的行数、哈希和抽样结果一致，并由开发与 DBA 归档报告、签字确认。
5. 验证失败不会留下半完成的权威数据；重复运行不会产生重复记录。

## 轨道三：公司生产切换

状态：**未开始。**

需要公司开发、DBA、运维和飞书管理员共同完成：

1. 配置正式 MySQL、飞书 OAuth、Ark、域名、Nginx、systemd、HTTPS 和密钥管理。
2. 在维护窗口冻结旧系统写入，生成最终快照并导入 MySQL。
3. 对账失败时立即恢复旧写入且不切 DNS；对账通过后执行学员与管理员代表性冒烟。
4. 冒烟覆盖登录、个人中心、任务、答题、会话恢复、报告重试、任务创建、题目发布、场景生成和报告复核。
5. 切换 DNS，并观察认证失败率、API 5xx、数据库连接、Ark 超时和 SSE 完成率。
6. 观察期通过后确认旧系统下线；旧源码继续只保留在 `legacy-next-final-bb8d164` 标签。

详细命令、维护窗口门禁和回滚顺序见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 最终签字门禁

| 检查项 | 负责人 | 当前状态 |
| --- | --- | --- |
| 代码级重构与自动化验证 | 开发 | 已通过，交接时需复跑 |
| 两次真实 PostgreSQL/MySQL 全量演练 | 开发 + DBA | 待执行 |
| 飞书、Ark、MySQL、密钥和域名配置 | 开发 + 运维 + 飞书管理员 | 待执行 |
| 维护窗口最终迁移与代表性冒烟 | 开发 + DBA + 运维 | 待执行 |
| DNS 切换、观察期与旧系统下线 | 运维 + 技术负责人 | 待执行 |

任一真实对账、冒烟或观察指标失败，都不得宣称整体迁移完成。
