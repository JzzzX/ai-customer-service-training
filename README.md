# AI 客服训练

面向宠物食品客服新人的 Web 培训应用：让新人先学习产品与服务知识，再通过 AI/演示情景练习接待，最后由系统生成反馈与复盘记录。

## 当前结论

当前项目已经达到“内部演示 / 试用可用”的 Web MVP 阶段，核心训练闭环已经具备：

| 范围 | 当前状态 | 交接时需要知道的边界 |
| --- | --- | --- |
| 学员训练 | 已完成 | 专题练习、正式知识小测、情景对话、历史与报告 |
| 管理端 | 已完成 | 题目、场景、训练记录和复核入口 |
| 内容与数据 | 技术验收通过 | 5 个专题 350 道练习题；40 道可追溯正式题；8 个固定情景；Neon 持久化 |
| 登录 | MVP 实现 | 当前是 Auth.js Credentials 登录，不是企业 SSO |
| 线上部署 | 已部署 | Vercel + Neon 链路可用；生产初始化命令见 [部署与运维说明](docs/DEPLOYMENT.md) |
| 线上真实 AI | 尚未闭环验收 | Vercel 函数访问外部模型接口仍会超时；不能把 Mock E2E 结果当作真实 AI 生产验收 |
| 企业化接入 | 待沟通 | 飞书 SSO、企业用户映射、公司数据服务和模型网络由后续技术方案确定 |

因此，它适合现在拿给公司技术人员做代码、架构和交接评审；在接入真实公司流程前，还需要完成身份、数据、模型服务和运维边界的确认。

## 技术交接先读什么

| 文档 | 用途 |
| --- | --- |
| [工程交接说明](docs/AGENT-HANDOFF.md) | 如何启动、代码从哪里替换、需要向公司技术团队确认什么 |
| [MVP 验收矩阵](docs/MVP-ACCEPTANCE.md) | 哪些功能已通过自动化验证，哪些验收仍被外部条件阻塞 |
| [部署与运维说明](docs/DEPLOYMENT.md) | Vercel、Neon、环境变量、初始化、线上验收和故障处理 |
| [Roadmap](docs/ROADMAP.md) | 当前范围、下一步优先级和明确不纳入 MVP 的事项 |

## 当前能力

- 学员端：专题练习、正式小测、8 个情景实战、刷新恢复、训练历史和复盘报告。
- 管理端：角色保护、题目与场景管理、训练记录查看和可选人工复核。
- 知识与题库：Markdown、Excel、MM 知识适配器；版本、来源、冲突和跨版本引用校验；5 个专题共 350 道练习题；40 道正式题可通过技术门禁自动发布。
- 情景 AI：Mock 模式用于确定性演示和自动化测试；real 模式使用 OpenAI 兼容接口，支持连续上下文、风险识别和五维评分。
- 数据与部署：开发期可使用本地 Demo 回退；生产要求 Neon；当前部署目标为 Vercel。

## 本地启动

要求 Node.js 24 和 pnpm 10.33。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 <http://localhost:3000>。最快的本地演示方式是在 `.env.local` 中设置：

```text
LOCAL_TEST_AUTH_ENABLED=true
SEED_ADMIN_EMAIL=admin@example.test
SEED_ADMIN_PASSWORD=仅保存在本机的管理员密码
SEED_LEARNER_EMAIL=learner@example.test
SEED_LEARNER_PASSWORD=仅保存在本机的学员密码
```

该回退只在非生产环境且没有 `DATABASE_URL` 时生效。不要把真实密码、数据库连接串、API Key 或 `.env.local` 提交到 Git。

如果需要使用 Neon 数据库模式，先在 `.env.local` 填写 `DATABASE_URL`、长度至少 32 位的 `AUTH_SECRET` 和种子账号密码，然后按以下顺序初始化：

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

知识发布命令需要本地可访问原始知识源；原始客服知识库不进入 Git，交接时应通过公司批准的文件渠道提供。

## 质量检查

常规质量门禁：

```bash
pnpm check
```

它会依次执行 lint、类型检查、单元测试、Drizzle 检查和生产构建。需要单独运行 Mock E2E 时：

```bash
pnpm test:e2e
```

真实 AI 线上冒烟会产生模型调用并依赖 Vercel 到模型服务的网络可达性，不是普通 CI 门禁；只有在模型入口、额度和测试账号准备好后再运行：

```bash
pnpm test:e2e:live
```

## 企业化替换边界

当前实现保留了可替换的服务接口，接入公司流程时优先替换适配器和 Provider，不要从页面层重写训练流程：

| 当前实现 | 后续可能接入 | 主要位置 |
| --- | --- | --- |
| Auth.js Credentials + 角色会话 | 飞书 SSO、用户/部门映射、账号生命周期 | `src/auth.ts`、`src/lib/auth/` |
| 本地 Markdown / Excel / MM 适配器 | 企业知识服务或知识引擎 | `src/lib/knowledge/` |
| Neon + Drizzle Repository | 公司数据库或数据服务 | `src/db/`、`src/lib/runtime/services.ts` |
| Mock / OpenAI 兼容情景 Provider | 公司批准的模型网关、审计和额度管理 | `src/lib/scenario/` |
| Vercel Web 部署 | 公司域名、CI/CD、监控和密钥托管 | `vercel.json`、`docs/DEPLOYMENT.md` |

## AI 情景配置

默认 `SCENARIO_AI_MODE=mock`，适合本地演示和测试。启用真实 AI 时，在不提交的 `.env.local` 中配置：

```text
SCENARIO_AI_MODE=real
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://your-approved-openai-compatible-endpoint.example/v1
OPENAI_MODEL=...
```

当前生产环境使用直连外部 OpenAI 兼容接口；本机请求曾成功，但 Vercel `hkg1` 到现有模型入口的请求超时。完成生产 AI 验收前，需要提供 Vercel 区域可达的公网 HTTPS 443 入口或公司批准的模型代理，并重新完成至少 3 轮对话、刷新恢复和报告生成验证。

## 项目结构

```text
src/app/                  Next.js 页面、路由和 Server Actions
src/components/           学员端、管理端和训练交互组件
src/lib/auth/             登录、角色和会话映射
src/lib/knowledge/        知识编译、来源、版本和发布
src/lib/quiz/             题库、抽题、判分和复核
src/lib/scenario/         情景模板、训练服务、Mock/real Provider
src/lib/training/         分配、目录和训练记录服务
src/db/                   Drizzle schema、迁移与 Neon Repository
scripts/                  数据初始化、知识/题库/场景发布和验收脚本
drizzle/                  数据库迁移文件
docs/                     验收、部署、Roadmap 和技术交接资料
```

## 公开仓库前的资料边界

当前仓库不包含原始知识库、环境文件、密码和生成产物，但代码中仍有公司专属产品名称、产品指标、客服话术和内部流程示例。将仓库设为 GitHub Public 前，必须由公司确认这些内容具备公开发布授权；否则应保持 Private，或先替换为公开安全的 Demo 内容后再建立 Public 镜像。

## 许可证

当前仓库尚未声明开源许可证。即使仓库设为 Public，也不等于自动授予第三方复制、修改或商用权利；公开前请由公司确认许可证和知识产权口径。
