# 个人中心数据切片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将任务、知识进度和实战覆盖摘要迁移到 FastAPI/Vue 个人中心，并保证服务端按当前用户隔离数据。

**Architecture:** 使用 SQLAlchemy 读模型保存个人中心所需的稳定聚合字段；Repository 只接受当前用户 ID；`GET /api/v1/me/overview` 返回用户、任务、知识摘要和实战摘要。Vue 通过 Pinia 加载该聚合，页面只渲染 API 返回的数据，不接触数据库。

**Tech Stack:** FastAPI 0.115.12、SQLAlchemy 2.0.27、Pydantic 2.10.6、Alembic、Vue 3、Pinia 3、Axios 1.7、pytest、Vitest/Vue Test Utils。

## Global Constraints

- 所有接口位于 `/api/v1`，错误使用 `code`、`message`、`details`、`request_id`。
- 用户身份来自 HttpOnly Cookie 的服务端 JWT，不能把令牌写入 localStorage。
- 时间以 UTC 保存；返回 ISO 时间，界面负责本地化。
- 旧 Next.js 系统继续可用，新接口不能修改旧表或旧业务行为。
- 每个行为先写失败测试，再实现最小代码并运行回归。

### Task 1: 个人中心读模型与 Repository

**Files:**
- Create: `backend/app/models/learning.py`
- Create: `backend/app/repositories/overview.py`
- Create: `backend/tests/test_overview_repository.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/20260806_create_learner_overview.py`

- [x] 写测试：任务只返回指定 learner，知识与实战摘要返回对应 learner 的聚合。
- [x] 运行 `cd backend && .venv/bin/python -m pytest tests/test_overview_repository.py -q`，确认缺少模型或 Repository 而失败。
- [x] 实现 `Assignment`、`KnowledgeProgress`、`ScenarioProgressSummary` 和 `LearnerOverviewRepository.get_overview(learner_id)`。
- [x] 运行同一测试并确认通过；对空摘要返回零值，不返回其他用户记录。
- [x] 创建 `20260806_create_learner_overview.py` Alembic migration，检查后使用临时 SQLite 执行 `upgrade head`。

### Task 2: 个人中心 API

**Files:**
- Create: `backend/app/schemas/overview.py`
- Create: `backend/app/api/overview.py`
- Create: `backend/tests/test_overview_api.py`
- Modify: `backend/app/api/router.py`

- [x] 写测试：带有效 Cookie 的 learner 获得 `/api/v1/me/overview`，未登录返回 `AUTH_REQUIRED`。
- [x] 运行测试确认路由不存在或未授权而失败。
- [x] 实现响应模型、当前用户依赖和只读 API。
- [x] 运行 API 测试，验证响应不泄露另一用户的任务与摘要。

### Task 3: Vue 个人中心数据联调

**Files:**
- Create: `frontend/src/api/overview.js`
- Create: `frontend/src/stores/overview.js`
- Create: `frontend/src/stores/overview.test.js`
- Modify: `frontend/src/views/ProfileView.vue`
- Modify: `frontend/src/views/ProfileView.test.js`

- [x] 写测试：Store 加载任务、知识和实战摘要；API 失败显示错误状态。
- [x] 运行 Vitest 确认模块缺失而失败。
- [x] 实现 Axios API、Pinia Store 和页面卡片。
- [x] 运行 Vue 测试和 Vite build，确认空状态与加载状态可用。

### Task 4: 集成验证与交付

**Files:**
- Modify: `docs/ROADMAP.md`
- Create: `tests/e2e/company-stack-overview.spec.ts` only after the test server has deterministic seed data.

- [ ] 运行后端、前端、旧系统测试、lint、构建、数据库校验和 E2E。
- [ ] 更新 Roadmap 的阶段 2 勾选项、进度和提交检查点。
- [ ] `git diff --check`、检查状态、使用中文 Conventional Commit 提交。
- [ ] 将同一提交推送并核对 GitHub、Gitea 分支哈希。
