# AI培训智能客服 Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use test-driven development for production behavior and run verification before every completion claim.

**Goal:** 建设一个可部署到Vercel的宠物食品客服新人训练Web应用，首版包含版本化文字知识、40道知识小测、8个Mock情景实战、学习历史和轻量管理端。

**Architecture:** 使用Next.js App Router全栈TypeScript单体应用和Neon PostgreSQL。真实知识源只在本机离线解析并直接发布到数据库；题目和场景显式绑定知识单元，不使用Webhook、向量库或开放式RAG。真实AI接口暂缓，首版通过Provider接口接入明确标识的Mock实现。

**Tech Stack:** Next.js、TypeScript、Tailwind CSS、Drizzle ORM、Neon PostgreSQL、Auth.js、Zod、ExcelJS、Unified/Remark、fast-xml-parser、Vitest、Testing Library、Playwright、Vercel。

## Global Constraints

- GitHub仓库为 `JzzzX/ai-customer-service-training`，可见性为Private。
- 用户已授权在 `main` 上进行个人项目的主要开发。
- 真实源文件、生成报告、环境变量和密钥不得提交Git。
- 学员界面采用已确认的简洁A方案，不加入XP、排行榜、签到和重度游戏化。
- MVP只支持单选题、判断题和文字对话。
- 首批内容固定为40题和8场景。
- 每个Part完成后更新 `docs/ROADMAP.md`，运行验证并提交。

---

## Part 1：工程与仓库基础

- 落盘产品规格、实施计划和Roadmap。
- 初始化Next.js、pnpm、TypeScript、Tailwind、Vitest、Testing Library、Playwright和质量命令。
- 建立最小可访问首页及其测试。
- 初始化Git `main`，创建私有GitHub仓库，验证后推送。

**完成标准：** `lint`、`typecheck`、单元测试和生产构建通过；Git工作区干净；远端 `main` 与本地一致。

## Part 2：版本化知识编译器

- 为Markdown、Excel和MM建立独立解析适配器。
- 生成稳定的来源定位、规范化知识单元和覆盖报告。
- 实现空答案过滤、重复合并、冲突标记、哈希幂等和发布门禁。
- 提供 `knowledge:check` 与 `knowledge:publish` 两个本地命令。

**完成标准：** 识别6份源文件、9个Excel工作表、996个MM节点和133项跳过图片；重复导入不产生重复数据。

## Part 3：数据库与认证

- 建立用户、知识版本、知识来源、知识单元、题库、作答、场景版本、训练会话、消息、报告和分配表。
- 使用事务发布不可变知识版本并维护唯一活动版本。
- 使用Auth.js凭证登录，预置管理员和学员测试账号，不开放注册。

**完成标准：** 未登录访问被拒绝；学员无法访问管理端；知识版本和训练记录可追溯。

## Part 4：40题知识小测

- 预置40道绑定知识来源的单选和判断题。
- 实现逐题作答、即时解释、80%通过线、错题重练和历史记录。
- 实现管理员题目和题组CRUD。

**完成标准：** 40题均具备答案、解释和来源；得分、错题和重练逻辑通过单元与端到端测试。

## Part 5：8场景Mock实战

- 建立售前、物流、破损少货和客诉各2个场景。
- 定义 `ConversationProvider` 与 `EvaluationProvider`。
- 默认使用确定性Mock Provider完成流式聊天、刷新恢复、模拟评分和报告。
- 所有Mock结果显示“演示模式”，不计入正式AI可信度验收。

**完成标准：** 8个场景均可开始、连续对话、恢复、结束、查看报告和重练。

## Part 6：管理端、测试与部署

- 实现训练分配、场景版本、复核队列、学习记录和只读知识版本页。
- 补齐响应式、键盘操作、空状态、错误状态和权限测试。
- 通过GitHub连接Vercel，并从Vercel Marketplace创建Neon。
- 运行迁移、真实知识导入和生产冒烟测试，发布 `v0.1.0`。

**完成标准：** `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:e2e`、`pnpm build`全部通过，生产环境完成核心路径冒烟测试。

## Deferred：真实AI适配

真实AI不属于 `v0.1.0`。获得模型接口文档、模型名、测试密钥和不少于40条黄金对话后，实现真实Provider，并验证通过/重练一致率不低于85%、关键风险召回率不低于90%。

