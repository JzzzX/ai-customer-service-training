# README and Engineering Handoff Implementation Plan

> 历史迁移记录，不是当前运行说明。当前入口见[项目 README](../../../../README.md)与[开发交接说明](../../../AGENT-HANDOFF.md)。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current MVP understandable to company developers, state its verified delivery boundary accurately, and prepare a safe decision point for GitHub visibility.

**Architecture:** Keep `README.md` as the short repository entry point and put implementation, deployment, replacement seams, and handoff questions in `docs/AGENT-HANDOFF.md`. Do not change application behavior. Remove the concrete model-service endpoint from the example environment file, while retaining the current runtime contract through generic placeholders.

**Tech Stack:** Next.js 16, React 19, Auth.js Credentials, Neon PostgreSQL, Drizzle ORM, Vercel, OpenAI-compatible model provider, pnpm 10.33, Node.js 24.

## Global Constraints

- Describe this as a Web MVP usable for internal demo/trial; do not describe online real-AI acceptance as complete while the Vercel-to-model request still times out.
- Treat Feishu SSO and company data-service integration as replacement seams, not current features.
- Do not publish passwords, tokens, private enterprise source files, generated artifacts, or the concrete model-service host/port.
- Preserve the existing application code and test contracts; this change is documentation and public-release hygiene only.
- Stage only the files changed by this task; leave unrelated user files untouched.
- Before claiming completion, run fresh repository checks, inspect `git status`, commit with Conventional Commits, and push the current branch as required by `AGENTS.md`.

---

### Task 1: Rewrite the repository entry point

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the verified status in `docs/MVP-ACCEPTANCE.md`, deployment procedures in `docs/DEPLOYMENT.md`, and roadmap boundaries in `docs/ROADMAP.md`.
- Produces: a developer-readable entry point with status, capabilities, local startup, quality gates, architecture seams, production boundary, and document index.

- [ ] **Step 1: Replace the opening with a concise project description and status table**

State that the product is a pet-food customer-service training Web MVP with learner practice and administrator review. Separate “MVP demo/trial usable” from “production complete”: credentials login is temporary, Feishu SSO is future work, and online real-AI acceptance remains blocked by the external model endpoint's Vercel reachability.

- [ ] **Step 2: Add a reading order for engineers**

Link `docs/AGENT-HANDOFF.md`, `docs/MVP-ACCEPTANCE.md`, `docs/DEPLOYMENT.md`, and `docs/ROADMAP.md`, and explain which question each document answers.

- [ ] **Step 3: Keep local setup and quality commands executable**

Document Node.js 24, pnpm 10.33, `pnpm install`, `pnpm dev`, `pnpm check`, and the Mock E2E command. Explain that live AI smoke tests are external-cost/network dependent and are not a normal CI gate.

- [ ] **Step 4: Document the four replacement seams without promising integrations**

Use the exact current boundaries: Auth.js Credentials to Feishu SSO plus user mapping; local Markdown/Excel/MM knowledge adapters to the company knowledge service; Neon repositories to the company data service if required; Mock/real scenario providers to the approved enterprise model gateway.

### Task 2: Add the engineering handoff document

**Files:**
- Create: `docs/AGENT-HANDOFF.md`

**Interfaces:**
- Consumes: the current source layout, environment contract in `.env.example`, schema and migration files under `drizzle/`, and the acceptance/deployment documents.
- Produces: a handoff checklist that a company developer can use to run the project, understand ownership boundaries, and ask precise questions about SSO, database, model access, deployment, and acceptance.

- [ ] **Step 1: Record the verified current state**

List the implemented learner/admin flows, five-topic 350-question practice bank, 40-question traceable quiz publication, eight scenario templates, role authorization, Neon persistence, and Vercel deployment. Mark live real-AI production acceptance as pending rather than completed.

- [ ] **Step 2: Describe the runtime and data flow**

Document the request path `Next.js route/action -> service contract -> provider/store -> database or model`, the Mock-vs-real scenario mode, the production-only Neon requirement, and the fact that original enterprise source files remain outside Git.

- [ ] **Step 3: Add onboarding commands and environment rules**

Give the exact local commands for install, local fallback login, migration/seed, knowledge/quiz/scenario publication, data verification, and quality checks. Refer developers to `.env.example` and explicitly forbid committing `.env.local`, passwords, API keys, and generated artifacts.

- [ ] **Step 4: Add integration questions and acceptance gates**

Provide concrete questions for the company technical team: Feishu app type and identity field, user/department mapping, authoritative database and ownership, network path to the model service, production secret management, logging/retention, and UAT owner. Keep the current acceptance commands and the known live-AI blocker visible.

### Task 3: Remove the concrete model endpoint from the example configuration

**Files:**
- Modify: `.env.example`

**Interfaces:**
- Consumes: the existing `OPENAI_BASE_URL` variable contract used by the runtime.
- Produces: a safe generic endpoint example that still teaches the required OpenAI-compatible path without exposing the company host or custom port.

- [ ] **Step 1: Replace the company-specific URL**

Change only the example value to `https://api.example.com/v1`; keep the variable name and comments aligned with the real runtime requirement.

- [ ] **Step 2: Re-run the tracked-file public-release scan**

Verify that tracked files contain no typical secret formats and that the concrete model-service host/port no longer appears in the working tree. Separately report that product-specific training content still requires company authorization before public visibility.

### Task 4: Verify, publish the branch, and stop at the visibility decision boundary

**Files:**
- Verify: `README.md`, `docs/AGENT-HANDOFF.md`, `.env.example`, and the full repository checks.

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: a pushed Conventional Commit on the current branch and an evidence-backed visibility recommendation.

- [ ] **Step 1: Run the full quality gate**

Run `pnpm check`; record the exit status and any existing failure. Run `pnpm test:e2e` separately if the full check does not include it.

- [ ] **Step 2: Inspect the final scope**

Run `git status --short --branch`, `git diff --check`, and `git diff --stat`; confirm only the three intended documentation/configuration files plus this plan are present, and do not stage unrelated files.

- [ ] **Step 3: Commit and push**

Use a Conventional Commit such as `docs: prepare engineering handoff`, then run `git push -u origin $(git branch --show-current)` and confirm the remote branch is updated.

- [ ] **Step 4: Verify GitHub visibility and report the blocker**

Re-read repository metadata through the GitHub connector. Because the repository currently contains company-specific product and internal-process training content, do not call `gh repo edit --visibility public` unless the user/company explicitly confirms that this content is approved for unrestricted public release or the content has been replaced with public-safe fixtures. Report the exact current visibility and the next safe action.
