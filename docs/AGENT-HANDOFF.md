# AI 客服训练：工程交接说明

最后更新：2026-08-03

这份文档面向接手项目的公司产品、前端、后端、数据和运维同事。它说明当前代码已经做到什么、如何在本地复现、哪些位置适合替换，以及接入真实公司流程前必须确认的问题。

## 1. 先给结论

当前项目可以作为内部演示和试用型 Web MVP 交接：

- 学员端、管理端、角色保护、专题练习、正式知识小测、情景实战、历史记录和复盘报告已经形成闭环。
- 当前代码包含 5 个专题共 350 道日常练习题、40 道可追溯正式题、8 个固定情景，以及 Mock 和 real 两种情景 Provider。
- 数据库模式使用 Neon PostgreSQL + Drizzle；当前线上部署为 Vercel + Neon。
- 当前登录是 Auth.js Credentials，仅用于 MVP 开发和试用，不应直接作为公司正式身份体系。
- 线上真实 AI 仍未完成闭环验收：Vercel 函数访问当前外部模型入口会超时。本地调用成功不能证明生产网络可达。
- 飞书 SSO、企业用户/部门映射、公司数据服务和正式模型网关尚未接入，需要由公司技术团队确定方案。

更完整的验收证据和未完成项见 [MVP 验收矩阵](MVP-ACCEPTANCE.md)；部署、环境变量和回滚见 [部署与运维说明](DEPLOYMENT.md)。

## 2. 当前功能边界

### 已实现

| 模块 | 当前实现 | 主要入口 |
| --- | --- | --- |
| 学员训练 | 专题练习、正式小测、情景对话、刷新恢复、历史和报告 | `src/app/practice/` |
| 管理端 | 题目、场景、训练记录、复核和分配相关页面 | `src/app/admin/` |
| 认证与权限 | Credentials 登录、管理员/学员角色、受保护路由和越权拦截 | `src/auth.ts`、`src/lib/auth/` |
| 知识编译 | Markdown、Excel、MM 适配器；规范化、版本、来源和冲突门禁 | `src/lib/knowledge/` |
| 题库 | 350 道专题练习；40 道带知识版本和来源定位的正式题 | `src/lib/quiz/` |
| 情景 AI | Mock 确定性演示；OpenAI 兼容 real Provider；上下文、风险和评分 | `src/lib/scenario/` |
| 持久化 | Neon 数据库、Drizzle schema、迁移和 Repository | `src/db/`、`drizzle/` |

### 尚未完成

1. 飞书 SSO 和企业用户映射。
2. 公司正式数据库或数据服务的归属、租户和数据保留方案。
3. 从 Vercel 区域可达的模型入口、模型额度和线上真实 AI 3 轮验收。
4. 正式企业运维体系：域名、CI/CD、密钥托管、监控、告警、审计和备份责任。
5. 正式考试、防作弊、认证成绩和复杂学习门户。这些明确不属于当前 MVP。

## 3. 本地启动

### 3.1 环境要求

- Node.js 24.x
- pnpm 10.33
- 需要数据库模式时，准备 Neon PostgreSQL 或兼容的 PostgreSQL 连接串
- 需要 real AI 时，准备公司批准的 OpenAI 兼容模型入口；不要把入口、密钥或账号写入代码

### 3.2 最小本地演示

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

在 `.env.local` 中启用非生产本地 Demo 回退，并为两个测试角色设置本机密码：

```text
LOCAL_TEST_AUTH_ENABLED=true
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=<local-only-password>
SEED_LEARNER_EMAIL=learner@example.test
SEED_LEARNER_PASSWORD=<local-only-password>
```

当 `NODE_ENV` 不是 production、`LOCAL_TEST_AUTH_ENABLED=true` 且没有 `DATABASE_URL` 时，运行时进入 `local_demo`：登录、演示情景和本地练习记录使用本地实现。生产环境或配置了 `DATABASE_URL` 时，这个回退会自动停用。

### 3.3 Neon 数据库模式

在 `.env.local` 配置 `DATABASE_URL`、至少 32 位的 `AUTH_SECRET` 和种子账号密码，然后按以下顺序执行：

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

知识发布命令依赖本地原始知识源目录。原始知识库、会议记录和生成产物不进入 Git；接手者应通过公司批准的存储或传输渠道取得它们，并在本机配置路径或文件位置，不要把源文件复制进仓库。

### 3.4 质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
pnpm test:e2e
```

一次执行静态检查、类型检查、单元测试、数据库检查和生产构建：

```bash
pnpm check
```

线上真实 AI 冒烟是有外部成本和网络前提的手工验收，不要加入每次提交的普通 CI：

```bash
pnpm test:e2e:live
```

## 4. 运行时与代码地图

### 4.1 组合根

`src/lib/runtime/services.ts` 是主要的运行时组合位置，负责根据运行模式组装：

```text
Next.js 页面 / Server Action
        ↓
训练服务与 Store contract
        ↓
Mock 或 real Provider / Local 或 Neon Repository
        ↓
本地 artifacts 或 PostgreSQL / 外部模型服务
```

`src/lib/runtime/mode.ts` 只区分 `local_demo` 和 `production`。页面层不应该自己判断数据库、模型或认证实现；新增企业接入时优先在 contract、Provider、Repository 或组合根替换。

### 4.2 认证

- `src/auth.ts` 负责 Auth.js 配置、会话回调和角色声明。
- `src/lib/auth/credentials.ts` 负责当前邮箱/密码登录。
- `src/lib/auth/` 下的 session claims、local test accounts 和相关测试定义了现有角色边界。
- 管理员和学员路由都在服务端做权限判断，不能只依赖前端隐藏按钮。

飞书 SSO 接入时，需要保留现有应用角色模型，但把“身份认证”和“企业用户映射”分开设计。不要直接用 email 作为永久主键；应由公司确认使用 `open_id`、`union_id`、员工号还是企业统一身份平台 subject，并定义离职、转岗、重名和账号合并策略。

### 4.3 知识与题库

- `src/lib/knowledge/`：读取 Markdown、Excel、MM，归一化为知识单元，生成版本、来源定位和冲突报告。
- `src/lib/quiz/question-bank.ts`：当前专题练习题内容。
- `src/lib/quiz/publisher.ts` 与 `scripts/quiz.ts`：构建和发布题库。
- `scripts/publish-knowledge-to-db.ts`、`scripts/publish-quiz-to-db.ts`：将通过门禁的不可变版本发布到 Neon。

企业化时应先确定知识的权威来源、版本责任人、冲突处理人和发布审批人，再决定接入企业知识引擎。当前 MVP 不包含开放式 RAG、知识上传后台或多模态处理。

### 4.4 情景训练与 AI

- `src/lib/scenario/templates.ts`：8 个固定情景及其角色、难度、风险规则和评分维度。
- `src/lib/scenario/training-service.ts`：管理会话、上下文、轮次、结束和报告。
- `src/lib/scenario/mock-providers.ts`：确定性演示和自动化测试。
- `src/lib/scenario/ai-providers.ts`、`ai-client.ts`：OpenAI 兼容 real Provider 和 AI Gateway 配置。
- `src/lib/scenario/session-store.ts`：情景会话存储契约。

real 模式要求模型入口能从运行环境直接访问，并且上游支持项目使用的 OpenAI 兼容接口。当前生产真实 AI 的阻塞点是 Vercel 函数到外部模型入口的网络可达性，不是本机 Provider 测试或 Vercel Web 页面托管。

### 4.5 数据库

- `src/db/schema.ts`：Drizzle schema，是当前数据库结构的代码来源。
- `drizzle/`：迁移文件，不要手工删除已应用迁移。
- `src/db/repositories/`：训练目录、题目、尝试、复核、场景会话和报告等 Repository。
- `src/db/production-verification.ts`、`scripts/verify-production-data.ts`：生产数据完整性检查。

如果公司要求迁移到已有数据库或数据中台，应先做表级映射和数据责任确认，再替换 Repository；不要让页面直接依赖某个公司数据库表名。

## 5. 环境变量和敏感资料

以 `.env.example` 为变量清单，真实值只放在未跟踪的 `.env.local` 或公司批准的部署密钥系统中。

| 变量 | 用途 | 规则 |
| --- | --- | --- |
| `DATABASE_URL` | Neon/PostgreSQL | 生产必填，不进 Git |
| `AUTH_SECRET` | Auth.js 会话签名 | 生产至少 32 位随机值，不复用测试值 |
| `LOCAL_TEST_AUTH_ENABLED` | 本地登录回退 | 只能用于非生产、无数据库场景 |
| `SEED_*` | 测试账号种子 | 密码只在本机或密钥托管中设置 |
| `SCENARIO_AI_MODE` | `mock` 或 `real` | 本地默认 `mock` |
| `OPENAI_API_KEY` | real 模式模型密钥 | 不进入 Git，不写日志 |
| `OPENAI_BASE_URL` | OpenAI 兼容入口 | 必须是运行区域可达的公司批准地址 |
| `OPENAI_MODEL` | real 模式模型名 | 由模型服务负责人确认 |
| `AI_GATEWAY_ENABLED` | 是否走 Vercel AI Gateway | 使用前确认额度、账单和 OIDC 配置 |

公开仓库前必须再次检查 Git 历史和当前跟踪文件；`.env.example` 只能使用示例邮箱、空密码和通用服务地址。即使没有密钥，产品配方、内部流程、客服口径和真实客户资料也可能属于公司受限内容。

## 6. 接入公司流程前的问题清单

### 身份与权限

- 飞书接入使用自建应用、企业统一身份平台，还是公司已有 SSO 网关？
- 回调域名、环境隔离、应用负责人和所需最小权限是什么？
- 用户主键使用 `open_id`、`union_id`、员工号还是 subject？历史 Credentials 账号如何迁移？
- 部门、岗位、管理员和培训范围如何映射？离职、转岗、兼职和多部门用户如何处理？
- 是否需要限制为公司租户、指定部门或指定培训项目？

### 数据库与知识

- 训练账号、题库、知识版本、会话和报告的权威数据源由谁负责？
- 公司是否提供 PostgreSQL、数据服务 API 或统一数据平台？连接方式、网络区域、读写权限和备份责任是什么？
- 训练记录、对话内容和 AI 报告保存多久？是否包含个人信息、订单信息或敏感业务信息？
- 知识负责人、审核人、发布人和运营负责人分别是谁？知识版本如何审批和回滚？
- 公司原始知识库是否允许进入开发环境、测试环境和 GitHub 仓库？

### AI 与网络

- 公司批准的模型供应商、模型名、配额、成本归属和限流策略是什么？
- Vercel 或公司部署区域如何访问模型服务？是否提供公网 HTTPS 443、专用网络或公司模型代理？
- 是否允许保存提示词、对话、评分和错误日志？敏感字段如何脱敏？
- 模型超时、降级到 Mock、人工复核和失败重试由谁负责？
- 真实 AI 上线验收是否至少包含 3 轮上下文对话、刷新恢复、报告生成、异常提示和成本观测？

### 工程与运维

- 生产部署继续使用 Vercel，还是迁移到公司云账号、容器平台或内网环境？
- 代码仓库使用公司 GitHub 组织、GitLab 还是其他平台？谁负责分支保护、Review 和发布？
- CI 需要运行哪些门禁？线上 AI 冒烟如何单独授权，避免每次提交产生模型费用？
- 域名、TLS、密钥托管、监控、告警、备份、审计和应急联系人分别由谁负责？
- UAT 的业务负责人、测试账号、正式内容版本和验收签字口径是什么？

## 7. 验收口径

当前应把两个结论分开：

| 交付口径 | 必须满足 | 当前状态 |
| --- | --- | --- |
| Web MVP 演示/试用 | 页面、权限、题库、Mock 情景、历史和报告可用；数据库初始化可重复 | 已具备，交接前重跑 `pnpm check` 和 `pnpm test:e2e` |
| 完整 AI 生产交付 | 真实 AI 3 轮对话、刷新恢复、AI 报告、生产数据检查和网络/成本/日志方案 | 尚未完成，当前被模型入口可达性阻塞 |

建议交接时保留以下证据：

```bash
pnpm check
pnpm test:e2e
pnpm production:verify:data
pnpm production:verify:data --formal
```

只有在模型网络前提清除后才运行：

```bash
pnpm test:e2e:live
```

不要把 `Ready` 部署状态、Mock E2E 通过或本机模型请求成功，单独解释为线上真实 AI 已验收。

## 8. GitHub 公开化决策

当前仓库虽然没有提交密码、密钥、原始知识库和生成产物，但代码中的题库和情景包含公司专属产品名称、产品指标、客服话术及内部流程示例。把仓库设为 Public 会让这些内容对互联网上的任何人可见，并可能被复制、索引和长期保留。

在公司明确授权前，推荐顺序是：

1. 保持当前仓库 Private，通过 GitHub collaborator、公司组织或内部镜像给技术人员访问。
2. 若必须 Public，先建立公开安全的 Demo 内容集，替换真实品牌、产品指标、内部流程和知识来源，再对 Git 历史做完整清理。
3. 如果公司确认现有内容可以公开，补充许可证、贡献规范、漏洞报告方式和公开仓库的维护负责人后，再执行可见性切换。

公开化不是代码功能验收的一部分；它是知识产权、数据合规和工程治理决策。技术人员需要查阅代码，并不自动等于仓库应当对全网公开。
