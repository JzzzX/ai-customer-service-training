# AI培训智能客服 MVP Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留 Trae 未提交成果的基础上，完成现代化 UI 收口、合理的专题题目分配、自然可用的真实 AI 对话，并验证 Vercel 登录与核心 MVP 流程。

**Architecture:** 保留现有 Next.js 16 App Router 单体、Auth.js、Neon Repository 和 Scenario Provider 边界。UI 继续采用已确认的轻量友好 A 方案；题库分配由纯函数按专题、题型和难度配额完成；真实 AI 继续通过 OpenAI 兼容 Provider 接入，Mock 只作为显式回退和自动测试替身。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind CSS 4、Auth.js、Neon PostgreSQL、Drizzle ORM、OpenAI 兼容 API、Vitest、Testing Library、Playwright、Vercel。

## Global Constraints

- 保留当前工作区中 Trae 留下的相关改动，不覆盖或丢弃用户成果。
- 不提交 `.env*`、本地截图、一次性调试脚本、密钥、数据库连接串或测试密码。
- 不手动编辑或提交 `next-env.d.ts`。
- 学员端保持轻量、友好、弱游戏化，不增加排行榜、积分、签到或复杂学习门户。
- 每个专题每次抽取 10 题；题库充足时为 5 道单选题、5 道判断题，并按简单 4、中等 4、困难 2 分配。
- 真实 AI 模式必须根据完整对话上下文响应学员最新消息，不得机械复述固定脚本。
- 生产运行必须使用 Neon 持久化，且管理员和学员 Credentials 登录均可用。
- 所有行为修复先复现红灯，再做最小修复，最后运行完整质量门禁。

---

### Task 1: Stabilize the Trae UI refactor

**Files:**
- Modify: `src/components/scenario/scenario-chat.tsx`
- Modify: `src/app/practice/history/page.test.tsx`
- Modify: `src/app/practice/quiz/page.test.tsx`
- Modify: files reported by ESLint under `src/app/practice`
- Test: `src/components/scenario/scenario-chat.test.tsx`
- Test: `src/app/practice/scenario/session/[sessionId]/page.test.tsx`
- Test: `src/app/practice/history/page.test.tsx`
- Test: `src/app/practice/quiz/page.test.tsx`

**Interfaces:**
- Consumes: existing `ScenarioSession`, `QuizRunner`, topic metadata, and shared `src/components/ui/*` primitives.
- Produces: render-stable chat bubbles, test-safe auto-scroll, warning-free page modules, and assertions matching the current product behavior.

- [ ] **Step 1: Preserve the current red evidence**

Run:

```bash
pnpm lint
pnpm vitest run src/components/scenario/scenario-chat.test.tsx src/app/practice/scenario/session/[sessionId]/page.test.tsx src/app/practice/history/page.test.tsx src/app/practice/quiz/page.test.tsx
```

Expected: ESLint reports synchronous `setState` in `MessageBubble`; tests report missing `scrollIntoView` in JSDOM and two stale UI expectations.

- [ ] **Step 2: Make auto-scroll capability-safe and remove mount state**

Use a direct animation class based on `role`; call `scrollIntoView` only when the resolved property is a function:

```ts
const target = messagesEndRef.current;
if (target && typeof target.scrollIntoView === "function") {
  target.scrollIntoView({ behavior: "smooth" });
}
```

- [ ] **Step 3: Remove unused imports and callback parameters**

Delete only the symbols reported by ESLint. Do not alter page behavior to silence warnings.

- [ ] **Step 4: Align stale tests with current topic inventory**

History must derive the denominator from the actual topic bank rather than the former 25-question fixture assumption. Demo quiz assertions must accept the current selected demo topic and attempt identifier contract.

- [ ] **Step 5: Verify UI unit coverage**

Run:

```bash
pnpm lint
pnpm vitest run src/components/scenario/scenario-chat.test.tsx src/app/practice/scenario/session/[sessionId]/page.test.tsx src/app/practice/history/page.test.tsx src/app/practice/quiz/page.test.tsx
```

Expected: PASS with zero ESLint warnings.

---

### Task 2: Validate and complete topic quiz allocation

**Files:**
- Modify: `src/lib/quiz/select-question-group.ts`
- Modify: `src/lib/quiz/select-question-group.test.ts`
- Modify: `src/lib/quiz/question-bank.ts`
- Modify: `src/lib/quiz/question-bank.test.ts`

**Interfaces:**
- Consumes: `QuizQuestion[]`, a topic category string, and optional group size.
- Produces: `selectQuestionGroupByTopic(questions, topic, 10): QuizQuestion[]` with no duplicate IDs and stable quota guarantees.

- [ ] **Step 1: Run the current quota and bank integrity tests**

```bash
pnpm vitest run src/lib/quiz/select-question-group.test.ts src/lib/quiz/question-bank.test.ts
```

Expected: existing tests prove the current state; any failure becomes the red case for the next step.

- [ ] **Step 2: Add uncovered allocation invariants**

Add tests asserting:

```ts
expect(new Set(selected.map((question) => question.id)).size).toBe(10);
expect(selected.every((question) => question.category === topic)).toBe(true);
expect(countByType(selected)).toEqual({ single_choice: 5, true_false: 5 });
expect(countByDifficulty(selected)).toEqual({ easy: 4, medium: 4, hard: 2 });
```

Also assert all bank IDs and knowledge-unit IDs are globally unique and every true/false item uses exactly `["正确", "错误"]`.

- [ ] **Step 3: Implement only missing fallback behavior**

When a difficulty bucket inside one type is short, fill from the same type first; only fall back across types when that type contains fewer than five total questions. Always de-duplicate by question ID before the final shuffle.

- [ ] **Step 4: Verify quiz behavior**

```bash
pnpm vitest run src/lib/quiz src/components/quiz src/app/practice/quiz
```

Expected: all quiz tests PASS.

---

### Task 3: Make real AI conversation natural and resilient

**Files:**
- Modify: `src/lib/scenario/ai-providers.ts`
- Modify: `src/lib/scenario/prompt-templates.ts`
- Modify: `src/lib/scenario/training-service.ts`
- Modify: `src/lib/scenario/ai-client.ts`
- Create or modify: focused tests beside those modules

**Interfaces:**
- Consumes: complete ordered `ScenarioMessageInput[]`, scenario hidden facts, matched knowledge units, and the current turn.
- Produces: a non-empty 1–3 sentence customer reply that responds to the learner's latest message and a schema-valid evaluation report.

- [ ] **Step 1: Add provider contract tests before changing behavior**

Use a fake OpenAI-compatible client to capture the outbound request and assert:

```ts
expect(request.messages).toContainEqual(
  expect.objectContaining({ role: "user", content: expect.stringContaining("客服：最新回复") }),
);
expect(request.stream).toBe(true);
```

Add tests for empty model output, provider timeout/error propagation, and complete transcript ordering.

- [ ] **Step 2: Verify the new tests fail for the intended gap**

```bash
pnpm vitest run src/lib/scenario/ai-providers.test.ts src/lib/scenario/prompt-templates.test.ts src/lib/scenario/training-service.test.ts
```

- [ ] **Step 3: Tighten prompt and reply handling**

Keep the existing persona and hidden-fact rules, explicitly prioritize the learner's latest message, prohibit repeating any previous customer message, trim provider output, and reject empty output with a user-safe retry error.

- [ ] **Step 4: Preserve exchanges under concurrency**

Keep optimistic concurrency via `expectedTurnCount`; ensure the learner message is persisted only together with the successful customer reply so failed AI calls do not leave half an exchange.

- [ ] **Step 5: Run a bounded live provider smoke test**

Using `.env.local` without printing any secret, start one scenario, send at least three context-dependent replies, and verify that the customer answers the latest question without repeating earlier messages.

- [ ] **Step 6: Verify all scenario tests**

```bash
pnpm vitest run src/lib/scenario src/components/scenario src/app/practice/scenario
```

Expected: PASS.

---

### Task 4: Verify Vercel authentication and MVP production flows

**Files:**
- Modify only if evidence requires it: `src/auth.ts`
- Modify only if evidence requires it: `src/proxy.ts`
- Modify only if evidence requires it: `src/app/login/actions.ts`
- Modify: `playwright.config.ts` or committed E2E specs only when reusable

**Interfaces:**
- Consumes: Vercel Production environment, Neon users, Auth.js Credentials, and protected routes.
- Produces: successful admin and learner sign-in, correct role redirects, persistent quiz/scenario data, and a reproducible production smoke result.

- [ ] **Step 1: Run local production gates**

```bash
pnpm db:check
pnpm typecheck
pnpm build
```

- [ ] **Step 2: Inspect the Vercel deployment without exposing secrets**

Confirm the linked project, latest production deployment state, production environment variable names, and alias `https://ai-customer-service-training.vercel.app`.

- [ ] **Step 3: Test both roles through the browser**

Verify:

1. unauthenticated `/practice` and `/admin` redirect to `/login`;
2. learner login enters `/practice` and cannot access `/admin`;
3. admin login enters `/admin`;
4. learner completes one quiz group and starts, continues, refreshes, and completes one real-AI scenario;
5. the resulting history/report survives refresh.

- [ ] **Step 4: Fix only evidence-backed production defects**

For each defect, add the narrowest reproducible automated test first, then implement and rerun the affected flow.

- [ ] **Step 5: Run the complete completion audit**

```bash
pnpm check
pnpm test:e2e
git diff --check
git status --short
```

Expected: all quality gates pass; tracked changes include only MVP implementation and tests.

---

### Task 5: Deliver through Git

**Files:**
- Include: all reviewed MVP source, test, shared UI, and plan files.
- Exclude: `.env*`, `scripts/test-e2e-iga.ts`, `scripts/test-e2e-iga-failure.png`, and one-off Playwright config files unless converted into maintained project tests.

- [ ] **Step 1: Review the exact diff**

```bash
git status --short
git diff --check
git diff --stat
```

- [ ] **Step 2: Stage only authorized deliverables**

```bash
git add docs/superpowers/plans/2026-07-31-mvp-completion.md src
```

Add maintained configuration/test files only after confirming they are reusable.

- [ ] **Step 3: Commit with Conventional Commits**

```bash
git commit -m "feat: complete training MVP experience"
```

- [ ] **Step 4: Push the current branch**

```bash
git push origin main
```

- [ ] **Step 5: Confirm remote synchronization**

```bash
git status --short --branch
git log -1 --oneline --decorate
```

Expected: local `main` and `origin/main` point to the new commit; excluded local diagnostics remain untracked and are reported separately.
