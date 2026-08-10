# 模拟对话与报告生成解耦 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 解耦最后一轮顾客回复和报告评测，并在对话页显示阶段式报告生成进度。

**Architecture:** 训练服务只负责保存顾客回复；现有报告 SSE 负责阶段事件和评测持久化。客户端维护对话、报告生成、成功和失败状态，并通过 URL 标记提前结束以支持刷新恢复。

**Tech Stack:** Next.js server actions/API routes, React 19 client components, TypeScript, Vitest, Playwright。

## Global Constraints

- 不新增数据库实体或依赖。
- 进度条表达阶段，不显示虚假的精确剩余百分比。
- 报告失败保留对话并手动重试。
- 完成代码后执行 `git status`、Conventional Commit 和 `git push`。

## Tasks

1. 为 `ScenarioTrainingService` 增加最后一轮不评测的失败测试，移除 `sendMessage()` 的隐式 `complete()`，验证 active 会话仍保存完整消息。
2. 为 `completeStream()` 和报告 SSE 增加阶段/落库顺序测试，定义 `analyzing | scoring | saving` 事件并将最终 report/session 事件放到持久化之后。
3. 增加对话页报告进度组件与状态机，支持自然结束、`finishing=1` 提前结束、成功 CTA、错误重试和刷新恢复。
4. 更新组件与 E2E 测试，运行单测、类型检查、lint、场景冒烟和完整 `pnpm check`。
5. 检查改动范围，提交并推送。
