# AI 客服训练

面向宠物食品客服新人的 Web 培训应用。MVP 将提供知识小测与文字情景实战，
帮助新人先学习固定知识，再在不接触真实顾客的情况下练习接待。

## 当前进度

项目按 [Roadmap](docs/ROADMAP.md) 分 Part 交付。当前代码已完成现代化学员端与
管理端、5 个专题共 350 道练习题、真实 AI 情景对话与评分链路、Auth.js 角色登录、
Neon 持久化和 Vercel 部署。40 道可追溯题已改为通过知识版本、来源和冲突校验后自动
发布，人工复核保留为可选质量工具。Vercel 免费版足够承载 Web MVP；线上真实 AI
仍需配置一个可用的模型服务，当前 Vercel AI Gateway 账户返回 403 时不影响网页托管，
但会阻塞真实对话。飞书身份和企业知识引擎属于后续企业化迭代。

当前验收结论和剩余交付条件见
[MVP 验收矩阵](docs/MVP-ACCEPTANCE.md)；Vercel + Neon 初始化与运维见
[部署与运维说明](docs/DEPLOYMENT.md)。

## 本地运行

要求 Node.js 24，并使用 pnpm 10.33。

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:check
pnpm build
pnpm test:e2e
```

也可以一次运行全部质量门禁：

```bash
pnpm check
```

## 数据库与测试账号

复制 `.env.example` 为不进入 Git 的 `.env.local`，填写 Neon 连接串、
`AUTH_SECRET` 以及管理员和学员的测试密码，然后运行：

```bash
pnpm db:migrate
pnpm db:seed
```

迁移采用代码优先方式保存在 `drizzle/`。预置账号不开放注册，真实密码不会写入
仓库。当前Credentials登录仅用于MVP开发和试用；后续接入飞书账号时替换认证
Provider与用户映射层，不引入Supabase，现有角色和训练数据模型继续复用。

Neon尚未配置时，可以在不进入Git的 `.env.local` 中显式设置
`LOCAL_TEST_AUTH_ENABLED=true`，并填写 `SEED_ADMIN_*` 与
`SEED_LEARNER_*`。该回退只在非生产环境且没有 `DATABASE_URL` 时生效；生产环境
或数据库已配置时会自动停用。

## 知识编译

真实知识源保留在本地 `TOC售前客服知识库` 文件夹中。检查源文件覆盖情况：

```bash
pnpm knowledge:check
```

门禁通过后，可生成不进入 Git 的不可变本地知识包和覆盖报告：

```bash
pnpm knowledge:publish
```

Neon迁移和账号种子完成后，可以把同一知识版本以事务方式发布到数据库：

```bash
pnpm knowledge:publish:db
```

## 小测草稿

知识包发布后，可从有效、无冲突且适合出题的知识单元生成40道本地小测草稿：

```bash
pnpm quiz:build
pnpm quiz:publish:db
```

该命令默认生成20道单选题和20道判断题，绑定知识版本、知识单元和来源定位。产物
保存在不进入Git的 `artifacts/quiz`，状态固定为 `draft`。`quiz:publish:db` 只接受
恰好40题、当前活动知识版本中无冲突且允许出题的知识单元，并在数据库中幂等创建草稿
后自动发布不可变正式题组；管理员可以从 `/admin/questions` 进行可选的逐题编辑与复核。
学员端发布后每组从正式题库选取10题，并平衡单选题和判断题。

除此之外，学员端提供 5 个专题共 350 道
练习题；每次专题练习抽取 10 题，题库充足时固定为 5 道单选题、5 道判断题，并
按简单 4 题、中等 4 题、困难 2 题分配。专题练习用于日常训练，不替代 40 道
可追溯正式题。当前即时判题属于学习反馈，不作为防作弊考试或认证成绩；未来若用于
正式考核，需要增加服务端一次性题单、单次作答状态和防重放。

正式小测完成后，服务端会基于发布题库重新判分，并按当前账号保存结果。学员可在
`/practice/history` 查看自己的练习记录；本地测试记录保存在不进入Git的
`artifacts/quiz`，后续可在不改变页面接口的前提下替换为企业正式存储。

## AI 情景实战

学员可从 `/practice/scenario` 进入8个固定场景，覆盖售前、物流、破损少货和客诉。
生产环境通过 OpenAI 兼容接口使用真实 `ConversationProvider` 与
`EvaluationProvider`，支持连续文字对话、完整上下文、刷新恢复、最大 12 轮、
五维 AI 评分、关键风险判定和原场景重练。Provider 会拒绝空回复，并对机械复述
上一条顾客消息做一次受控重试。确定性 Mock 仅用于显式本地回退和自动化测试。

在不提交密钥的 `.env.local` 中配置以下变量即可启用真实 AI：

```bash
SCENARIO_AI_MODE=real
OPENAI_API_KEY=...
OPENAI_BASE_URL=...
OPENAI_MODEL=...
```

当前 Vercel Production 显式启用 Vercel AI Gateway，并通过运行时自动注入的短期
OIDC 身份调用同厂商 `bytedance/seed-1.8`。本地仍可使用公司 OpenAI 兼容网关。
Vercel 免费 Web 托管与模型调用是两件事：Gateway 路由必须通过
`AI_GATEWAY_ENABLED=true` 主动开启且项目账户有可用账单；如果要维持 Vercel 免费版，
可关闭 Gateway，改配一个外部 OpenAI 兼容接口。两种方式都不把密钥提交到仓库。

数据库迁移、账号种子和知识版本发布完成后，可将8个固定场景及其完整来源、评分
维度和风险规则幂等发布到数据库：

```bash
pnpm scenario:publish:db
```

发布器要求每个来源定位都能命中当前活动知识版本，且对应知识不得存在冲突或被
禁止用于场景；相同场景版本键如果出现不同内容会拒绝覆盖。

## 生产初始化与验收

空数据库按以下顺序初始化；所有发布命令均可安全重复执行：

```bash
pnpm db:migrate
pnpm db:seed
pnpm knowledge:publish:db
pnpm quiz:publish:db
pnpm scenario:publish:db
pnpm production:verify:data
```

默认验收要求一个活动知识版本、40道题、1个已发布正式题组、8个已发布场景、启用中
的管理员与学员账号，且不存在跨知识版本引用。`pnpm quiz:publish:db` 会自动发布正式
题组；`pnpm production:verify:data --formal` 只检查正式题组是否存在及其技术一致性，
人工复核数量作为观测指标，不再阻塞 MVP。

场景页面、会话和报告均按运行时实际模式标识“AI 实战/AI 评分”或“演示模式/
演示评分”，不会再由旧场景模板中的 Mock 标记误判。生产会话写入 Neon；显式本地
Demo 才会使用不进入 Git 的 `artifacts/scenario`。

## 资料边界

原始客服知识库、会议记录、环境变量和本地生成报告均不进入 Git。知识编译器会从
本地源文件生成可审计的规范化知识，再把通过门禁的版本发布到 Neon。
