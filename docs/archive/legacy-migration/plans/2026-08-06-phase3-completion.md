# 阶段 3 知识与题库完整迁移 Implementation Plan

> 历史迁移记录，不是当前运行说明。当前入口见[项目 README](../../../../README.md)与[开发交接说明](../../../AGENT-HANDOFF.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完整交付 Vue/FastAPI 新系统的知识编译与发布、正式题组发布、专题取题、服务端判分、答题记录、覆盖率和可重复数据迁移对账，并把 Roadmap 阶段 3 标记为完成。

> 执行状态：已于 `c65d0a3` 完成并双远程推送；以下步骤为已完成复盘记录，下一目标转入阶段 4。

**Architecture:** Python 领域模块将 Markdown、Excel 与 FreeMind XML 编译为确定性 `KnowledgePack`，发布服务在单一事务内写入带来源和冲突标记的活动知识版本。正式题组只能引用无冲突的活动知识单元；学员 API 在服务端固定题目快照、判分并保存作答，Vue 只接收无答案题目，完成后才显示结果。迁移脚本把旧题库导出为稳定 JSON，再幂等导入 SQLAlchemy，并以数量、外键和 SHA-256 摘要对账。

**Tech Stack:** FastAPI 0.115.12、SQLAlchemy 2.0.27、Alembic 1.13.3、Pydantic 2.10.6、openpyxl 3.1.5、Vue 3、Pinia 3、Axios 1.7、pytest、Vitest、Playwright。

## Global Constraints

- 用户已明确授权本轮直接在 `main` 开发、提交并推送。
- 生产数据库使用 MySQL `utf8mb4`，测试允许 SQLite；业务时间以 UTC 保存。
- 所有接口位于 `/api/v1`，错误使用 `code`、`message`、`details`、`request_id`。
- 取题和目录响应不得返回 `correct_answers`；正确答案和解析只在提交后返回。
- 每个发布和答题动作使用单一数据库事务，失败不能留下部分数据。
- 冲突知识不得进入正式题组；未发布或非活动知识版本不得服务学员请求。
- 旧 Next.js 系统保持生产权威；本阶段只完成可重复迁移与隔离数据库对账，不执行生产切换。
- 每个可验收切片都更新 `docs/ROADMAP.md`，使用中文 Conventional Commit，并最终同步 `origin main` 与 `gitea main`。

---

### Task 1: 补齐阶段 3 数据模型

**Files:**
- Modify: `backend/app/models/catalog.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/20260806_expand_phase3_tables.py`
- Test: `backend/tests/test_phase3_models.py`

**Interfaces:**
- Produces `KnowledgeSource`, `KnowledgeUnit`, `QuizAttempt`, `QuizAnswer`。
- `QuizAttempt.question_ids: list[str]` 固定本次服务端抽题结果；`QuizAnswer` 对 `(attempt_id, question_id)` 唯一。
- `KnowledgeUnit` 保存 `unit_key`、`content_hash`、`sources`、`has_conflict` 和三个用途门禁。

- [x] **Step 1: Write failing model tests** — 创建活动知识版本、来源、冲突/非冲突知识、正式题组、题目、答题尝试与逐题答案，并验证唯一约束和关系。

```python
attempt = QuizAttempt(id="attempt-1", learner_id="learner-1", quiz_set=quiz_set,
                      question_ids=["question-1"], status="in_progress", total_questions=1)
attempt.answers.append(QuizAnswer(id="answer-1", question=question,
                                  selected_answers=["A"], is_correct=True))
assert attempt.answers[0].question.knowledge_unit.unit_key == "ku_001"
```

- [x] **Step 2: Verify RED** — `cd backend && .venv/bin/python -m pytest tests/test_phase3_models.py -q`; expect missing model imports.
- [x] **Step 3: Implement models** — add stable string IDs, JSON columns, lifecycle fields, indexes, uniqueness and relationships without removing fields already consumed by the catalog API.
- [x] **Step 4: Verify GREEN** — focused pytest passes.
- [x] **Step 5: Generate and verify migration** — upgrade existing revisions, autogenerate `20260806phase3`, then run upgrade → downgrade → upgrade against a temporary SQLite database.
- [x] **Step 6: Update Roadmap and commit** — `feat(knowledge): 补齐阶段三数据模型`。

### Task 2: 知识解析、规范化与确定性编译

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/services/knowledge/__init__.py`
- Create: `backend/app/services/knowledge/schema.py`
- Create: `backend/app/services/knowledge/normalize.py`
- Create: `backend/app/services/knowledge/adapters.py`
- Create: `backend/app/services/knowledge/compiler.py`
- Test: `backend/tests/test_knowledge_compiler.py`

**Interfaces:**
- `parse_markdown(source_path: str, text: str) -> ParseResult`
- `parse_excel(source_path: str, content: bytes) -> ParseResult`
- `parse_mindmap(source_path: str, text: str) -> ParseResult`
- `compile_knowledge_sources(sources: list[SourceInput], expected: dict[str, int]) -> KnowledgePack`
- Stable IDs use `ku_` plus the first 24 hex characters of the source locator SHA-256; `pack_hash` hashes canonical JSON.

- [x] **Step 1: Write adapter tests** — cover heading paths and image skipping, Excel question/answer/category rows and empty answers, FreeMind nested nodes and numeric entities.
- [x] **Step 2: Write compiler tests** — duplicate content merges sources, conflicting semantic keys produce warning issues, coverage mismatch fails the gate, source order does not change the pack hash.
- [x] **Step 3: Verify RED** — focused pytest expects `app.services.knowledge` import failure.
- [x] **Step 4: Implement schemas and normalization** — Pydantic models validate locators, units, issues, coverage and pack shape; text uses NFC, removes zero-width characters and normalizes whitespace.
- [x] **Step 5: Implement adapters and compiler** — use `re` for Markdown, `openpyxl.load_workbook(BytesIO(...), data_only=True)` for Excel and `xml.etree.ElementTree` for FreeMind XML; canonical JSON uses sorted keys and UTF-8.
- [x] **Step 6: Verify GREEN** — all knowledge compiler tests and backend suite pass with no warnings.
- [x] **Step 7: Update Roadmap and commit** — `feat(knowledge): 迁移知识解析与规范化`。

### Task 3: 知识发布、来源追溯与冲突门禁

**Files:**
- Create: `backend/app/repositories/knowledge.py`
- Create: `backend/app/services/knowledge/publication.py`
- Create: `backend/scripts/knowledge.py`
- Test: `backend/tests/test_knowledge_publication.py`
- Test: `backend/tests/test_knowledge_cli.py`

**Interfaces:**
- `KnowledgePublicationService.publish(pack: KnowledgePack, label: str) -> PublicationResult`
- Same `pack_hash` is idempotent; a new published version deactivates the prior version inside the same transaction.
- Conflict membership sets `has_conflict=True` and all `can_use_for_*` flags false.
- CLI: `python scripts/knowledge.py compile <source-dir> <pack.json>` and `python scripts/knowledge.py publish <pack.json> --label <label>`.

- [x] **Step 1: Write failing publication tests** — reject failed coverage gates, persist source locators, quarantine conflicts, switch one active version atomically and return the existing version for identical hashes.
- [x] **Step 2: Write failing CLI behavior tests** — run the CLI against temporary Markdown/XLSX/MM fixtures and assert JSON output/exit codes rather than source text.
- [x] **Step 3: Verify RED** — focused pytest fails on missing repository/service.
- [x] **Step 4: Implement repository and service** — use `session.begin_nested()` only when a caller already owns a transaction; otherwise commit once at the API/CLI boundary.
- [x] **Step 5: Implement CLI** — load settings/database through existing configuration and print a compact JSON result containing `version_id`, `pack_hash`, source/unit/conflict counts and `created`.
- [x] **Step 6: Verify GREEN** — focused and full backend tests pass.
- [x] **Step 7: Update Roadmap and commit** — `feat(knowledge): 建立版本发布与冲突门禁`。

### Task 4: 正式题组发布与旧内容导出

**Files:**
- Create: `backend/app/services/quiz/publication.py`
- Create: `backend/scripts/quiz.py`
- Create: `scripts/export-phase3-data.ts`
- Test: `backend/tests/test_quiz_publication.py`
- Test: `backend/tests/test_quiz_cli.py`
- Test: `src/lib/quiz/phase3-export.test.ts`

**Interfaces:**
- `QuizPublicationService.publish(payload: QuizPublicationInput) -> QuizPublicationResult`
- Payload topics contain `id`, `label`, `description`, `passing_score`, and questions bound by `knowledge_unit_key`.
- Publishing rejects missing, conflicting or disallowed units; questions and set become published in one transaction; same `quiz_hash` is idempotent.
- Export command: `npm exec -- tsx scripts/export-phase3-data.ts -- <output.json>`; output includes current five topics and every legacy topic question with a deterministic `quiz_hash`.

- [x] **Step 1: Write failing publication tests** — cover conflict rejection, answer persistence, atomic rollback and idempotency.
- [x] **Step 2: Write failing export test** — invoke the exporter in a temporary directory and assert 5 topics, non-zero question totals, unique IDs and a reproducible SHA-256.
- [x] **Step 3: Verify RED** — Python and TypeScript focused tests fail for missing modules/scripts.
- [x] **Step 4: Implement service and CLI** — publish one set per topic against the active knowledge version and preserve stable old question IDs.
- [x] **Step 5: Implement exporter** — serialize the existing `quizTopics` and `topicQuizQuestions` through a canonical sorted JSON structure without duplicating the 5,000-line question bank in Git.
- [x] **Step 6: Verify GREEN** — focused Python/TypeScript tests and backend suite pass.
- [x] **Step 7: Update Roadmap and commit** — `feat(quiz): 建立正式题组发布流程`。

### Task 5: 专题取题、服务端判分、记录与覆盖率 API

**Files:**
- Create: `backend/app/repositories/quiz_attempts.py`
- Create: `backend/app/services/quiz/attempts.py`
- Modify: `backend/app/schemas/catalog.py`
- Modify: `backend/app/api/catalog.py`
- Test: `backend/tests/test_quiz_attempt_service.py`
- Test: `backend/tests/test_quiz_attempt_api.py`

**Interfaces:**
- `POST /api/v1/quiz/topics/{topic_id}/attempts` requires learner login and returns `{attempt_id, topic, passing_score, questions}` without answer fields.
- Selection uses difficulty quotas `easy=4, medium=4, hard=2`, fills shortages deterministically after a seeded shuffle, and stores selected IDs on the attempt.
- `POST /api/v1/quiz/attempts/{attempt_id}/submit` accepts `{answers: [{question_id, selected_answers}]}` and returns score/status plus per-question correctness, correct answers and explanation.
- `GET /api/v1/me/quiz-progress` returns overall/topic coverage, accuracy, attempt count and recent attempts.

- [x] **Step 1: Write failing service tests** — selected questions belong to the published active set, answers are never trusted from the client, duplicate/missing/foreign questions fail, repeat submit is idempotent, cross-user access is rejected and rollback leaves no answers.
- [x] **Step 2: Write failing API tests** — anonymous start/submit/progress returns 401; start payload hides answers; submit returns server-derived results; progress counts unique covered questions and cumulative accuracy.
- [x] **Step 3: Verify RED** — focused pytest fails for missing attempt service.
- [x] **Step 4: Implement repository/service** — use `secrets.SystemRandom` in production with an injectable `random.Random` for deterministic tests; calculate rounded percentage and `passed` at `passing_score`.
- [x] **Step 5: Implement schemas/routes** — map domain failures to stable `QUIZ_NOT_FOUND`, `QUIZ_ATTEMPT_INVALID`, `QUIZ_ATTEMPT_FORBIDDEN` and `QUIZ_ATTEMPT_COMPLETED` errors.
- [x] **Step 6: Verify GREEN** — focused and full backend tests pass.
- [x] **Step 7: Update Roadmap and commit** — `feat(quiz): 接入服务端判分与答题记录`。

### Task 6: Vue 答题与结果闭环

**Files:**
- Modify: `frontend/src/api/catalog.js`
- Modify: `frontend/src/stores/catalog.js`
- Create: `frontend/src/stores/quizAttempt.js`
- Create: `frontend/src/stores/quizAttempt.test.js`
- Create: `frontend/src/views/QuizAttemptView.vue`
- Create: `frontend/src/views/QuizAttemptView.test.js`
- Modify: `frontend/src/views/QuizTopicsView.vue`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/router/index.test.js`
- Modify: `frontend/src/styles/base.css`

**Interfaces:**
- `startQuizAttempt(topicId)`, `submitQuizAttempt(attemptId, answers)`, `getQuizProgress()` call the new API routes.
- `useQuizAttemptStore` exposes `attempt`, `answers`, `result`, `status`, `error`, `start(topicId)`, `select(questionId, answer)` and `submit()`.
- Route `/practice/quiz/topics/:topicId` requires authentication and renders one selection per question, submit disabled until every question has an answer, then renders score and per-question feedback.

- [x] **Step 1: Write failing store tests** — start loading/error, local selections, exact submit payload and server result.
- [x] **Step 2: Write failing view/router tests** — question/options render without answers, submit gating, passed/retry result, API error and anonymous redirect.
- [x] **Step 3: Verify RED** — focused Vitest fails for missing store/view.
- [x] **Step 4: Implement API/store/view/route/styles** — retain catalog empty/error behavior and use native radio controls with accessible labels.
- [x] **Step 5: Verify GREEN** — focused tests, full Vue tests and Vite build pass without stderr warnings.
- [x] **Step 6: Update Roadmap and commit** — `feat(quiz): 完成 Vue 答题与结果闭环`。

### Task 7: 数据迁移、对账与阶段验收

**Files:**
- Create: `backend/app/services/phase3_migration.py`
- Create: `backend/scripts/migrate_phase3.py`
- Create: `backend/tests/fixtures/phase3-export.json`
- Create: `backend/tests/test_phase3_migration.py`
- Modify: `tests/e2e/company-stack-foundation.spec.ts`
- Modify: `playwright.company-stack.config.ts`
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- `migrate_phase3_export(session, payload) -> MigrationReport` is idempotent and returns source/imported counts plus canonical source/target hashes.
- `reconcile_phase3_export(session, payload) -> ReconciliationReport` checks row counts, foreign keys, question IDs, answer IDs and canonical SHA-256; any mismatch sets `passed=False` and CLI exits non-zero.
- CLI: `python scripts/migrate_phase3.py <export.json> --rehearsals 2`; each rehearsal uses a fresh isolated SQLite database unless `DATABASE_URL` is explicitly supplied.

- [x] **Step 1: Write failing migration tests** — fixed fixture imports identically twice, two fresh rehearsals produce the same hash, missing references roll back, and a tampered target fails reconciliation.
- [x] **Step 2: Add failing E2E** — seed one learner and one published topic, authenticate via test token, complete a quiz in Vue and assert the result/coverage survives a page reload.
- [x] **Step 3: Verify RED** — focused migration pytest and Playwright fail before implementation/seed wiring.
- [x] **Step 4: Implement migration and CLI** — reject malformed exports before opening the transaction and produce machine-readable JSON reports.
- [x] **Step 5: Wire deterministic E2E seed** — run Alembic plus a small test-only seeder before Uvicorn; do not enable test seeding outside `APP_ENV=test`.
- [x] **Step 6: Verify GREEN** — migration tests and E2E pass.
- [x] **Step 7: Run complete verification** — company-stack script, backend pytest, Vue tests/build, root lint/typecheck/tests/db check/build and company-stack E2E.
- [x] **Step 8: Complete Roadmap** — mark all five stage 3 bullets complete, stage 3 at 100%, overall migration at 60%, record exact test totals and set the next target to stage 4.
- [x] **Step 9: Commit and dual-push** — `docs(roadmap): 标记阶段三完成并启动阶段四`; push `main` to both remotes and compare `HEAD`, `origin/main`, `gitea/main`.
