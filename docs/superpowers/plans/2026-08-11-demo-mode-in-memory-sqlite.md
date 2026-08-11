# 学员演示模式内存 SQLite 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在显式开启 `DEMO_MODE=true` 的测试部署中提供“直接进入演示”入口，并用内存 SQLite 支撑完整的学员题库、情景和报告体验，不把演示数据写入持久磁盘。

**Architecture:** 演示模式由运行时环境开关控制。登录页显示一个单独的演示 Server Action，Auth.js 使用固定 UUID 的演示学员身份签发会话；数据库客户端在演示模式创建 `:memory:` SQLite，执行现有 migration 并加载最小发布题库/场景 fixture。正式模式仍强制 `SQLITE_PATH`、正式账号和持久 SQLite，不改变现有认证路径。

**Tech Stack:** Next.js 16 App Router、Auth.js Credentials、Drizzle ORM、better-sqlite3、Vitest、Playwright。

## Global Constraints

- `DEMO_MODE` 默认关闭；未开启时登录页不得出现演示入口。
- 演示用户 ID 必须是合法 UUID，满足现有答题和情景外键/输入校验。
- 演示 SQLite 只能使用 `:memory:`，不得回退到磁盘或 JSON Store。
- 演示账号、密码和开关不得硬编码到生产代码；演示环境必须显式配置 `AUTH_SECRET`。
- 演示数据可以在当前运行实例内写入用于功能测试，但重启/冷启动后不保证保留。
- 不增加生产依赖，不恢复管理员、assignment 或复核运行时。

---

### Task 1: 运行时开关与演示认证

**Files:**
- Modify: `src/lib/runtime/mode.ts`
- Modify: `src/lib/runtime/env.ts`
- Modify: `src/auth.ts`
- Modify: `src/app/login/actions.ts`
- Modify: `src/app/login/login-form.tsx`
- Modify: `src/app/login/page.tsx`
- Test: `src/lib/runtime/mode.test.ts`
- Test: `src/lib/runtime/env.test.ts`
- Test: `src/app/login/actions.test.ts`
- Test: `src/app/login/page.test.tsx`

**Interfaces:**
- Produce `isDemoMode(environment?: Record<string, string | undefined>): boolean`.
- Produce `demoLoginAction(): Promise<void>` that calls `signIn("demo", { redirect: false })` and redirects to `/login/continue`.
- Auth.js adds a provider with ID `demo`; it returns `{ id: "00000000-0000-4000-8000-000000000001", email: "demo@example.test", name: "演示学员" }` only when `DEMO_MODE=true`.

- [ ] **Step 1: Write failing tests**

  Add tests for: `DEMO_MODE=true` is detected; production env may omit `SQLITE_PATH` only in demo mode; demo action selects the `demo` provider; default login page has no demo button and demo mode shows `直接进入演示` plus `演示环境，不保存数据`.

- [ ] **Step 2: Run focused tests and verify RED**

  Run `pnpm vitest run src/lib/runtime/mode.test.ts src/lib/runtime/env.test.ts src/app/login/actions.test.ts src/app/login/page.test.tsx`.

  Expected: failures for the missing demo flag, provider, action, and UI.

- [ ] **Step 3: Implement the minimum runtime/auth/UI behavior**

  Add `DEMO_MODE` parsing, the guarded Auth.js provider, the server action, and a server-rendered boolean prop so the client form only renders the demo form when the flag is enabled. Keep the existing email/password action unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

  Re-run the same Vitest command; all new and existing focused tests must pass.

- [ ] **Step 5: Commit**

  `git add src/lib/runtime/mode.ts src/lib/runtime/env.ts src/auth.ts src/app/login/actions.ts src/app/login/login-form.tsx src/app/login/page.tsx src/lib/runtime/mode.test.ts src/lib/runtime/env.test.ts src/app/login/actions.test.ts src/app/login/page.test.tsx && git commit -m "feat(demo): 增加受控演示登录入口"`

### Task 2: 内存 SQLite 演示 fixture

**Files:**
- Create: `src/db/demo-fixture.ts`
- Modify: `src/db/client.ts`
- Modify: `scripts/prepare-learner-e2e.ts`
- Test: `src/db/demo-fixture.test.ts`

**Interfaces:**
- Produce `DEMO_USER_ID` as the fixed UUID above.
- Produce `initializeDemoDatabase(database: DatabaseClient): void` that applies sorted `drizzle/000*.sql` files and inserts one active demo learner plus one published scenario linked to one active knowledge version.
- `getDatabase()` calls the fixture initializer and uses `:memory:` only when `isDemoMode()` is true; normal mode continues to require `SQLITE_PATH` and schema validation.

- [ ] **Step 1: Write failing fixture tests**

  Test that `initializeDemoDatabase` creates all required tables, inserts the active demo learner, exposes one published scenario through `DbScenarioTemplateStore`, and leaves the database in-memory without a file path.

- [ ] **Step 2: Run the fixture test and verify RED**

  Run `pnpm vitest run src/db/demo-fixture.test.ts`.

  Expected: import/initializer or demo database behavior is missing.

- [ ] **Step 3: Implement the minimal fixture and client branch**

  Extract the deterministic migration/seed logic from `scripts/prepare-learner-e2e.ts` into the reusable fixture. Seed only the demo user, one published knowledge version/unit, and one published `presale` scenario version using the existing Mock AI-compatible fields. Make `validateRuntimeEnvironment` allow a missing `SQLITE_PATH` only when `DEMO_MODE=true`; keep `AUTH_SECRET` required in production.

- [ ] **Step 4: Run fixture and database tests**

  Run `pnpm vitest run src/db/demo-fixture.test.ts src/db/client.test.ts src/db/schema.test.ts` and verify all pass.

- [ ] **Step 5: Commit**

  `git add src/db/demo-fixture.ts src/db/demo-fixture.test.ts src/db/client.ts scripts/prepare-learner-e2e.ts && git commit -m "feat(demo): 增加内存SQLite演示数据"`

### Task 3: 完整演示闭环与文档

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`
- Create: `tests/e2e/demo-mode.spec.ts`
- Modify: `playwright.config.ts` only if the demo test needs an explicit `DEMO_MODE=true` webServer environment.

**Interfaces:**
- Demo E2E uses the login page button, reaches `/practice`, opens the fallback demo quiz, opens the seeded scenario, sends one Mock AI message, and verifies that a cold-start fixture is allowed to reset data.

- [ ] **Step 1: Write the failing E2E test**

  Add a Playwright test that starts the app with `DEMO_MODE=true`, clicks `直接进入演示`, asserts `/practice`, checks `交互演示题` and `情景实战`, starts the seeded presale scenario, sends a message, and sees a customer reply.

- [ ] **Step 2: Run E2E and verify RED**

  Run `DEMO_MODE=true SCENARIO_AI_MODE=mock pnpm exec playwright test tests/e2e/demo-mode.spec.ts`.

  Expected: the test fails before the login button/fixture branch exists.

- [ ] **Step 3: Implement the environment documentation and test wiring**

  Document `DEMO_MODE=true` as a test-only setting, explicitly warn that it must not be enabled on the production learner deployment, and state that Vercel cold starts reset in-memory data. Keep all persistent deployment instructions unchanged.

- [ ] **Step 4: Run the demo E2E and full verification**

  Run the demo E2E, `pnpm check`, and the existing learner E2E/concurrency checks. Confirm `DEMO_MODE` remains absent/false in the normal test suite and no generated `next-env.d.ts` change is staged.

- [ ] **Step 5: Commit and push both remotes**

  `git status --short --branch`; stage only the demo feature files and docs; commit with `feat(demo): 完成内存SQLite演示闭环`; push the current branch explicitly to both `origin` and `gitea`; verify both remote SHAs.

## Self-review checklist

- The normal login path remains database-backed and unchanged when `DEMO_MODE` is not true.
- The demo path has no persisted account or password and cannot be enabled accidentally by default.
- The demo user UUID satisfies all existing learner ID validators.
- The seeded scenario is published, uses Mock AI, and has the knowledge foreign key required by the scenario service.
- Documentation distinguishes this temporary Vercel preview mode from the persistent-disk SQLite deployment.
