# 阶段 4：AI 实战与训练记录完成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vue 3/FastAPI/SQLAlchemy 目标架构中完成场景目录、版本、可恢复多轮训练、实时风险、Ark/Mock Provider、报告 SSE、历史时间线和迁移演练，使阶段 4 形成可独立验收的纵向闭环。

**Architecture:** 后端以 `Scenario`/`ScenarioVersion`/`TrainingSession`/`TrainingMessage`/`EvaluationReport`/`ReviewDecision` 六类模型保存稳定 ID、版本、消息顺序、报告和复核关系；场景服务只依赖 Provider 协议，确定性 Mock 用于自动化验收，Ark HTTP 适配器只在明确配置时调用且失败时返回可重试错误。前端以 Pinia 维护目录、当前会话和历史数据，普通 API 走 Axios，报告生成走浏览器原生 SSE；历史记录按场景聚合、按活动时间排序，组内旧会话折叠并分页。

**Tech Stack:** Python 3.12、FastAPI、SQLAlchemy 2、Alembic、Pydantic 2、pytest、Vue 3、Vite、Pinia、Vue Router、Axios、Vitest/Vue Test Utils、Playwright、SQLite rehearsal（MySQL 兼容字段与事务边界）。

## Global Constraints

- 所有新接口位于 `/api/v1`，统一返回 `code`、`message`、`details`、`request_id` 错误结构。
- 业务时间以 UTC 持久化，前端时间线显示 Asia/Shanghai；消息 `position` 在会话内从 0 递增且唯一。
- Ark 密钥、地址、模型、超时和模式只能来自环境配置；生产 Provider 失败不得静默切换 Mock 或保存伪造报告。
- 会话、消息、报告写入必须在 SQLAlchemy 事务内完成；报告 SSE 重试必须幂等，不得重复生成或覆盖已完成报告。
- 任何场景、会话、报告都必须在服务端校验当前用户归属；前端隐藏按钮不构成权限控制。
- 迁移保留旧场景/版本/会话/消息/报告的 ID、时间戳、来源定位、消息顺序、分数和审核关系；重复运行不新增重复业务记录。
- 新系统不修改或删除旧 Next.js 文件；阶段 4 未完成前旧系统继续作为生产权威。
- 每个任务完成后运行聚焦测试并按仓库 `AGENTS.md` 提交、推送到 `origin` 和 `gitea`；最终阶段验收还要运行旧系统测试。

---

## 文件与边界地图

### 后端

- Create `backend/app/models/scenario.py`: 六类场景与训练记录 SQLAlchemy 模型、枚举和关系。
- Create `backend/app/schemas/scenario.py`: 场景目录、会话、消息、风险、报告、历史分组和 SSE 事件 DTO。
- Create `backend/app/repositories/scenario.py`: 场景发布查询、会话/消息/报告事务、历史分组与游标分页。
- Create `backend/app/services/scenario/providers.py`: `ConversationProvider`、`LiveRiskProvider`、`EvaluationProvider` 协议和 Provider 错误。
- Create `backend/app/services/scenario/mock.py`: 无随机性、按模板信号评分的 Mock Provider。
- Create `backend/app/services/scenario/ark.py`: Ark OpenAI-compatible HTTP 适配器、超时/空响应/JSON 解析错误映射。
- Create `backend/app/services/scenario/training.py`: start/load/send/complete/retry 编排，保护会话状态和报告幂等。
- Create `backend/app/services/scenario/publication.py`: 旧模板导出校验、知识版本来源门禁和幂等发布。
- Create `backend/app/services/phase4_migration.py`: JSON 导入、ID 映射、重复运行对账摘要。
- Create `backend/app/api/scenario.py`: 目录、会话、消息、报告 SSE、历史接口与权限依赖。
- Modify `backend/app/models/__init__.py`, `backend/app/api/router.py`, `backend/config/settings.py`.
- Create `backend/alembic/versions/20260806phase4_scenario_training.py`.
- Create `backend/scripts/export_phase4_data.py`, `backend/scripts/migrate_phase4.py`.

### 前端

- Create `frontend/src/api/scenario.js`: 目录、会话、消息、报告 SSE 和历史 API 封装。
- Create `frontend/src/stores/scenarioCatalog.js`, `scenarioTraining.js`, `scenarioHistory.js`.
- Create `frontend/src/components/scenario/ScenarioChat.vue`, `ScenarioReportProgress.vue`, `ScenarioHistoryTimeline.vue`.
- Create `frontend/src/views/ScenarioCatalogView.vue`, `ScenarioSessionView.vue`, `ScenarioReportView.vue`, `ScenarioHistoryView.vue`.
- Modify `frontend/src/router/index.js`, `frontend/src/views/ProfileView.vue`, `frontend/src/styles/base.css`.

### 测试与验收

- Create backend tests `test_phase4_models.py`, `test_scenario_publication.py`, `test_scenario_providers.py`, `test_scenario_training.py`, `test_scenario_api.py`, `test_phase4_migration.py`.
- Create frontend tests `scenarioCatalog.test.js`, `scenarioTraining.test.js`, `scenarioHistory.test.js`, `ScenarioChat.test.js`, `ScenarioHistoryTimeline.test.js`, `ScenarioViews.test.js`.
- Modify `backend/scripts/seed_phase3_e2e.py` to seed one published Phase 4 scenario with matching knowledge units.
- Modify `playwright.company-stack.config.ts` only if the Phase 4 seed requires a second idempotent seed command.
- Create `tests/e2e/company-stack-phase4.spec.ts` covering login, start, reload/restore, risk, SSE report, retry and history.
- Modify `docs/ROADMAP.md` and add `docs/superpowers/reports/2026-08-06-phase4-acceptance.md` with exact test and rehearsal evidence.

## Task 1: 场景数据模型、Alembic 迁移与基础 Repository

**Interfaces:** `ScenarioVersion.id` and `TrainingSession.id` are stable string IDs; `TrainingMessage.position` is unique per session; `EvaluationReport.training_session_id` is unique; repository methods are `list_published`, `get_owned_session`, `append_exchange`, `save_report`, `list_history_groups`, and `list_history_sessions`.

- [ ] **Step 1: Write failing model tests** in `backend/tests/test_phase4_models.py` for enum values, unique message position, one-report-per-session, completed-session/report invariant, and `Base.metadata.create_all` on SQLite.
- [ ] **Step 2: Run the model tests and verify they fail**.

  Run: `cd backend && .venv/bin/python -m pytest tests/test_phase4_models.py -q`

  Expected: FAIL because the Phase 4 models and exports do not exist.

- [ ] **Step 3: Implement models and migration** in `backend/app/models/scenario.py`, exports, and `20260806phase4_scenario_training.py`. Use nullable JSON fields for provider metadata, `String(64)` IDs to preserve old identifiers, UTC `DateTime`, cascade only for session messages, and restrict report/review deletion.
- [ ] **Step 4: Implement repository red tests** for published catalog filtering, owner checks, atomic append of learner/customer messages, report idempotency, and cursor pagination.
- [ ] **Step 5: Implement `backend/app/repositories/scenario.py`** and wire `get_session` transactions without importing FastAPI in repository code.
- [ ] **Step 6: Run focused tests plus Alembic upgrade/downgrade**.

  Run: `cd backend && .venv/bin/python -m pytest tests/test_phase4_models.py tests/test_scenario_repository.py -q && DATABASE_URL=sqlite+pysqlite:///./phase4-models.db .venv/bin/alembic upgrade head && DATABASE_URL=sqlite+pysqlite:///./phase4-models.db .venv/bin/alembic downgrade -1`

- [ ] **Step 7: Commit the independent slice** with `git add backend/app/models backend/app/repositories backend/alembic/versions backend/tests/test_phase4_models.py backend/tests/test_scenario_repository.py && git commit -m "feat(phase4): 建立场景训练数据模型与仓储"`, then push the current `main` to both remotes and verify the commit SHA.

## Task 2: 场景导出、发布门禁与幂等迁移

**Interfaces:** canonical template JSON contains `scenario_key`, `version_key`, `knowledge_version_hash`, `source_locators`, `category`, `title`, `opening_message`, `customer_turns`, `scoring_dimensions`, `critical_risks`, `reference_flow`, `reference_reply`, `max_turns`, `mock_mode`, `difficulty`, and `status`; `publish_phase4_templates(session, payload)` returns counts and `migrate_phase4(session, payload)` returns `source_hash`, `target_hash`, `created`, `updated`, `skipped`.

- [ ] **Step 1: Write failing publication and migration tests** in `backend/tests/test_scenario_publication.py` and `backend/tests/test_phase4_migration.py`: missing source locator is rejected, non-active knowledge version is rejected, eight canonical templates publish, repeated publish does not duplicate, two isolated imports produce equal hashes, and invalid scoring weights are rejected.
- [ ] **Step 2: Run the tests and verify the expected failures**.

  Run: `cd backend && .venv/bin/python -m pytest tests/test_scenario_publication.py tests/test_phase4_migration.py -q`

- [ ] **Step 3: Add the deterministic exporter** in `backend/scripts/export_phase4_data.py`; it serializes the existing `src/lib/scenario/templates.ts` data through a checked-in JSON fixture and sorts keys/records before hashing. It must support `--output` and `--check`.
- [ ] **Step 4: Implement publication validation and source gating** in `backend/app/services/scenario/publication.py`; require an active `KnowledgeVersion` and a matching `KnowledgeUnit.source_locator` for every declared source, and use `scenario_key`/`version_key` as idempotency keys.
- [ ] **Step 5: Implement `phase4_migration.py` and `scripts/migrate_phase4.py`** with one transaction, deterministic canonical hash, upsert semantics, relationship checks, and a nonzero exit on any count/hash mismatch.
- [ ] **Step 6: Run exporter, migration tests and two isolated rehearsal commands**.

  Run: `cd backend && .venv/bin/python scripts/export_phase4_data.py --output tests/fixtures/phase4-export.json --check && .venv/bin/python -m pytest tests/test_scenario_publication.py tests/test_phase4_migration.py -q && tmp1=$(mktemp -d) && tmp2=$(mktemp -d) && DATABASE_URL=sqlite+pysqlite:///$tmp1/one.db .venv/bin/alembic upgrade head && DATABASE_URL=sqlite+pysqlite:///$tmp2/two.db .venv/bin/alembic upgrade head && DATABASE_URL=sqlite+pysqlite:///$tmp1/one.db .venv/bin/python scripts/migrate_phase4.py tests/fixtures/phase4-export.json --report $tmp1/report.json && DATABASE_URL=sqlite+pysqlite:///$tmp2/two.db .venv/bin/python scripts/migrate_phase4.py tests/fixtures/phase4-export.json --report $tmp2/report.json && cmp $tmp1/report.json $tmp2/report.json`

- [ ] **Step 7: Commit and push** with `chore(phase4): 完成场景导出发布与幂等迁移`.

## Task 3: Provider 协议、确定性 Mock 与 Ark 失败边界

**Interfaces:** `ConversationProvider.stream_customer_reply(scenario, messages, learner_turn_count) -> Iterable[str]`, `LiveRiskProvider.detect_risk(scenario, messages) -> RiskAlert | None`, and `EvaluationProvider.evaluate(scenario, messages) -> EvaluationReportDraft`; all raise `ProviderError(code, retryable, message)` on upstream failure.

- [ ] **Step 1: Write failing provider tests** in `backend/tests/test_scenario_providers.py` for deterministic customer chunks, signal-based score/status, critical-risk detection, Ark timeout/empty/invalid JSON mapping, and the rule that real-provider failure never returns Mock output.
- [ ] **Step 2: Run provider tests and verify failure**.
- [ ] **Step 3: Implement protocols and typed DTOs** in `providers.py` with no dependency on FastAPI or SQLAlchemy.
- [ ] **Step 4: Implement `mock.py`** with fixed turn selection, chunk splitting, five weighted dimensions, confidence/low-confidence rules, and risk keyword matching; seed no random state.
- [ ] **Step 5: Implement `ark.py`** using `urllib.request`/JSON to avoid adding a dependency; read `ARK_BASE_URL`, `ARK_API_KEY`, `ARK_MODEL`, `ARK_TIMEOUT_SECONDS`, and `SCENARIO_AI_MODE`, parse only the documented response shape, redact secrets in errors, and never fall back.
- [ ] **Step 6: Run focused provider tests and settings tests**.

  Run: `cd backend && .venv/bin/python -m pytest tests/test_scenario_providers.py tests/test_settings.py -q`

- [ ] **Step 7: Commit and push** with `feat(phase4): 接入实战 Provider 与确定性 Mock`.

## Task 4: 训练服务、会话恢复、风险与报告幂等

**Interfaces:** `ScenarioTrainingService.start(user_id, scenario_id)`, `.load(user_id, session_id)`, `.send_message(user_id, session_id, content, expected_position)`, `.complete(user_id, session_id)`, and `.retry_report(user_id, session_id)`; service returns serializable schema objects and leaves messages untouched on Provider failure.

- [ ] **Step 1: Write failing service tests** in `backend/tests/test_scenario_training.py` for published-only start, owner isolation, version mismatch, completed-session rejection, stale-position conflict, optimistic learner/customer append, risk-provider failure isolation, Ark conversation failure preservation, completed-report idempotency, SSE retry after evaluation failure, and no duplicate report.
- [ ] **Step 2: Run service tests and verify failure**.
- [ ] **Step 3: Implement `training.py`** around repository and Provider protocols. Select Mock only when `SCENARIO_AI_MODE=mock`; select Ark only when mode is `ark` and all required settings exist; preserve the active session and messages when any Provider raises `ProviderError`.
- [ ] **Step 4: Implement report phase events** (`analyzing`, `scoring`, `saving`, `delta`, `report`, `error`) with a single transaction for report persistence and a guard that returns the existing report on repeated completion.
- [ ] **Step 5: Run service tests and the full backend suite**.

  Run: `cd backend && .venv/bin/python -m pytest tests/test_scenario_training.py -q && .venv/bin/python -m pytest -q`

- [ ] **Step 6: Commit and push** with `feat(phase4): 完成多轮训练与报告幂等服务`.

## Task 5: FastAPI 场景 API、SSE 与历史分页

**Interfaces:**

```text
GET  /api/v1/scenarios
POST /api/v1/scenarios/{scenario_id}/sessions
GET  /api/v1/scenario-sessions/{session_id}
POST /api/v1/scenario-sessions/{session_id}/messages
POST /api/v1/scenario-sessions/{session_id}/report/stream
POST /api/v1/scenario-sessions/{session_id}/report/retry
GET  /api/v1/me/scenario-history?status=all|active|completed&cursor=&limit=20
GET  /api/v1/me/scenario-history/{scenario_id}/sessions?status=all|active|completed&cursor=&limit=10
```

- [ ] **Step 1: Write failing API tests** in `backend/tests/test_scenario_api.py` covering 401, 403 cross-user access, catalog shape without hidden facts/answers, session start/load, message validation, risk response, SSE event order, SSE retry, stable error codes, status filters and cursors.
- [ ] **Step 2: Run API tests and verify failure**.
- [ ] **Step 3: Implement `backend/app/schemas/scenario.py`** with response models that omit hidden facts and provider secrets; add router dependencies and error translation in `backend/app/api/scenario.py`.
- [ ] **Step 4: Wire the router and session transaction dependency** in `backend/app/api/router.py`; use `StreamingResponse` with `text/event-stream`, `Cache-Control: no-cache`, and one JSON payload per SSE event.
- [ ] **Step 5: Run API tests plus backend full suite and inspect OpenAPI**.

  Run: `cd backend && .venv/bin/python -m pytest tests/test_scenario_api.py -q && .venv/bin/python -m pytest -q && .venv/bin/python -c "from main import app; paths=app.openapi()['paths']; assert '/api/v1/scenario-sessions/{session_id}/report/stream' in paths; print('phase4 OpenAPI ok')"`

- [ ] **Step 6: Commit and push** with `feat(phase4): 暴露场景训练与报告 SSE API`.

## Task 6: Vue 目录、训练、报告和历史时间线

**Interfaces:** `scenarioCatalog` exposes `items/loading/error/load()`, `scenarioTraining` exposes `session/messages/risk/report/streaming/start/load/send/complete/retry`, and `scenarioHistory` exposes `groups/filter/cursor/expanded/loading/load/loadMore/toggle`.

- [ ] **Step 1: Write failing Vitest tests** for API URL/error mapping, Pinia reload restoration, message append, SSE phase parsing and retry, route guards, history grouping/date sorting/status filters/fold/pagination, and mobile timeline accessible labels.
- [ ] **Step 2: Run the frontend tests and verify failure**.
- [ ] **Step 3: Implement `api/scenario.js`** with Axios calls and an SSE parser that handles `event:`/`data:` lines, reconnects only through explicit retry action, and exposes stable backend error codes.
- [ ] **Step 4: Implement the three stores** with no component-level API calls; keep only current session/report and history cursors in Pinia and clear them on logout.
- [ ] **Step 5: Implement `ScenarioCatalogView`, `ScenarioSessionView`, `ScenarioReportView`, `ScenarioHistoryView` and the three components**. The session page must fetch the server session on mount, show customer/learner bubbles, turn progress, risk alert and send/complete controls; the report page must show phases, delta text, score/status/dimensions/recommendations and retry button.
- [ ] **Step 6: Add routes `/practice/scenario`, `/practice/scenario/session/:sessionId`, `/practice/scenario/report/:sessionId`, `/practice/scenario/history` and profile entry. Add responsive CSS for 320px width, `details`-based group folding, status filter buttons, and group “load more”.
- [ ] **Step 7: Run all frontend tests and build**.

  Run: `npm --prefix frontend test && npm --prefix frontend run build`

- [ ] **Step 8: Commit and push** with `feat(phase4): 完成 Vue 实战与历史时间线`.

## Task 7: Phase 4 E2E、迁移演练、Roadmap 与阶段验收

**Interfaces:** the E2E seed creates one published `e2e-scenario-returns` version tied to the seeded active knowledge version and at least two matching source units; the acceptance report records exact command, date, commit SHA, pass count, and both remote SHAs.

- [ ] **Step 1: Extend the E2E seed** in `backend/scripts/seed_phase3_e2e.py` (or a separate `seed_phase4_e2e.py` called from `playwright.company-stack.config.ts`) with an idempotent published scenario and matching source locators; never deactivate the Phase 3 knowledge version after seeding.
- [ ] **Step 2: Write `tests/e2e/company-stack-phase4.spec.ts`** for test login → catalog → start → send at least three turns → reload and restore messages → trigger risk keyword → complete report SSE → assert score/status → retry completed report idempotently → open history, filter completed, expand group and load more.
- [ ] **Step 3: Run the E2E red test against the configured company-stack servers**, fix only implementation/seed issues, and rerun until deterministic.

  Run: `npm run test:e2e:company-stack -- --grep "Phase 4"`

- [ ] **Step 4: Run the complete verification matrix**: backend pytest, frontend Vitest/build, old Next Vitest, TypeScript/ESLint/Drizzle/Next build, exporter `--check`, two isolated migration rehearsals, and company-stack Playwright. Capture exact results in `docs/superpowers/reports/2026-08-06-phase4-acceptance.md`.
- [ ] **Step 5: Update `docs/ROADMAP.md`**: mark all five Phase 4 bullets checked, set Phase 4 to 100%/已完成, overall progress to 80%, set Phase 5 as next target, update current execution to `7/7`, add the acceptance evidence table and latest commit.
- [ ] **Step 6: Run `git status --short --branch` and inspect the diff**; only Phase 4 source, tests, migration fixture, roadmap, plan and acceptance report may be included. Do not stage `next-env.d.ts`, SQLite DB files, `__pycache__`, coverage output or local env files.
- [ ] **Step 7: Commit and push the final documentation/acceptance slice** with `docs(roadmap): 完成阶段四 AI 实战与记录迁移验收`, then run:

  ```bash
  git push origin main
  git push gitea main
  git rev-parse HEAD
  git ls-remote origin refs/heads/main
  git ls-remote gitea refs/heads/main
  ```

  Both remote SHAs must equal `HEAD` before reporting Phase 4 complete.

## Self-review checklist

- The plan covers every Phase 4 roadmap bullet: catalog/version, restore/multi-turn, live risk, Ark conversation/evaluation, report SSE/retry/review persistence, timeline/filter/fold/pagination/mobile, migration rehearsal and E2E.
- Every task has concrete file paths, interfaces, failing-test command, implementation boundary and verification command; there are no deferred placeholders.
- Production Ark failure remains visible and retryable; Mock is deterministic and selected only by explicit mode.
- Phase 3 routes, tests, seed data and old Next.js behavior remain compatible.
