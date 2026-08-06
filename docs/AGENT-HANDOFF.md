# 开发交接说明

本文是当前 `main` 的运行与维护入口。历史阶段计划保留在 `docs/superpowers/`，不应替代本文或当前 [Roadmap](ROADMAP.md)。

## 当前边界

仓库当前运行栈为：

- Python 3.12+、FastAPI、SQLAlchemy、Alembic、PyMySQL。
- Vue 3、Vite、Vue Router、Pinia、Axios。
- Uvicorn、Nginx、systemd、Linux。
- 飞书 OAuth + JWT Cookie；Ark Provider，测试时只能通过配置显式启用 Mock。

当前 `main` 已删除旧前端和旧 ORM 运行代码；可恢复的旧快照是双远程标签 `legacy-next-final-bb8d164`。

## 目录导航

| 目录 | 职责 |
| --- | --- |
| `backend/app/api/` | `/api/v1` 路由、请求边界和权限依赖 |
| `backend/app/models/` | SQLAlchemy 事实模型与关联关系 |
| `backend/app/repositories/` | 查询和持久化封装 |
| `backend/app/services/` | 知识、题库、情景、管理和迁移业务逻辑 |
| `backend/alembic/versions/` | 可升级/可降级数据库迁移 |
| `backend/scripts/` | 内容导入、种子、迁移和对账命令 |
| `backend/tests/` | 后端单元、API、权限和迁移测试 |
| `frontend/src/api/` | Axios API 封装 |
| `frontend/src/stores/` | Pinia 状态与请求动作 |
| `frontend/src/views/` | 学员、管理、健康检查和兼容页面 |
| `frontend/tests/e2e/` | 公司栈 Playwright 验收 |
| `deploy/` | Nginx、systemd 和生产环境模板 |

## 常用命令

```bash
./install.sh
./start.sh
./stop.sh
./build.sh

cd backend
.venv/bin/python -m pytest -q
.venv/bin/alembic upgrade head
.venv/bin/python scripts/migrate_legacy.py --help

cd ../frontend
npm test -- --run
npm run build
npm run test:e2e:company-stack
```

本地默认端口：FastAPI `8005`、Vite `8006`。后端环境变量放在 `backend/.env`，生产数据库必须是 `mysql+pymysql://` 且带 `charset=utf8mb4`。

## 功能入口

### 学员

- `/profile`：个人中心、任务和训练摘要。
- `/practice/quiz/topics`：专题目录与答题。
- `/practice/scenario`：情景目录、会话、报告和历史。
- `/practice/profile`、`/practice/assignments`、`/practice/history`、`/practice/quiz`：旧书签兼容跳转。

### 管理员

- `/admin/knowledge`：知识版本健康。
- `/admin/questions`、`/admin/questions/{id}/review`：题目编辑、审核和题组发布。
- `/admin/assignments`：创建学员题库/场景任务。
- `/admin/scenarios/generate`：按类别生成 1–5 个 Ark 场景草稿；Ark 失败返回可重试错误，不静默切 Mock。
- `/admin/reviews`、`/api/v1/admin/reviews/{report_id}`：报告复核和证据。
- `/admin/history`：管理审计记录。

所有写接口都在服务端校验登录、角色、资源归属和状态；不要把前端路由守卫当作唯一安全机制。

## 数据迁移交接

迁移入口是 `backend/scripts/migrate_legacy.py`，连接串只从 `LEGACY_DATABASE_URL` 和 `DATABASE_URL` 读取：

```bash
LEGACY_DATABASE_URL='postgresql+psycopg://...' \
  backend/.venv/bin/python backend/scripts/migrate_legacy.py export \
  --output /secure/legacy-snapshot.jsonl --manifest /secure/legacy-manifest.json

DATABASE_URL='mysql+pymysql://...?charset=utf8mb4' \
  backend/.venv/bin/python backend/scripts/migrate_legacy.py import \
  --input /secure/legacy-snapshot.jsonl --report /secure/mysql-import-report.json \
  --topic-fixture backend/tests/fixtures/legacy-topic-question-bank.json

backend/.venv/bin/python backend/scripts/migrate_legacy.py reconcile \
  --manifest /secure/legacy-manifest.json --report /secure/mysql-import-report.json
```

迁移工具的约束：快照 JSONL 首行带 schema 版本、导出时间和旧提交 SHA；文件权限 `0600` 且不进 Git；默认拒绝非空目标库；按表事务导入；重复导入幂等或明确拒绝；派生进度导入后重算。完整字段映射见 [PHASE6-MIGRATION-MATRIX.md](PHASE6-MIGRATION-MATRIX.md)。

## 交接前检查

1. `git status --short` 为空，确认 `HEAD == origin/main == gitea/main`。
2. `backend/.venv/bin/python -m pytest -q` 通过。
3. `npm --prefix frontend test -- --run` 和 `npm --prefix frontend run build` 通过。
4. `npm --prefix frontend run test:e2e:company-stack` 通过。
5. `git ls-files '*.ts' '*.tsx'` 为空；`frontend` 仅使用 JavaScript/Vue。
6. `backend/.venv/bin/alembic upgrade head`、`downgrade -1`、`upgrade head` 在隔离库通过。
7. 两次隔离 PostgreSQL/MySQL 演练的行数、哈希、孤儿和抽样结果一致。
8. 公司开发、DBA、运维和飞书管理员确认真实切换窗口、密钥、Ark、域名和观察指标。

只有代码、数据和生产三条轨道都通过，才能把整体迁移标记为 100%。
