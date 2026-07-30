# Part 6 Production MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **2026-07-30 范围调整：** 用户要求停止继续扩展数据库、账号和 E2E 基础设施，
> 优先完成可交接的 Vercel 技术 Demo。本计划保留为原始实施记录；当前有效收口范围
> 只有：必要生产修复、Neon 临时演示数据、Vercel Production 部署、最小验收和架构
> 交接。未执行的增强项不再作为本次交付阻塞条件，后续状态以 `docs/ROADMAP.md` 和
> `docs/2026-07-30-PART6-VERCEL-HANDOFF.md` 为准。

**Goal:** 将当前本地可演示应用生产化为部署在 Vercel、使用 Neon 持久化、具备完整基础管理闭环并通过架构审计的 `v0.1.0`。

**Architecture:** 保留 Next.js 16 App Router 全栈单体和现有领域逻辑，在领域服务与存储之间建立显式 Port；本地 Store 仅服务测试与本地 Demo，生产通过 Drizzle Repository 写入 Neon。Vercel 承载 Web 与 Server Actions，可信本机 CLI 负责把知识、题库草稿和 8 场景版本发布到 Neon。

**Tech Stack:** Next.js 16、TypeScript、React 19、Auth.js、Drizzle ORM、Neon PostgreSQL、Zod、Vitest、Testing Library、Playwright、pnpm、Vercel。

## Global Constraints

- Production Branch 固定为 `main`，仓库为私有 `JzzzX/ai-customer-service-training`。
- 真实知识源、`artifacts`、`.env.local`、密码、数据库连接串和平台 Token 不得进入 Git。
- 生产环境禁止 `LOCAL_TEST_AUTH_ENABLED=true`，禁止读写本地 artifacts。
- 学员端保持简洁 A 方案，不在 Part 6 增加积分、排行、签到或复杂学习门户。
- 单选题、判断题、8 个文字场景和 Mock 评分继续是 `v0.1.0` 的训练范围。
- 真实 AI Provider、飞书免登、企业知识引擎、OCR、多模态和开放式 RAG 不进入 Part 6。
- 40 题必须保留人工内容审核记录，程序不得自动冒充知识负责人完成 40/40 审核。
- 所有生产行为先写失败测试，再写最小实现；每个任务结束必须独立验证并提交。
- 部署完成不等于 Part 6 完成；必须通过生产冒烟、中国大陆网络验收和基础架构审计。

---

## File and Boundary Map

### Domain ports

- `src/lib/quiz/review-store.ts`：审题和正式题组 Port。
- `src/lib/quiz/attempt-store.ts`：小测提交和学习记录 Port。
- `src/lib/scenario/template-store.ts`：已发布场景版本 Port。
- `src/lib/scenario/session-store.ts`：训练会话和报告 Port。
- `src/lib/training/assignment-store.ts`：训练分配 Port。
- `src/lib/training/review-store.ts`：人工复核 Port。

### Database adapters

- `src/db/repositories/db-quiz-review-store.ts`
- `src/db/repositories/db-quiz-attempt-store.ts`
- `src/db/repositories/db-scenario-template-store.ts`
- `src/db/repositories/db-scenario-session-store.ts`
- `src/db/repositories/db-assignment-store.ts`
- `src/db/repositories/db-review-store.ts`
- `src/db/repositories/db-knowledge-query-store.ts`

### Runtime composition

- `src/lib/runtime/mode.ts`：只判断是否显式本地 Demo。
- `src/lib/runtime/services.ts`：按运行模式组合 Local 或 Database adapters。
- 页面和 Server Actions 只调用 service factory，不直接实例化 Local Store 或数据库。

### Production publishing

- `src/db/quiz-draft-publication.ts` / `scripts/publish-quiz-to-db.ts`
- `src/db/scenario-publication.ts` / `scripts/publish-scenarios-to-db.ts`
- 现有 `scripts/publish-knowledge-to-db.ts`

---

### Task 1: Extract persistence ports and remove concrete-store coupling

**Files:**
- Create: `src/lib/quiz/review-store.ts`
- Create: `src/lib/quiz/attempt-store.ts`
- Create: `src/lib/scenario/template-store.ts`
- Create: `src/lib/scenario/session-store.ts`
- Modify: `src/lib/quiz/local-review-store.ts`
- Modify: `src/lib/quiz/local-attempt-store.ts`
- Modify: `src/lib/scenario/local-session-store.ts`
- Modify: `src/lib/scenario/training-service.ts`
- Test: `src/lib/quiz/store-contracts.test.ts`
- Test: `src/lib/scenario/store-contracts.test.ts`

**Interfaces:**

```ts
export interface QuizReviewStore {
  loadReview(): Promise<QuizReview>;
  approveQuestion(input: ApproveStoredQuestionInput): Promise<QuizReview>;
  publish(): Promise<QuizPublishedPack>;
  loadPublished(): Promise<QuizPublishedPack | null>;
}

export interface QuizAttemptStore {
  saveAttempt(input: SaveQuizAttemptInput): Promise<QuizAttemptRecord>;
  listAttempts(learnerId: string): Promise<QuizAttemptRecord[]>;
}

export interface ScenarioTemplateStore {
  listPublished(): Promise<ScenarioTemplate[]>;
  getPublishedById(scenarioId: string): Promise<ScenarioTemplate | null>;
}

export interface ScenarioSessionStore {
  startSession(input: StartScenarioSessionInput): Promise<ScenarioSession>;
  loadSession(input: SessionIdentity): Promise<ScenarioSession>;
  appendExchange(input: AppendScenarioExchangeInput): Promise<ScenarioSession>;
  completeSession(input: CompleteScenarioSessionInput): Promise<ScenarioSession>;
}
```

- [ ] **Step 1: Write failing compile-time and behavioral contract tests**

```ts
it("ScenarioTrainingService accepts any ScenarioSessionStore port", () => {
  const store: ScenarioSessionStore = createInMemoryScenarioStore();
  const service = new ScenarioTrainingService({
    store,
    templates: createStaticTemplateStore(),
    conversationProvider: new MockConversationProvider(),
    evaluationProvider: new MockEvaluationProvider(),
  });
  expect(service).toBeInstanceOf(ScenarioTrainingService);
});
```

- [ ] **Step 2: Run focused tests and verify type failure**

Run:

```bash
pnpm vitest run src/lib/quiz/store-contracts.test.ts src/lib/scenario/store-contracts.test.ts
```

Expected: FAIL because the Port files and generic constructor types do not exist.

- [ ] **Step 3: Add the Port interfaces and move shared input types into them**

`LocalQuizReviewStore`, `LocalQuizAttemptStore`, and
`LocalScenarioSessionStore` must explicitly `implements` their respective Port.
`ScenarioTrainingService` must depend on `ScenarioSessionStore` and
`ScenarioTemplateStore`, never import `LocalScenarioSessionStore` or
`getScenarioTemplate`.

- [ ] **Step 4: Update existing local tests and run the domain suite**

Run:

```bash
pnpm vitest run src/lib/quiz src/lib/scenario
```

Expected: all quiz and scenario tests PASS without changing local behavior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz src/lib/scenario
git commit -m "refactor: define production persistence ports"
```

---

### Task 2: Evolve the PostgreSQL schema for immutable external identities and review audit

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/schema.test.ts`
- Generate: `drizzle/0001_*.sql`
- Generate: `drizzle/meta/0001_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Produces:**

```ts
questions.questionKey: string
questionReviews: {
  questionId: string;
  reviewerId: string;
  contentHash: string;
  snapshot: QuizQuestionDraft;
  createdAt: Date;
}
quizSets.quizHash: string
quizSets.sourceQuizHash: string | null
quizSets.knowledgeVersionId: string
quizSets.publishedAt: Date | null
quizAttempts.assignmentId: string | null
scenarios.scenarioKey: string
scenarioVersions.versionKey: string
scenarioVersions.summary: string
scenarioVersions.customerTurns: string[]
scenarioVersions.criticalRisks: ScenarioTemplate["criticalRisks"]
scenarioVersions.referenceFlow: string[]
scenarioVersions.sources: SourceLocator[]
scenarioVersions.mockMode: boolean
trainingSessions.mode: "mock"
evaluationReports.recommendations: string[]
```

- [ ] **Step 1: Extend schema tests first**

```ts
it("declares stable external keys and question review audit", () => {
  expect(getTableConfig(questions).uniqueConstraints).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "questions_version_key_unique" }),
    ]),
  );
  expect(mvpTables.questionReviews).toBe(questionReviews);
});
```

- [ ] **Step 2: Run the schema test and observe failure**

Run:

```bash
pnpm vitest run src/db/schema.test.ts
```

Expected: FAIL because the new columns/table are absent.

- [ ] **Step 3: Add columns, constraints and indexes**

Required constraints:

- `questions(knowledge_version_id, question_key)` unique;
- `quiz_sets.quiz_hash` unique;
- `scenarios.scenario_key` unique;
- `scenario_versions.version_key` unique;
- `question_reviews(question_id, content_hash)` unique;
- `quiz_attempts.assignment_id` foreign key with `onDelete: set null`;
- `training_sessions.mode` check equals `mock` in `v0.1.0`.

- [ ] **Step 4: Generate and inspect the migration**

Run:

```bash
pnpm db:generate
pnpm db:check
```

Expected: one additive migration; no table drops, destructive column changes, or
enum value removals.

- [ ] **Step 5: Run schema/type checks**

Run:

```bash
pnpm vitest run src/db/schema.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts drizzle
git commit -m "feat: extend production training schema"
```

---

### Task 3: Publish the 40-question draft into Neon idempotently

**Files:**
- Create: `src/db/quiz-draft-publication.ts`
- Create: `src/db/quiz-draft-publication.test.ts`
- Create: `scripts/publish-quiz-to-db.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

```ts
export interface QuizDraftPublicationStore {
  findQuizSetByHash(quizHash: string): Promise<{ id: string } | null>;
  publishDraftAtomically(input: PreparedQuizDraftPublication): Promise<{
    id: string;
    quizHash: string;
  }>;
}

export async function publishQuizDraftToStore(
  draft: QuizDraftPack,
  store: QuizDraftPublicationStore,
): Promise<{ id: string; quizHash: string; created: boolean }>;
```

- [ ] **Step 1: Write failing idempotency and conflict tests**

```ts
it("publishes the same draft hash only once", async () => {
  const first = await publishQuizDraftToStore(draft, store);
  const second = await publishQuizDraftToStore(draft, store);
  expect(first.created).toBe(true);
  expect(second).toEqual({ ...first, created: false });
});

it("rejects a question whose knowledge unit is conflicting", async () => {
  store.resolveKnowledgeUnit.mockResolvedValue({ hasConflict: true });
  await expect(publishQuizDraftToStore(draft, store)).rejects.toThrow(
    "冲突知识不能进入题库",
  );
});
```

- [ ] **Step 2: Run the test and observe missing implementation**

Run:

```bash
pnpm vitest run src/db/quiz-draft-publication.test.ts
```

- [ ] **Step 3: Implement preparation and database transaction**

The transaction must:

1. find the active knowledge version by `knowledgePackHash`;
2. resolve every `knowledgeUnitId` against `knowledge_units.unit_key`;
3. reject missing, conflicting, or `canUseForQuiz=false` units;
4. insert one draft `quiz_sets` row keyed by `quizHash`;
5. insert/upsert 40 `questions` keyed by version + `questionKey`;
6. insert ordered `quiz_set_questions`;
7. return an existing row without writing when the hash already exists.

- [ ] **Step 4: Add the trusted-local CLI**

`pnpm quiz:publish:db` must:

- load `.env.local` without printing secrets;
- read `artifacts/quiz/latest.json` and its immutable draft;
- resolve the seeded admin as `createdById`;
- publish through `publishQuizDraftToStore`;
- print only hash, count and created/idempotent status.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm vitest run src/db/quiz-draft-publication.test.ts
pnpm typecheck
pnpm db:check
```

- [ ] **Step 6: Commit**

```bash
git add src/db/quiz-draft-publication.ts src/db/quiz-draft-publication.test.ts scripts/publish-quiz-to-db.ts package.json README.md
git commit -m "feat: publish quiz drafts to postgres"
```

---

### Task 4: Implement PostgreSQL-backed question review and immutable publication

**Files:**
- Create: `src/db/repositories/db-quiz-review-store.ts`
- Create: `src/db/repositories/db-quiz-review-store.test.ts`
- Modify: `src/lib/quiz/review-store.ts`
- Modify: `src/lib/quiz/review-service.ts`
- Modify: `src/app/admin/questions/actions.test.ts`

**Consumes:** `QuizReviewStore`, `quizSets`, `questions`, `questionReviews`,
`quizSetQuestions`, `knowledgeUnits`.

**Produces:**

```ts
export class DbQuizReviewStore implements QuizReviewStore {
  constructor(database: Database);
  loadReview(): Promise<QuizReview>;
  approveQuestion(input: ApproveStoredQuestionInput): Promise<QuizReview>;
  publish(): Promise<QuizPublishedPack>;
  loadPublished(): Promise<QuizPublishedPack | null>;
}
```

- [ ] **Step 1: Write failing transactional tests**

Cover:

- current draft loads in deterministic position order;
- approval updates question fields and inserts `question_reviews` with a
  content hash and snapshot;
- editing an approved question invalidates the previous hash;
- publish fails unless every current question hash is approved;
- repeated publish returns the same immutable published set;
- source locators come from the bound knowledge unit.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run src/db/repositories/db-quiz-review-store.test.ts
```

- [ ] **Step 3: Implement the Drizzle repository**

Publishing transaction:

1. lock/read the current draft set and 40 ordered questions;
2. compute each current question hash;
3. require a matching review row;
4. call existing `publishQuizReview` for deterministic published hash;
5. return an existing published set if the hash exists;
6. otherwise insert a published `quiz_sets` row and ordered joins;
7. set referenced questions to `published`;
8. commit atomically.

- [ ] **Step 4: Keep actions domain-only**

`review-service.ts` selects a `QuizReviewStore` from runtime composition; the
admin page/action must not import the database repository.

- [ ] **Step 5: Verify**

```bash
pnpm vitest run src/db/repositories/db-quiz-review-store.test.ts src/app/admin/questions
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/db-quiz-review-store.ts src/db/repositories/db-quiz-review-store.test.ts src/lib/quiz/review-store.ts src/lib/quiz/review-service.ts src/app/admin/questions
git commit -m "feat: persist question review and publication"
```

---

### Task 5: Persist quiz attempts, answers and assignment completion

**Files:**
- Create: `src/db/repositories/db-quiz-attempt-store.ts`
- Create: `src/db/repositories/db-quiz-attempt-store.test.ts`
- Modify: `src/lib/quiz/attempt-store.ts`
- Modify: `src/lib/quiz/local-attempt-store.ts`
- Modify: `src/lib/quiz/attempt-service.ts`
- Modify: `src/app/practice/quiz/page.tsx`
- Modify: `src/app/practice/quiz/actions.ts`
- Modify: `src/components/quiz/quiz-runner.tsx`
- Modify: related tests

**Input contract:**

```ts
export type SaveQuizAttemptInput = {
  attemptId: string;
  learnerId: string;
  quizHash: string;
  assignmentId?: string;
  passingScore: number;
  answers: Array<{
    questionId: string;
    selectedAnswers: string[];
    isCorrect: boolean;
  }>;
};
```

- [ ] **Step 1: Write failing tests**

Cover:

- server supplies one UUID `attemptId` to `QuizRunner`;
- duplicate submission with the same `attemptId` returns the existing attempt;
- selected answers and correctness are stored server-side;
- another learner cannot read the attempt;
- a matching assignment moves to `completed`;
- score and status are recomputed from persisted answers.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run src/db/repositories/db-quiz-attempt-store.test.ts src/app/practice/quiz src/components/quiz
```

- [ ] **Step 3: Implement the repository transaction**

Resolve the published set by `quizHash`, validate every external question key,
insert `quiz_attempts` using `attemptId`, insert `quiz_answers`, compute
score/status, set `completedAt`, and update a matching assignment. Use
`onConflictDoNothing` on the attempt UUID and return the existing row to make
the action retry-safe.

- [ ] **Step 4: Update history mapping**

`listAttempts(learnerId)` joins `quiz_sets` and derives
`missedQuestionIds` from incorrect `quiz_answers`; order descending by
`completedAt`.

- [ ] **Step 5: Verify**

```bash
pnpm vitest run src/lib/quiz src/db/repositories/db-quiz-attempt-store.test.ts src/app/practice/quiz src/app/practice/history src/components/quiz
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/db-quiz-attempt-store.ts src/db/repositories/db-quiz-attempt-store.test.ts src/lib/quiz src/app/practice/quiz src/app/practice/history src/components/quiz
git commit -m "feat: persist quiz attempts and answers"
```

---

### Task 6: Publish and query eight immutable scenario versions

**Files:**
- Create: `src/db/scenario-publication.ts`
- Create: `src/db/scenario-publication.test.ts`
- Create: `src/db/repositories/db-scenario-template-store.ts`
- Create: `src/db/repositories/db-scenario-template-store.test.ts`
- Create: `scripts/publish-scenarios-to-db.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

```ts
export interface ScenarioPublicationStore {
  publishAtomically(input: {
    knowledgeVersionHash: string;
    templates: ScenarioTemplate[];
    createdById: string;
  }): Promise<{ created: number; existing: number }>;
}
```

- [ ] **Step 1: Write failing publication/query tests**

Cover exactly eight templates, stable `scenarioKey`/`versionKey`, source
locators, score weight sum, active knowledge version match, conflict rejection
and repeat-publication idempotency.

- [ ] **Step 2: Run and observe failure**

```bash
pnpm vitest run src/db/scenario-publication.test.ts src/db/repositories/db-scenario-template-store.test.ts
```

- [ ] **Step 3: Implement database publication**

For each template:

- upsert `scenarios` by `scenarioKey`;
- insert immutable `scenario_versions` by `versionKey`;
- write all hidden facts, scripted customer turns, risks, reference flow,
  source locators and Mock flag;
- mark the scenario and version `published`;
- reject a different payload for an existing `versionKey`.

- [ ] **Step 4: Implement query mapping**

`DbScenarioTemplateStore` must reconstruct and parse a full
`ScenarioTemplate`; it must never return a draft or disabled version.

- [ ] **Step 5: Add CLI and verify**

```bash
pnpm scenario:publish:db
pnpm vitest run src/db/scenario-publication.test.ts src/db/repositories/db-scenario-template-store.test.ts
pnpm typecheck
```

The CLI prints only template counts, knowledge hash and idempotent status.

- [ ] **Step 6: Commit**

```bash
git add src/db/scenario-publication.ts src/db/scenario-publication.test.ts src/db/repositories/db-scenario-template-store.ts src/db/repositories/db-scenario-template-store.test.ts scripts/publish-scenarios-to-db.ts package.json README.md
git commit -m "feat: publish scenario versions to postgres"
```

---

### Task 7: Persist scenario sessions, messages, reports and retry-safe completion

**Files:**
- Create: `src/db/repositories/db-scenario-session-store.ts`
- Create: `src/db/repositories/db-scenario-session-store.test.ts`
- Modify: `src/lib/scenario/session-store.ts`
- Modify: `src/lib/scenario/training-service.ts`
- Modify: `src/app/practice/scenario/actions.ts`
- Modify: related scenario page/action tests

**Produces:** `DbScenarioSessionStore implements ScenarioSessionStore`.

- [ ] **Step 1: Write failing concurrency and ownership tests**

Cover:

- opening message position is `0`;
- session load returns messages ordered by position;
- learner ownership is enforced in the query;
- append inserts learner/customer positions atomically;
- optimistic update rejects a stale turn count;
- completed sessions cannot append;
- repeat completion returns the existing report;
- failed/critical report creates `needsReview=true`;
- matching scenario assignment completes.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run src/db/repositories/db-scenario-session-store.test.ts
```

- [ ] **Step 3: Implement start/load/append**

Use one transaction for every state change. `appendExchange` must update the
session with a `where` condition on `id`, `learnerId`, `status=in_progress`,
and expected `turnCount`; exactly one updated row is required before inserting
the two messages.

- [ ] **Step 4: Implement completion/report mapping**

Map:

- `status=passed` to training `completed`;
- `status=needs_retry` to training `needs_review`;
- dimensions, strengths, missed steps, risks, recommendations, reference flow,
  reference reply, evidence and confidence into `evaluation_reports`;
- trigger priority: `critical_risk` → `low_confidence` → `failed` →
  deterministic `random_sample`.

- [ ] **Step 5: Verify full scenario flow**

```bash
pnpm vitest run src/lib/scenario src/db/repositories/db-scenario-session-store.test.ts src/app/practice/scenario src/components/scenario
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/db-scenario-session-store.ts src/db/repositories/db-scenario-session-store.test.ts src/lib/scenario src/app/practice/scenario src/components/scenario
git commit -m "feat: persist scenario training sessions"
```

---

### Task 8: Compose local and production services safely

**Files:**
- Create: `src/lib/runtime/mode.ts`
- Create: `src/lib/runtime/mode.test.ts`
- Create: `src/lib/runtime/services.ts`
- Create: `src/lib/runtime/services.test.ts`
- Modify: `src/lib/quiz/review-service.ts`
- Modify: `src/lib/quiz/attempt-service.ts`
- Modify: `src/lib/scenario/scenario-service.ts`
- Modify: `src/lib/auth/local-test-accounts.ts`

**Interfaces:**

```ts
export type RuntimeMode = "local_demo" | "production";
export function resolveRuntimeMode(env?: NodeJS.ProcessEnv): RuntimeMode;
export function getQuizReviewStore(): QuizReviewStore;
export function getQuizAttemptStore(): QuizAttemptStore;
export function getScenarioTrainingService(): ScenarioTrainingService;
```

- [ ] **Step 1: Write failing mode/factory tests**

```ts
it("never selects local_demo in production", () => {
  expect(
    resolveRuntimeMode({
      NODE_ENV: "production",
      LOCAL_TEST_AUTH_ENABLED: "true",
    }),
  ).toBe("production");
});

it("production factories do not construct local stores", () => {
  expect(getServiceKinds(productionEnv)).toEqual({
    quizReview: "database",
    quizAttempt: "database",
    scenario: "database",
  });
});
```

- [ ] **Step 2: Run tests and observe missing factory**

```bash
pnpm vitest run src/lib/runtime src/lib/auth/local-test-accounts.test.ts
```

- [ ] **Step 3: Implement one composition root**

Only `services.ts` may instantiate concrete Local/Database stores. Remove
`getLocalScenarioTrainingService` from Server Actions and replace it with
`getScenarioTrainingService`.

- [ ] **Step 4: Add a static production-boundary test**

The test scans `src/app` and fails if application pages/actions contain:

- `LocalQuiz`
- `LocalScenario`
- `artifacts`
- `node:fs`
- `node:path`

- [ ] **Step 5: Verify**

```bash
pnpm vitest run src/lib/runtime src/lib/auth src/app
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/runtime src/lib/auth/local-test-accounts.ts src/lib/quiz src/lib/scenario src/app
git commit -m "refactor: compose production services safely"
```

---

### Task 9: Implement assignment and review domain services

**Files:**
- Create: `src/lib/training/assignment-schema.ts`
- Create: `src/lib/training/assignment-store.ts`
- Create: `src/lib/training/assignment-service.ts`
- Create: `src/lib/training/assignment-service.test.ts`
- Create: `src/lib/training/review-schema.ts`
- Create: `src/lib/training/review-store.ts`
- Create: `src/lib/training/review-service.ts`
- Create: `src/lib/training/review-service.test.ts`
- Create: `src/db/repositories/db-assignment-store.ts`
- Create: `src/db/repositories/db-assignment-store.test.ts`
- Create: `src/db/repositories/db-review-store.ts`
- Create: `src/db/repositories/db-review-store.test.ts`

**Interfaces:**

```ts
export interface AssignmentStore {
  create(input: CreateAssignmentInput): Promise<TrainingAssignment>;
  listForLearner(learnerId: string): Promise<TrainingAssignment[]>;
  listForAdmin(filters: AssignmentFilters): Promise<TrainingAssignment[]>;
}

export interface ReviewStore {
  listPending(): Promise<TrainingReviewItem[]>;
  load(reportId: string): Promise<TrainingReviewItem | null>;
  decide(input: ReviewDecisionInput): Promise<TrainingReviewItem>;
}
```

- [ ] **Step 1: Write failing domain tests**

Cover:

- quiz assignment requires a published quiz set only;
- scenario assignment requires a published scenario version only;
- learner target must be active and role `learner`;
- due date cannot be before creation time;
- pending review means `needsReview=true` and no decision;
- corrected score is required only for `adjusted`;
- only an admin reviewer may decide;
- repeated identical review submission is idempotent.

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run src/lib/training src/db/repositories/db-assignment-store.test.ts src/db/repositories/db-review-store.test.ts
```

- [ ] **Step 3: Implement domain validation and repositories**

Use the existing assignment target check and review decision constraints.
Queries return display names and immutable target/version labels without
exposing password hashes or hidden scenario facts to learner services.

- [ ] **Step 4: Add repositories to runtime composition**

```ts
export function getAssignmentService(): AssignmentService;
export function getReviewService(): ReviewService;
```

Production uses DB adapters. Local Demo may expose an empty read-only assignment
list; it must not write fake production assignments.

- [ ] **Step 5: Verify**

```bash
pnpm vitest run src/lib/training src/db/repositories
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/training src/db/repositories src/lib/runtime/services.ts
git commit -m "feat: add assignments and review services"
```

---

### Task 10: Complete knowledge and scenario management pages

**Files:**
- Create: `src/db/repositories/db-knowledge-query-store.ts`
- Create: `src/db/repositories/db-knowledge-query-store.test.ts`
- Create: `src/app/admin/knowledge/page.tsx`
- Create: `src/app/admin/knowledge/page.test.tsx`
- Create: `src/app/admin/scenarios/page.tsx`
- Create: `src/app/admin/scenarios/page.test.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/page.test.tsx`

- [ ] **Step 1: Write failing page/repository tests**

Knowledge page expectations:

- active version hash, published time and coverage;
- source file/workbook/sheet/unit/duplicate/conflict/image/error counts;
- conflict warning;
- no raw full knowledge content.

Scenario page expectations:

- exactly 8 published versions grouped into 4 categories;
- version, max turns, five scoring dimensions and knowledge hash;
- Mock badge;
- no hidden facts or scripted customer turns.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run src/db/repositories/db-knowledge-query-store.test.ts src/app/admin/knowledge src/app/admin/scenarios src/app/admin/page.test.tsx
```

- [ ] **Step 3: Implement read-only pages**

Reuse the existing visual language: one page title, concise status summary and
small tables/cards. Add links from `/admin`.

- [ ] **Step 4: Verify accessibility basics**

Tests require one `h1`, ordered heading levels, named navigation links, readable
empty/error states and no horizontal overflow assumptions in markup.

- [ ] **Step 5: Verify**

```bash
pnpm vitest run src/app/admin src/db/repositories/db-knowledge-query-store.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/db/repositories/db-knowledge-query-store.ts src/db/repositories/db-knowledge-query-store.test.ts src/app/admin
git commit -m "feat: add knowledge and scenario administration"
```

---

### Task 11: Complete assignment, learning-record and review user interfaces

**Files:**
- Create: `src/app/admin/assignments/page.tsx`
- Create: `src/app/admin/assignments/actions.ts`
- Create: `src/app/admin/assignments/assignment-form.tsx`
- Create: related tests
- Create: `src/app/admin/history/page.tsx`
- Create: `src/app/admin/history/page.test.tsx`
- Create: `src/app/admin/reviews/page.tsx`
- Create: `src/app/admin/reviews/[reportId]/page.tsx`
- Create: `src/app/admin/reviews/actions.ts`
- Create: related tests
- Create: `src/app/practice/assignments/page.tsx`
- Create: `src/app/practice/assignments/page.test.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/practice/page.tsx`
- Modify: `src/app/practice/history/page.tsx`

- [ ] **Step 1: Write failing page and action tests**

Cover:

- only admins can create assignments and submit review decisions;
- learner selector contains active learners only;
- target selector contains published quiz/scenario versions only;
- assignment list shows target, learner, due date and state;
- learner page shows only own assignments;
- admin history filters by learner/type/status;
- review detail contains transcript, original report and decision form;
- learner pages never render hidden facts or answer keys.

- [ ] **Step 2: Run focused tests**

```bash
pnpm vitest run src/app/admin/assignments src/app/admin/history src/app/admin/reviews src/app/practice/assignments src/app/practice
```

- [ ] **Step 3: Implement server pages and actions**

Use Zod for all form input. Server Actions return reader-safe Chinese error
messages and call `revalidatePath` for affected admin/learner routes.

- [ ] **Step 4: Integrate state transitions**

- starting an assigned quiz/scenario marks it `in_progress`;
- completion marks it `completed`;
- direct unassigned practice remains allowed for MVP;
- overdue is display state derived from `dueAt`, not a new enum.

- [ ] **Step 5: Verify**

```bash
pnpm vitest run src/app/admin src/app/practice src/lib/training
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin src/app/practice src/lib/training
git commit -m "feat: complete training administration"
```

---

### Task 12: Add production-safe errors, configuration and observability

**Files:**
- Create: `src/lib/runtime/env.ts`
- Create: `src/lib/runtime/env.test.ts`
- Create: `src/app/error.tsx`
- Create: `src/app/global-error.tsx`
- Create: `src/app/admin/error.tsx`
- Create: `src/app/practice/error.tsx`
- Create: related tests
- Modify: `.env.example`
- Modify: `src/db/client.ts`
- Modify: `README.md`

**Configuration schema:**

```ts
export const productionEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  LOCAL_TEST_AUTH_ENABLED: z.literal("false").optional(),
});
```

- [ ] **Step 1: Write failing environment/error tests**

Cover missing/short `AUTH_SECRET`, missing DB URL in production, accidental
local auth enablement, and redaction of a thrown database URL/password.

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run src/lib/runtime/env.test.ts src/app/error.test.tsx src/app/admin/error.test.tsx src/app/practice/error.test.tsx
```

- [ ] **Step 3: Implement validation and error boundaries**

Reader-facing messages:

- “服务暂时不可用，请稍后重试。”
- “这条记录不存在或你没有访问权限。”
- “提交未保存，请检查网络后重试。”

Log structured identifiers only: route, user ID, session/attempt/report ID,
error class. Never log password, selected secret environment values or full
connection strings.

- [ ] **Step 4: Verify production boundary**

```bash
NODE_ENV=production LOCAL_TEST_AUTH_ENABLED=true \
  pnpm vitest run src/lib/runtime/env.test.ts src/lib/runtime/mode.test.ts
pnpm typecheck
```

Expected: the runtime-mode test proves production still resolves to DB mode,
while the environment-validation test rejects the explicit unsafe local-auth
value.

- [ ] **Step 5: Run quality checks**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/runtime src/app/error.tsx src/app/global-error.tsx src/app/admin/error.tsx src/app/practice/error.tsx .env.example src/db/client.ts README.md
git commit -m "feat: harden production runtime"
```

---

### Task 13: Build deterministic Playwright E2E coverage

**Files:**
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/quiz.spec.ts`
- Create: `tests/e2e/scenario.spec.ts`
- Create: `tests/e2e/admin.spec.ts`
- Create: `tests/e2e/responsive.spec.ts`
- Create: `tests/e2e/helpers/auth.ts`
- Create: `tests/e2e/helpers/database.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write the E2E tests before database fixture support**

Required scenarios:

1. unauthenticated redirects;
2. learner cannot access `/admin`;
3. admin can open all management pages;
4. learner completes one published quiz and history persists after reload;
5. learner completes one scenario turn, reloads, finishes, sees report and
   restarts;
6. admin creates one assignment and sees completion;
7. admin processes one review;
8. 390px viewport has `scrollWidth === clientWidth`.

- [ ] **Step 2: Run and observe fixture/setup failure**

```bash
pnpm test:e2e
```

- [ ] **Step 3: Add isolated E2E database configuration**

`E2E_DATABASE_URL` must point to a non-production Neon branch or local test
database. The helper runs migrations, seeds fixed accounts, publishes a
minimal knowledge pack, one published 10-question quiz set and 8 scenarios.
It must refuse a URL equal to `DATABASE_URL` when `VERCEL_ENV=production`.

- [ ] **Step 4: Make Playwright deterministic**

- one worker for database-mutating specs;
- `pnpm build && pnpm start` in CI, not dev mode;
- fixed clock-independent assertions;
- no test depends on execution order;
- artifacts under ignored `test-results` and `playwright-report`.

- [ ] **Step 5: Verify**

```bash
pnpm test:e2e
```

Expected: all Chromium E2E tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e playwright.config.ts package.json .gitignore
git commit -m "test: cover production training journeys"
```

---

### Task 14: Rehearse a blank-database production bootstrap

**Files:**
- Create: `scripts/verify-production-data.ts`
- Create: `src/db/production-verification.ts`
- Create: `src/db/production-verification.test.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing verification tests**

The verifier returns a non-zero result unless:

- exactly one active knowledge version exists;
- 40 draft questions exist;
- a published quiz set exists only when 40 current hashes are reviewed;
- exactly 8 published scenario versions exist;
- admin and learner accounts are active;
- all production rows reference the active knowledge version as required.

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run src/db/production-verification.test.ts
```

- [ ] **Step 3: Add the verification command**

```bash
pnpm production:verify:data
```

Output may contain counts, hashes and status only. It must not print emails,
password hashes, connection strings or raw knowledge content.

- [ ] **Step 4: Rehearse on a disposable database branch**

Run in order:

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

Run the same sequence again and verify idempotency.

- [ ] **Step 5: Run all local gates**

```bash
pnpm check
pnpm test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-production-data.ts src/db/production-verification.ts src/db/production-verification.test.ts package.json README.md
git commit -m "feat: verify production bootstrap"
```

---

### Task 15: Provision Neon and deploy Vercel Production

**Files:**
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Create only if account supports selected region: `vercel.json`

**External state:**
- one Neon production project in Singapore;
- one non-production Neon branch for E2E/preview;
- one Vercel project connected to the private GitHub repository;
- Production Branch `main`.

- [ ] **Step 1: Verify local CLIs and authenticated identities**

Run:

```bash
vercel --version
vercel whoami
```

For Neon, use the connected Neon/Vercel Marketplace flow or official Neon CLI
only after confirming the authenticated account. Never print tokens.

- [ ] **Step 2: Pause only at unavoidable login/account authorization**

If Vercel or Neon requires browser/device authorization, show the official
authorization step and wait for the user to complete it. Do not create a
second account or project as a workaround.

- [ ] **Step 3: Create production and preview data targets**

- create Neon in Singapore;
- capture production and branch connection strings only in secret stores;
- execute Task 14 bootstrap against the production database;
- keep seed passwords outside Vercel runtime after seeding.

- [ ] **Step 4: Configure Vercel**

Set:

- `DATABASE_URL` for Production;
- `AUTH_SECRET` for Production;
- preview database URL for Preview;
- Node version compatible with `>=20.9.0`;
- framework preset Next.js;
- build command `pnpm build`;
- Production Branch `main`.

If the account permits `sin1`, set the single function region to `sin1`;
otherwise retain the account-supported default and record it in Roadmap.

- [ ] **Step 5: Deploy a reviewed commit**

Run:

```bash
vercel --prod
```

Record the returned deployment URL and Git SHA. Do not claim success from CLI
exit code alone; inspect Vercel build and function logs.

- [ ] **Step 6: Commit only non-secret deployment documentation**

```bash
git add README.md docs/ROADMAP.md
git add vercel.json # only when this file was created
git commit -m "docs: record production deployment configuration"
git push origin main
```

Omit the second `git add` command when `vercel.json` was not created.

---

### Task 16: Run production smoke, mainland network acceptance and rollback rehearsal

**Files:**
- Create: `docs/acceptance/2026-07-30-v0.1.0-production-acceptance.md`
- Update: `docs/ROADMAP.md`

- [ ] **Step 1: Run automated production HTTP checks**

Verify:

- `/` and `/login` return 200;
- unauthenticated `/practice` and `/admin` redirect;
- response contains no local filesystem paths or secrets;
- deployment SHA matches the intended commit.

- [ ] **Step 2: Run administrator browser journey**

Log in, inspect knowledge/scenarios, review a question, create an assignment,
inspect history and process a review. Record result and timestamp.

- [ ] **Step 3: Run learner browser journey**

Log in, view assignment, complete quiz, reload history, run scenario, reload
session, finish, inspect report and restart. Confirm data survives a Vercel
redeploy.

- [ ] **Step 4: Run responsive and console checks**

At 390px:

```js
document.documentElement.scrollWidth ===
document.documentElement.clientWidth
```

must be true for login, practice, quiz, scenario chat/report and all admin
index pages. Record application console errors separately from browser/plugin
warnings.

- [ ] **Step 5: Complete mainland network acceptance**

The user opens the same Production URL on:

- company office network;
- one mainland mobile network.

Record login, quiz submit and scenario send as pass/fail plus subjective
latency. If either network cannot complete the three operations reliably, mark
deployment “blocked for real use” and do not tag `v0.1.0`.

- [ ] **Step 6: Rehearse rollback**

Identify the prior healthy Vercel deployment and document the exact Promote /
Rollback operation without modifying production data. Confirm database
migrations are forward-compatible and no rollback requires dropping columns.

- [ ] **Step 7: Commit acceptance evidence**

```bash
git add docs/acceptance/2026-07-30-v0.1.0-production-acceptance.md docs/ROADMAP.md
git commit -m "docs: record production acceptance"
git push origin main
```

---

### Task 17: Audit the project foundation and architecture

**Files:**
- Create: `docs/architecture/2026-07-30-foundation-audit.md`
- Modify any source/test files only when the audit discovers a verified defect
- Update: `docs/ROADMAP.md`

- [ ] **Step 1: Run automated structural inventory**

Record:

- application routes and role requirements;
- domain Ports and concrete adapters;
- every production table, unique constraint and foreign key;
- all local filesystem imports and whether they are reachable in production;
- environment variables and secret owners;
- knowledge/question/scenario version links;
- package dependency and migration status.

- [ ] **Step 2: Enforce architecture rules**

Add/extend tests that fail when:

- `src/app` imports concrete database/local stores;
- production composition references local files;
- a published question/scenario lacks a knowledge version;
- mutable content overwrites an immutable hash/version;
- learner queries omit a learner ownership predicate;
- hidden facts or correct answers cross into learner list/page props;
- Server Actions accept client-computed scores or verdicts.

- [ ] **Step 3: Review failure and recovery paths**

Inspect and test:

- database timeout during login;
- duplicate form submission;
- session completion race;
- stale quiz/scenario version;
- unauthorized UUID enumeration;
- Vercel cold start;
- malformed environment variables;
- deployment with migrations not applied.

- [ ] **Step 4: Fix all P0/P1 foundation defects**

P0/P1 means data loss, permission bypass, incorrect version binding, secret
exposure, production local-store usage, non-idempotent publish or unrecoverable
deployment. Every fix follows a red/green test and its own focused commit.

- [ ] **Step 5: Document P2/P3 follow-ups without expanding scope**

UI polish, question wording refinement, richer analytics, real AI, Feishu and
knowledge-engine work stay in follow-up sections and do not block `v0.1.0`
unless they expose a foundation defect.

- [ ] **Step 6: Run the full foundation gate**

```bash
pnpm check
pnpm test:e2e
pnpm production:verify:data
git diff --check
```

All must pass. Working tree may contain only explicitly documented user-owned
uncommitted files.

- [ ] **Step 7: Commit audit**

```bash
git add docs/architecture/2026-07-30-foundation-audit.md docs/ROADMAP.md
git commit -m "docs: audit production foundation"
git push origin main
```

---

### Task 18: Release v0.1.0 and deliver final recap

**Files:**
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Create: `docs/2026-07-30-v0.1.0-DELIVERY-RECAP.md`

- [ ] **Step 1: Verify release facts**

Collect:

- final Git SHA and matching remote `main`;
- Vercel production URL and deployment status;
- Neon region and production verification counts;
- automated test/E2E totals;
- office/mobile network results;
- 40-question review count;
- 8 scenario count;
- open P2/P3 follow-ups.

- [ ] **Step 2: Update reader documentation**

README must explain production architecture, local setup, database bootstrap,
deployment, Mock limitation and secret boundaries. Roadmap marks Part 6
complete only if all success criteria pass.

- [ ] **Step 3: Write the delivery recap**

The recap separates:

- delivered facts;
- measured effects;
- architecture decisions;
- content limitations;
- deferred real AI work;
- next recommended sequence.

- [ ] **Step 4: Run final verification immediately before release**

```bash
pnpm check
pnpm test:e2e
pnpm production:verify:data
git status -sb
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

- [ ] **Step 5: Commit and push documentation**

```bash
git add README.md docs/ROADMAP.md docs/2026-07-30-v0.1.0-DELIVERY-RECAP.md
git commit -m "docs: complete v0.1.0 delivery"
git push origin main
```

- [ ] **Step 6: Tag only a verified release**

```bash
git tag -a v0.1.0 -m "AI客服训练 MVP v0.1.0"
git push origin v0.1.0
```

Do not create or push the tag if production/network acceptance is incomplete,
the production data verifier fails, or the 40-question content status is
misrepresented.
