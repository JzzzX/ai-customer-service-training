# 知识与题库目录迁移 Implementation Plan

> 历史迁移记录，不是当前运行说明。当前入口见[项目 README](../../../../README.md)与[开发交接说明](../../../AGENT-HANDOFF.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为新 Vue/FastAPI 系统交付可读取已发布知识版本和专题题库目录的纵向切片，作为后续答题、判分与内容发布迁移的稳定边界。

**Architecture:** SQLAlchemy 模型保存知识版本、题目和题库集合；Repository 只返回 `published` 内容；FastAPI 提供 `/api/v1/quiz/topics`，Vue 通过 Axios/Pinia 展示专题目录。答案字段永远不出现在目录 API 中。

**Tech Stack:** FastAPI 0.115.12、SQLAlchemy 2.0.27、Alembic 1.13.3、Vue 3、Pinia 3、Axios 1.7、pytest、Vitest。

## Global Constraints

- 生产数据库使用 MySQL `utf8mb4`，测试允许 SQLite。
- 所有接口位于 `/api/v1`，错误使用 `code`、`message`、`details`、`request_id`。
- 题库目录只暴露已发布题库和题量，不返回 `correct_answers`。
- 业务时间以 UTC 存储，接口输出带时区时间。
- 旧 Next.js 系统保持可用，新目录无数据时返回空集合，不伪造题目。

---

### Task 1: 知识版本与题库模型

**Files:**
- Create: `backend/app/models/catalog.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/20260806_create_catalog_tables.py`
- Test: `backend/tests/test_catalog_models.py`

**Interfaces:**
- Produces `KnowledgeVersion`, `QuizSet`, `Question` SQLAlchemy models and metadata for the next Repository task.

- [ ] **Step 1: Write the failing model test** — assert tables can be created, a published quiz set references one knowledge version, and questions retain options/correct answers in persistence.
- [ ] **Step 2: Run the model test and verify it fails** — run `.venv/bin/python -m pytest tests/test_catalog_models.py -q` from `backend/`; expect import failure for `KnowledgeVersion`.
- [ ] **Step 3: Implement the minimal models** — use stable string IDs, JSON columns for options/correct answers, lifecycle status strings, UTC timestamps, and foreign keys.
- [ ] **Step 4: Run the model test and verify it passes** — repeat the focused pytest command.
- [ ] **Step 5: Generate and verify Alembic migration** — run `APP_ENV=test DATABASE_URL=sqlite+pysqlite:///./company-stack-dev.db .venv/bin/alembic revision --autogenerate -m 'create catalog tables'`, then upgrade a temporary SQLite database.
- [ ] **Step 6: Commit** — `git add backend/app/models backend/alembic/versions backend/tests/test_catalog_models.py && git commit -m "feat(catalog): 建立知识与题库模型"`.

### Task 2: 已发布题库目录 Repository 与 API

**Files:**
- Create: `backend/app/repositories/catalog.py`
- Create: `backend/app/schemas/catalog.py`
- Create: `backend/app/api/catalog.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_catalog_repository.py`, `backend/tests/test_catalog_api.py`

**Interfaces:**
- `PublishedCatalogRepository.list_topics() -> list[TopicCatalog]` returns only published sets joined to active knowledge versions.
- `GET /api/v1/quiz/topics` returns `{topics: [{id, label, question_count, description}], knowledge_version}`.

- [ ] **Step 1: Write failing Repository and API tests** — include draft rows and assert they never appear; assert response JSON has no answer fields.
- [ ] **Step 2: Run focused tests and verify the expected missing-module failure** — `.venv/bin/python -m pytest tests/test_catalog_repository.py tests/test_catalog_api.py -q`.
- [ ] **Step 3: Implement the Repository and schemas** — filter `status='published'`, `is_active=true`, order by title/id, count questions through the quiz-set relation.
- [ ] **Step 4: Implement the route** — register the router and return the stable response; keep it readable without authentication because published catalog is not learner-private.
- [ ] **Step 5: Run focused tests and verify they pass**.
- [ ] **Step 6: Commit** — `git add backend/app && git commit -m "feat(catalog): 提供已发布题库目录接口"`.

### Task 3: Vue 专题目录页

**Files:**
- Create: `frontend/src/api/catalog.js`
- Create: `frontend/src/stores/catalog.js`
- Create: `frontend/src/stores/catalog.test.js`
- Create: `frontend/src/views/QuizTopicsView.vue`
- Create: `frontend/src/views/QuizTopicsView.test.js`
- Modify: `frontend/src/router/index.js`, `frontend/src/styles/base.css`

**Interfaces:**
- `getQuizTopics()` calls `/quiz/topics`.
- `useCatalogStore.loadTopics()` exposes `topics`, `knowledgeVersion`, `status`, and `error`.
- Route `/practice/quiz/topics` renders published topics and links to the future quiz runner.

- [ ] **Step 1: Write failing store and view tests** — assert loading, empty state, API error, topic title, question count, and stable link shape.
- [ ] **Step 2: Run frontend focused tests and verify missing-module failures** — `npm test -- src/stores/catalog.test.js src/views/QuizTopicsView.test.js` from `frontend/`.
- [ ] **Step 3: Implement API, Store, view, route and minimal responsive styles**.
- [ ] **Step 4: Run focused tests and verify they pass**.
- [ ] **Step 5: Commit** — `git add frontend/src && git commit -m "feat(quiz): 接入专题目录页面"`.

### Task 4: Slice verification and Roadmap update

**Files:**
- Modify: `docs/ROADMAP.md`
- Test: existing backend/frontend suites and company-stack E2E.

- [ ] **Step 1: Run verification** — backend pytest, frontend tests/build, root tests/lint/Next build, database check, and company-stack E2E.
- [ ] **Step 2: Update Roadmap** — mark the catalog items complete, record the commit and test totals, and move the next target to answer submission/server-side grading.
- [ ] **Step 3: Commit and push** — push the same commit to `origin main` and `gitea main`, then compare both remote hashes with local `HEAD`.
