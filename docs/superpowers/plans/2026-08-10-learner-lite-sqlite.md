# 学员轻量版 SQLite 改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 保留 Next.js 学员训练闭环，移除管理端，并将运行时持久化从 Neon/PostgreSQL 切换为 SQLite。

**Architecture:** 在 `codex/learner-lite-sqlite` 分支中保留现有 Next.js、领域服务和公司 OpenAI 兼容 AI 网关。学员端使用单角色 Auth.js 会话和 Drizzle SQLite；账号、内容由 CSV/文件和 CLI 维护。当前 `main` 的 Vercel/Neon 生产基线不合并，待服务器方案确定后再部署。

**Tech Stack:** Next.js 16、React 19、TypeScript、Auth.js Credentials、Drizzle ORM、`better-sqlite3@13.0.3`、Vitest、Playwright。

## Global Constraints

- 首版只有学员角色：邮箱密码登录、专题/正式题库、AI 情景、报告和个人历史。
- 首版目标规模为 100 个账号、约 30 个并发学员，运行形态为单个 Node.js 实例和持久 SQLite 文件。
- SQLite 使用 `foreign_keys=ON`、WAL、`busy_timeout=5000`；AI 请求不在数据库事务内。
- `SQLITE_PATH` 为运行时数据库路径；不可写、损坏或 schema 不兼容时必须失败，不能回退 JSON/内存库。
- 管理端、任务分配、题目审核、场景管理、人工复核不进入活跃代码树；历史代码由归档标签保留。
- Neon 基础迁移只包含有效学员、活动知识、正式题库和已发布场景；不迁移训练流水。
- 每个里程碑使用中文 Conventional Commit，并明确推送 `origin` 与 `gitea`。

---

### Task 1: 建立归档基线与学员单端边界

**Files:**
- Create: `docs/archive/learner-lite-admin-archive.md`
- Modify: `src/auth.ts`, `src/lib/auth/credentials.ts`, `src/lib/auth/route-access.ts`, `src/lib/auth/session-claims.ts`, `src/app/login/continue/page.tsx`, `src/app/practice/profile/page.tsx`
- Delete from active tree: `src/app/admin/`, admin-only training/assignment/review services, stores, tests
- Test: auth and route-access tests; learner page tests

**Interfaces:**
- `StoredUserAccount` and `SessionUser` no longer expose `role`.
- Route access has only public/login/allow behavior; authenticated users enter `/practice`.
- Create `PublishedQuizStore` with `loadPublished(): Promise<QuizPublishedPack | null>` for learner reads.

- [ ] Write failing tests for learner-only login, admin rejection, `/practice` redirect, and published-quiz read access.
- [ ] Run focused auth/page tests and confirm failures are caused by the missing learner-only behavior.
- [ ] Implement the learner-only session and route behavior, delete active admin routes and admin-only services, and split published quiz reads from review writes.
- [ ] Run focused tests, `pnpm typecheck`, and `pnpm lint`.
- [ ] Add the archive document with tag `archive/full-app-before-learner-lite-20260810`, restore commit, and removed module inventory.
- [ ] Commit `refactor(app): 收敛为学员训练单端` and push the feature branch to both remotes.

### Task 2: Build the SQLite schema and client

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `.env.example`, `drizzle.config.ts`, `src/db/client.ts`, `src/db/schema.ts`, `src/lib/runtime/env.ts`, `src/lib/runtime/mode.ts`, `src/lib/runtime/services.ts`
- Replace: PostgreSQL migration history under `drizzle/` with a new SQLite migration history
- Test: SQLite client/schema tests and updated `src/db/test-support/create-test-database.ts`

**Interfaces:**
- `createDatabaseClient(sqlitePath: string): DatabaseClient` opens SQLite and applies required pragmas.
- `getDatabase()` reads `SQLITE_PATH` and validates it before opening.
- Runtime composition contains only SQLite stores plus local/mock or company AI Providers; no runtime Neon/PostgreSQL path.

- [ ] Write failing tests for SQLite path validation, pragma configuration, JSON/text and timestamp mappings, foreign keys, and missing-path errors.
- [ ] Run the focused database tests and confirm the expected missing-driver/schema failures.
- [ ] Add `better-sqlite3@13.0.3` and its types; convert schema to the 16 learner tables with text UUIDs, JSON text, text checks, integer timestamps and real confidence values.
- [ ] Replace runtime environment validation with `SQLITE_PATH`, `AUTH_SECRET`, and existing AI variables; remove local JSON fallback and database mode branching.
- [ ] Convert transaction callbacks to synchronous short transactions while preserving async Repository contracts.
- [ ] Generate and validate fresh SQLite migrations; update temporary test database creation.
- [ ] Run SQLite client/schema tests, `pnpm db:check`, `pnpm typecheck`, and `pnpm lint`.
- [ ] Commit `refactor(data): 切换SQLite轻量持久化` and push both remotes.

### Task 3: Port learner repositories and publishing

**Files:**
- Modify: `src/db/repositories/db-quiz-attempt-store.ts`, `src/db/repositories/db-scenario-session-store.ts`, `src/db/repositories/db-scenario-template-store.ts`, `src/db/repositories/db-knowledge-query-store.ts`, `src/db/knowledge-store.ts`, `src/db/quiz-draft-publication.ts`, `src/db/scenario-publication.ts`
- Create/modify: `src/db/repositories/sqlite-published-quiz-store.ts`, `src/lib/quiz/published-quiz-store.ts`
- Test: learner Repository contract tests and publication tests

- [ ] Write failing Repository tests for quiz attempts, topic attempts, scenario sessions/messages/reports, published templates, knowledge lookup, and published quiz reads against a temporary SQLite file.
- [ ] Run those tests and confirm they fail before the port.
- [ ] Port joins, inserts, idempotency keys and short transactions to SQLite; remove assignment references and review-only writes.
- [ ] Keep `KnowledgeQueryStore` for scenario context matching and make content publication CLI-only.
- [ ] Run all learner Repository/publication tests plus the existing domain tests.
- [ ] Commit `refactor(repository): 迁移学员训练数据访问` and push both remotes.

### Task 4: Add CLI account/content operations

**Files:**
- Modify: `package.json`, `scripts/seed.ts`, `scripts/knowledge.ts`, `scripts/publish-knowledge-to-db.ts`, `scripts/publish-quiz-to-db.ts`, `scripts/publish-scenarios-to-db.ts`
- Create: `scripts/import-learners.ts`, `scripts/disable-learner.ts`, `scripts/reset-learner-password.ts`, `scripts/verify-sqlite.ts`, `scripts/backup-sqlite.ts`, `scripts/cli-support.ts`
- Test: CLI integration tests using temporary SQLite files and fixture CSVs

**Interfaces:**
- `pnpm learners:import -- --file <csv>` with `email,name,password,is_active`.
- `pnpm learners:disable -- --email <email>`.
- `pnpm learners:reset-password -- --email <email>` reading the new password from stdin.
- `pnpm db:verify` and `pnpm db:backup -- --output <path>`.

- [ ] Write failing tests for idempotent CSV import, password preservation, disable/reset behavior, invalid rows, database verification and backup output.
- [ ] Run CLI tests and verify the expected command-not-found or missing-schema failures.
- [ ] Implement normalized email handling, bcrypt hashing, no plaintext/hash logging, transaction rollback, and deterministic CLI summaries.
- [ ] Update content publishing commands to validate then atomically publish immutable SQLite versions; repeated publish is idempotent.
- [ ] Run all CLI tests and the full domain test suite.
- [ ] Commit `feat(ops): 增加学员与内容维护命令` and push both remotes.

### Task 5: Implement Neon base-data Bundle migration

**Files:**
- Create: `src/db/migration/base-data-bundle.ts`, `scripts/export-neon-base-data.ts`, `scripts/import-base-data.ts`
- Modify: `package.json` and migration-only dependency declarations
- Test: Bundle schema, export fixture and import verification tests

**Interfaces:**
- `BaseDataBundleV1` contains `schemaVersion`, export timestamp, source, table counts, SHA-256 checksums, learner accounts, active knowledge, published quiz data and published scenarios.
- Export is read-only against PostgreSQL; import only accepts an empty SQLite target and runs in one transaction.

- [ ] Write failing tests for Bundle parsing, checksum mismatch, non-empty target rejection, password-hash preservation and exclusion of historical tables.
- [ ] Run migration tests and confirm failures before implementation.
- [ ] Implement PostgreSQL read-only export using the retained migration-only client, deterministic serialization and SHA-256 checksums.
- [ ] Implement SQLite import with active-pointer, count, hash, foreign-key and empty-history verification.
- [ ] Run migration fixture tests; report that real Neon export remains pending until credentials are supplied.
- [ ] Commit `feat(migration): 支持Neon基础数据迁移` and push both remotes.

### Task 6: End-to-end hardening and documentation

**Files:**
- Modify: `README.md`, `.env.example`, `docs/DEPLOYMENT.md`, `docs/AGENT-HANDOFF.md`, `playwright.config.ts`, `package.json`
- Create: `tests/e2e/learner-lite-smoke.spec.ts`, `tests/load/sqlite-concurrency.ts`
- Test: full unit, build, E2E, migration and concurrency suites

- [ ] Write failing E2E/load tests for learner login, quiz, three-turn Mock AI scenario, refresh recovery, report/history, cross-user isolation and 30-client SQLite writes.
- [ ] Run focused tests and confirm failures before wiring the final paths.
- [ ] Implement the learner-only E2E flow and a Mock AI concurrency harness; keep real AI as a separately authorized smoke command.
- [ ] Update docs to state single-instance persistent-disk requirements, CLI operations, branch-only status and the unchanged main production baseline.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:check`, `pnpm build`, learner E2E, migration verification and the concurrency harness.
- [ ] Commit `test(sqlite): 完成学员轻量版验收` and push `codex/learner-lite-sqlite` to both remotes; verify both remote SHAs.

### Task 7: Whole-branch review and handoff

- [ ] Review the complete branch against the design and this plan, including all deferred migration/deployment assumptions.
- [ ] Fix only load-bearing findings, rerun the complete verification suite, and document any external blocker (Neon credentials, server choice, real AI smoke).
- [ ] Leave the feature branch pushed to both remotes; do not merge into `main` until the deployment design is approved.
