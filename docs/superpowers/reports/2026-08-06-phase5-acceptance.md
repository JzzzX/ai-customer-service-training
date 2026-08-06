# 阶段五管理端与生产切换验收报告

日期：2026-08-06
分支：`main`
验收范围：管理员管理端、审核审计、全量迁移对账、Linux 生产配置、维护窗口门禁和阶段级回归。

## 结论

Phase 5 的工程实现和自动化验收已完成。新系统已经具备管理员资源管理、审核决策审计、全量快照/复制/对账、Nginx/systemd/Uvicorn 配置和失败不切换的维护窗口剧本；真实生产 MySQL 迁移、DNS 切换和旧系统下线没有在本地执行，因为当前环境没有公司测试库/生产库连接信息，也没有获得维护窗口授权。旧 Next.js 系统继续作为生产权威和回滚入口。

## 已交付能力

- FastAPI 管理 API：知识版本、题目、场景、任务、报告复核和管理历史；所有接口服务端检查 `role == "admin"`。
- 审核闭环：复核报告、修正分数/结论、评论写入 `review_decisions`，同时写入 `admin_audit_events`。
- Vue 管理端：`/admin`、知识、题目、场景、任务、审核和历史页面，角色守卫、表格空态/错误态和移动横向滚动。
- 迁移工具：`backend/scripts/migrate_phase5.py` 支持 `mysql+pymysql` 与 SQLite，按外键顺序复制并比较行数、孤儿外键、关键字段确定性 SHA-256；`rehearse_phase5.py` 支持两组隔离 URL。
- Linux 配置：`deploy/systemd/ai-customer-service-training.service`、`deploy/nginx/ai-customer-service-training.conf`、`deploy/env/backend.env.example`。
- 运营门禁：`phase5_preflight.sh` 校验生产环境和迁移报告；`phase5_cutover.sh` 默认只允许 dry-run，确认模式也不会自动切 DNS、删除旧系统或重置 Git；`update.sh` 只接受干净工作区、双远程同 SHA 和 fast-forward。

## 自动化证据

| 检查 | 结果 |
| --- | --- |
| `cd backend && .venv/bin/python -m pytest -q` | **90 passed** |
| Phase5 Alembic 临时库 `upgrade head → downgrade -1 → upgrade head` | 通过，`20260806phase5` 升降级闭环 |
| `npm --prefix frontend test -- --run` | **38 passed**（21 test files） |
| `npm --prefix frontend run build` | Vite production build 通过 |
| `npm test -- --run` | **232 passed**（79 test files） |
| `npm run lint` | 通过，无 ESLint 错误/警告 |
| `npm run db:check` | Drizzle check 通过 |
| `./node_modules/.bin/next typegen` | 通过 |
| `./node_modules/.bin/tsc --noEmit` | 通过 |
| `npm run build` | Next.js production build 通过 |
| `npm run test:e2e:company-stack` | **6/6 passed**（基础、Phase 4、Phase 5） |
| `cd backend && .venv/bin/python -m pytest tests/test_phase5_migration.py -q` | **5 passed** |
| `rehearse_phase5.py` 两组隔离演练 | `runs=2`、两组 `match=true`；报告 SHA-256 `eec6c1f4c523caf9702141a981b7df761497f0a71634b49cfe97a1e8269b1866` |
| `migrate_phase5.py` CLI | source/target hash `c9a14f8213075ee575a4ef4826c329aa46468368705c4ecf95754a90cfc80aa3` 一致；报告 SHA-256 `6f8036e0a757a3534088e9d9a2d3b000ab0f8f76482bf774929af373162c93a1` |
| `bash scripts/test_phase5_scripts.sh` | 通过；生产 env 拒绝、Nginx/systemd、dry-run、确认门禁和 fast-forward-only 检查均通过 |
| `phase5_preflight.sh --manifest ...` | 通过（使用 `mysql+pymysql` + `charset=utf8mb4` 形态的非生产占位连接串） |
| `phase5_cutover.sh --dry-run --manifest ...` | 通过，输出只读、最终增量、对账、回滚和观察顺序 |

仓库 `npm run typecheck` 和 `pnpm exec` 包装命令在当前运行环境会先触发 pnpm 的 `ignored build scripts` 安全策略并退出；这不是代码检查失败。已用仓库现有直接二进制完成 `next typegen`、`tsc --noEmit` 和 Next build，且最终工作区无 pnpm 生成文件。

## 真实生产窗口前置条件

1. 提供两组隔离的公司 MySQL schema 连接串，并用 `--source-url-1/--target-url-1`、`--source-url-2/--target-url-2` 完成真实 MySQL 演练。
2. 提供生产 `backend.env`、飞书 OAuth、Ark 和 Nginx 域名配置，由值班人员审核密钥权限。
3. 在维护窗口按 dry-run 顺序阻止旧系统写入、导出最终增量、导入并对账；任一 hash/外键/页面冒烟失败都保持旧系统并恢复写入。
4. 观察认证失败率、API 5xx、数据库连接、Ark 超时和报告 SSE 完成率，满足窗口退出条件后再确认域名切换和旧系统下线。

在上述外部条件完成前，不执行生产 DNS、旧系统写入封锁或旧系统删除。
