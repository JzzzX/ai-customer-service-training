# 阶段五管理端与生产切换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不直接改动生产库的前提下，交付管理员管理闭环、MySQL 兼容迁移与对账工具、Linux 生产配置、维护窗口切换门禁和阶段级验收证据。

**Architecture:** FastAPI 通过独立的管理员依赖、Repository 和 Service 暴露知识、题目、场景、任务、审核与历史资源；审核写入统一的管理审计表。Vue 使用受角色保护的管理路由和 Pinia 数据层，资源页共享分页表格壳。迁移工具基于 SQLAlchemy Core 读取 `Base.metadata`，按外键顺序复制并对所有业务表生成确定性快照，既支持 `mysql+pymysql` 也支持隔离 SQLite 演练。部署交付 Nginx、systemd、环境模板和只允许 fast-forward 的更新/切换脚本，切换脚本默认只做预检和 dry-run。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Alembic、PyMySQL、Vue 3、Pinia、Vue Router、Vitest、pytest、Playwright、Nginx、systemd、Bash。

## Global Constraints

- 生产数据库 URL 必须使用 `mysql+pymysql://`，字符集使用 `utf8mb4`，业务时间使用 UTC。
- 不新增双写；维护窗口先阻止旧系统写入，失败时保持旧系统并恢复写入。
- 所有管理员接口必须在服务端检查当前用户 `role == "admin"`，前端隐藏按钮不构成权限控制。
- `update.sh` 禁止 `git reset --hard`，工作区不干净、分支分叉或 fast-forward 失败时立即停止。
- 不提交 `.env`、SQLite 数据库、`__pycache__`、构建产物和覆盖率文件。
- 每个代码切片先写一个会失败的测试，确认红灯后实现最小行为，再运行聚焦测试和全量回归。

---

### Task 1: 管理审计模型与管理员 API

**Files:**
- Create: `backend/app/models/admin.py`
- Create: `backend/alembic/versions/20260806phase5_admin_audit.py`
- Create: `backend/app/repositories/admin.py`
- Create: `backend/app/services/admin.py`
- Create: `backend/app/schemas/admin.py`
- Create: `backend/app/api/admin.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/api/auth.py`
- Test: `backend/tests/test_phase5_admin.py`

**Interfaces:**
- `admin_required(user: User = Depends(get_current_user)) -> User` raises `ADMIN_REQUIRED` (403) for non-admin users.
- `AdminRepository.list_resource(resource, status, offset, limit) -> AdminPage` returns stable `items`, `total`, and `next_offset` for `knowledge`, `questions`, `scenarios`, `assignments`, `reviews`, and `history`.
- `AdminService.decide_review(report_id, reviewer_id, payload) -> ReviewDecision` creates a decision and `AdminAuditEvent` in one transaction; a missing report raises `REVIEW_NOT_FOUND`.
- Endpoints are `/api/v1/admin/overview`, `/knowledge`, `/questions`, `/scenarios`, `/assignments`, `/reviews`, `/reviews/{report_id}/decision`, and `/history`.

- [x] **Step 1: Write failing tests** for role rejection, resource list shape, review decision persistence/audit event, idempotent latest-review display, and migration table creation.
- [x] **Step 2: Run the focused tests** with `cd backend && .venv/bin/python -m pytest tests/test_phase5_admin.py -q`; the initial run failed on missing routes and model registration.
- [x] **Step 3: Implement the model, migration, repository, service, schemas, dependency, and router** with transaction boundaries and bounded `limit` values.
- [x] **Step 4: Run the focused tests again** and Alembic upgrade → downgrade → upgrade; focused tests pass and the migration round-trip completes.
- [x] **Step 5: Commit and push** with `feat(phase5): 建立管理员管理与审计 API`.

### Task 2: Vue 管理端页面与管理员 E2E

**Files:**
- Create: `frontend/src/api/admin.js`
- Create: `frontend/src/stores/admin.js`
- Create: `frontend/src/views/AdminDashboardView.vue`
- Create: `frontend/src/views/AdminResourceView.vue`
- Create: `frontend/src/views/AdminReviewsView.vue`
- Create: `frontend/src/views/AdminHistoryView.vue`
- Create: `frontend/src/views/AdminViews.test.js`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/components/AppShell.vue`
- Modify: `frontend/src/styles/base.css`
- Modify: `backend/scripts/seed_phase3_e2e.py`
- Modify: `backend/app/api/auth.py`
- Create: `tests/e2e/company-stack-phase5.spec.ts`

**Interfaces:**
- `frontend/src/api/admin.js` exports `getAdminOverview`, `listAdminResource`, `decideAdminReview`, and `listAdminHistory`.
- `useAdminStore` exposes `overview`, `resources`, `reviews`, `history`, `loading`, `error`, `loadResource(name)`, and `decideReview(reportId, payload)`.
- Admin routes use `meta: { requiresAuth: true, requiresAdmin: true }`; the router redirects authenticated learners to `/profile` and unauthenticated users to `/login`.
- In `APP_ENV=test`, `POST /api/v1/auth/test-login?role=admin` issues a cookie for the seeded `e2e-admin`; the query parameter is rejected outside test mode.

- [x] **Step 1: Write failing Vitest tests** for admin route metadata/redirect, store loading and review action, and table rendering of status/empty/error states.
- [x] **Step 2: Run `cd frontend && npm test -- --run src/views/AdminViews.test.js src/router/index.test.js`; the initial run failed on missing API/store/view modules.
- [x] **Step 3: Implement API/store/views/router guard/nav and the deterministic test admin seed** without duplicating learner pages.
- [x] **Step 4: Run focused Vitest and `npm --prefix frontend run build`; Vue tests, build, and the full backend regression pass.
- [x] **Step 5: Run the Phase5 Playwright spec** against the seeded company-stack server; learner denial, admin resources, review decision, and history refresh pass 2/2.
- [x] **Step 6: Commit and push** with `feat(phase5): 完成管理员 Vue 管理端与复核闭环`.

### Task 3: 全量迁移快照、复制与两次隔离演练

**Files:**
- Create: `backend/app/services/phase5_migration.py`
- Create: `backend/scripts/migrate_phase5.py`
- Create: `backend/scripts/rehearse_phase5.py`
- Create: `backend/tests/test_phase5_migration.py`
- Modify: `backend/requirements.txt` only if the existing PyMySQL floor needs to be made explicit.

**Interfaces:**
- `snapshot_database(session) -> dict` returns `tables`, `row_counts`, `foreign_key_orphans`, and a canonical SHA-256 `hash` for users, identities, knowledge, quiz, assignments, scenarios, sessions, messages, reports, reviews, and admin audit records.
- `migrate_database(source_url, target_url, *, dry_run=False) -> dict` copies rows in dependency order, preserves primary keys/timestamps/JSON, refuses a non-empty target unless `--replace-target` is explicit, then returns source/target snapshots and `match`.
- `backend/scripts/migrate_phase5.py --source-url URL --target-url URL --report PATH [--dry-run] [--replace-target]` exits nonzero on count/hash/orphan mismatch.
- `backend/scripts/rehearse_phase5.py --root PATH` creates two independent source/target pairs and writes byte-identical reports; `PHASE5_SOURCE_URL` and `PHASE5_TARGET_URL` can point the same harness at isolated MySQL databases.

- [ ] **Step 1: Write failing tests** for canonical row hashing, foreign-key orphan detection, preservation of JSON/timestamps, refusal of a dirty target, dry-run no-write behavior, and two isolated deterministic reports.
- [ ] **Step 2: Run `cd backend && .venv/bin/python -m pytest tests/test_phase5_migration.py -q`; confirm failures occur before the service/CLI exists.
- [ ] **Step 3: Implement snapshot, ordered copy, reconciliation, CLI argument validation, and the rehearsal harness using SQLAlchemy Core so `sqlite+pysqlite` and `mysql+pymysql` share the same code path.
- [ ] **Step 4: Run the migration tests plus two isolated rehearsal commands on temporary SQLite databases; if MySQL connection variables are present, repeat the exact commands with two isolated MySQL schemas and record both dialects.
- [ ] **Step 5: Commit and push** with `feat(phase5): 完成全量迁移对账与隔离演练工具`.

### Task 4: Linux 生产配置与安全切换门禁

**Files:**
- Create: `deploy/systemd/ai-customer-service-training.service`
- Create: `deploy/nginx/ai-customer-service-training.conf`
- Create: `deploy/env/backend.env.example`
- Create: `scripts/phase5_preflight.sh`
- Create: `scripts/phase5_cutover.sh`
- Create: `scripts/test_phase5_scripts.sh`
- Modify: `install.sh`
- Modify: `build.sh`
- Modify: `start.sh`
- Modify: `stop.sh`
- Modify: `update.sh`
- Modify: `docs/DEPLOYMENT.md`

**Interfaces:**
- systemd binds Uvicorn to `127.0.0.1:8005`, loads only `/etc/ai-customer-service-training/backend.env`, restarts on failure, and never stores secrets in the unit.
- Nginx serves `frontend/dist`, proxies `/api/` to the local Uvicorn process, disables proxy buffering for SSE, and exposes `/healthz` without leaking environment values.
- `phase5_preflight.sh` validates production settings, migration report match, required paths, and clean Git state; it never changes DNS or data.
- `phase5_cutover.sh --dry-run --manifest PATH` prints the maintenance-window sequence; without `--dry-run`, it refuses to run unless `PHASE5_CONFIRM_CUTOVER=I_UNDERSTAND` and a matching manifest are supplied. It never invokes `git reset --hard` or deletes the old system.
- `update.sh` fetches both remotes and only performs `git merge --ff-only origin/<branch>` when the worktree is clean and `gitea/<branch>` has no divergent commits.

- [ ] **Step 1: Write failing shell tests** for Bash syntax, production env rejection, Nginx/systemd invariants, dry-run output, confirmation refusal, and fast-forward-only update guards.
- [ ] **Step 2: Run `bash scripts/test_phase5_scripts.sh`; confirm each assertion fails for the missing artifacts or guards.
- [ ] **Step 3: Implement the config templates and scripts with quoted paths, explicit absolute deploy directories, no destructive cleanup, and clear Chinese operator errors.
- [ ] **Step 4: Run the shell test, `bash -n` for every script, and a dry-run preflight against a generated matching migration manifest.
- [ ] **Step 5: Commit and push** with `chore(phase5): 固化 Linux 部署与切换门禁`.

### Task 5: 阶段级回归、验收报告与 Roadmap 收口

**Files:**
- Create: `docs/superpowers/reports/2026-08-06-phase5-acceptance.md`
- Modify: `docs/ROADMAP.md`
- Modify: `README.md` only if the new admin/deployment entry points are missing from the navigation.

**Interfaces:**
- Acceptance report records exact commands, pass counts, commit SHAs, migration report hashes, deployment guard results, and any external prerequisite such as company MySQL credentials without calling that prerequisite complete.
- Roadmap marks all six Phase5 checkboxes only when the corresponding automated evidence exists, sets current execution to `6/6`, overall progress to `100%`, links plan/report, and preserves the rollback rule for a real production window.

- [ ] **Step 1: Run backend focused tests and full `cd backend && .venv/bin/python -m pytest -q`**.
- [ ] **Step 2: Run frontend focused tests, full Vitest, Vite build, legacy Next tests, direct ESLint/type checks/Drizzle check/Next build, and company-stack Playwright including Phase5.
- [ ] **Step 3: Run the migration rehearsal and deployment guard matrix again from a clean temporary directory; save deterministic report hashes.
- [ ] **Step 4: Write the acceptance report and update Roadmap only with observed evidence; explicitly separate local MySQL-compatible validation from a real company database cutover when credentials are absent.
- [ ] **Step 5: Run `git status --short --branch`, inspect staged paths, commit with `docs(roadmap): 完成阶段五管理端与切换验收`, push the same commit to `origin main` and `gitea main`, and compare all three SHAs.

## Self-review checklist

- The five tasks cover all six Phase5 Roadmap bullets: six management resources, Linux deployment, two isolated rehearsals, account/content/task/session/message/report/review reconciliation, maintenance-window guard, and observed cutover readiness.
- No task silently performs a production DNS switch, deletes a source database, or weakens server-side authorization.
- Migration interfaces preserve identifiers and timestamps and fail closed on dirty targets or mismatched hashes.
- Frontend routes and backend dependencies use the same `admin` role contract.
- Every new production behavior has a red-green test step and every completion claim has a reproducible command in the acceptance report.
